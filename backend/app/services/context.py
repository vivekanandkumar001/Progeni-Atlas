"""
Progeni Atlas - Context Module
Extracted from interview_engine.py for better code organization.

Resolves the grounding context for one interview (job, candidate, skills,
resume text) and caches it for the lifetime of the session.

The cache holds plain snapshots, never live ORM rows: it outlives the
SQLAlchemy session that populated it, and a detached instance would raise
DetachedInstanceError on the next attribute read.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import CandidateResume, CandidateSkill, InterviewSession, Job, Skill, User
from app.services.vector_service import vector_db

logger = logging.getLogger("progeni_atlas.context")

# Per-session cache of the retrieval context. The resume/JD context is static for
# the duration of one interview, so it is resolved once and reused across turns.
# Previously `_candidate_context` ran on every question generation AND every
# evaluation, issuing two embedding requests per turn for identical input.
_CONTEXT_CACHE: dict[str, dict] = {}
_CONTEXT_CACHE_MAX = 256
_CONTEXT_CACHE_TTL_SECONDS = 600


@dataclass(frozen=True)
class _JobContext:
    """Plain snapshot of the job fields the interview needs.

    The cache outlives the SQLAlchemy session of the request that populated it.
    Storing live ORM instances would leave expired/detached objects behind, so
    the next attribute read (e.g. `ctx["job"].title`) raises
    DetachedInstanceError. Snapshotting the values keeps the cache session-free.
    """

    title: str | None
    job_description: str | None
    experience_level: str | None
    rubric_weights: dict


@dataclass(frozen=True)
class _CandidateContext:
    """Plain snapshot of the candidate fields the interview needs (see _JobContext)."""

    full_name: str | None


def _cache_get(session_id: str) -> dict | None:
    item = _CONTEXT_CACHE.get(str(session_id))
    if item is None:
        return None
    created_at = item.get("_cache_created_at") if isinstance(item, dict) else None
    if created_at and time.monotonic() - created_at > _CONTEXT_CACHE_TTL_SECONDS:
        _CONTEXT_CACHE.pop(str(session_id), None)
        return None
    return item


def _cache_put(session_id: str, value: dict) -> None:
    if len(_CONTEXT_CACHE) >= _CONTEXT_CACHE_MAX:
        for stale in list(_CONTEXT_CACHE)[: _CONTEXT_CACHE_MAX // 2]:
            _CONTEXT_CACHE.pop(stale, None)
    value = dict(value)
    value["_cache_created_at"] = time.monotonic()
    _CONTEXT_CACHE[str(session_id)] = value


def clear_session_context(session_id) -> None:
    """Drop a cached context (call after the resume or job changes)."""
    _CONTEXT_CACHE.pop(str(session_id), None)


def clear_candidate_context(candidate_id) -> None:
    """Invalidate all cached sessions belonging to a candidate.

    Used when a resume/skills identity changes. This deliberately invalidates
    by inspecting cached candidate IDs rather than retaining another PII index.
    """
    for key, value in list(_CONTEXT_CACHE.items()):
        if str(value.get("candidate_id")) == str(candidate_id):
            _CONTEXT_CACHE.pop(key, None)


def _candidate_context(db: Session, session: InterviewSession, use_cache: bool = True) -> dict:
    """Resolve the real grounding context for one interview.

    Returns job, candidate, skills, resume_text and a `context_warnings` list.

    Fixes applied here:
      * The retrieval query is derived from the ACTUAL job description when a
        job is attached, and from the candidate's own indexed resume skills
        otherwise. It previously fell back to the constant string
        "technical skills projects engineering experience" whenever job_id was
        NULL (always, in practice), so every embedding call in the platform used
        the same vector.
      * Retrieval failures are reported instead of being swallowed. The old
        `if not self._client: return []` path made an unindexed or unreachable
        Qdrant indistinguishable from "the resume simply had nothing relevant",
        so the interviewer appeared personalised while running on no resume at
        all.
    """
    if use_cache:
        cached = _cache_get(session.id)
        if cached is not None:
            return cached

    warnings: list[str] = []

    job: Job | None = db.get(Job, session.job_id) if session.job_id else None
    candidate: User | None = db.get(User, session.candidate_id)

    skills = [
        name
        for (name,) in db.execute(
            select(Skill.name)
            .join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
            .where(CandidateSkill.candidate_id == session.candidate_id)
            .order_by(Skill.name)
        ).all()
    ]
    # Status must be PARSED: the resume upload handler now performs extraction and
    # sets it. An UPLOADED/FAILED resume is reported rather than silently ignored.
    resume = db.scalar(
        select(CandidateResume)
        .where(
            CandidateResume.candidate_id == session.candidate_id,
            CandidateResume.is_active.is_(True),
        )
        .order_by(CandidateResume.uploaded_at.desc())
    )

    resume_text = ""
    if resume is None:
        warnings.append("no active resume on file for this candidate")
    else:
        resume_status = resume.status.value if hasattr(resume.status, "value") else str(resume.status)
        if resume_status != "PARSED":
            warnings.append(f"active resume is in state {resume_status!r}; text extraction has not completed")
            if resume.parse_error:
                warnings.append(f"resume parse error: {str(resume.parse_error)[:200]}")
        elif not (resume.parsed_text or "").strip():
            warnings.append("active resume is marked PARSED but contains no extractable text "
                            "(it may be a scanned image PDF)")
        else:
            resume_text = resume.parsed_text
            # Candidate skills are persisted canonically. If enrichment is not
            # available yet, derive skills from the parsed resume text so the
            # interview context remains grounded in real candidate data.
            # No mock or invented skills are introduced.
            if not skills:
                try:
                    from app.services.resume_parser import derive_skills

                    derived = derive_skills(resume_text) or []
                    seen_lower = set()
                    for s in derived:
                        if isinstance(s, str) and s.lower() not in seen_lower:
                            seen_lower.add(s.lower())
                            skills.append(s)
                    skills.sort(key=str.lower)
                    skills = skills[:40]
                except Exception as exc:
                    warnings.append(f"skill extraction unavailable ({type(exc).__name__})")

    # Build the retrieval query from real data.
    if job and job.job_description:
        search_query = job.job_description
    elif skills:
        search_query = ", ".join(skills)
    elif resume_text:
        search_query = resume_text[:500]
    else:
        search_query = "technical skills projects engineering experience"
        warnings.append("no job description or resume text available to ground retrieval")

    if session.candidate_id:
        try:
            chunks = vector_db.search_resume_context(
                session.candidate_id, search_query[:500], limit=3
            )
        except Exception as exc:
            # An unreachable or unindexed Qdrant must be reported, not hidden.
            chunks = []
            warnings.append(f"resume retrieval unavailable ({type(exc).__name__})")
        if chunks:
            semantic_block = "\n--- Targeted Resume Semantic Chunks ---\n" + "\n---\n".join(chunks)
            resume_text = (resume_text + "\n\n" + semantic_block).strip()

    result = {
        "candidate_id": str(session.candidate_id),
        # Snapshot the ORM rows while they are still attached to this session.
        # Caching the instances themselves leaks detached objects into later
        # requests (DetachedInstanceError on the next attribute read).
        "job": _JobContext(
            title=job.title,
            job_description=job.job_description,
            experience_level=job.experience_level,
            rubric_weights=dict(job.rubric_weights or {}),
        ) if job is not None else None,
        "candidate": _CandidateContext(full_name=candidate.full_name)
        if candidate is not None else None,
        "skills": skills,
        "resume_text": resume_text,
        "context_warnings": warnings,
    }
    _cache_put(session.id, result)
    return result
