"""
Progeni Atlas - Scorecard Service Module
Extracted from interview_engine.py for better code organization.

Builds the final scorecard for a completed interview: transcript, per-turn
evaluations, proctoring evidence, the server-authoritative score and the
persisted scorecard with its competency rows.

Nothing here fabricates a score. The final number is derived from the
independently stored per-turn evaluations and the approved rubric weights.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    CompetencyScore,
    InterviewQuestion,
    InterviewResponse,
    InterviewSession,
    NotificationType,
    ProctoringEvent,
    Recommendation,
    RubricVersion,
    Scorecard,
)
from app.services import llm_service, notifications
from app.services.context import _candidate_context
from app.services.evaluation_service import (
    RubricError,
    build_scorecard_from_evaluations,
)
from app.services.lifecycle import lifecycle_state

logger = logging.getLogger("talentpulse.scorecard_service")

__all__ = ["build_scorecard"]


def _approved_rubric(db: Session, session: InterviewSession):
    """Resolve the rubric this session is scored against.

    A session may pin a rubric version. When it does, that exact version is
    used - scoring a pinned session against a different rubric version would
    silently change the result. Otherwise the latest version for the job is
    used, and only an approved version contributes weights.
    """
    pinned_id = (session.config or {}).get("rubric_version_id")
    if pinned_id:
        try:
            rubric = db.get(RubricVersion, uuid.UUID(str(pinned_id)))
        except (ValueError, TypeError):
            rubric = None
        if rubric is None:
            raise ValueError(
                "Pinned interview rubric is unavailable; refusing to rescore against a different version."
            )
        return rubric

    if not session.job_id:
        return None

    from app.services.rubric_service import get_latest_rubric

    return get_latest_rubric(db, session.job_id)


def build_scorecard(db: Session, session: InterviewSession) -> Scorecard:
    """Build and persist the scorecard for a completed interview."""
    # The lifecycle state is authoritative; the legacy `status` column lags
    # behind it (FINAL_SCORING still maps to IN_PROGRESS), so gate on the
    # lifecycle state exactly as `finalize` does before calling this.
    if lifecycle_state(session) not in ("INTERVIEW_COMPLETING", "FINAL_SCORING", "REPORT_GENERATED"):
        raise ValueError("Session must be completed before a scorecard is generated")

    ctx = _candidate_context(db, session)
    rows = db.execute(
        select(InterviewQuestion, InterviewResponse)
        .outerjoin(
            InterviewResponse,
            (InterviewResponse.question_id == InterviewQuestion.id)
            & (InterviewResponse.session_id == InterviewQuestion.session_id),
        )
        .where(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.turn_index)
    ).all()
    transcript = [
        {"question": q.prompt_text, "answer": r.answer_text if r else ""} for q, r in rows
    ]
    evaluations = [
        {
            "turn": r.turn_index,
            "stage": (q.stage.value if hasattr(q.stage, "value") else str(q.stage)) if q else "technical",
            "relevance": r.relevance_score,
            "depth": r.depth_score,
            "correctness": r.correctness_score,
            "notes": r.evaluator_notes,
            "missing": list(r.missing_concepts or []),
            "red_flags": list(r.red_flags or []),
            "competency": next(
                (str(c).split(":", 1)[1] for c in (q.expected_concepts or [])
                 if str(c).startswith("__competency__:")),
                None,
            ) if q else None,
        }
        for q, r in rows
        if r is not None
    ]

    counts = db.execute(
        select(ProctoringEvent.event_type, ProctoringEvent.severity, func.count())
        .where(ProctoringEvent.session_id == session.id)
        .group_by(ProctoringEvent.event_type, ProctoringEvent.severity)
    ).all()
    event_counts: dict[str, int] = {}
    warning_count = 0
    for event_type, severity, count in counts:
        event_name = event_type.value if hasattr(event_type, "value") else str(event_type)
        event_counts[event_name] = event_counts.get(event_name, 0) + int(count)
        severity_name = severity.value if hasattr(severity, "value") else str(severity)
        if severity_name in {"warning", "critical"}:
            warning_count += int(count)
    threshold = int((session.config or {}).get("proctoring_warning_threshold", 5))
    proctoring_summary = {
        "event_counts": event_counts,
        "warning_count": warning_count,
        "threshold": threshold,
        "flagged": bool((session.config or {}).get("proctoring_flagged")) or warning_count >= threshold,
    }

    scorecard_config = {
        k: v for k, v in (session.config or {}).items()
        if k not in {"resume_text", "candidate_name", "candidate_email", "phone"}
    }
    generated = llm_service.generate_scorecard(
        job_title=ctx["job"].title if ctx["job"] else None,
        candidate_name=ctx["candidate"].full_name if ctx["candidate"] else "Candidate",
        config=scorecard_config,
        transcript=transcript,
        evaluations=evaluations,
        proctoring_summary=proctoring_summary,
    )

    rubric = _approved_rubric(db, session)
    rubric_status = getattr(getattr(rubric, "status", None), "value", None)
    rubric_weights = dict(rubric.weights or {}) if rubric and rubric_status == "approved" else dict(
        (ctx["job"].rubric_weights if ctx["job"] else {}) or {}
    )
    rubric_competencies = list(rubric.competencies or []) if rubric and rubric_status == "approved" else []
    if not rubric_competencies:
        rubric_competencies = [
            {"name": name, "label": name, "weight": weight}
            for name, weight in rubric_weights.items()
        ]
    try:
        final_score, final_recommendation, authoritative_competencies = build_scorecard_from_evaluations(
            weights=rubric_weights,
            competencies=rubric_competencies,
            llm_competencies=generated.competencies,
            evaluations=evaluations,
        )
    except RubricError:
        # Fall back to computing a score from per-turn evaluations when the
        # auto-generated rubric has no usable weights or no assessed competencies.
        # Evaluation relevance/depth/correctness are on a 0-10 scale; convert to 0-100.
        numeric = []
        for ev in evaluations or []:
            for v in (ev.get("relevance"), ev.get("depth"), ev.get("correctness")):
                if v is not None and str(v).strip() != "":
                    try:
                        numeric.append(max(0.0, min(10.0, float(v))) * 10.0)
                    except (ValueError, TypeError):
                        pass
        if numeric:
            overall = round(sum(numeric) / len(numeric), 2)
            if overall >= 85:
                recommendation = "STRONG_HIRE"
            elif overall >= 75:
                recommendation = "HIRE"
            elif overall >= 65:
                recommendation = "LEAN_HIRE"
            else:
                recommendation = "REJECT"
            authoritative_competencies = []
            final_score = overall
            final_recommendation = recommendation
        else:
            final_score = 0.0
            final_recommendation = "REJECT"
            authoritative_competencies = []

    # Integrity is part of the hiring decision, not merely telemetry. A flagged
    # session may not receive an automatic HIRE/STRONG_HIRE recommendation. The
    # numeric score remains evidence-based, while the recommendation is capped to
    # LEAN_HIRE for recruiter review.
    if proctoring_summary.get("flagged") and final_recommendation in {"STRONG_HIRE", "HIRE"}:
        final_recommendation = "LEAN_HIRE"
        generated.concerns = list(generated.concerns or []) + [
            "Interview integrity threshold was reached; recruiter review is required before hiring."
        ]

    existing = db.scalar(select(Scorecard).where(Scorecard.session_id == session.id))
    if existing is not None:
        for comp in list(existing.competencies):
            db.delete(comp)
        db.flush()
        scorecard = existing
    else:
        scorecard = Scorecard(session_id=session.id)
        db.add(scorecard)

    scorecard.overall_score = final_score
    scorecard.recommendation = Recommendation(final_recommendation)
    scorecard.executive_summary = generated.executive_summary
    scorecard.strengths = generated.strengths
    scorecard.concerns = generated.concerns
    scorecard.model_used = generated.model_used
    scorecard.generated_at = datetime.now(timezone.utc)
    # Flush so scorecard.id is populated before competencies reference it.
    db.flush()

    for item in authoritative_competencies:
        db.add(
            CompetencyScore(
                scorecard_id=scorecard.id,
                competency=item["competency"],
                score=item["score"],
                weight=item["weight"],
                evidence=item["evidence"],
            )
        )

    session.total_score = final_score
    session.final_recommendation = Recommendation(final_recommendation)
    db.commit()
    db.refresh(scorecard)

    notifications.push(
        db,
        user_id=session.candidate_id,
        notification_type=NotificationType.SCORECARD_READY,
        title="Your scorecard is ready",
        body=f"Overall score: {final_score}",
        payload={"session_id": str(session.id)},
    )
    if session.recruiter_id:
        notifications.push(
            db,
            user_id=session.recruiter_id,
            notification_type=NotificationType.SCORECARD_READY,
            title="Scorecard generated for a candidate",
            body=f"Session {session.id}",
            payload={"session_id": str(session.id)},
        )
    db.commit()
    return scorecard
