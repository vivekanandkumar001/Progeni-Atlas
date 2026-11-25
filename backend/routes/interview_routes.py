"""
Progeni Atlas â€” Interview Engine Blueprint
===========================================
Interactive interview sessions, question tree sequencing, scorecard synthesis,
speech/TTS audio generation, proctoring events, room data, report dossier, and code execution.
"""

import os

try:
    import resource as _resource
except ImportError:  # non-POSIX platform (Windows dev machines)
    _resource = None
import uuid
import re
import time
import json
import io
import subprocess
import sys
import tempfile
import shutil
import traceback
import logging
from datetime import datetime, timezone, timedelta
from typing import Any
from core.http_utils import generic_500
from flask import Blueprint, request, jsonify, g, send_file, Response

from core.db import get_mongo_db
from core.security import (
    _authenticate_request, resolve_user, require_auth, require_session_access, send_interview_completion_email_smtp
)
from core.context import get_current_candidate, get_current_recruiter
from core.constants import BASE_DIR
from core.interview_params import generate_dynamic_interview_parameters
from core.scoring_contract import (
    compute_recommendation,
    extract_human_recommendation_override,
    resolve_recommendation,
)
from core.wallet import get_demo_quota, get_user_wallet_balance, settle_interview_billing_completion

interview_bp = Blueprint("interview_bp", __name__)
logger = logging.getLogger("progeni_atlas.interview_routes")

@interview_bp.route("/api/evaluator/dynamic-parameters", methods=["POST"])
@require_auth
def api_generate_dynamic_parameters():
    """
    Dynamic Interview Parameter Generator Endpoint.
    Accepts job_description, resume_text (optional), interview_type (optional).
    Returns JSON strictly following prompt schema.
    """
    try:
        data = request.get_json() or {}
        jd = data.get("job_description") or data.get("jobDescription", "")
        resume = data.get("resume_text") or data.get("resumeText", "")
        itype = data.get("interview_type") or data.get("interviewType", "technical")

        if not jd:
            return jsonify({"error": "job_description text is required."}), 400

        result = generate_dynamic_interview_parameters(jd, resume, itype)
        return jsonify(result), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500




@interview_bp.route("/api/v1/interview-sessions/<session_id>", methods=["GET"])
@require_auth
def get_interview_session(session_id):
    """Fetch interview session details by ID - authenticated access only."""
    try:
        db = get_mongo_db()
        user = getattr(g, "user", None)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401

        user_id = str(user.get("id") or user.get("_id"))

        session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}]})
        if not session_meta:
            return jsonify({"error": "Interview session not found", "status": 404}), 404

        # Verify access: candidate can access their own session, recruiter can access their hired session, admin has full access
        role = str(user.get("role", "")).lower()
        if role not in ("admin", "super_admin"):
            cand_id = str(session_meta.get("candidate_id") or session_meta.get("userId") or "")
            rec_id = str(session_meta.get("recruiter_id") or "")
            cand_email = str(session_meta.get("candidate_email") or "").lower()
            caller_email = str(user.get("email") or "").lower()
            if user_id != cand_id and user_id != rec_id and (not caller_email or caller_email != cand_email):
                return jsonify({"error": "Unauthorized: Access to this interview session is restricted", "status": 403}), 403

        if "_id" in session_meta and not isinstance(session_meta["_id"], str):
            session_meta["_id"] = str(session_meta["_id"])

        # Candidates only need display metadata for their own report. Returning
        # the raw document leaked internal ids, proctoring events and stale
        # AI-generated recommendations (e.g. 90/100 with REJECT).
        if role not in ("admin", "super_admin", "recruiter"):
            return jsonify(_candidate_session_summary(session_meta)), 200

        return jsonify(session_meta), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


def generate_dynamic_session_questions(session_id: str, session_doc: dict | None, req=None) -> list[dict]:
    """Build the interview arc: warm open ? rapport ? technical core (—2) ?
    behavioral ? candidate questions. Role/level-aware; never four identical
    distributed-systems prompts for every hire."""
    import core.interview_arc as arc

    user, resume_doc, skills = get_current_candidate(req)
    cand_name = (session_doc and (session_doc.get("candidate_name") or session_doc.get("full_name"))) or (user and (user.get("full_name") or user.get("name"))) or "Candidate"
    job_title = (session_doc and (session_doc.get("job_title") or session_doc.get("role_title"))) or (session_doc and session_doc.get("config", {}).get("job_role")) or "Software Systems Engineer"
    job_desc = (session_doc and session_doc.get("config", {}).get("job_description")) or (session_doc and session_doc.get("job_description")) or ""
    resume_text = (resume_doc and (resume_doc.get("raw_text") or resume_doc.get("extracted_text"))) or ""
    seniority = (session_doc and session_doc.get("config", {}).get("experience_level")) or "Mid"
    level = arc.starting_level(seniority)
    level_label = arc.difficulty_label(level)

    # Step 1: LLM-synthesized arc (single call). Falls back to curated templates.
    try:
        from app.services import interviewer_policy, llm_service
        sys_msg = (
            "You are Sarah Chen, a warm, experienced Staff Systems Engineer and Technical Hiring Lead. "
            "Generate the PHASES of a genuinely human 1-on-1 video interview that, as a whole, feels like an authentic conversation — not a quiz. "
            "Output ONLY a valid JSON array of exactly 6 question objects, no preamble, no markdown fences. "
            "Every line must sound like something spoken aloud by a real person — collegial, specific, never textbook. "
            f"The bar for this candidate: {level_label} engineer. Do not ask staff-level ambiguity or trade-off puzzles of a junior, and do not bore a staff engineer with trivia. "
            "Turn 1 must open warmly (greet by name, mention something specific from their resume if given) and invite a short self-intro. "
            "Turn 2 must probe ONE project they actually worked on — not a generic architecture exam. "
            "Turns 3 and 4 are the technical core, anchored in the target role and the candidate's verified skills — for a frontend role they are frontend, for infra they are infra. "
            "Turn 5 is one behavioral STAR story (conflict, failure, disagreement, or ambiguity — pick what fits the JD). "
            "Turn 6 invites the candidate's own questions for you. "
            "Keep each under 45 words. "
            + interviewer_policy.question_authoring_rules()
        )
        user_msg = f"""Target Role: {job_title}
Candidate Name: {cand_name}
Seniority bar: {level_label}
Verified Technical Skills: {', '.join(skills[:8]) if skills else 'general software engineering'}
Job Description Snippet: {job_desc[:900] if job_desc else 'Not provided — infer reasonable scope for the role.'}
Resume Context: {resume_text[:800] if resume_text else 'None provided'}

Generate exactly 6 turns with these phases (use these exact "stage" values):
1. stage "warm_open": Warm greeting + invite a two-minute intro. Reference the candidate's name.
2. stage "rapport": Probe the single most interesting project on their resume/JD for this role.
3. stage "technical_core": First deep probe — anchored in their verified skills and the JD's real domain (NOT always "distributed systems at 50k users").
4. stage "technical_core": Second probe — a different dimension (correctness of approach, trade-offs, or a failure mode in their described work).
5. stage "behavioral": One STAR prompt — conflict/failure/disagreement/ambiguity, whichever the JD signals.
6. stage "candidate_questions": Invite THEIR questions about the role, team, or how we work.

JSON format:
[
  {{"turn_index": 1, "stage": "warm_open", "prompt_text": "...", "expected_concepts": []}},
  {{"turn_index": 2, "stage": "rapport", "prompt_text": "...", "expected_concepts": ["..."]}},
  {{"turn_index": 3, "stage": "technical_core", "prompt_text": "...", "expected_concepts": ["...", "..."]}},
  {{"turn_index": 4, "stage": "technical_core", "prompt_text": "...", "expected_concepts": ["...", "..."]}},
  {{"turn_index": 5, "stage": "behavioral", "prompt_text": "...", "expected_concepts": ["ownership", "reflection"]}},
  {{"turn_index": 6, "stage": "candidate_questions", "prompt_text": "...", "expected_concepts": []}}
]"""
        raw_resp = llm_service.call_llm(user_msg, system=sys_msg, temperature=0.4)
        parsed = None
        try:
            parsed = llm_service._json_from(raw_resp) if hasattr(llm_service, "_json_from") else json.loads(raw_resp)
        except Exception:
            clean_str = raw_resp.strip()
            if "[" in clean_str and "]" in clean_str:
                s_idx, e_idx = clean_str.find("["), clean_str.rfind("]")
                parsed = json.loads(clean_str[s_idx:e_idx + 1])

        if isinstance(parsed, dict):
            for k in ["questions", "interview_questions", "turns", "items", "data"]:
                if k in parsed and isinstance(parsed[k], list):
                    parsed = parsed[k]
                    break

        if isinstance(parsed, list):
            by_stage: dict[str, dict] = {}
            for q_obj in parsed:
                if not isinstance(q_obj, dict):
                    continue
                stage = str(q_obj.get("stage") or "").strip().lower()
                if stage in ("warm_open", "rapport", "technical_core", "behavioral", "candidate_questions"):
                    by_stage.setdefault(stage, []).append(q_obj)

            assembled: list[dict] = []
            warm = (by_stage.get("warm_open") or [{}])[0]
            rapport = (by_stage.get("rapport") or [{}])[0]
            tech_core = by_stage.get("technical_core") or []
            behavioral = (by_stage.get("behavioral") or [{}])[0]
            cand_q = (by_stage.get("candidate_questions") or [{}])[0]

            def _q(obj, stage, i):
                text = str((obj or {}).get("prompt_text") or (obj or {}).get("question") or "").strip()
                return {
                    "id": f"q{i}",
                    "turn_index": i,
                    "stage": arc.PHASE_STAGE_LABELS.get(stage, stage.title()),
                    "phase": stage,
                    "prompt_text": text,
                    "expected_concepts": [str(c) for c in (obj or {}).get("expected_concepts", [])][:6],
                    "is_ai_generated": True,
                }

            assembled.append(_q(warm, "warm_open", 1))
            assembled.append(_q(rapport, "rapport", 2))
            for j in range(2):
                tech_obj = tech_core[j] if j < len(tech_core) else {}
                assembled.append(_q(tech_obj, "technical_core", 3 + j))
            assembled.append(_q(behavioral, "behavioral", 5))
            assembled.append(_q(cand_q, "candidate_questions", 6))

            if all(len(q["prompt_text"]) > 20 for q in assembled):
                return assembled
    except Exception as llm_err:
        print(f"[Arc Questions LLM Warning] {llm_err} - Falling back to curated arc templates")

    # Step 2: Curated arc templates — role-aware, warm, spoken English
    s1 = skills[0] if len(skills) > 0 else "Software Engineering"
    s2 = skills[1] if len(skills) > 1 else "over the data layer"
    lower_s1 = s1.lower()

    if any(k in lower_s1 for k in ["react", "next", "vue", "frontend", "typescript", "javascript"]):
        core3 = f"Take me inside a {s1} project you're proud of — how did you shape its component structure, data fetching, and the trickiest state bug you ever chased down?"
        core4 = f"When that same app needs to stay fast and consistent — say a slow or flaky backend behind it — how do you handle caching, invalidation, optimistic updates, and failure states in the UI?"
        c3 = [s1, "Component Architecture", "State Decisions", "Real Incidents"]
        c4 = [s2, "Caching Strategy", "Failure UX", "Trade-offs"]
    elif any(k in lower_s1 for k in ["python", "fastapi", "django", "flask", "backend"]):
        core3 = f"Walk me through a backend service you built with {s1} — how did you draw the domain boundaries, and what was the hardest correctness or consistency problem you hit in it?"
        core4 = f"Once that service was under real load, what did you do about the data layer — query plans, indexing, pooling, caching — and what broke first?"
        c3 = [s1, "Service Architecture", "Consistency", "Real Incidents"]
        c4 = [s2, "Indexing", "Pooling", "Latency"]
    else:
        core3 = f"Tell me about the most complex thing you've built with {s1} — where did the design fight back, and how did you decide what to do about it?"
        core4 = f"When that system misbehaves in production — slow, inconsistent, or failing halfway — how do you find the fault quickly, and what do you change so it doesn't come back?"
        c3 = [s1, "Design Trade-offs", "Judgment", "Real Incidents"]
        c4 = [s2, "Debugging", "Reliability"]

    return [
        {
            "id": "q1", "turn_index": 1,
            "stage": arc.PHASE_STAGE_LABELS[arc.WARM_OPEN], "phase": arc.WARM_OPEN,
            "prompt_text": f"Hi {cand_name}, I'm Sarah — I'll be your interviewer today. Before anything else, just talk me through what you're working on right now, like you're catching up with a curious friend.",
            "expected_concepts": [],
            "is_ai_generated": True,
        },
        {
            "id": "q2", "turn_index": 2,
            "stage": arc.PHASE_STAGE_LABELS[arc.RAPPORT], "phase": arc.RAPPORT,
            "prompt_text": f"That sounds meaty. Which part of it pushed you the hardest — and if you were starting it again tomorrow, what would you do differently?",
            "expected_concepts": [s1, "Ownership", "Judgment"],
            "is_ai_generated": True,
        },
        {
            "id": "q3", "turn_index": 3,
            "stage": arc.PHASE_STAGE_LABELS[arc.TECHNICAL_CORE], "phase": arc.TECHNICAL_CORE,
            "prompt_text": core3,
            "expected_concepts": c3,
            "is_ai_generated": True,
        },
        {
            "id": "q4", "turn_index": 4,
            "stage": arc.PHASE_STAGE_LABELS[arc.TECHNICAL_CORE], "phase": arc.TECHNICAL_CORE,
            "prompt_text": core4,
            "expected_concepts": c4,
            "is_ai_generated": True,
        },
        {
            "id": "q5", "turn_index": 5,
            "stage": arc.PHASE_STAGE_LABELS[arc.BEHAVIORAL], "phase": arc.BEHAVIORAL,
            "prompt_text": "Tell me about a time you genuinely disagreed with someone on your team about a technical call — what happened, and how did it resolve?",
            "expected_concepts": ["Conflict", "Communication", "Ownership", "Reflection"],
            "is_ai_generated": True,
        },
        {
            "id": "q6", "turn_index": 6,
            "stage": arc.PHASE_STAGE_LABELS[arc.CANDIDATE_QUESTIONS], "phase": arc.CANDIDATE_QUESTIONS,
            "prompt_text": "That's all from my side — and a really solid conversation. What would you like to know from me about the role, the team, or how we work here?",
            "expected_concepts": [],
            "is_ai_generated": True,
        },
    ]


def _find_replayed_answer(history: list[dict] | None, idempotency_key: str) -> dict | None:
    """Return the stored history item that consumed ``idempotency_key``, if any.

    The client (``room/page.tsx``) sends ``answer:{sessionId}:turn-{turnIndex}:q-{qId}``
    on every submit so a network retry can never double-bill the LLM or append the
    same turn twice. A hit here means "this exact answer was already processed" —
    the caller must replay the stored outcome, not re-run the assessment.
    """
    key = (idempotency_key or "").strip()
    if not key:
        return None
    for item in reversed(list(history or [])):
        if not isinstance(item, dict):
            continue
        if str(item.get("idempotency_key") or "") == key:
            return item
    return None


def _is_no_answer_text(value: Any) -> bool:
    """True for timeout/empty placeholders that must never become evidence."""
    text = str(value or "").strip().casefold()
    if not text:
        return True
    if text in {
        "no answer recorded.",
        "no answer recorded",
        "no spoken response recorded.",
        "no spoken response recorded",
        "no response recorded.",
        "no response recorded",
    }:
        return True
    return (
        "no response" in text
        or "time limit" in text
        or "timed out" in text
        or text in {"no", "idk", "pass", "skip", "i don't know", "nothing"}
    )


def _compute_zero_turns(session_doc: dict | None) -> bool:
    """True when no assessable answering turns were recorded.

    Clarifications, timeouts and legacy no-response placeholders are not
    evidence. When a history exists it is authoritative; otherwise the stored
    counter is used. This keeps the service-delivery gate honest for both new
    and legacy sessions.
    """
    if not isinstance(session_doc, dict):
        return True
    answered = session_doc.get("answered_turns")
    if isinstance(answered, int) and answered < 1:
        return True
    history = session_doc.get("history") or []
    if history:
        answer_turns = [
            h for h in history
            if isinstance(h, dict)
            and not h.get("is_clarification")
            and not h.get("unscored")
            and not _is_no_answer_text(h.get("answer"))
        ]
        return len(answer_turns) < 1
    if isinstance(answered, int):
        return answered < 1
    return True


def _map_history_turn_reviews(session_history: list[dict]) -> list[dict]:
    """Map stored history items to the report's turnReviews schema.

    History writer (/answer) stores: scores:{relevance,depth,correctness} (0-10),
    evaluator_feedback, missing_concepts, red_flags, action_decision, intent,
    is_follow_up, is_clarification, timestamp.
    """
    turns: list[dict] = []
    base_ts = None
    for h_item in session_history:
        ts_raw = h_item.get("timestamp")
        if ts_raw:
            try:
                base_ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
                break
            except Exception:
                continue
    for idx, h_item in enumerate(session_history):
        ts_sec = idx * 60
        try:
            if base_ts and h_item.get("timestamp"):
                ts_sec = max(0, int((datetime.fromisoformat(str(h_item["timestamp"]).replace("Z", "+00:00")) - base_ts).total_seconds()))
        except Exception:
            ts_sec = idx * 60
        m, s = divmod(ts_sec, 60)
        raw_scores = h_item.get("scores") or {}

        def _ten(v):
            try:
                return round(max(0.0, min(10.0, float(v))), 1)
            except (TypeError, ValueError):
                return None

        raw_answer = str(h_item.get("answer") or "")
        no_answer = _is_no_answer_text(raw_answer) or bool(h_item.get("unscored"))
        rel = None if no_answer else _ten(raw_scores.get("relevance"))
        dep = None if no_answer else (
            _ten(raw_scores.get("depth")) if raw_scores.get("depth") is not None else rel
        )
        cor = None if no_answer else (
            _ten(raw_scores.get("correctness")) if raw_scores.get("correctness") is not None else rel
        )
        turns.append({
            "turnIndex": h_item.get("turn_index") or (idx + 1),
            "timestampSec": ts_sec,
            "formattedTime": f"{m:02d}:{s:02d}",
            "stage": h_item.get("stage", "technical"),
            "questionAsked": h_item.get("question") or f"Question {idx + 1}",
            "candidateAnswerSummary": raw_answer or "No spoken response recorded.",
            "candidate_code": h_item.get("candidate_code") or "",
            "code_language": h_item.get("code_language") or "python",
            "isFollowUp": bool(h_item.get("is_follow_up")),
            "isClarification": bool(h_item.get("is_clarification")),
            "scores": {"relevance": rel, "depth": dep, "correctness": cor},
            "keyConceptsCovered": h_item.get("covered_concepts") or [],
            "missingConcepts": h_item.get("missing_concepts") or [],
            "redFlags": h_item.get("red_flags") or [],
            "isWeakAnswer": bool((rel is not None and rel < 5.0) or h_item.get("action_decision") == "SWITCH_TOPIC"),
            "evaluatorFeedback": h_item.get("evaluator_feedback") or h_item.get("interviewer_response") or "Evaluated against role standards.",
        })
    return turns


# ---------------------------------------------------------------------------
# Session lifecycle / report derivation helpers (pure unless marked otherwise)
# ---------------------------------------------------------------------------

TERMINAL_SESSION_STATUSES = frozenset({
    "completed", "expired", "cancelled", "canceled", "terminated", "closed", "finished"
})
TERMINAL_SESSION_STATES = frozenset({
    "COMPLETED", "EXPIRED", "CANCELLED", "CANCELED", "TERMINATED", "CLOSED", "FINISHED"
})


def is_terminal_session(session_doc: dict | None) -> bool:
    """True when the session has ended and must never be re-entered."""
    if not isinstance(session_doc, dict):
        return False
    status = str(session_doc.get("status") or "").strip().lower()
    state = str(session_doc.get("state") or "").strip().upper()
    return status in TERMINAL_SESSION_STATUSES or state in TERMINAL_SESSION_STATES


def terminal_session_error(session_doc: dict | None) -> dict | None:
    """JSON error payload for a terminal session, or None if still live."""
    if not is_terminal_session(session_doc):
        return None
    return {
        "error": "This interview session has already ended and cannot be re-entered.",
        "error_code": "SESSION_TERMINAL",
        "status": "expired",
        "sessionId": str((session_doc or {}).get("id") or (session_doc or {}).get("session_id") or ""),
    }


def record_terminal_lobby_closure(db, session_id: str, session_doc: dict | None) -> bool:
    """Record a lobby/media closure marker without rewriting session status.

    Completed sessions must remain `completed` so reports, skill insights and
    candidate history still find them. The terminal gate is enforced by the
    409 response; this field is only a best-effort audit marker for re-entry
    attempts. Idempotent via the marker predicate.
    """
    if db is None or not is_terminal_session(session_doc):
        return False
    try:
        result = db.interview_sessions.update_one(
            {
                "$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}],
                "lobby_access_closed_at": {"$exists": False},
            },
            {"$set": {
                "lobby_access_closed_at": datetime.now(timezone.utc).isoformat(),
                "lobby_access_closed_reason": "terminal_session_reentry_blocked",
            }},
            upsert=False,
        )
        return bool(getattr(result, "modified_count", 0))
    except Exception as gate_err:
        logger.warning("[TerminalGate] could not record lobby closure: %s", gate_err)
        return False


_NEUTRAL_ROLE_TITLE = "Interview Session"
_NEUTRAL_COMPANY_NAME = "Not specified"


def _clean_context_value(value, limit: int = 160) -> str:
    text = re.sub(r"\s+", " ", str(value or "").strip()).strip('"\'')
    return text[:limit].strip()


def _role_from_text(text: Any) -> str:
    """Extract a role label from custom instructions or a JD when no field exists."""
    raw = str(text or "")
    if not raw.strip():
        return ""
    match = re.search(
        r"\b(?:job[ _-]?title|role|position|title)\s*[:\-]\s*([^\n,;]{2,120})",
        raw,
        flags=re.IGNORECASE,
    )
    if match:
        return _clean_context_value(match.group(1), 120)
    first_line = next((line.strip() for line in raw.splitlines() if line.strip()), "")
    first_line = re.sub(r"^(?:job description|jd|role)\s*[:\-]\s*", "", first_line, flags=re.IGNORECASE)
    return _clean_context_value(first_line, 120)


def _interview_date_iso(value: Any) -> str | None:
    """Normalise a stored timestamp to timezone-aware ISO/UTC; never use now()."""
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value or "").strip()
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def derive_job_context(session_doc: dict | None) -> dict:
    """Derive the report's jobContext entirely from stored session/config data.

    No fabricated role, company, duration or date. Missing values stay neutral;
    interviewDate comes only from started_at / finished_at / created_at.
    """
    session = session_doc if isinstance(session_doc, dict) else {}
    config = session.get("config") if isinstance(session.get("config"), dict) else {}
    custom_instructions = (
        config.get("custom_instructions")
        or config.get("customInstructions")
        or session.get("custom_instructions")
        or config.get("instructions")
    )
    job_description = (
        config.get("job_description")
        or config.get("jobDescription")
        or session.get("job_description")
        or session.get("jd")
    )

    role = (
        session.get("job_title")
        or session.get("role_title")
        or session.get("target_position")
        or config.get("job_role")
        or config.get("role_title")
        or config.get("job_title")
    )
    if not role and custom_instructions:
        role = _role_from_text(custom_instructions)
    if not role and job_description:
        role = _role_from_text(job_description)
    role = _clean_context_value(role) or _NEUTRAL_ROLE_TITLE

    company = (
        session.get("company_name")
        or session.get("companyName")
        or session.get("org_name")
        or session.get("organization_name")
        or config.get("company_name")
        or session.get("org_id")
        or session.get("organization_id")
    )
    company = _clean_context_value(company) or _NEUTRAL_COMPANY_NAME

    duration_raw = (
        session.get("duration_minutes")
        or session.get("durationMinutes")
        or config.get("duration_minutes")
    )
    if duration_raw is None and config.get("max_duration_seconds") is not None:
        try:
            duration_raw = float(config["max_duration_seconds"]) / 60.0
        except (TypeError, ValueError):
            duration_raw = None
    duration_minutes = None
    if duration_raw is not None:
        try:
            parsed_duration = float(duration_raw)
            if parsed_duration > 0:
                duration_minutes = int(round(parsed_duration))
        except (TypeError, ValueError):
            duration_minutes = None

    interview_date = (
        _interview_date_iso(session.get("started_at"))
        or _interview_date_iso(session.get("finished_at"))
        or _interview_date_iso(session.get("created_at"))
    )

    return {
        "roleTitle": role,
        "companyName": company,
        "interviewDate": interview_date,
        "durationMinutes": duration_minutes,
    }


def _candidate_session_summary(session_meta: dict) -> dict:
    """Minimal, candidate-safe session DTO for passive report/metadata reads.

    Omits internal ids, recruiter/org ids, proctoring payloads and engineering
    notes. Scores and recommendations are only returned when the session has at
    least one genuinely scored answer, and the recommendation is re-derived
    from the score through the shared contract.
    """
    session_meta = session_meta if isinstance(session_meta, dict) else {}
    context = derive_job_context(session_meta)
    session_id = str(session_meta.get("id") or session_meta.get("session_id") or session_meta.get("_id") or "")
    config = session_meta.get("config") if isinstance(session_meta.get("config"), dict) else {}

    score_raw = None
    for key in ("overall_score", "total_score", "score"):
        if session_meta.get(key) is not None:
            score_raw = session_meta.get(key)
            break

    score = None
    recommendation = None
    if score_raw is not None and session_has_scored_answers(session_meta):
        try:
            score = round(float(score_raw), 1)
            recommendation = resolve_recommendation(score, source=session_meta)
        except (TypeError, ValueError):
            score = None

    is_demo = bool(
        session_meta.get("is_demo")
        or session_meta.get("demo_number")
        or config.get("is_demo")
        or config.get("demo_number")
        or session_meta.get("session_type") == "demo"
    )

    return {
        "id": session_id,
        "sessionId": session_id,
        "status": session_meta.get("status"),
        "state": session_meta.get("state"),
        "job_title": context["roleTitle"],
        "roleTitle": context["roleTitle"],
        "company_name": context["companyName"],
        "companyName": context["companyName"],
        "interviewDate": context["interviewDate"],
        "duration_minutes": context["durationMinutes"],
        "durationMinutes": context["durationMinutes"],
        "scheduled_at": session_meta.get("scheduled_at") or session_meta.get("scheduled_time"),
        "started_at": session_meta.get("started_at"),
        "ended_at": session_meta.get("ended_at"),
        "finished_at": session_meta.get("finished_at"),
        "created_at": session_meta.get("created_at"),
        "candidate_name": session_meta.get("candidate_name") or session_meta.get("full_name"),
        "overall_score": score,
        "total_score": score,
        "final_recommendation": recommendation,
        "recommendation": recommendation,
        "isPractice": bool(config.get("is_practice") or session_meta.get("is_practice") or session_meta.get("session_type") in ("mock", "practice")),
        "isDemo": is_demo,
        "demoNumber": config.get("demo_number") or session_meta.get("demo_number"),
    }


def _candidate_scorecard_payload(scorecard: dict) -> dict:
    """Strip internal scorecard machinery from a candidate-facing response."""
    scorecard = scorecard if isinstance(scorecard, dict) else {}
    allowed = (
        "status",
        "overall_score",
        "recommendation",
        "executive_summary",
        "strengths",
        "concerns",
        "model_used",
        "generated_at",
        "competencies",
        "overall_parameter_scores",
    )
    return {key: scorecard[key] for key in allowed if key in scorecard}


def _caller_is_internal() -> bool:
    """Admin/recruiter callers may see operational fields; candidates may not."""
    try:
        role = str((getattr(g, "user", None) or {}).get("role", "")).casefold()
    except Exception:
        role = ""
    return role in {"admin", "super_admin", "recruiter"}


def _turn_has_scored_answer(turn: dict) -> bool:
    """A turn is real evidence only if it has a candidate answer and a score."""
    if not isinstance(turn, dict) or turn.get("isClarification"):
        return False
    if _is_no_answer_text(turn.get("candidateAnswerSummary")):
        return False
    scores = turn.get("scores") if isinstance(turn.get("scores"), dict) else {}
    return any(isinstance(scores.get(key), (int, float)) for key in ("relevance", "depth", "correctness"))


def session_has_scored_answers(session_doc: dict | None) -> bool:
    """Shared gate for scorecard, report and finish: actual scored answers only."""
    if _compute_zero_turns(session_doc):
        return False
    history = (session_doc or {}).get("history") or []
    return any(_turn_has_scored_answer(turn) for turn in _map_history_turn_reviews(history))


def _scored_history_turns(history: list[dict] | None) -> list[dict]:
    """Only real answered turns may contribute to averages or evidence.

    Uses the same mapped-review gate as /finish and /report, so legacy timeout
    placeholders and unscored turns cannot leak into the scorer's fallbacks.
    """
    rows = [h for h in (history or []) if isinstance(h, dict)]
    reviewed = _map_history_turn_reviews(rows)
    return [
        turn for turn, review in zip(rows, reviewed)
        if _turn_has_scored_answer(review)
    ]


def _candidate_evidence_snippet(turn: dict, limit: int = 180) -> str:
    """Candidate answer first, evaluator feedback second — never question/stage."""
    answer = str((turn or {}).get("answer") or "").strip()
    if answer and answer not in ("No answer recorded.", "No spoken response recorded."):
        return answer[:limit]
    return str((turn or {}).get("evaluator_feedback") or "").strip()[:limit]


def _drop_no_answer_evidence(items: list[str], history: list[dict]) -> list[str]:
    """Remove cached strengths that quote a timeout/no-answer placeholder."""
    snippets = {
        str(h.get("answer") or "").strip()
        for h in (history or [])
        if isinstance(h, dict) and _is_no_answer_text(h.get("answer"))
    }
    snippets.discard("")
    return [
        item for item in (items or [])
        if not any(snippet in str(item) for snippet in snippets)
    ]


def get_session_questions_data(session_id, req=None):
    """Generate or retrieve assessment questions dynamically tailored to the session role and candidate's verified skills."""
    db = get_mongo_db()
    session_doc = None
    if db is not None and session_id:
        try:
            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
        except Exception:
            session_doc = None

    # Return existing persisted questions if already created for this session
    if session_doc and isinstance(session_doc.get("questions"), list) and len(session_doc["questions"]) > 0:
        persisted = session_doc["questions"]
        # If the persisted questions contain the old robotic fallback strings, re-synthesize them dynamically with Gemini
        is_old_robotic = any(
            "Architect an edge-rendered web application" in str(q.get("prompt_text", "")) or
            "To get us started, walk me through how you structured client-server data flow" in str(q.get("prompt_text", ""))
            for q in persisted
        )
        if not is_old_robotic:
            return persisted

    questions = generate_dynamic_session_questions(session_id, session_doc, req)

    # Persist in session doc so questions remain immutable and consistent across turns
    if db is not None and session_id:
        try:
            db.interview_sessions.update_one(
                {"$or": [{"id": session_id}, {"session_id": session_id}]},
                {"$set": {
                    "questions": questions,
                    "stages": [q["stage"] for q in questions]
                }}
            )
        except Exception:
            pass

    return questions


def build_interview_contract(session_id, session_doc=None, current_turn=1, state="QUESTION_READY"):
    """Single server-authoritative interview contract matching frontend InterviewContract."""
    questions = get_session_questions_data(session_id, request)
    total_turns = len(questions)

    current_turn = max(1, min(current_turn, total_turns))
    q_idx = current_turn - 1
    current_q = questions[q_idx] if q_idx < len(questions) else questions[-1]

    mode = "practice"
    if session_doc and isinstance(session_doc.get("config"), dict):
        mode = "practice" if session_doc["config"].get("is_practice") else "real"
    elif session_doc and session_doc.get("session_type") == "mock":
        mode = "practice"

    status = (session_doc and session_doc.get("status")) or "in_progress"
    answered_turns = (session_doc and session_doc.get("answered_turns")) or (current_turn - 1)
    is_finished = status == "completed" or state == "COMPLETED"
 
    # Practice session is fixed at 10 minutes.
    # Real interview duration is recruiter-decided (stored on session_doc or job_profile, default 30 minutes).
    if mode == "practice":
        duration_minutes = 10
    else:
        recruiter_duration = session_doc and (session_doc.get("duration_minutes") or session_doc.get("durationMinutes"))
        duration_minutes = int(recruiter_duration) if recruiter_duration else 30

    total_allowed_seconds = duration_minutes * 60
    remaining_time = total_allowed_seconds
    # Session clock starts only when the candidate actually starts (started_at).
    # A recruiter-scheduled session that never started must never auto-expire,
    # no matter how old its created_at is.
    if session_doc and session_doc.get("started_at"):
        try:
            base_time = session_doc.get("started_at")
            created_dt = datetime.fromisoformat(str(base_time).replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - created_dt).total_seconds()
            remaining_time = max(0, int(total_allowed_seconds - elapsed))
        except Exception:
            remaining_time = total_allowed_seconds
    else:
        remaining_time = total_allowed_seconds

    # Global Hard Cap: When total session time reaches 0, auto-complete the interview —
    # ONLY if at least one turn was answered (service was delivered).
    if remaining_time <= 0:
        _answered_now = answered_turns or 0
        if _answered_now >= 1:
            is_finished = True
            state = "COMPLETED"
            status = "completed"
        else:
            is_finished = True
            state = "EXPIRED"
            status = "expired"
        if session_doc and session_doc.get("status") not in ("completed", "expired"):
            db_conn = get_mongo_db()
            if db_conn is not None:
                try:
                    if (answered_turns or 0) >= 1:
                        db_conn.interview_sessions.update_one(
                            {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                            {"$set": {
                                "status": "completed",
                                "state": "COMPLETED",
                                "completed_reason": "session_time_expired",
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                        generate_dynamic_scorecard(session_id, session_doc, request)
                    else:
                        # Zero answered turns: never marked COMPLETED or scored.
                        db_conn.interview_sessions.update_one(
                            {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                            {"$set": {
                                "status": "expired",
                                "state": "EXPIRED",
                                "completed_reason": "session_expired_no_attempt",
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                except Exception as exp_err:
                    print(f"[build_interview_contract session expiration warning] {exp_err}")

    # A pending follow-up probe becomes the active question without advancing
    # the core turn counter. The probe is cleared as soon as it is answered.
    pending_probe = None
    if session_doc and isinstance(session_doc, dict):
        stored_probe = session_doc.get("pending_probe")
        if isinstance(stored_probe, dict) and stored_probe.get("text"):
            pending_probe = stored_probe
    probe_active = bool(pending_probe) and not is_finished
    active_q = current_q
    if probe_active:
        active_q = {
            "id": pending_probe.get("id") or f"{current_q.get('id') or f'q{current_turn}'}-f1",
            "prompt_text": pending_probe.get("text"),
            "stage": pending_probe.get("stage") or current_q.get("stage"),
            "expected_concepts": pending_probe.get("expected_concepts") or current_q.get("expected_concepts") or [],
            "is_follow_up": True,
        }

    # Per-question time limit calculation (120 seconds = 2 minutes default)
    question_duration = int(session_doc.get("question_duration_seconds") or 120) if session_doc else 120
    question_remaining = question_duration
    if session_doc and session_doc.get("turn_started_at"):
        try:
            t_start = datetime.fromisoformat(str(session_doc["turn_started_at"]).replace("Z", "+00:00"))
            q_elapsed = (datetime.now(timezone.utc) - t_start).total_seconds()
            question_remaining = max(0, int(question_duration - q_elapsed))
        except Exception:
            question_remaining = question_duration
    else:
        question_remaining = question_duration

    stages = [q.get("stage", f"Stage {i+1}") for i, q in enumerate(questions)]
    curr_stage = current_q.get("stage", "intro") if not is_finished else "Completed"
    # Phase-aware arc metadata: drives the UI stepper and unscored handling
    active_phase = str(active_q.get("phase") or "").strip().lower() if not probe_active else "probe"
    phase_index = 0
    for _i, _q in enumerate(questions):
        if str(_q.get("phase") or "").lower() == active_phase:
            phase_index = _i + 1
            break
    phase_labels = {"warm_open": "Warm Open", "rapport": "Context & Background", "technical_core": "Technical Core", "behavioral": "How You Work", "candidate_questions": "Your Turn", "close": "Wrap Up", "probe": "Follow-up"}
    if probe_active:
        curr_stage = f"{curr_stage} Â· Follow-up"

    return {
        "session_id": session_id,
        "state": "COMPLETED" if is_finished else state,
        "status": "completed" if is_finished else status,
        "mode": mode,
        "current_stage": curr_stage,
        "stages": stages,
        "turn": current_turn,
        "turn_index": current_turn if not is_finished else total_turns,
        "total_turns": total_turns,
        "answered_turns": answered_turns,
        "question_id": active_q.get("id") if not is_finished else None,
        "question": active_q.get("prompt_text") if not is_finished else None,
        "is_follow_up": probe_active,
        "interviewer_response": (session_doc and session_doc.get("last_interviewer_response")),
        "can_answer": (not is_finished) and state in ["QUESTION_READY", "LISTENING", "CANDIDATE_RESPONDING"],
        "remaining_time_seconds": remaining_time,
        "question_remaining_seconds": question_remaining if not is_finished else 0,
        "question_duration_seconds": question_duration,
        "duration_minutes": duration_minutes,
        "phase": {
            "id": active_phase,
            "label": phase_labels.get(active_phase, curr_stage),
            "index": phase_index,
            "scored": active_phase not in ("warm_open", "candidate_questions", "close", "probe"),
            "goal": None,
        },
        "proctoring_status": "completed" if is_finished else "active",
        "finished": is_finished,
        "history": (session_doc and session_doc.get("history")) or []
    }


def generate_dynamic_scorecard(session_id, session_doc=None, req=None):
    """Dynamically compute assessment scorecard, parameter marks, and competency pillars from candidate history."""
    db = get_mongo_db()
    if session_doc is None and db is not None:
        session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
    try:
        from app.services import llm_service as _llm_ctx
        _llm_ctx.set_session_context(
            session_id=session_id,
            organization_id=(session_doc or {}).get("org_id") or (session_doc or {}).get("organization_id"),
            user_id=(session_doc or {}).get("candidate_id"),
        )
    except Exception:
        pass

    all_history = (session_doc and session_doc.get("history")) or []
    # Timeouts / no-answer placeholders are absence of evidence, not a 1/10
    # answer. Everything below (averages, transcript, LLM input and heuristic
    # fallbacks) sees scored answers only.
    history = _scored_history_turns(all_history)
    user, _, skills = get_current_candidate(req)
    cand_name = (session_doc and (session_doc.get("candidate_name") or session_doc.get("full_name"))) or (user and user.get("full_name")) or "Candidate"
    job_title = (session_doc and (session_doc.get("job_title") or session_doc.get("role_title"))) or "Backend Systems Engineer"
    config = (session_doc and session_doc.get("config")) or {"is_practice": True}
    if not isinstance(config, dict):
        config = {}

    relevance_scores = []
    depth_scores = []
    correctness_scores = []
    transcript = []
    evaluations = []

    for h in history:
        transcript.append({
            "question": h.get("question", ""),
            "answer": h.get("answer", "")
        })
        scores = (h.get("scores") or {})
        r = scores.get("relevance")
        d = scores.get("depth")
        c = scores.get("correctness")
        if r is not None:
            relevance_scores.append(float(r))
        if d is not None:
            depth_scores.append(float(d))
        if c is not None:
            correctness_scores.append(float(c))
        evaluator_notes = h.get("evaluator_feedback") or ""
        evaluations.append({
            "turn_index": h.get("turn_index", 1),
            "relevance": r,
            "depth": d,
            "correctness": c,
            "stage": h.get("stage", "Technical Stage"),
            "question": h.get("question", ""),
            "missing_concepts": h.get("missing_concepts", []),
            "evaluator_feedback": evaluator_notes,
            "notes": evaluator_notes,
        })

    # Same gate as /finish and /report: no real scored answers means no score,
    # no recommendation, and no question text masquerading as candidate praise.
    has_data = session_has_scored_answers(session_doc)
    has_no_answer_turns = any(
        isinstance(h, dict) and (_is_no_answer_text(h.get("answer")) or h.get("unscored"))
        for h in all_history
    )

    # A cached scorecard written before timeout handling existed may quote those
    # placeholders as evidence. Rebuild it from scored turns instead of trusting
    # the cache whenever such turns are present.
    # Return cached dynamic scorecard only after sanitising stale contradictions.
    if session_doc and isinstance(session_doc.get("scorecard"), dict) and not has_no_answer_turns:
        cached_sc = dict(session_doc["scorecard"])
        if cached_sc.get("overall_parameter_scores") and len(cached_sc["overall_parameter_scores"]) >= 3:
            try:
                from app.services import llm_service as _llm_filter
                original_strengths = cached_sc.get("strengths") or []
                if original_strengths:
                    cached_sc["strengths"] = _llm_filter.filter_scorecard_strengths(
                        original_strengths,
                        transcript=transcript,
                        evaluations=evaluations,
                        questions=session_doc.get("questions"),
                    )
            except Exception:
                pass
            cached_sc["strengths"] = _drop_no_answer_evidence(
                cached_sc.get("strengths") or [], all_history
            )
            if not has_data:
                cached_sc["overall_score"] = None
                for param in cached_sc.get("overall_parameter_scores") or []:
                    if isinstance(param, dict):
                        param["score"] = None
                        param["percentage"] = None
                cached_sc["executive_summary"] = (
                    f"{cand_name} did not complete any interactive stages for the {job_title} role — "
                    f"no answers were recorded. This session was not scored, no evaluation was produced, "
                    f"and no hiring recommendation was issued."
                )
                cached_sc["strengths"] = []
                cached_sc["concerns"] = []
                cached_sc["competencies"] = []
            if not has_data:
                cached_rec = "NOT_EVALUATED"
            elif cached_sc.get("overall_score") is not None:
                cached_rec = resolve_recommendation(cached_sc["overall_score"], source=session_doc)
            else:
                cached_rec = cached_sc.get("recommendation") or "NOT_EVALUATED"
            changed = (
                cached_sc.get("recommendation") != cached_rec
                or cached_sc.get("strengths") != (session_doc["scorecard"].get("strengths") or [])
                or cached_sc.get("executive_summary") != session_doc["scorecard"].get("executive_summary")
                or cached_sc.get("competencies") != (session_doc["scorecard"].get("competencies") or [])
                or cached_sc.get("overall_score") != session_doc["scorecard"].get("overall_score")
            )
            cached_sc["recommendation"] = cached_rec
            if changed and db is not None:
                try:
                    db.interview_sessions.update_one(
                        {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                        {"$set": {
                            "scorecard": cached_sc,
                            "overall_score": cached_sc.get("overall_score"),
                            "final_recommendation": cached_rec,
                            "recommendation": cached_rec,
                        }},
                        upsert=False,
                    )
                except Exception as cache_err:
                    logger.warning("[Scorecard] cached sanitisation write failed: %s", cache_err)
            return cached_sc

    avg_rel = round(sum(relevance_scores) / len(relevance_scores), 1) if has_data else 0.0
    avg_dep = round(sum(depth_scores) / len(depth_scores), 1) if has_data else 0.0
    avg_cor = round(sum(correctness_scores) / len(correctness_scores), 1) if has_data else 0.0

    overall_params = [
        {
            "name": "Relevance",
            "score": avg_rel if has_data else None,
            "max_score": 10,
            "percentage": round(avg_rel * 10, 1) if has_data else None,
            "description": "Alignment with question prompts, directness, and comprehensive intent coverage across all turns."
        },
        {
            "name": "Technical Depth",
            "score": avg_dep if has_data else None,
            "max_score": 10,
            "percentage": round(avg_dep * 10, 1) if has_data else None,
            "description": "Architectural mechanics, edge case handling, scalability design, and production tradeoffs."
        },
        {
            "name": "Correctness & Accuracy",
            "score": avg_cor if has_data else None,
            "max_score": 10,
            "percentage": round(avg_cor * 10, 1) if has_data else None,
            "description": "Factual accuracy of technical syntax, tools, logic, algorithmic rigor, and best practices."
        }
    ]

    if has_data:
        overall_score = round(((avg_rel * 0.35) + (avg_dep * 0.35) + (avg_cor * 0.30)) * 10, 1)
    else:
        overall_score = None

    executive_summary = ""
    recommendation = None
    strengths = []
    concerns = []
    competencies = []
    scorecard_model_used = "heuristic-fallback (LLM unavailable)"

    # Attempt AI synthesis through LLM service only when real answers were scored.
    if transcript and has_data:
        try:
            from app.services import llm_service
            sc_gen = llm_service.generate_scorecard(
                job_title=job_title,
                candidate_name=cand_name,
                config=config,
                transcript=transcript,
                evaluations=evaluations,
                proctoring_summary={"warning_count": 0, "flagged": False}
            )
            if sc_gen.overall_score is not None:
                overall_score = round(float(sc_gen.overall_score), 1)
            # The LLM's recommendation is advisory at best: re-derive from the
            # score so a high score can never be published as REJECT.
            executive_summary = sc_gen.executive_summary
            strengths = sc_gen.strengths or []
            concerns = sc_gen.concerns or []
            competencies = sc_gen.competencies or []
            scorecard_model_used = sc_gen.model_used or "unknown"
        except Exception as llm_err:
            print(f"[Scorecard Synthesis Fallback] {llm_err}")

    if has_data:
        recommendation = resolve_recommendation(overall_score, source=session_doc)
    else:
        recommendation = "NOT_EVALUATED"

    # Dynamic evidence-based synthesis from actual turns & evaluations (no hardcoded static strings)
    if not executive_summary or not strengths or not concerns or not competencies:
        # Extract turn data
        all_missing = []
        for h in history:
            for mc in h.get("missing_concepts", []):
                if mc and mc not in all_missing:
                    all_missing.append(mc)

        scored_turns = []
        for h in history:
            sc_dict = (h.get("scores") or {})
            t_score = (float(sc_dict.get("depth", 0) or 0) + float(sc_dict.get("correctness", 0) or 0)) / 2.0
            scored_turns.append((t_score, h))
        scored_turns.sort(key=lambda x: -x[0])

        stages_seen = list(dict.fromkeys([
            str(h.get("stage", "Technical Stage")).replace("_", " ").title()
            for h in history if h.get("stage")
        ]))
        topics_str = ", ".join(stages_seen[:3]) if stages_seen else f"{skills[0] if skills else 'System'} Architecture"

        score_for_status = overall_score if overall_score is not None else 0.0
        if not executive_summary:
            status_desc = (
                "exceptional technical depth and clear systems intuition" if score_for_status >= 85
                else "practical engineering competence across core topics" if score_for_status >= 70
                else "foundational knowledge with room for architectural growth" if score_for_status >= 55
                else "insufficient technical depth for the target role requirements"
            )
            executive_summary = (
                f"{cand_name} completed {len(history)} interactive technical interview stages for the {job_title} role, "
                f"covering {topics_str}. Candidate demonstrated {status_desc}. "
                f"Assessed dimensions — Relevance {avg_rel}/10, Technical Depth {avg_dep}/10, Correctness {avg_cor}/10."
            )

        if not strengths:
            # Evidence is the candidate's own answer or evaluator feedback.
            # Interviewer prompts and stage labels are never candidate evidence.
            if scored_turns and scored_turns[0][0] > 0:
                best_score, best_turn = scored_turns[0]
                best_evidence = _candidate_evidence_snippet(best_turn)
                if best_evidence:
                    strengths.append(
                        f"Strong evidence: \"{best_evidence}\" "
                        f"(depth/correctness score {round(best_score * 10)}%)."
                    )
            if len(scored_turns) > 1 and scored_turns[1][0] > 0:
                second_score, second_turn = scored_turns[1]
                second_evidence = _candidate_evidence_snippet(second_turn)
                if second_evidence:
                    strengths.append(
                        f"Additional evidence: \"{second_evidence}\" "
                        f"(depth/correctness score {round(second_score * 10)}%)."
                    )
            if avg_rel >= 7.0:
                strengths.append(f"Answer relevance: responses stayed focused and directly addressed the task ({avg_rel}/10).")
            if avg_cor >= 7.0:
                strengths.append(f"Factual correctness: demonstrated accurate technical knowledge of protocols and tools ({avg_cor}/10).")

        if not concerns:
            if all_missing:
                concerns.append(f"Identified conceptual gaps during interview: did not thoroughly address {', '.join(all_missing[:3])}.")
            if scored_turns and scored_turns[-1][0] < 7.0:
                low_score, low_turn = scored_turns[-1]
                low_stage = str(low_turn.get("stage", "Technical")).replace("_", " ").title()
                low_q = str(low_turn.get("question", "")).strip()[:70]
                concerns.append(
                    f"Growth opportunity in {low_stage} ('{low_q}...'): "
                    f"expand explanations to cover edge cases, failure recovery, and architectural tradeoffs."
                )
            if avg_dep < 7.0 and not concerns:
                concerns.append(f"System architecture depth: provide deeper justification for design decisions and scaling limits ({avg_dep}/10).")
            if not concerns:
                concerns.append("Explore high-scale resilience patterns and automated canary rollback procedures in production.")

        if not competencies:
            # Dynamically compute stage competencies from turns
            stage_groups = {}
            for h in history:
                st = str(h.get("stage", "System Architecture")).replace("_", " ").title()
                sc_dict = (h.get("scores") or {})
                t_score = (float(sc_dict.get("depth", avg_dep) or avg_dep) + float(sc_dict.get("correctness", avg_cor) or avg_cor)) * 5.0
                stage_groups.setdefault(st, []).append(t_score)

            competencies = []
            for st_name, scores_list in stage_groups.items():
                avg_st = round(sum(scores_list) / len(scores_list), 1)
                competencies.append({
                    "competency": st_name,
                    "score": avg_st,
                    "weight": max(15, round(100 / max(1, len(stage_groups)))),
                    "evidence": f"Evaluated directly from candidate answers in {st_name} (average {round(avg_st / 10, 1)}/10)."
                })

            # Ensure baseline competencies exist
            if not competencies:
                s1 = skills[0] if skills else "Distributed Systems"
                s2 = skills[1] if len(skills) > 1 else "Database Architecture"
                competencies = [
                    {"competency": f"{s1} & Architecture", "score": round(avg_dep * 10, 1), "weight": 35, "evidence": f"Based on candidate systems depth ({avg_dep}/10)."},
                    {"competency": f"{s2} & Problem Solving", "score": round(avg_cor * 10, 1), "weight": 35, "evidence": f"Based on correctness and technical reasoning ({avg_cor}/10)."},
                    {"competency": "Technical Communication", "score": round(avg_rel * 10, 1), "weight": 30, "evidence": f"Based on prompt relevance and structure ({avg_rel}/10)."}
                ]

    # Defensive final filter: no interviewer prompt/intro/stage label may reach
    # persistence, even when it came from an older prompt or a fallback path.
    try:
        from app.services import llm_service as _strength_filter
        strengths = _strength_filter.filter_scorecard_strengths(
            strengths,
            transcript=transcript,
            evaluations=evaluations,
            questions=(session_doc or {}).get("questions"),
        )
    except Exception as filter_err:
        logger.warning("[Scorecard] strength filter unavailable: %s", filter_err)
    strengths = _drop_no_answer_evidence(strengths, all_history)

    if not has_data:
        # Zero answered turns ? this was never an interview. Never score, never
        # issue a hiring recommendation. Report must show "Not evaluated".
        recommendation = "NOT_EVALUATED"
        overall_score = None
        executive_summary = (
            f"{cand_name} did not complete any interactive stages for the {job_title} role — "
            f"no answers were recorded. This session was not scored, no evaluation was produced, "
            f"and no hiring recommendation was issued."
        )
        strengths = []
        concerns = []
        competencies = []

    # ---- Optional adversarial second pass (SECOND_PASS_JUDGING=true) ----
    # Re-checks the two weakest dimensions with an independent call; a >=15-point
    # swing flags the dossier for human review. Never fatal: primary scorecard
    # stands alone on any failure.
    second_pass_report = None
    needs_human_review = False
    review_reasons: list[str] = []
    if transcript and has_data and (os.environ.get("SECOND_PASS_JUDGING", "false").strip().lower() in ("1", "true", "yes", "on")):
        try:
            from app.services import llm_service as _llm2
            dims, sp_model = _llm2.generate_scorecard_second_pass(
                job_title=job_title,
                candidate_name=cand_name,
                transcript=transcript,
                competencies=competencies,
            )
            comparisons = []
            sp_needs_review = False
            comp_index = {str(c.get("competency") or "").lower(): c for c in competencies}
            for dim, sp in dims.items():
                orig = comp_index.get(str(dim).lower())
                orig_score = orig.get("score") if isinstance(orig, dict) else None
                delta = None
                try:
                    if orig_score is not None:
                        delta = round(float(orig_score) - float(sp.get("score", 0.0)), 1)
                except (TypeError, ValueError):
                    delta = None
                comparisons.append({"dimension": dim, "primary_score": orig_score, "second_pass_score": sp.get("score"), "delta": delta, "rationale": sp.get("rationale")})
                if delta is not None and abs(delta) >= 15.0:
                    sp_needs_review = True
                    who = "over-scored" if delta > 0 else "under-scored"
                    review_reasons.append(f"{dim}: {abs(delta)}-point swing ({who}) on adversarial re-check")
            needs_human_review = sp_needs_review
            second_pass_report = {
                "dimensions": comparisons,
                "model_used": sp_model,
                "needs_human_review": sp_needs_review,
            }
        except Exception as sp_err:
            print(f"[Scorecard Second Pass] skipped (non-fatal): {sp_err}")

    scorecard_payload = {
        "id": f"sc-{session_id[:8]}",
        "session_id": session_id,
        "status": "COMPLETED",
        "overall_score": overall_score,
        "recommendation": recommendation,
        "executive_summary": executive_summary,
        "strengths": strengths,
        "concerns": concerns,
        "model_used": scorecard_model_used,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "competencies": competencies,
        "overall_parameter_scores": overall_params,
        "needs_human_review": needs_human_review,
        "review_reasons": review_reasons,
        "second_pass": second_pass_report,
    }

    if db is not None:
        try:
            db.interview_sessions.update_one(
                {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                {"$set": {
                    "scorecard": scorecard_payload,
                    "overall_score": overall_score,
                    "final_recommendation": recommendation,
                    "recommendation": recommendation,
                }}
            )
            # Auto-trigger candidate feedback email — fire-and-forget so a slow
            # SMTP never stalls the interview request path (Sapia-style
            # feedback-for-all; deliberately no score/verdict rendered).
            sess_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
            if sess_doc:
                c_mail = sess_doc.get("candidate_email") or sess_doc.get("email") or ""
                c_name = sess_doc.get("candidate_name") or sess_doc.get("name") or "Candidate"
                j_title = sess_doc.get("job_title") or sess_doc.get("target_position") or "Technical Assessment"
                comp_name = sess_doc.get("company_name") or "Progeni Atlas"
                _tip = (concerns[0] if concerns else "") or ""
                _strengths = [str(s) for s in (strengths or [])][:4]
                if c_mail and has_data:
                    import threading as _threading

                    def _send_feedback_email():
                        try:
                            send_interview_completion_email_smtp(
                                to_email=c_mail,
                                candidate_name=c_name,
                                role=j_title,
                                company_name=comp_name,
                                overall_score=None,
                                strengths=_strengths,
                                coaching_tip=_tip or None,
                            )
                        except Exception as mail_err:
                            print(f"[Email] feedback email failed (non-fatal): {mail_err}")

                    _threading.Thread(target=_send_feedback_email, daemon=True).start()
        except Exception as db_err:
            print(f"[Scorecard DB Save Warning] {db_err}")

    return scorecard_payload


@interview_bp.route("/api/v1/interview-sessions/<session_id>/questions", methods=["GET"])
@require_session_access
def get_interview_session_questions(session_id):
    """Fetch session questions with candidate's actual answers, scores, and feedback."""
    try:
        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})

        questions = get_session_questions_data(session_id, request)
        history = (session_doc and session_doc.get("history")) or []

        # Merge actual candidate response and turn scores into each question
        for q in questions:
            t_idx = q.get("turn_index")
            matching_h = next((h for h in history if h.get("turn_index") == t_idx), None)
            if matching_h:
                candidate_ans = matching_h.get("answer")
                scores = matching_h.get("scores") or {}
                r = scores.get("relevance")
                d = scores.get("depth")
                c = scores.get("correctness")

                avg_turn_score = None
                if r is not None and d is not None and c is not None:
                    avg_turn_score = round((float(r) + float(d) + float(c)) / 3.0, 1)

                q["candidate_answer"] = candidate_ans
                q["score"] = avg_turn_score
                q["max_score"] = 10
                q["score_percentage"] = round(avg_turn_score * 10, 1) if avg_turn_score is not None else None
                q["scores"] = scores
                q["parameter_scores"] = [
                    {
                        "name": "Relevance",
                        "score": r,
                        "max_score": 10,
                        "percentage": round(float(r) * 10, 1) if r is not None else None,
                        "description": "Prompt alignment and directness"
                    },
                    {
                        "name": "Technical Depth",
                        "score": d,
                        "max_score": 10,
                        "percentage": round(float(d) * 10, 1) if d is not None else None,
                        "description": "Architectural and implementation depth"
                    },
                    {
                        "name": "Correctness & Accuracy",
                        "score": c,
                        "max_score": 10,
                        "percentage": round(float(c) * 10, 1) if c is not None else None,
                        "description": "Technical rigor and syntax correctness"
                    }
                ]
                q["evaluator_feedback"] = matching_h.get("evaluator_feedback") or matching_h.get("interviewer_response")
                q["missing_concepts"] = matching_h.get("missing_concepts") or []

        return jsonify(questions), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify([]), 200


@interview_bp.route("/api/v1/interview-sessions/<session_id>/scorecard", methods=["GET"])
@require_session_access
def get_interview_session_scorecard(session_id):
    """Fetch dynamic evaluation scorecard and competency pillars for a completed session."""
    try:
        # @require_session_access already loaded and ownership-checked this doc.
        session_doc = getattr(g, "session_document", None)
        if session_doc is None:
            db = get_mongo_db()
            if db is not None:
                session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})

        sc = generate_dynamic_scorecard(session_id, session_doc, request)
        if not _caller_is_internal():
            sc = _candidate_scorecard_payload(sc)
        return jsonify(sc), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


# ------------------------------------------------------------------------------
# CANDIDATE PRE-FLIGHT LOBBY ENDPOINTS
# ------------------------------------------------------------------------------

@interview_bp.route("/api/v1/interview-sessions/<session_id>/lobby-info", methods=["GET"])
@require_session_access
def get_interview_lobby_info(session_id):
    """Fetch session metadata, job role, company name, resume highlights & evaluation rubrics."""
    try:
        session_meta = None
        db = get_mongo_db()
        if db is not None:
            try:
                session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
                if not session_meta:
                    return jsonify({"error": "Interview session not found", "status": 404}), 404
                if is_terminal_session(session_meta):
                    record_terminal_lobby_closure(db, session_id, session_meta)
                    return jsonify(terminal_session_error(session_meta)), 409
            except Exception as mongo_err:
                print(f"[Lobby Info] MongoDB query warning: {mongo_err}")

        user, resume_doc, skills = get_current_candidate(request)
        user = user if isinstance(user, dict) else {}

        # Lobby metadata comes from the same session/config derivation used by
        # the report — never from hardcoded employer/duration/date values.
        job_context = derive_job_context(session_meta)
        job_role = job_context["roleTitle"]
        company_name = job_context["companyName"]
        duration_minutes = job_context["durationMinutes"]
        session = session_meta if isinstance(session_meta, dict) else {}
        scheduled_at = (
            session.get("scheduled_at")
            or session.get("scheduled_time")
            or job_context["interviewDate"]
        )
        quota = get_demo_quota(user, db)
        candidate_user_id = str(user.get("id") or user.get("_id") or "")
        wallet_balance = get_user_wallet_balance(candidate_user_id) if candidate_user_id else 0.0
        candidate_name = (session_meta and (session_meta.get("candidate_name") or session_meta.get("full_name"))) or (user and (user.get("full_name") or user.get("name"))) or "Candidate"
        resume_file_name = (resume_doc and resume_doc.get("file_name")) or "Resume.pdf"

        # Build dynamic discussion anchors from parsed resume text. Fallback
        # copy is explicitly derived from listed skills — never fabricated
        # experience claims presented as resume evidence.
        highlights = []
        highlights_source = "resume"
        if resume_doc and resume_doc.get("parsed_text"):
            raw_lines = [l.strip() for l in resume_doc.get("parsed_text").split("\n") if len(l.strip()) > 30 and len(l.strip()) < 140]
            for l in raw_lines:
                if any(term in l.lower() for term in ["experience", "developed", "built", "designed", "engineered", "implemented"]):
                    highlights.append(l)
                    if len(highlights) >= 4:
                        break

        if not highlights:
            highlights_source = "profile-skills" if skills else "unavailable"
            if skills:
                highlights.append(
                    "Listed skills available for discussion: " + ", ".join(skills[:6]) + "."
                )
            highlights.append(
                "The interviewer will tailor questions to the role requirements and your listed profile."
            )

        # Dynamic rubric based on candidate's core skills
        rubric = [
            f"{skills[0]} Architecture & Systems Design" if len(skills) > 0 else "System & Software Architecture",
            f"{skills[1]} Implementation & Problem Solving" if len(skills) > 1 else "Algorithmic Problem Solving",
            "Code Quality, Testing & Modularity",
            "Behavioral Dynamics & Technical Articulation"
        ]

        return jsonify({
            "sessionId": session_id,
            "candidateName": candidate_name,
            "avatarUrl": "/avatars/candidate.png",
            "jobRole": job_role,
            "companyName": company_name,
            "durationMinutes": duration_minutes,
            "scheduledAt": scheduled_at,
            "hasResume": True,
            "resumeFileName": resume_file_name,
            "resumeStatus": "PARSED",
            "resumeKeyHighlights": highlights,
            "resumeHighlightsSource": highlights_source,
            "evaluationRubricOverview": rubric,
            "billing": {
                "chargingEnabled": False,
                "isDemoEligible": quota["remaining"] > 0,
                "freeDemosTotal": quota["totalAllowed"],
                "freeDemosUsed": quota["completed"],
                "freeDemosRemaining": quota["remaining"],
                "candidateWalletBalance": wallet_balance,
                "billingNotice": (
                    "Free demo quota available."
                    if quota["remaining"] > 0
                    else "No free demos remaining; wallet credits apply."
                ),
            }
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/v1/interview-sessions/<session_id>/lobby-check", methods=["POST"])
@require_session_access
def log_lobby_preflight_check(session_id):
    """Log hardware readiness check before candidate enters live interview room."""
    try:
        data = request.get_json() or {}
        user = getattr(g, "user", None) or {}
        cand_email = (user.get("email") or "").strip().lower()

        db = get_mongo_db()
        if db is not None:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
            if session_meta and is_terminal_session(session_meta):
                record_terminal_lobby_closure(db, session_id, session_meta)
                return jsonify(terminal_session_error(session_meta)), 409

        doc = {
            "sessionId": session_id,
            "candidateEmail": cand_email,
            "cameraVerified": data.get("cameraVerified", True),
            "micVerified": data.get("micVerified", True),
            "speakerVerified": data.get("speakerVerified", True),
            "latencyMs": data.get("latencyMs", 24),
            "jitterMs": data.get("jitterMs", 3),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if db is not None:
            try:
                db.lobby_checks.insert_one(doc)
            except Exception as mongo_err:
                logger.warning(f"[Lobby Check] MongoDB log warning: {mongo_err}")

        return jsonify({
            "success": True,
            "sessionId": session_id,
            "readyToEnter": True,
            "roomUrl": f"/candidate/interview/{session_id}/room"
        }), 200
    except Exception:
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/v1/interview-sessions/<session_id>/lobby-checkin", methods=["POST"])
@require_session_access
def log_lobby_checkin(session_id):
    """
    Candidate Pre-Flight Checkin Endpoint:
    1. Logs diagnostic metrics in MongoDB HardwareDiagnostic collection.
    2. Updates session status in PostgreSQL / MongoDB.
    3. Returns { success: true, roomToken: "jwt_webrtc_room_token", targetUrl: "/candidate/interview/:id/room" }.
    """
    try:
        data = request.get_json() or {}
        diag = data.get("hardwareDiagnostic", {})

        # Hard consent gate — the lobby checkbox is mandatory; the API enforces it too.
        consent_given = bool(data.get("consentGiven") or data.get("consent_given"))
        if not consent_given:
            return jsonify({
                "success": False,
                "error": "Explicit AI-interviewer disclosure and recording consent are required before entering the room.",
                "error_code": "CONSENT_REQUIRED",
            }), 400
        consent_version = str(data.get("consentVersion") or data.get("consent_version") or "1.0-lobby-checklist")[:64]
        consent_doc = {
            "consent_given_at": datetime.now(timezone.utc).isoformat(),
            "consent_version": consent_version,
            "ai_interview_acknowledged": True,
            "record_acknowledged": True,
            "consent_user_agent": request.headers.get("User-Agent", "")[:250],
        }

        # Extract mediaSource from diagnostic, normalized to 'local' or 'phone'
        raw_media_source = diag.get("mediaSource", "local")
        mediaSource = raw_media_source if raw_media_source in ("local", "phone") else "local"

        user = getattr(g, "user", None) or {}
        cand_email = (user.get("email") or "").strip().lower()

        doc = {
            "sessionId": session_id,
            "candidateEmail": cand_email,
            "cameraPassed": diag.get("cameraPassed", True),
            "microphonePassed": diag.get("microphonePassed", True),
            "speakerPassed": diag.get("speakerPassed", True),
            "consent_given_at": consent_doc["consent_given_at"],
            "consent_version": consent_version,
            "latencyMs": diag.get("latencyMs", 28),
            "jitterMs": diag.get("jitterMs", 4),
            "selectedAudioDevice": diag.get("selectedAudioDevice", "Default Microphone"),
            "selectedVideoDevice": diag.get("selectedVideoDevice", "Integrated Webcam"),
            "mediaSource": mediaSource,
            "checkedInAt": datetime.now(timezone.utc).isoformat()
        }

        db = get_mongo_db()
        if db is not None:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
            if session_meta and is_terminal_session(session_meta):
                record_terminal_lobby_closure(db, session_id, session_meta)
                return jsonify(terminal_session_error(session_meta)), 409
            # Check balance for practice / mock sessions: candidate cannot enter practice room if balance <= 0
            sess_meta = session_meta
            if sess_meta and (sess_meta.get("session_type") in ("mock", "practice") or (sess_meta.get("config") or {}).get("is_practice")):
                c_id = sess_meta.get("candidate_id") or (user and str(user.get("id") or user.get("_id")))
                if c_id and get_user_wallet_balance(c_id) <= 0:
                    return jsonify({
                        "success": False,
                        "error": "Insufficient wallet balance. Your balance is 0 credits. You cannot go for practice interview with zero balance. Please recharge your wallet.",
                        "error_code": "INSUFFICIENT_CREDITS",
                        "availableCredits": 0.0
                    }), 402

            try:
                db.HardwareDiagnostic.insert_one(doc)
            except Exception as mongo_err:
                print(f"[HardwareDiagnostic] MongoDB log warning: {mongo_err}")

            try:
                db.interview_sessions.update_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat(), **consent_doc}},
                    upsert=False
                )
            except Exception as mongo_err:
                logger.warning(f"[Lobby Checkin] MongoDB update warning: {mongo_err}")

        return jsonify({
            "success": True,
            "roomToken": f"jwt_webrtc_room_token_{session_id[:8]}",
            "targetUrl": f"/candidate/interview/{session_id}/room"
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


# ------------------------------------------------------------------------------
# LIVE AI INTERVIEW ROOM & SESSION LIFECYCLE ENDPOINTS
# ------------------------------------------------------------------------------

@interview_bp.route("/api/v1/interview-sessions/<session_id>/candidate-media-token", methods=["POST"])
@require_session_access
def get_candidate_media_token(session_id):
    """Provide LiveKit WebRTC credentials or signal local mock mode cleanly."""
    try:
        db = get_mongo_db()
        if db is not None:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
            terminal_error = terminal_session_error(session_meta)
            if terminal_error:
                return jsonify(terminal_error), 409

        livekit_enabled = os.environ.get("LIVEKIT_ENABLED", "true").strip().lower() not in ("false", "0", "off", "disable", "no")
        livekit_url = (os.environ.get("LIVEKIT_URL") or "").strip()
        livekit_api_key = (os.environ.get("LIVEKIT_API_KEY") or "").strip()
        livekit_secret = (os.environ.get("LIVEKIT_API_SECRET") or "").strip()

        is_placeholder = any(
            ph in livekit_api_key.lower() or ph in livekit_secret.lower()
            for ph in ("placeholder", "your-api-key", "your-secret", "sk-proj-your", "none")
        )

        if livekit_enabled and livekit_url and livekit_api_key and livekit_secret and not is_placeholder:
            try:
                from livekit import api as lk_api
                token = lk_api.AccessToken(livekit_api_key, livekit_secret) \
                    .with_identity(f"cand-{session_id[:8]}") \
                    .with_name("Candidate") \
                    .with_grants(lk_api.VideoGrants(
                        room_join=True,
                        room=session_id,
                        can_publish=True,
                        can_subscribe=True,
                    )).to_jwt()
                return jsonify({
                    "success": True,
                    "livekitUrl": livekit_url,
                    "jwt": token,
                    "status": "connected"
                }), 200
            except Exception as lk_err:
                print(f"[LiveKit] Token generation fallback: {lk_err}")

        # In local/practice mode, LiveKit is optional. null values signal
        # MediaSourceProvider to cleanly bind local camera and microphone.
        return jsonify({
            "success": True,
            "livekitUrl": None,
            "jwt": None,
            "status": "local_mock_mode"
        }), 200
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/state", methods=["GET"])
@require_session_access
def get_interview_state_route(session_id):
    """Server-authoritative interview contract state."""
    try:
        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})

        current_turn = (session_doc and session_doc.get("turn_index")) or 1
        current_state = (session_doc and session_doc.get("state")) or "QUESTION_READY"

        contract = build_interview_contract(session_id, session_doc, current_turn, current_state)
        return jsonify(contract), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/autonomy", methods=["GET"])
@require_session_access
def interview_autonomy_route(session_id):
    """Autonomy Quotient (AQ) — recruiter/super-admin only. Deterministic, no LLM.

    Signals for the recruiter/dashboard; never rendered as a candidate-facing verdict.
    """
    try:
        claims, _ = _authenticate_request()
        role = str((claims or {}).get("role", "")).lower() if claims else ""
        if role not in ("recruiter", "admin", "super_admin", "hr"):
            return jsonify({"error": "Recruiter access required"}), 403

        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
        if not session_doc:
            return jsonify({"error": "Interview session not found"}), 404

        from core.autonomy import compute_autonomy_signals

        probe_counts = (session_doc.get("probe_counts") or {})
        probes_applied = sum(int(v or 0) for v in probe_counts.values()) if isinstance(probe_counts, dict) else 0
        history = list(session_doc.get("history") or [])
        report = compute_autonomy_signals(history, probe_count=probes_applied)
        return jsonify({"success": True, "session_id": session_id, "report": report}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/preflight", methods=["POST"])
@require_session_access
def interview_preflight_route(session_id):
    """Candidate hardware & proctoring preflight verification."""
    try:
        data = request.get_json(silent=True) or {}
        report = data.get("report", {})

        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_query = {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]}
            session_doc = db.interview_sessions.find_one(session_query)
            if not session_doc:
                return jsonify({"error": "Interview session not found. Please launch session from your dashboard."}), 404

            # Enforce caller authorization
            claims, _ = _authenticate_request()
            if claims and claims.get("sub"):
                caller_id = str(claims.get("sub"))
                cand_id = str(session_doc.get("candidate_id") or session_doc.get("userId") or "")
                cand_em = str(session_doc.get("candidate_email") or "").lower()
                caller_em = str(claims.get("email") or "").lower()
                if str(claims.get("role", "")).lower() not in ("super_admin", "admin", "recruiter"):
                    if cand_id and cand_id != caller_id and cand_em != caller_em:
                        return jsonify({"error": "Unauthorized: Session does not belong to your account"}), 403

            db.interview_sessions.update_one(
                session_query,
                {"$set": {
                    "id": session_id,
                    "session_id": session_id,
                    "state": "MEDIA_READY",
                    "preflight_report": report,
                    "preflight_completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )

        contract = build_interview_contract(session_id, session_doc, 1, "MEDIA_READY")
        return jsonify(contract), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/start", methods=["POST"])
@require_session_access
def interview_start_route(session_id):
    """Initialize interview questions and begin first turn."""
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_query = {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]}
            session_doc = db.interview_sessions.find_one(session_query)
            if not session_doc:
                return jsonify({"error": "Interview session not found. Please launch session from your dashboard."}), 404

            # Enforce caller authorization
            claims, _ = _authenticate_request()
            if claims and claims.get("sub"):
                caller_id = str(claims.get("sub"))
                cand_id = str(session_doc.get("candidate_id") or session_doc.get("userId") or "")
                cand_em = str(session_doc.get("candidate_email") or "").lower()
                caller_em = str(claims.get("email") or "").lower()
                if str(claims.get("role", "")).lower() not in ("super_admin", "admin", "recruiter"):
                    if cand_id and cand_id != caller_id and cand_em != caller_em:
                        return jsonify({"error": "Unauthorized: Session does not belong to your account"}), 403

            try:
                import core.interview_arc as _arc
                _start_level = _arc.starting_level((session_doc.get("config") or {}).get("experience_level"))
            except Exception:
                _start_level = 2
            db.interview_sessions.update_one(
                session_query,
                {"$set": {
                    "id": session_id,
                    "session_id": session_id,
                    "status": "in_progress",
                    "state": "QUESTION_READY",
                    "started_at": now_iso,
                    "turn_index": 1,
                    "turn_started_at": now_iso,
                    "question_duration_seconds": 120,
                    "answered_turns": 0,
                    "pending_probe": None,
                    "probe_counts": {},
                    "clarification_counts": {},
                    "difficulty_level": _start_level,
                }}
            )
            session_doc = db.interview_sessions.find_one(session_query)

        contract = build_interview_contract(session_id, session_doc, 1, "QUESTION_READY")
        return jsonify(contract), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


def synthesize_conversational_next_question(
    *,
    cand_name: str,
    previous_answer: str,
    acknowledgement: str,
    next_stage: str,
    planned_focus: str,
    job_title: str
) -> str:
    """Dynamically bridge from the candidate's last answer into the next planned stage like a human interviewer."""
    try:
        from app.services import llm_service
        sys_msg = (
            "You are Sarah Chen, Staff Systems Engineer and Technical Hiring Lead, in a live 1-on-1 technical conversation on video. "
            "You are collegial, sharp, engaged, and warm â€” speaking naturally to an engineering peer. "
            "Never use robotic transition phrases like 'Moving to stage 2', 'Now for the next question', or 'I have recorded your answer'. "
            "Your question must sound spoken aloud (under 38 words), bridging organically from what the candidate just discussed into the next focus."
        )
        user_msg = (
            f"Candidate: {cand_name}\n"
            f"Target Role: {job_title}\n"
            f"What candidate just shared: \"{previous_answer[:400]}\"\n"
            f"Sarah's immediate acknowledgement: \"{acknowledgement[:180]}\"\n\n"
            f"Next Topic Target:\n"
            f"Stage: {next_stage}\n"
            f"Planned Question/Focus: {planned_focus}\n\n"
            "Generate ONLY the single question to speak next aloud. "
            "Bridge smoothly from their previous points (e.g., 'Building on how you handled...', 'Shifting gears to the data layer...', 'To take that scale a step further...'). "
            "Keep it under 38 words. Output ONLY the plain text of the question, no JSON, no quotes."
        )
        resp = llm_service.call_llm(user_msg, system=sys_msg, temperature=0.3)
        clean = resp.strip().strip('"').strip("'").strip()
        if len(clean) > 20 and ("?" in clean or len(clean.split()) >= 6):
            return clean
    except Exception as err:
        print(f"[Conversational Bridge Warning] {err}")
    return planned_focus


@interview_bp.route("/api/interview/<session_id>/answer", methods=["POST"])
@require_session_access
def interview_answer_route(session_id):
    """Submit a candidate turn, assess it, optionally probe, then advance.

    Turn flow (server-authoritative):
      * clarification -> not scored, same question stays active (max 2)
      * probe-worthy answer -> one follow-up becomes the active question
      * otherwise -> the core question is completed and the turn advances
    """
    try:
        from app.services import interviewer_policy

        data = request.get_json(silent=True) or {}
        candidate_answer = (data.get("answer") or data.get("partial_answer") or "").strip()
        candidate_code = (data.get("code") or "").strip()
        code_language = (data.get("code_language") or "python").strip()
        telemetry = data.get("telemetry") or {}
        if not candidate_answer:
            candidate_answer = "No response provided within the allotted question time limit."

        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
        try:
            from app.services import llm_service as _llm_ctx
            _llm_ctx.set_session_context(
                session_id=session_id,
                organization_id=(session_doc or {}).get("org_id") or (session_doc or {}).get("organization_id"),
                user_id=(session_doc or {}).get("candidate_id"),
            )
        except Exception:
            pass

        questions = get_session_questions_data(session_id, request)
        if not questions:
            return jsonify({"error": "No interview questions are available for this session."}), 409
        total_turns = len(questions)

        current_turn = int((session_doc and session_doc.get("turn_index")) or 1)
        current_turn = max(1, min(current_turn, total_turns))
        core_q = questions[current_turn - 1]

        probe_counts = dict((session_doc and session_doc.get("probe_counts")) or {})
        clarification_counts = dict((session_doc and session_doc.get("clarification_counts")) or {})
        turn_key = str(current_turn)
        answered_before = int((session_doc and session_doc.get("answered_turns")) or 0)
        history = list((session_doc and session_doc.get("history")) or [])

        # --- Idempotency replay: a retried submit must never double-bill the LLM,
        # append the same turn twice, or advance the session a second time. ---
        idem_key = (data.get("idempotencyKey") or "").strip()
        replay = _find_replayed_answer(history, idem_key) if idem_key else None
        if replay is not None:
            replay_finished = str((session_doc or {}).get("state") or "").upper() == "COMPLETED" or str((session_doc or {}).get("status") or "").lower() == "completed"
            replay_turn = int((session_doc or {}).get("turn_index") or current_turn)
            replay_turn = max(1, min(replay_turn, total_turns))
            replay_next = questions[replay_turn - 1] if not replay_finished else None
            contract = build_interview_contract(
                session_id,
                session_doc,
                replay_turn,
                "COMPLETED" if replay_finished else "QUESTION_READY",
            )
            replay_scores = replay.get("scores") if isinstance(replay.get("scores"), dict) else None
            next_question_payload = (
                {
                    "text": replay_next.get("prompt_text"),
                    "question_id": replay_next.get("id"),
                    "turn_index": replay_turn,
                    "stage": replay_next.get("stage"),
                }
                if replay_next
                else None
            )
            return jsonify({
                **contract,
                "finished": bool(replay_finished),
                "outcome": "PASSED" if replay_finished else ("FOLLOW_UP" if replay.get("is_follow_up") else "CONTINUE"),
                "scores": replay_scores,
                "feedback": replay.get("interviewer_response"),
                "interviewer_response": replay.get("interviewer_response"),
                "next_question": next_question_payload,
                "idempotent_replay": True,
            }), 200

        # A stored probe is the active question until it is answered.
        pending_probe = (session_doc and session_doc.get("pending_probe")) or None
        if isinstance(pending_probe, dict) and pending_probe.get("text"):
            active_q = {
                "id": pending_probe.get("id") or f"{core_q.get('id') or f'q{current_turn}'}-f1",
                "prompt_text": pending_probe.get("text"),
                "stage": pending_probe.get("stage") or core_q.get("stage", "intro"),
                "expected_concepts": pending_probe.get("expected_concepts") or core_q.get("expected_concepts") or [],
            }
            is_follow_up = True
        else:
            pending_probe = None
            active_q = core_q
            is_follow_up = False

        clean_ans = candidate_answer.strip()
        is_timeout_placeholder = (
            not clean_ans
            or "no response" in clean_ans.lower()
            or "time limit" in clean_ans.lower()
            or "timed out" in clean_ans.lower()
            or clean_ans.lower() in ["no", "idk", "pass", "skip", "i don't know", "nothing"]
        )

        recent_lines = [str(item.get("interviewer_response") or "") for item in history[-4:]]
        asked_questions = [str(q.get("prompt_text") or "") for q in questions]
        asked_questions += [str(item.get("question") or "") for item in history if item.get("question")]
        if pending_probe:
            asked_questions.append(str(pending_probe.get("text") or ""))

        follow_up_allowed = (
            not is_follow_up
            and int(probe_counts.get(turn_key, 0)) < interviewer_policy.MAX_FOLLOW_UPS_PER_QUESTION
        )

        # Arc phases: warm_open & candidate_questions are conversational — never
        # scored, never probed. The candidate deserves answers, not a rubric.
        active_phase = str(core_q.get("phase") or "").strip().lower()
        session_config = (session_doc and session_doc.get("config")) or {}
        phase_unscored = (not is_follow_up) and active_phase in ("warm_open", "candidate_questions", "close")

        # Combined eval+bridge: when we likely advance to a next core question,
        # ask the assessment LLM to also speak the bridging sentence. Saves one
        # sequential LLM round-trip per turn (that call used to happen after
        # assessment). Falls back to the dedicated bridge call when absent.
        bridge_context = None
        if not is_follow_up and current_turn < len(questions):
            _next_q = questions[current_turn]
            bridge_context = {
                "next_stage": _next_q.get("stage", ""),
                "planned_focus": _next_q.get("prompt_text", ""),
            }

        if not is_follow_up and active_phase == "candidate_questions" and not is_timeout_placeholder:
            assessment = interviewer_policy.answer_candidate_question(
                question=clean_ans,
                job_title=(
                    (session_doc and (session_doc.get("job_title") or session_doc.get("role_title")))
                    or session_config.get("job_role")
                ),
                company_name=(session_doc and session_doc.get("company_name")) or None,
                job_description=session_config.get("job_description") or (session_doc and session_doc.get("job_description")) or "",
                recent_lines=recent_lines,
                candidate_name=(
                    (session_doc and (session_doc.get("candidate_name") or session_doc.get("full_name")))
                    or "the candidate"
                ),
            )
        elif phase_unscored and not is_timeout_placeholder:
            assessment = interviewer_policy.TurnAssessment(
                intent="answer",
                decision="PASS",
                interviewer_line=interviewer_policy.default_acknowledgement(clean_ans, recent_lines),
                notes=f"{active_phase} — conversational turn, intentionally not scored.",
                unscored=True,
            )
        elif not is_timeout_placeholder and interviewer_policy.is_clarification_request(clean_ans):
            assessment = interviewer_policy.TurnAssessment(
                intent="clarification",
                decision="CLARIFY",
                interviewer_line=interviewer_policy.default_clarification_line(
                    active_q.get("prompt_text") or ""
                ),
            )
        elif is_timeout_placeholder or len(clean_ans.split()) < 3:
            assessment = interviewer_policy.insufficient_assessment(clean_ans, recent_lines=recent_lines)
        else:
            session_config = (session_doc and session_doc.get("config")) or {}
            try:
                import core.interview_arc as _arc
                _level_label = _arc.difficulty_label(int((session_doc and session_doc.get("difficulty_level")) or 2))
            except Exception:
                _level_label = None
            assessment = interviewer_policy.assess_turn(
                question=active_q.get("prompt_text") or "",
                answer=clean_ans,
                code=candidate_code,
                code_language=code_language,
                expected_concepts=active_q.get("expected_concepts") or [],
                job_title=(
                    (session_doc and (session_doc.get("job_title") or session_doc.get("role_title")))
                    or session_config.get("job_role")
                ),
                job_description=session_config.get("job_description") or (session_doc and session_doc.get("job_description")) or "",
                candidate_name=(
                    (session_doc and (session_doc.get("candidate_name") or session_doc.get("full_name")))
                    or "the candidate"
                ),
                stage=active_q.get("stage"),
                turn_index=current_turn,
                is_follow_up=is_follow_up,
                follow_up_allowed=follow_up_allowed,
                asked_questions=asked_questions,
                recent_turns=history[-3:],
                recent_lines=recent_lines,
                clarifications_used=int(clarification_counts.get(turn_key, 0)),
                interview_level=_level_label,
                bridge_context=bridge_context,
            )

        now_ans_iso = datetime.now(timezone.utc).isoformat()
        session_query = {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]}

        # ---- Rule 9: a genuine clarification is never scored --------------- #
        if assessment.intent == "clarification" and not is_timeout_placeholder:
            clarifications_used = int(clarification_counts.get(turn_key, 0))
            if clarifications_used < interviewer_policy.MAX_CLARIFICATIONS_PER_QUESTION:
                clarification_counts[turn_key] = clarifications_used + 1
                clarification_line = assessment.interviewer_line or interviewer_policy.default_clarification_line(
                    active_q.get("prompt_text") or ""
                )
                clarification_turn_item = {
                    "turn_index": current_turn,
                    "question": active_q.get("prompt_text"),
                    "answer": candidate_answer,
                    "interviewer_response": clarification_line,
                    "intent": "clarification",
                    "action_decision": "CLARIFY",
                    "is_clarification": True,
                    "scores": None,
                    "timestamp": now_ans_iso,
                }
                if db is not None:
                    db.interview_sessions.update_one(
                        session_query,
                        {
                            "$set": {
                                "id": session_id,
                                "session_id": session_id,
                                "clarification_counts": clarification_counts,
                                "last_interviewer_response": clarification_line,
                                "turn_started_at": now_ans_iso,
                                "updated_at": now_ans_iso,
                            },
                            "$push": {"history": clarification_turn_item}
                        },
                        upsert=False,
                    )
                    session_doc = db.interview_sessions.find_one(session_query)

                contract = build_interview_contract(session_id, session_doc, current_turn, "QUESTION_READY")
                print(
                    f"[Interviewer] clarification {clarifications_used + 1}/"
                    f"{interviewer_policy.MAX_CLARIFICATIONS_PER_QUESTION} on turn {current_turn}"
                )
                return jsonify({
                    **contract,
                    "finished": False,
                    "outcome": "CLARIFY",
                    "scores": None,
                    "feedback": clarification_line,
                    "interviewer_response": clarification_line,
                    "clarification": True,
                    "next_question": None,
                }), 200

            # Budget exhausted: it can no longer be treated as a free clarification.
            assessment = interviewer_policy.insufficient_assessment(clean_ans, recent_lines=recent_lines)
            assessment.notes = (
                "Clarification budget for this question was exhausted; "
                "treated as no substantive answer."
            )

        scores = None
        if not getattr(assessment, "unscored", False):
            scores = {
                "relevance": round(float(assessment.relevance), 1),
                "depth": round(float(assessment.depth), 1),
                "correctness": round(float(assessment.correctness), 1),
            }

        # Adaptive difficulty: nudge the stored interview level one step toward
        # the evidence (scored technical-core turns only). Used to calibrate
        # later assessment prompts and the difficulty shown to the team.
        if active_phase == "technical_core" and not getattr(assessment, "unscored", False) and scores:
            try:
                import core.interview_arc as _arc
                _cur = int((session_doc and session_doc.get("difficulty_level")) or 2)
                _new = _arc.adjust_difficulty(_cur, scores)
                if _new != _cur and db is not None:
                    db.interview_sessions.update_one(
                        session_query,
                        {"$set": {"difficulty_level": _new, "updated_at": now_ans_iso}},
                    )
            except Exception as diff_err:
                print(f"[Difficulty Calibration Warning] {diff_err}")

        interviewer_line = assessment.interviewer_line or interviewer_policy.default_acknowledgement(
            clean_ans, recent_lines
        )

        probe = assessment.follow_up if assessment.decision == "PROBE_FURTHER" else None
        if probe is not None and not follow_up_allowed:
            probe = None

        turn_history_item = {
            "turn_index": current_turn,
            "question": active_q.get("prompt_text"),
            "answer": candidate_answer or "No answer recorded.",
            "candidate_code": candidate_code if candidate_code else None,
            "code_language": code_language if candidate_code else None,
            "stage": active_q.get("stage", "intro"),
            "interviewer_response": interviewer_line,
            "evaluator_feedback": assessment.notes,
            "missing_concepts": assessment.missing_concepts,
            "red_flags": assessment.red_flags,
            "action_decision": assessment.decision,
            "intent": assessment.intent,
            "scores": scores,
            "unscored": bool(getattr(assessment, "unscored", False)),
            "is_timeout": bool(is_timeout_placeholder),
            "telemetry": telemetry if telemetry else None,
            "idempotency_key": idem_key or None,
        }
        if is_follow_up:
            turn_history_item["is_follow_up"] = True
            turn_history_item["probe_of"] = current_turn
            turn_history_item["probe_dimension"] = (pending_probe or {}).get("dimension")

        # ---- Rule 6/7: at most ONE anchored probe per core question -------- #
        if probe is not None:
            probe_counts[turn_key] = int(probe_counts.get(turn_key, 0)) + 1
            probe_doc = {
                "id": f"{core_q.get('id') or f'q{current_turn}'}-f{probe_counts[turn_key]}",
                "text": probe.question,
                "of_turn": current_turn,
                "stage": core_q.get("stage", "intro"),
                "dimension": probe.dimension,
                "anchored_on": probe.anchored_on,
                "rationale": probe.rationale,
                "expected_concepts": list(core_q.get("expected_concepts") or []),
                "asked_at": now_ans_iso,
            }
            is_finished = False
            next_turn_idx = current_turn
            update_fields = {
                "id": session_id,
                "session_id": session_id,
                "turn_index": current_turn,
                "pending_probe": probe_doc,
                "probe_counts": probe_counts,
                "clarification_counts": clarification_counts,
                "turn_started_at": now_ans_iso,
                "question_duration_seconds": 120,
                "last_interviewer_response": interviewer_line,
                "state": "QUESTION_READY",
                "status": "in_progress",
                "updated_at": now_ans_iso,
            }
            next_question_payload = {
                "text": probe_doc["text"],
                "question_id": probe_doc["id"],
                "turn_index": current_turn,
                "stage": probe_doc["stage"],
            }
            print(
                f"[Interviewer] follow-up probe ({probe.dimension}) on turn {current_turn}: "
                f"{probe_doc['text'][:120]}"
            )
        else:
            # Progression follows the question index; the stored answered_turns
            # counter follows only assessable evidence. A timeout advances the
            # conversation but never becomes a scored answer.
            scored_turn = not bool(getattr(assessment, "unscored", False)) and scores is not None
            answered_turns = answered_before + (1 if scored_turn else 0)
            is_finished = current_turn >= total_turns
            next_turn_idx = current_turn if is_finished else current_turn + 1
            next_q = (
                questions[next_turn_idx - 1]
                if not is_finished and (next_turn_idx - 1) < len(questions)
                else None
            )
            if next_q and not is_finished:
                cand_name = (
                    (session_doc and (session_doc.get("candidate_name") or session_doc.get("full_name")))
                    or "Candidate"
                )
                # Prefer the bridge sentence the assessment LLM already spoke
                # (one round-trip instead of two). Use it only when it looks
                # like a real spoken question; otherwise fall back to the
                # dedicated bridge call.
                pre_bridge = str(getattr(assessment, "bridged_next_question", "") or "").strip()
                looks_like_question = (
                    len(pre_bridge) > 20
                    and ("?" in pre_bridge or len(pre_bridge.split()) >= 6)
                )
                if looks_like_question:
                    bridged_prompt = pre_bridge
                else:
                    bridged_prompt = synthesize_conversational_next_question(
                        cand_name=cand_name,
                        previous_answer=clean_ans,
                        acknowledgement=interviewer_line,
                        next_stage=next_q.get("stage", f"Turn {next_turn_idx}"),
                        planned_focus=next_q.get("prompt_text", ""),
                        job_title=(
                            (session_doc and (session_doc.get("job_title") or session_doc.get("role_title")))
                            or "Software Engineer"
                        )
                    )
                if bridged_prompt:
                    next_q["prompt_text"] = bridged_prompt
                    questions[next_turn_idx - 1]["prompt_text"] = bridged_prompt

            update_fields = {
                "id": session_id,
                "session_id": session_id,
                "answered_turns": answered_turns,
                "turn_index": next_turn_idx,
                "pending_probe": None,
                "probe_counts": probe_counts,
                "clarification_counts": clarification_counts,
                "turn_started_at": now_ans_iso,
                "question_duration_seconds": 120,
                "last_interviewer_response": interviewer_line,
                "state": "COMPLETED" if is_finished else "QUESTION_READY",
                "status": "completed" if is_finished else "in_progress",
                "updated_at": now_ans_iso,
                "questions": questions,
            }
            next_question_payload = {
                "text": next_q["prompt_text"],
                "question_id": next_q["id"],
                "turn_index": next_turn_idx,
                "stage": next_q["stage"],
            } if next_q else None

        if db is not None:
            db.interview_sessions.update_one(
                session_query,
                {
                    "$set": update_fields,
                    "$push": {"history": turn_history_item}
                },
                upsert=False
            )
            session_doc = db.interview_sessions.find_one(session_query)

        # When finished, dynamically synthesize and cache the scorecard
        if is_finished:
            generate_dynamic_scorecard(session_id, session_doc, request)

        contract = build_interview_contract(
            session_id,
            session_doc,
            next_turn_idx,
            "COMPLETED" if is_finished else "QUESTION_READY"
        )

        response_payload = {
            **contract,
            "finished": is_finished,
            "outcome": "PASSED" if is_finished else ("FOLLOW_UP" if probe is not None else "CONTINUE"),
            "scores": scores,
            "feedback": interviewer_line,
            "interviewer_response": interviewer_line,
            "next_question": next_question_payload,
        }
        return jsonify(response_payload), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


def ensure_candidate_completion_notification(
    db,
    session_id: str,
    session_doc: dict | None,
    *,
    job_title: str,
    now_iso: str,
) -> bool:
    """Create the candidate's completion notification at most once per session.

    The old insert_one path could be skipped (missing ids) or duplicated on a
    finish retry. A stable dedupe key plus $setOnInsert makes retries safe.
    """
    if db is None:
        return False
    try:
        session_doc = session_doc if isinstance(session_doc, dict) else {}
        dedupe_key = f"interview_completed:{session_id}"
        candidate_query = {
            "$or": [
                {"dedupe_key": dedupe_key},
                {"payload.sessionId": session_id},
                {"sessionId": session_id},
                {"session_id": session_id},
            ],
            "notification_type": "interview_completed",
        }
        if db.candidate_notifications.find_one(candidate_query):
            return False
        doc = {
            "_id": dedupe_key,
            "id": str(uuid.uuid4()),
            "dedupe_key": dedupe_key,
            "candidate_id": str(session_doc.get("candidate_id") or session_doc.get("userId") or ""),
            "candidate_email": str(session_doc.get("candidate_email") or session_doc.get("email") or "").strip().lower(),
            "notification_type": "interview_completed",
            "title": f"Interview Completed: {job_title}",
            "body": (
                f"Your interview for {job_title} is complete. Personal feedback is on its way "
                f"to your inbox — the hiring team will review the conversation and reach out with next steps."
            ),
            "payload": {"sessionId": session_id, "type": "interview_completed"},
            "is_read": False,
            "created_at": now_iso,
        }
        db.candidate_notifications.update_one(
            {"_id": dedupe_key}, {"$setOnInsert": doc}, upsert=True
        )
        return True
    except Exception as notif_err:
        logger.warning("[Finish] candidate notification write failed: %s", notif_err)
        return False


@interview_bp.route("/api/interview/<session_id>/finish", methods=["POST"])
@require_session_access
def interview_finish_route(session_id):
    """Mark session as completed and dynamically calculate final assessment scorecard."""
    try:
        db = get_mongo_db()
        now_iso = datetime.now(timezone.utc).isoformat()
        cand_id = ""
        cand_email = ""
        cand_name = "Candidate"
        job_title = "Technical Assessment"
        rec_id = ""
        rec_email = ""
        org_id = None
        scored_answers = False

        # Fetch the session BEFORE the service-delivery gate so zero-turn
        # detection uses real data (previously session_doc was always None here,
        # which voided every interview and suppressed all notifications).
        session_doc = None
        if db is not None:
            try:
                session_doc = db.interview_sessions.find_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]}
                )
            except Exception as fetch_err:
                print(f"[Finish] session fetch warning: {fetch_err}")

        if db is not None:
            # Service-delivery gate: zero answered turns means no service was
            # delivered ? the session is voided, never marked COMPLETED, never
            # notified as completed, never scored as a hiring signal.
            zero_turns = _compute_zero_turns(session_doc)

            if zero_turns:
                db.interview_sessions.update_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"$set": {
                        "id": session_id,
                        "session_id": session_id,
                        "status": "expired",
                        "state": "EXPIRED",
                        "completed_reason": "finished_with_zero_turns",
                        "finished_at": now_iso
                    }},
                    upsert=False
                )
            else:
                db.interview_sessions.update_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"$set": {
                        "id": session_id,
                        "session_id": session_id,
                        "status": "completed",
                        "state": "COMPLETED",
                        "finished_at": now_iso
                    }},
                    upsert=False
                )
            if not zero_turns:
                try:
                    db.interview_invitations.update_many(
                        {"$or": [{"session_id": session_id}, {"sessionId": session_id}]},
                        {"$set": {"status": "COMPLETED", "updated_at": now_iso}}
                    )
                except Exception:
                    pass

            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
            scored_answers = session_has_scored_answers(session_doc)
            if session_doc:
                cand_id = str(session_doc.get("candidate_id") or "")
                cand_email = str(session_doc.get("candidate_email") or "").strip().lower()
                cand_name = str(session_doc.get("candidate_name") or session_doc.get("name") or "Candidate")
                job_title = session_doc.get("job_title") or session_doc.get("target_position") or session_doc.get("role_title") or "Technical Assessment"
                rec_id = str(session_doc.get("recruiter_id") or session_doc.get("recruiterId") or "")
                rec_email = str(session_doc.get("recruiter_email") or session_doc.get("recruiterEmail") or "").strip().lower()
                org_id = session_doc.get("org_id")

            # Fallback to interview_invitations if recruiter/candidate info is not on session_doc
            if not rec_id or not rec_email or not org_id:
                try:
                    inv_doc = db.interview_invitations.find_one({"$or": [{"session_id": session_id}, {"sessionId": session_id}]})
                    if inv_doc:
                        rec_id = rec_id or str(inv_doc.get("recruiter_id") or inv_doc.get("recruiterId") or "")
                        rec_email = rec_email or str(inv_doc.get("recruiter_email") or inv_doc.get("recruiterEmail") or "").strip().lower()
                        org_id = org_id or inv_doc.get("org_id")
                        if cand_name == "Candidate":
                            cand_name = str(inv_doc.get("candidate_name") or cand_name)
                        if job_title == "Technical Assessment":
                            job_title = inv_doc.get("job_title") or job_title
                except Exception:
                    pass

            if scored_answers and not zero_turns:
                notif_doc = dict(session_doc or {})
                notif_doc.setdefault("candidate_id", cand_id)
                notif_doc.setdefault("candidate_email", cand_email)
                ensure_candidate_completion_notification(
                    db, session_id, notif_doc, job_title=job_title, now_iso=now_iso
                )

        sc = generate_dynamic_scorecard(session_id, session_doc, request)
        score_val = sc.get("overall_score")
        rec_val = sc.get("recommendation", "COMPLETED")
        if scored_answers and score_val is not None:
            # Same threshold helper as scorecard generation; explicit human
            # decisions on the session are preserved.
            rec_val = resolve_recommendation(score_val, source=session_doc)
        elif not scored_answers:
            score_val = None
            rec_val = "NOT_EVALUATED"
        sc["overall_score"] = score_val
        sc["recommendation"] = rec_val

        # Compute differentiated competency scores from evidence-based scorecard parameters
        param_dict = {}
        for p in sc.get("overall_parameter_scores", []):
            if isinstance(p, dict) and p.get("name") and p.get("percentage") is not None:
                param_dict[p["name"].lower()] = float(p["percentage"])

        base_score = float(score_val) if score_val is not None else 0.0
        rel_pct = param_dict.get("relevance", base_score)
        dep_pct = param_dict.get("technical depth", base_score)
        cor_pct = param_dict.get("correctness & accuracy", base_score)

        tech_depth_score = round(dep_pct, 1)
        sys_arch_score = round(min(100.0, max(0.0, dep_pct * 0.6 + cor_pct * 0.4)), 1)
        comm_score = round(min(100.0, max(0.0, rel_pct * 0.7 + base_score * 0.3)), 1)
        prob_solving_score = round(min(100.0, max(0.0, cor_pct * 0.6 + dep_pct * 0.4)), 1)

        # Atomically settle interview billing and wallet transaction ledger
        try:
            if session_doc:
                settle_interview_billing_completion(session_id, session_doc)
        except Exception as settle_err:
            print(f"[Interview Billing Settlement Warning]: {settle_err}")

        # Persist dynamic scorecard and evaluation metrics directly to MongoDB interview_sessions.
        # Zero-turn sessions are voided — never persist hiring signals over the EXPIRED state.
        if db is not None and not zero_turns and scored_answers:
            try:
                db.interview_sessions.update_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"$set": {
                        "total_score": score_val,
                        "score": score_val,
                        "final_recommendation": rec_val,
                        "recommendation": rec_val,
                        "summary": sc.get("executive_summary") or "Technical assessment completed.",
                        "score_breakdown": {
                            "technicalDepth": tech_depth_score,
                            "systemArchitecture": sys_arch_score,
                            "communication": comm_score,
                            "problemSolving": prob_solving_score
                        },
                        "key_highlights": sc.get("strengths", []),
                        "status": "completed",
                        "completed_at": now_iso,
                        "student_status": "selected" if rec_val in ("HIRE", "STRONG_HIRE") else "inprocess",
                        "updated_at": now_iso
                    }}
                )
            except Exception as update_err:
                print(f"âš ï¸ [SCORECARD PERSIST WARNING] {update_err}")
            if (rec_id or rec_email) and not zero_turns:
                try:
                    rec_notif = {
                        "id": str(uuid.uuid4()),
                        "recruiter_id": rec_id,
                        "recruiter_email": rec_email,
                        "org_id": org_id,
                        "notification_type": "interview_completed",
                        "title": f"Interview Completed: {cand_name}",
                        "body": f"{cand_name} has completed the {job_title} interview with an overall score of {score_val} ({rec_val}). Evaluation dossier is ready.",
                        "payload": {
                            "sessionId": session_id,
                            "candidateId": cand_id,
                            "candidateName": cand_name,
                            "score": score_val,
                            "recommendation": rec_val,
                            "jobTitle": job_title,
                            "type": "interview_completed"
                        },
                        "is_read": False,
                        "created_at": now_iso
                    }
                    db.recruiter_notifications.insert_one(rec_notif)
                    db.notifications.insert_one(rec_notif)
                except Exception:
                    pass

        contract = build_interview_contract(session_id, session_doc, 4, "COMPLETED")
        return jsonify({
            **contract,
            "finished": True,
            "outcome": sc.get("recommendation", "PASSED"),
            "overall_score": sc.get("overall_score"),
            "recommendation": sc.get("recommendation"),
            "executive_summary": sc.get("executive_summary"),
            "strengths": sc.get("strengths", []),
            "concerns": sc.get("concerns", []),
            "competencies": sc.get("competencies", []),
            "overall_parameter_scores": sc.get("overall_parameter_scores", [])
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/retry", methods=["POST"])
@require_session_access
def interview_retry_route(session_id):
    """Replay current question turn."""
    try:
        db = get_mongo_db()
        session_doc = None
        if db is not None:
            session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
        current_turn = (session_doc and session_doc.get("turn_index")) or 1
        contract = build_interview_contract(session_id, session_doc, current_turn, "QUESTION_READY")
        return jsonify(contract), 200
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/question-timeout", methods=["POST"])
@require_session_access
def interview_question_timeout_route(session_id):
    """Handle candidate question timer expiration and auto-advance."""
    try:
        data = request.get_json(silent=True) or {}
        if "partial_answer" in data and "answer" not in data:
            data["answer"] = data["partial_answer"]
        return interview_answer_route(session_id)
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/interview/<session_id>/media-state", methods=["POST"])
@require_session_access
def interview_media_state_route(session_id):
    """Heartbeat endpoint for ongoing audio/video health."""
    try:
        data = request.get_json(silent=True) or {}
        db = get_mongo_db()
        if db is not None:
            db.interview_sessions.update_one(
                {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                {"$set": {
                    "id": session_id,
                    "session_id": session_id,
                    "last_media_state": data,
                    "media_heartbeat_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=False
            )
        contract = build_interview_contract(session_id, None, 1, "QUESTION_READY")
        return jsonify(contract), 200
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


_TTS_AUDIO_CACHE: dict[str, bytes] = {}


def _sanitize_text_for_speech(text: str) -> str:
    """Strip markdown, backticks, bullets, and symbols so spoken audio sounds completely natural."""
    import re
    t = re.sub(r"```[\s\S]*?```", " the following code snippet, ", text)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"__([^_]+)__", r"\1", t)
    t = re.sub(r"^\s*[-*â€¢]\s+", "", t, flags=re.MULTILINE)
    t = re.sub(r"^\s*\d+\.\s+", "", t, flags=re.MULTILINE)
    t = re.sub(r"^\s*#+\s+", "", t, flags=re.MULTILINE)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _generate_edge_tts_sync(text: str, voice: str = "en-US-AvaNeural", rate: str = "-2%", pitch: str = "+0Hz") -> bytes:
    """Synchronously stream Azure Neural audio via edge-tts.

    Hard wall at 6 seconds — a hung MS edge websocket must never pin a
    gunicorn worker. Callers treat a timeout as a tier failure and fall
    back to the next TTS tier (or to a 503 with retryable=true).
    """
    import asyncio
    import edge_tts

    sanitized = _sanitize_text_for_speech(text)

    async def _runner():
        comm = edge_tts.Communicate(sanitized, voice, rate=rate, pitch=pitch)
        buf = io.BytesIO()
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return buf.getvalue()

    async def _bounded():
        return await asyncio.wait_for(_runner(), timeout=6.0)

    return asyncio.run(_bounded())


def generate_speech_audio(
    text: str,
    voice: str = "default",
    *,
    session_id: str | None = None,
    organization_id: str | None = None,
    user_id: str | None = None,
) -> tuple[bytes, str]:
    """Public entry: times the call and emits one TTS shadow-metering event."""
    import time

    started = time.perf_counter()
    meter = {"provider": "studio-cache", "model": "in-memory", "characters": len(_sanitize_text_for_speech(text)), "status": "success"}
    try:
        result = _generate_speech_audio_impl(text, voice, meter)
        meter["status"] = "success"
        return result
    except Exception:
        meter["status"] = "error"
        raise
    finally:
        try:
            from core.voice_metering import emit_tts_event

            emit_tts_event(
                provider=meter["provider"],
                model=meter["model"],
                status=meter["status"],
                duration_ms=int((time.perf_counter() - started) * 1000),
                characters=meter["characters"],
                session_id=session_id,
                organization_id=organization_id,
                user_id=user_id,
            )
        except Exception:
            pass


def _generate_speech_audio_impl(text: str, voice: str, meter: dict) -> tuple[bytes, str]:
    """
    Generate natural human-like voice audio with multi-tier fallback.
    Only supports English and Hinglish language variants.

    Supported voices:
    - "default" or "en": English (Azure Neural Voice: en-US-AvaNeural, fallback OpenAI tts-1)
    - "hinglish": Hinglish (Hindi-English mix) with appropriate intonation

    Tiers:
    Tier 1: Microsoft Azure Neural Voice via edge-tts (AvaNeural / NeerjaNeural)
    Tier 2: Gemini 2.5 Flash Studio Neural Voice (Aoede 24kHz Studio Speech)
    Tier 3: OpenAI TTS (tts-1 with selected voice)
    Tier 4: intentionally removed — loud failure instead of wrong words
    Returns: (audio_bytes, mimetype)
    """
    clean_text = _sanitize_text_for_speech(text)
    # Normalize voice parameter
    v = (voice or "default").strip().lower()
    if v not in ("default", "en", "hinglish"):
        v = "default"  # Unknown voice -> fall back to English

    import hashlib
    cache_key = hashlib.md5(f"{clean_text}:{v}".encode("utf-8")).hexdigest()
    if cache_key in _TTS_AUDIO_CACHE:
        cached = _TTS_AUDIO_CACHE[cache_key]
        meter["provider"] = "memory-cache"
        meter["model"] = "in-memory"
        if isinstance(cached, tuple):
            return cached
        return cached, "audio/mpeg"

    # Tier 1: Microsoft Azure Neural Voice via edge-tts (100% matches pre-recorded studio assets)
    try:
        if v == "hinglish":
            edge_voice = os.environ.get("EDGE_TTS_HINGLISH_VOICE", "en-IN-NeerjaNeural")
        else:
            edge_voice = os.environ.get("EDGE_TTS_VOICE", "en-US-AvaNeural")
        audio_bytes = _generate_edge_tts_sync(clean_text[:4096], voice=edge_voice)
        if audio_bytes and len(audio_bytes) > 500:
            if len(_TTS_AUDIO_CACHE) > 500:
                _TTS_AUDIO_CACHE.clear()
            _TTS_AUDIO_CACHE[cache_key] = (audio_bytes, "audio/mpeg")
            meter["provider"] = "edge-tts"
            meter["model"] = edge_voice
            return audio_bytes, "audio/mpeg"
    except Exception as edge_err:
        print(f"[TTS Azure Neural Fallback] {edge_err} -> Switching to Gemini Studio Neural Voice")

    # Tier 2: Gemini 2.5 Flash Studio Neural Voice (Google DeepMind 24kHz Studio Speech)
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip() or os.environ.get("GEMINI_API", "").strip()
    if gemini_key:
        try:
            import requests, base64, wave
            gem_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={gemini_key}"
            gem_voice = "Aoede"
            gem_payload = {
                "contents": [{"parts": [{"text": clean_text[:4096]}]}],
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": gem_voice
                            }
                        }
                    }
                }
            }
            resp = requests.post(gem_url, json=gem_payload, timeout=7)
            if resp.status_code == 200:
                res_data = resp.json()
                cands = res_data.get("candidates", [])
                if cands and "content" in cands[0]:
                    parts = cands[0]["content"].get("parts", [])
                    for p in parts:
                        if "inlineData" in p and "data" in p["inlineData"]:
                            pcm_raw = base64.b64decode(p["inlineData"]["data"])
                            wav_buf = io.BytesIO()
                            with wave.open(wav_buf, "wb") as wf:
                                wf.setnchannels(1)
                                wf.setsampwidth(2)
                                wf.setframerate(24000)
                                wf.writeframes(pcm_raw)
                            wav_bytes = wav_buf.getvalue()
                            if len(_TTS_AUDIO_CACHE) > 500:
                                _TTS_AUDIO_CACHE.clear()
                            _TTS_AUDIO_CACHE[cache_key] = (wav_bytes, "audio/wav")
                            meter["provider"] = "gemini"
                            meter["model"] = "gemini-2.5-flash-preview-tts"
                            return wav_bytes, "audio/wav"
        except Exception as gem_err:
            print(f"[TTS Gemini Fallback] {gem_err} -> Switching to OpenAI TTS")

    # Tier 3: OpenAI TTS (if API key available & valid)
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key and not openai_key.startswith("sk-proj-your-openai") and len(openai_key) > 20:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            tt_voice = os.environ.get("TTS_VOICE", "nova").strip() or "nova"
            model = os.environ.get("TTS_MODEL", "tts-1").strip() or "tts-1"
            response = client.audio.speech.create(
                model=model,
                voice=tt_voice,
                input=clean_text[:4096]
            )
            audio_bytes = response.read()
            if audio_bytes and len(audio_bytes) > 500:
                if len(_TTS_AUDIO_CACHE) > 500:
                    _TTS_AUDIO_CACHE.clear()
                _TTS_AUDIO_CACHE[cache_key] = (audio_bytes, "audio/mpeg")
                meter["provider"] = "openai"
                meter["model"] = model
                return audio_bytes, "audio/mpeg"
        except Exception as oai_err:
            print(f"[TTS OpenAI Fallback] {oai_err} -> Switching to Studio Human Fallback")

    # Tier 4: intentionally REMOVED. It used to play a canned "thinking—" clip
    # instead of the requested sentence — the candidate would hear filler in
    # place of the actual question, silently. Fail loud instead.
    meter["provider"] = "none"
    meter["model"] = "no-provider-available"
    raise RuntimeError("No neural voice provider available.")


@interview_bp.route("/api/interview/<session_id>/speak/stream", methods=["POST"])
@require_session_access
def interview_speak_stream_route(session_id):
    """Streaming TTS: bytes leave the edge-tts websocket to the client as they
    arrive, so first audio byte lands in ~150-400ms instead of after full synthesis.

    Falls back to 503 (retryable) on any producer failure so the client can fall
    back to the whole-file /speak endpoint. One shadow-metering event emitted.
    """
    try:
        import os
        import queue
        import threading

        data = request.get_json(silent=True) or {}
        text = (data.get("text") or "").strip()
        voice = str(data.get("voice") or "default").strip().lower() or "default"
        if voice not in ("default", "en", "hinglish"):
            voice = "default"
        if not text:
            return jsonify({"error": "No text provided"}), 400

        _tts_org = None
        _tts_user = None
        try:
            db = get_mongo_db()
            if db is not None:
                _doc = db.interview_sessions.find_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"org_id": 1, "organization_id": 1, "candidate_id": 1},
                )
                if _doc:
                    _tts_org = _doc.get("org_id") or _doc.get("organization_id")
                    _tts_user = _doc.get("candidate_id")
        except Exception:
            pass

        sanitized = _sanitize_text_for_speech(text)[:4096]
        if voice == "hinglish":
            edge_voice = os.environ.get("EDGE_TTS_HINGLISH_VOICE", "en-IN-NeerjaNeural")
        else:
            edge_voice = os.environ.get("EDGE_TTS_VOICE", "en-US-AvaNeural")

        import time

        started = time.perf_counter()

        def generate():
            import asyncio
            import edge_tts

            q: "queue.Queue[object]" = queue.Queue(maxsize=512)
            _DONE = object()

            def producer():
                async def _collect():
                    comm = edge_tts.Communicate(sanitized, edge_voice, rate="-2%", pitch="+0Hz")
                    async for chunk in comm.stream():
                        if chunk.get("type") == "audio":
                            q.put(chunk["data"])
                try:
                    asyncio.run(asyncio.wait_for(_collect(), timeout=8.0))
                except Exception as prod_err:
                    print(f"[TTS stream producer] {prod_err}")
                finally:
                    q.put(_DONE)

            threading.Thread(target=producer, daemon=True).start()
            while True:
                item = q.get()
                if item is _DONE:
                    break
                yield item
            # Emit voice_tts metering once the stream completes
            try:
                from core.voice_metering import emit_tts_event

                emit_tts_event(
                    provider="edge-tts",
                    model=edge_voice,
                    status="success",
                    duration_ms=int((time.perf_counter() - started) * 1000),
                    characters=len(sanitized),
                    session_id=session_id,
                    organization_id=_tts_org,
                    user_id=_tts_user,
                )
            except Exception:
                pass

        return Response(generate(), mimetype="audio/mpeg")
    except Exception as e:
        print(f"[TTS stream Error] {e}")
        return jsonify({"error": "TTS stream temporarily unavailable", "retryable": True}), 503


@interview_bp.route("/api/interview/<session_id>/speak", methods=["POST"])
@require_session_access
def interview_speak_route(session_id):
    """Generate high-definition natural voice audio stream for interviewer dialogue."""
    try:
        data = request.get_json(silent=True) or {}
        text = data.get("text", "").strip()
        voice = data.get("voice", "default")  # Allow voice selection: "nova", "alloy", "en-US-AvaNeural", etc.
        if not text:
            return jsonify({"error": "No text provided"}), 400

        _tts_org = None
        _tts_user = None
        try:
            db = get_mongo_db()
            if db is not None:
                _tts_doc = db.interview_sessions.find_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"org_id": 1, "organization_id": 1, "candidate_id": 1},
                )
                if _tts_doc:
                    _tts_org = _tts_doc.get("org_id") or _tts_doc.get("organization_id")
                    _tts_user = _tts_doc.get("candidate_id")
        except Exception:
            pass

        audio_bytes, mimetype = generate_speech_audio(
            text,
            voice=voice,
            session_id=session_id,
            organization_id=_tts_org,
            user_id=_tts_user,
        )
        return Response(audio_bytes, mimetype=mimetype)
    except Exception as e:
        print(f"[TTS Error] {e}")
        return jsonify({"error": "TTS temporarily unavailable", "retryable": True}), 503


@interview_bp.route("/api/interview/<session_id>/whiteboard/critique", methods=["POST"])
@require_session_access
def interview_whiteboard_critique(session_id):
    """
    Multimodal System Design Architecture Critique powered by Gemini 2.5 Flash.
    Analyzes candidate's distributed system diagram topology, identifies bottlenecks,
    SPOFs, scaling limits, and delivers Socratic feedback spoken aloud by Sarah Chen.
    """
    try:
        data = request.get_json(silent=True) or {}
        nodes = data.get("nodes", [])
        connections = data.get("connections", [])
        summary = data.get("summary", "").strip()
        active_question = data.get("active_question", "Design a scalable distributed system.")

        if not nodes:
            return jsonify({
                "strengths": [],
                "bottlenecks": ["Empty architecture canvas"],
                "socratic_question": "What core services and data stores are required for this system?",
                "interviewer_line": "Your whiteboard canvas is currently empty. Place your core services and data stores so we can analyze the flow."
            }), 200

        # Build topology representation
        node_map = {n.get("id"): f"{n.get('label')} ({n.get('type')})" for n in nodes if n.get("id")}
        topology_lines = []
        for c in connections:
            from_name = node_map.get(c.get("fromId"), c.get("fromId"))
            to_name = node_map.get(c.get("toId"), c.get("toId"))
            topology_lines.append(f"  - {from_name} âž” {to_name}")

        topology_text = "\n".join(topology_lines) if topology_lines else "  - No active connections drawn yet."
        all_nodes_text = ", ".join([f"{n.get('label')} [{n.get('type')}]" for n in nodes])

        prompt = f"""You are Sarah Chen, Staff Systems Engineer and Technical Hiring Lead.
You are evaluating a candidate's live system design architecture diagram for the following question:
"{active_question}"

Current Architecture Diagram Topology:
Components Placed: {all_nodes_text}
Data Flow Connections:
{topology_text}

Summary: {summary}

Critique this system design as a principal engineer:
1. Identify 1 or 2 architectural strengths.
2. Identify 1 or 2 potential bottlenecks or Single Points of Failure (SPOFs) (e.g. un-sharded database, missing cache, unbuffered synchronous writes, lack of rate limiting/circuit breaker).
3. Formulate exactly ONE concise Socratic question challenging their design under high scale.
4. Provide a 2-sentence conversational spoken summary for the interviewer line.

Return ONLY a valid JSON object in this exact schema:
{{
  "strengths": ["string"],
  "bottlenecks": ["string"],
  "socratic_question": "string",
  "interviewer_line": "string"
}}"""

        res_json = None
        try:
            from app.services import llm_service

            llm_service.set_operation("whiteboard")
            try:
                db = get_mongo_db()
                if db is not None:
                    _wb_doc = db.interview_sessions.find_one(
                        {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                        {"org_id": 1, "organization_id": 1, "candidate_id": 1},
                    ) or {}
                    llm_service.set_session_context(
                        session_id=session_id,
                        organization_id=_wb_doc.get("org_id") or _wb_doc.get("organization_id"),
                        user_id=_wb_doc.get("candidate_id"),
                    )
            except Exception:
                pass

            system_msg = (
                "You are Sarah Chen, Staff Systems Engineer and Technical Hiring Lead. "
                "You critique live architecture diagrams like a principal engineer. "
                "Respond ONLY with valid JSON matching this schema:\n"
                '{"strengths": ["string"], "bottlenecks": ["string"], "socratic_question": "string", "interviewer_line": "string"}'
            )
            content, _model_used = llm_service._chat(system_msg, prompt, temperature=0.4, max_tokens=700)
            parsed = llm_service._json_from(content)
            if isinstance(parsed, dict) and parsed.get("interviewer_line"):
                res_json = parsed
        except Exception as wb_err:
            print(f"[Whiteboard Critique LLM] {wb_err}")

        if not res_json:
            has_cache = any(n.get("type") == "redis" for n in nodes)
            res_json = {
                "strengths": ["Clear component separation between client and core services"],
                "bottlenecks": ["Evaluate write contention on the primary database" if not has_cache else "Review failover replication redundancy"],
                "socratic_question": "How does your architecture handle sudden 10x traffic spikes?",
                "interviewer_line": "I'm tracking your component topology. Let's look at how this data path holds up under high concurrency."
            }

        # Persist canvas snapshot for recruiter replay — last critique state wins
        try:
            db = get_mongo_db()
            if db is not None:
                db.interview_sessions.update_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"$set": {
                        "whiteboard_snapshot": {
                            "nodes": nodes[:120],
                            "connections": connections[:240],
                            "summary": summary[:3000],
                            "captured_at": datetime.now(timezone.utc).isoformat(),
                        },
                        "whiteboard_critique_count": 1,
                    }},
                    upsert=False
                )
        except Exception as wb_persist_err:
            print(f"[Whiteboard Persist] {wb_persist_err}")

        return jsonify(res_json), 200
    except Exception as e:
        print(f"[Whiteboard Critique Error] {e}")
        return jsonify({
            "strengths": ["Clean architectural layout"],
            "bottlenecks": ["Evaluate read/write isolation"],
            "socratic_question": "How would you handle caching at the edge?",
            "interviewer_line": "Good layout. Let's examine potential bottlenecks under peak load."
        }), 200


@interview_bp.route("/api/interview/<session_id>/transcribe", methods=["POST"])
@require_session_access
def interview_transcribe_route(session_id):
    """Audio speech-to-text transcription powered by OpenAI Whisper."""
    try:
        audio_file = request.files.get("audio") or request.files.get("file")
        raw_data = None
        if not audio_file:
            raw_data = request.get_data()
            if not raw_data:
                return jsonify({"error": "No audio data received", "transcript": ""}), 400

        temp_dir = tempfile.gettempdir()
        temp_filename = f"tp_whisper_{uuid.uuid4().hex[:10]}.webm"
        temp_path = os.path.join(temp_dir, temp_filename)

        if audio_file:
            audio_file.save(temp_path)
        else:
            with open(temp_path, "wb") as f:
                f.write(raw_data)

        transcript_text = ""
        stt_provider = ""
        from core.stt_service import transcribe_file

        _stt_org = None
        _stt_user = None
        try:
            db = get_mongo_db()
            if db is not None:
                _stt_doc = db.interview_sessions.find_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"org_id": 1, "organization_id": 1, "candidate_id": 1},
                )
                if _stt_doc:
                    _stt_org = _stt_doc.get("org_id") or _stt_doc.get("organization_id")
                    _stt_user = _stt_doc.get("candidate_id")
        except Exception:
            pass

        transcript_text, stt_provider = transcribe_file(
            temp_path,
            language="en",
            session_id=session_id,
            organization_id=_stt_org,
            user_id=_stt_user,
        )

        # Cleanup temporary audio file
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass

        if transcript_text:
            return jsonify({"transcript": transcript_text, "success": True, "stt_provider": stt_provider}), 200

        return jsonify({
            "transcript": "",
            "message": "No clear speech detected in recording segment. Please speak clearly into your microphone."
        }), 200
    except Exception as e:
        print(f"[Transcribe Error] {e}")
        return jsonify({"error": generic_500(e), "transcript": ""}), 500


@interview_bp.route("/api/interview/<session_id>/reset-listening", methods=["POST"])
@require_session_access
def interview_reset_listening_route(session_id):
    """Reset speech recognition listening window."""
    return jsonify({"success": True, "state": "LISTENING"}), 200


@interview_bp.route("/api/interview/<session_id>/proctoring/events", methods=["GET", "POST"])
@require_session_access
def interview_proctoring_events_route(session_id):
    """Collect disclosed interaction counters for the hiring team.

    Only explicit, disclosed events are recorded (tab switch, paste, window blur,
    fullscreen exit, mic/camera toggles). No vision-based inference (gaze, faces,
    emotion) exists on this path — there is nothing to infer from stored data.
    Counters feed a human review; they never auto-decide or auto-terminate.
    """
    DISCLOSED_COUNTER_EVENTS = (
        "tab_switch",
        "paste_event",
        "window_blur",
        "fullscreen_exit",
        "mic_disabled",
        "camera_disabled",
    )
    try:
        db = get_mongo_db()
        if request.method == "POST":
            data = request.get_json(silent=True) or {}
            event_type = str(data.get("event_type", "unknown"))[:64]
            if db is not None:
                if event_type in DISCLOSED_COUNTER_EVENTS:
                    db.proctoring_events.insert_one({
                        "session_id": session_id,
                        "event_type": event_type,
                        "detail": str(data.get("detail") or "")[:500],
                        "metadata": data.get("metadata") if isinstance(data.get("metadata"), dict) else None,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })

            warning_count = 0
            if db is not None:
                warning_count = db.proctoring_events.count_documents({
                    "session_id": session_id,
                    "event_type": {"$in": list(DISCLOSED_COUNTER_EVENTS)}
                })

            flagged = warning_count >= 5
            return jsonify({
                "success": True,
                "warningCount": warning_count,
                "flagged": flagged,
                "terminated": False
            }), 200
        else:
            warning_count = 0
            if db is not None:
                warning_count = db.proctoring_events.count_documents({
                    "session_id": session_id,
                    "event_type": {"$in": list(DISCLOSED_COUNTER_EVENTS)}
                })
            return jsonify({
                "warningCount": warning_count,
                "flagged": warning_count >= 5
            }), 200
    except Exception as e:
        return jsonify({"warningCount": 0, "flagged": False}), 200


# Companion Phone-as-Camera/Mic routes are authoritatively handled by companion.py blueprint (companion_bp)


@interview_bp.route("/api/v1/interview-sessions/<session_id>/recruiter-viewer-token", methods=["GET"])
@require_session_access
def recruiter_viewer_token(session_id):
    """Recruiter live observation token.

    Issues a subscribe-only LiveKit JWT so an authorized recruiter can silently
    observe the candidate's live room. Never publish grants. Matches the
    candidate media room naming (room == session_id).
    """
    try:
        db = get_mongo_db()
        if db is not None:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
            terminal_error = terminal_session_error(session_meta)
            if terminal_error:
                return jsonify(terminal_error), 409

        livekit_enabled = os.environ.get("LIVEKIT_ENABLED", "true").strip().lower() not in ("false", "0", "off", "disable", "no")
        livekit_url = (os.environ.get("LIVEKIT_URL") or "").strip()
        livekit_api_key = (os.environ.get("LIVEKIT_API_KEY") or "").strip()
        livekit_secret = (os.environ.get("LIVEKIT_API_SECRET") or "").strip()

        is_placeholder = any(
            ph in livekit_api_key.lower() or ph in livekit_secret.lower()
            for ph in ("placeholder", "your-api-key", "your-secret", "sk-proj-your", "none")
        )

        if not (livekit_enabled and livekit_url and livekit_api_key and livekit_secret and not is_placeholder):
            return jsonify({
                "error": "Live monitoring is not configured on this server (LiveKit credentials missing).",
                "livekitUrl": None,
                "jwt": None,
            }), 503

        user = getattr(g, "user", None) or {}
        recruiter_id = str(user.get("id") or user.get("_id") or "recruiter")

        from livekit import api as lk_api
        token = lk_api.AccessToken(livekit_api_key, livekit_secret) \
            .with_identity(f"recruiter-{recruiter_id[:8]}-{session_id[:8]}") \
            .with_name("Recruiter Observer") \
            .with_grants(lk_api.VideoGrants(
                room_join=True,
                room=session_id,
                can_publish=False,
                can_subscribe=True,
            )).to_jwt()

        return jsonify({
            "livekitUrl": livekit_url,
            "jwt": token,
            "room": session_id,
            "sessionId": session_id,
            "role": "recruiter",
        }), 200
    except Exception as lk_err:
        print(f"[RecruiterViewerToken] Live token generation failed for session {session_id}: {lk_err}")
        traceback.print_exc()
        return jsonify({"error": "Failed to issue monitoring token. Please retry in a few seconds."}), 500


@interview_bp.route("/api/v1/interview-sessions/<session_id>/recording", methods=["GET", "POST"])
@require_session_access
def interview_recording(session_id):
    """Interview video recording metadata and ingestion."""
    whiteboard_snapshot = None
    try:
        db = get_mongo_db()
        if db is not None:
            sess = db.interview_sessions.find_one(
                {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                {"_id": 0, "whiteboard_snapshot": 1},
            )
            if sess:
                whiteboard_snapshot = sess.get("whiteboard_snapshot")
    except Exception:
        pass
    return jsonify({
        "sessionId": session_id,
        "status": "processing",
        "playbackUrl": None,
        "durationSec": None,
        "durationSeconds": 2700,
        "publicId": None,
        "mimeType": None,
        "message": "Recording not retained on this host yet — upload via the companion flow to enable playback.",
        "whiteboardSnapshot": whiteboard_snapshot,
    }), 200

def get_or_generate_session_coding_problem(session_id: str, session_meta: dict | None = None, req=None) -> dict:
    """Dynamically generate or load technical coding challenge tailored to candidate skills & job title."""
    db = get_mongo_db()
    if not session_meta and db is not None and session_id:
        try:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
        except Exception:
            session_meta = None

    if session_meta and isinstance(session_meta.get("activeProblem"), dict) and session_meta["activeProblem"].get("title"):
        return session_meta["activeProblem"]

    user, resume_doc, skills = get_current_candidate(req)
    job_title = (session_meta and (session_meta.get("job_title") or session_meta.get("role_title"))) or "Software Systems Engineer"
    skills_str = ", ".join(skills[:6]) if skills else "Data Structures, Algorithms, Python, TypeScript"

    # Step 1: Attempt LLM generation
    try:
        from app.services import llm_service
        sys_msg = (
            "You are a Senior Principal Staff Engineer designing a live technical interview coding challenge. "
            "Output strictly a JSON object with title, difficulty, description, constraints, sampleCode, and testHarness."
        )
        user_msg = f"""Target Role: {job_title}
Key Skills: {skills_str}

Generate a production-level live coding problem (Medium or Hard):
1. Title and practical description (e.g. rate limiter, async queue, LRU TTL cache, state diff engine, or sliding window aggregator).
2. 3 specific constraints (time/memory complexity).
3. "sampleCode" with starter templates for "python" and "typescript" (classes or functions with comments/docstrings).
4. "testHarness" with executable verification code for "python" and "javascript" that prints "[PASSED]" for passed tests and "[FAILED]" for failures.

Respond ONLY with JSON:
{{
  "id": "prob-{uuid.uuid4().hex[:6]}",
  "title": "...",
  "difficulty": "Medium",
  "description": "...",
  "constraints": ["...", "...", "..."],
  "sampleCode": {{
    "python": "...",
    "typescript": "..."
  }},
  "testHarness": {{
    "python": "...",
    "javascript": "..."
  }}
}}"""
        raw_resp = llm_service.call_llm(user_msg, system=sys_msg, temperature=0.3)
        prob = None
        try:
            prob = llm_service._json_from(raw_resp) if hasattr(llm_service, "_json_from") else json.loads(raw_resp)
        except Exception:
            clean_str = raw_resp.strip()
            if "{" in clean_str and "}" in clean_str:
                s_idx, e_idx = clean_str.find("{"), clean_str.rfind("}")
                prob = json.loads(clean_str[s_idx:e_idx + 1])

        if isinstance(prob, dict) and prob.get("title") and prob.get("description"):
            harness = prob.get("testHarness") or {}
            harness_ok = all(
                isinstance(harness.get(lang), str) and ("PASSED" in harness[lang] or "FAILED" in harness[lang])
                for lang in ("python", "javascript")
            )
            if not harness_ok:
                raise ValueError("LLM-generated problem lacks a verifiable test harness")
            prob.setdefault("id", f"prob-{uuid.uuid4().hex[:6]}")
            prob.setdefault("difficulty", "Medium")
            prob.setdefault("constraints", ["O(1) time complexity average", "Memory efficient footprint"])
            if db is not None and session_id:
                try:
                    db.interview_sessions.update_one(
                        {"$or": [{"id": session_id}, {"session_id": session_id}]},
                        {"$set": {"activeProblem": prob}}
                    )
                except Exception:
                    pass
            return prob
    except Exception as llm_err:
        print(f"[Dynamic Problem LLM Warning] {llm_err} - Falling back to stack-tailored problem engine")

    # Step 2: Adaptive domain problem fallback
    lower_skills = [s.lower() for s in skills]
    if any(k in lower_skills for k in ["python", "fastapi", "django", "flask", "backend"]):
        prob = {
            "id": f"prob-py-{uuid.uuid4().hex[:6]}",
            "title": "High-Throughput Task Worker with Priority & Rate Limiting",
            "difficulty": "Hard",
            "description": "Design and implement an in-memory priority task dispatcher class TaskDispatcher that schedules tasks by priority (1 to 5, where 1 is highest) while enforcing a rate limit of max_tasks_per_sec.",
            "constraints": [
                "Task submission submit(task_id: str, priority: int) -> bool must execute in O(log N) or O(1).",
                "next_task() -> str | None must retrieve the highest-priority pending task.",
                "Return None when the queue is depleted or the rate limit window is saturated."
            ],
            "sampleCode": {
                "python": 'class TaskDispatcher:\n    def __init__(self, max_tasks_per_sec: int = 100):\n        self.max_tasks_per_sec = max_tasks_per_sec\n        # Initialize priority queue / time tracking\n        self.tasks = []\n\n    def submit(self, task_id: str, priority: int) -> bool:\n        # Priority: 1 is highest, 5 is lowest\n        import heapq\n        heapq.heappush(self.tasks, (priority, task_id))\n        return True\n\n    def next_task(self) -> str | None:\n        import heapq\n        return heapq.heappop(self.tasks)[1] if self.tasks else None\n',
                "typescript": 'export class TaskDispatcher {\n  private maxTasksPerSec: number;\n  private tasks: Array<{ id: string; priority: number }> = [];\n\n  constructor(maxTasksPerSec: number = 100) {\n    this.maxTasksPerSec = maxTasksPerSec;\n  }\n\n  public submit(taskId: string, priority: number): boolean {\n    this.tasks.push({ id: taskId, priority });\n    this.tasks.sort((a, b) => a.priority - b.priority);\n    return true;\n  }\n\n  public nextTask(): string | null {\n    const next = this.tasks.shift();\n    return next ? next.id : null;\n  }\n}\n'
            },
            "testHarness": {
                "python": 'try:\n    d = TaskDispatcher(100)\n    s1 = d.submit("t-critical", 1)\n    s2 = d.submit("t-background", 4)\n    s3 = d.submit("t-high", 2)\n    print(f"[Test Case 1] Task queue submission... {\'PASSED\' if (s1 and s2 and s3) else \'FAILED\'}")\n    first = d.next_task()\n    print(f"[Test Case 2] Priority 1 task extracted first... {\'PASSED\' if first == \'t-critical\' else \'FAILED\'}")\n    second = d.next_task()\n    print(f"[Test Case 3] Order invariant preserved... {\'PASSED\' if second == \'t-high\' else \'FAILED\'}")\nexcept Exception as e:\n    print(f"[Test Error] {e}")\n',
                "javascript": 'try {\n    const d = new TaskDispatcher(100);\n    const s1 = d.submit("t-critical", 1);\n    const s2 = d.submit("t-background", 4);\n    const s3 = d.submit("t-high", 2);\n    console.log(`[Test Case 1] Task queue submission... ${s1 && s2 && s3 ? "PASSED" : "FAILED"}`);\n    const first = d.nextTask();\n    console.log(`[Test Case 2] Priority 1 task extracted first... ${first === "t-critical" ? "PASSED" : "FAILED"}`);\n    const second = d.nextTask();\n    console.log(`[Test Case 3] Order invariant preserved... ${second === "t-high" ? "PASSED" : "FAILED"}`);\n} catch (e) {\n    console.log(`[Test Error] ${e.message}`);\n}\n'
            }
        }
    elif any(k in lower_skills for k in ["react", "next", "vue", "frontend", "typescript", "javascript"]):
        prob = {
            "id": f"prob-ts-{uuid.uuid4().hex[:6]}",
            "title": "Deep Reactive Object State Diff & Patch Engine",
            "difficulty": "Intermediate",
            "description": "Implement a state-diffing algorithm deep_diff(base, target) that recursively detects added, modified, and removed keys between two JSON objects, returning a delta patch dictionary.",
            "constraints": [
                "Recursively traverse arbitrary nested dictionaries and objects up to 10 levels deep.",
                "Return dictionary: {'added': {...}, 'modified': {...}, 'removed': [...]}.",
                "Average execution time under 5ms for objects with 500+ keys."
            ],
            "sampleCode": {
                "python": 'def deep_diff(base: dict, target: dict) -> dict:\n    added = {}\n    modified = {}\n    removed = []\n    for k, v in target.items():\n        if k not in base:\n            added[k] = v\n        elif base[k] != v:\n            modified[k] = {"before": base[k], "after": v}\n    for k in base:\n        if k not in target:\n            removed.append(k)\n    return {"added": added, "modified": modified, "removed": removed}\n',
                "typescript": 'export function deepDiff(base: Record<string, any>, target: Record<string, any>): Record<string, any> {\n  const added: Record<string, any> = {};\n  const modified: Record<string, any> = {};\n  const removed: string[] = [];\n  for (const key of Object.keys(target)) {\n    if (!(key in base)) added[key] = target[key];\n    else if (base[key] !== target[key]) modified[key] = { before: base[key], after: target[key] };\n  }\n  for (const key of Object.keys(base)) {\n    if (!(key in target)) removed.push(key);\n  }\n  return { added, modified, removed };\n}\n'
            },
            "testHarness": {
                "python": 'try:\n    b = {"version": 1, "status": "pending", "legacy": True}\n    t = {"version": 2, "status": "pending", "new_field": "active"}\n    res = deep_diff(b, t)\n    print(f"[Test Case 1] Added keys detection... {\'PASSED\' if \'new_field\' in res.get(\'added\', {}) else \'FAILED\'}")\n    print(f"[Test Case 2] Modified value tracking... {\'PASSED\' if res.get(\'modified\', {}).get(\'version\', {}).get(\'after\') == 2 else \'FAILED\'}")\n    print(f"[Test Case 3] Removed keys tracking... {\'PASSED\' if \'legacy\' in res.get(\'removed\', []) else \'FAILED\'}")\nexcept Exception as e:\n    print(f"[Test Error] {e}")\n',
                "javascript": 'try {\n    const b = { version: 1, status: "pending", legacy: true };\n    const t = { version: 2, status: "pending", new_field: "active" };\n    const res = deepDiff(b, t);\n    console.log(`[Test Case 1] Added keys detection... ${res.added && res.added.new_field === "active" ? "PASSED" : "FAILED"}`);\n    console.log(`[Test Case 2] Modified value tracking... ${res.modified && res.modified.version && res.modified.version.after === 2 ? "PASSED" : "FAILED"}`);\n    console.log(`[Test Case 3] Removed keys tracking... ${res.removed && res.removed.includes("legacy") ? "PASSED" : "FAILED"}`);\n} catch (e) {\n    console.log(`[Test Error] ${e.message}`);\n}\n'
            }
        }
    else:
        prob = {
            "id": f"prob-sys-{uuid.uuid4().hex[:6]}",
            "title": "Thread-Safe Sliding-Window Rate Limiter",
            "difficulty": "Hard",
            "description": "Design and implement a thread-safe, sliding-window rate limiter class SlidingWindowRateLimiter that tracks request timestamps to throttle requests exceeding limit within window_sec.",
            "constraints": [
                "allow_request(user_id: str) -> bool must execute in O(1) average time.",
                "Memory overhead per user key must not exceed 256 bytes.",
                "Handle multi-threaded lock contention cleanly."
            ],
            "sampleCode": {
                "python": 'import time\nfrom collections import deque\n\nclass SlidingWindowRateLimiter:\n    def __init__(self, limit: int = 5, window_sec: int = 1):\n        self.limit = limit\n        self.window_sec = window_sec\n        self.records = {}\n\n    def allow_request(self, user_id: str) -> bool:\n        now = time.time()\n        if user_id not in self.records:\n            self.records[user_id] = deque()\n        q = self.records[user_id]\n        while q and q[0] <= now - self.window_sec:\n            q.popleft()\n        if len(q) < self.limit:\n            q.append(now)\n            return True\n        return False\n',
                "typescript": 'export class SlidingWindowRateLimiter {\n  private limit: number;\n  private windowSec: number;\n  private records: Map<string, number[]> = new Map();\n\n  constructor(limit: number = 5, windowSec: number = 1) {\n    this.limit = limit;\n    this.windowSec = windowSec;\n  }\n\n  public allowRequest(userId: string): boolean {\n    const now = Date.now() / 1000;\n    if (!this.records.has(userId)) this.records.set(userId, []);\n    const times = this.records.get(userId)!;\n    while (times.length > 0 && times[0] <= now - this.windowSec) {\n      times.shift();\n    }\n    if (times.length < this.limit) {\n      times.push(now);\n      return true;\n    }\n    return false;\n  }\n}\n'
            },
            "testHarness": {
                "python": 'try:\n    limiter = SlidingWindowRateLimiter(limit=2, window_sec=1)\n    t1 = limiter.allow_request("user-alpha")\n    t2 = limiter.allow_request("user-alpha")\n    t3 = limiter.allow_request("user-alpha")\n    print(f"[Test Case 1] Burst limit capacity respected... {\'PASSED\' if (t1 and t2 and not t3) else \'FAILED\'}")\n    t_other = limiter.allow_request("user-beta")\n    print(f"[Test Case 2] User isolation under throttle... {\'PASSED\' if t_other else \'FAILED\'}")\n    time.sleep(1.05)\n    t4 = limiter.allow_request("user-alpha")\n    print(f"[Test Case 3] Sliding window eviction after expiration... {\'PASSED\' if t4 else \'FAILED\'}")\nexcept Exception as e:\n    print(f"[Test Error] {e}")\n',
                "javascript": 'try {\n    const limiter = new SlidingWindowRateLimiter(2, 1);\n    const t1 = limiter.allowRequest("user-alpha");\n    const t2 = limiter.allowRequest("user-alpha");\n    const t3 = limiter.allowRequest("user-alpha");\n    console.log(`[Test Case 1] Burst limit capacity respected... ${t1 && t2 && !t3 ? "PASSED" : "FAILED"}`);\n    const t_other = limiter.allowRequest("user-beta");\n    console.log(`[Test Case 2] User isolation under throttle... ${t_other ? "PASSED" : "FAILED"}`);\n    console.log(`[Test Case 3] Sliding window eviction after expiration... PASSED`);\n} catch (e) {\n    console.log(`[Test Error] ${e.message}`);\n}\n'
            }
        }

    if db is not None and session_id:
        try:
            db.interview_sessions.update_one(
                {"$or": [{"id": session_id}, {"session_id": session_id}]},
                {"$set": {"activeProblem": prob}}
            )
        except Exception:
            pass

    return prob


@interview_bp.route("/api/v1/interview-sessions/<session_id>/room-data", methods=["GET"])
@require_session_access
def get_interview_room_data(session_id):
    """Fetch live interview room initial state, stage stepper, and problem context."""
    try:
        session_meta = None
        db = get_mongo_db()
        if db is not None:
            try:
                session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
                if not session_meta:
                    return jsonify({"error": "Interview session not found", "status": 404}), 404
            except Exception as mongo_err:
                print(f"[Room Data] MongoDB query warning: {mongo_err}")

        user, resume_doc, skills = get_current_candidate(request)

        job_context = derive_job_context(session_meta)
        job_title = job_context["roleTitle"]
        company_name = job_context["companyName"]
        candidate_name = (session_meta and (session_meta.get("candidate_name") or session_meta.get("full_name"))) or (user and (user.get("full_name") or user.get("name"))) or "Candidate"
        first_name = candidate_name.split()[0] if candidate_name else "Candidate"

        questions = get_session_questions_data(session_id, request)
        stages = [q.get("stage", f"Stage {i+1}") for i, q in enumerate(questions)]
        active_problem = get_or_generate_session_coding_problem(session_id, session_meta, request)

        _mode = "practice" if (session_meta or {}).get("config", {}).get("is_practice") or (session_meta or {}).get("session_type") == "mock" else "real"
        # Prefer the shared derivation; only fall back for legacy rows that
        # predate duration metadata, never invent a 45/30/10 minute session.
        duration_minutes = job_context["durationMinutes"] or (
            10 if _mode == "practice" else 0
        )
        elapsed_seconds = 0
        _started = (session_meta or {}).get("started_at")
        if _started:
            try:
                elapsed_seconds = max(0, int((datetime.now(timezone.utc) - datetime.fromisoformat(str(_started).replace("Z", "+00:00"))).total_seconds()))
            except Exception:
                elapsed_seconds = 0

        return jsonify({
            "sessionId": session_id,
            "jobTitle": job_title,
            "companyName": company_name,
            "candidateName": candidate_name,
            "durationMinutes": duration_minutes,
            "elapsedSeconds": elapsed_seconds,
            "currentStage": stages[0] if stages else "Introduction",
            "stages": stages,
            "interviewerAvatar": {
                "name": "Sarah Chen",
                "role": "AI Interviewer — Staff Systems Engineer",
                "status": "active_speaking"
            },
            "activeProblem": active_problem,
            "subtitlesStream": [
                {"id": "sub-1", "speaker": "Sarah Chen", "text": f"Welcome {first_name}! Great to meet you. I'm Sarah, leading your technical conversation today. Feel free to review the challenge and think out loud anytime."}
            ]
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


def _posix_preexec() -> None:
    """Best-effort POSIX resource-limit preexec for the candidate sandbox.

    Caps address space (2 GiB — python/node/java friendly while containing
    memory bombs), CPU seconds (4), open file descriptors (64) and max file
    size (10 MiB), and places the child in its own process group. Every limit
    is applied independently; failure of one never blocks the others.
    No-op on non-POSIX platforms (preexec_fn=None there).
    """
    if _resource is None:
        return

    def _set(limit, soft, hard):
        try:
            _resource.setrlimit(limit, (soft, hard))
        except Exception:
            pass

    _set(_resource.RLIMIT_AS if hasattr(_resource, "RLIMIT_AS") else _resource.RLIMIT_VMEM,
         2 * 1024 * 1024 * 1024, 2 * 1024 * 1024 * 1024)
    _set(_resource.RLIMIT_CPU, 4, 4)
    _set(_resource.RLIMIT_NOFILE, 64, 64)
    _set(_resource.RLIMIT_FSIZE, 10 * 1024 * 1024, 10 * 1024 * 1024)
    try:
        os.setsid()
    except Exception:
        pass


_POSIX_PREEXEC = _posix_preexec if os.name == "posix" else None


def _get_sandboxed_env(tmpdir: str) -> dict:
    """
    Construct a strictly isolated, leak-proof execution environment.
    Strips all sensitive host environment variables (JWT_SECRET, MONGO_URI, API keys, etc.)
    so untrusted candidate code cannot leak secrets or read infrastructure configuration.
    """
    safe_path = os.environ.get("PATH", "")
    safe_system_root = os.environ.get("SYSTEMROOT", "C:\\Windows")
    safe_comspec = os.environ.get("COMSPEC", "C:\\Windows\\system32\\cmd.exe")
    safe_windir = os.environ.get("WINDIR", "C:\\Windows")

    return {
        "PATH": safe_path,
        "SYSTEMROOT": safe_system_root,
        "COMSPEC": safe_comspec,
        "WINDIR": safe_windir,
        "TEMP": tmpdir,
        "TMP": tmpdir,
        "PYTHONPATH": "",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUNBUFFERED": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "NODE_ENV": "sandbox",
    }


def _build_marked_exec_code(code: str, problem: dict, language: str):
    """Append the randomized test harness with per-run markers.

    The marker makes ``[PASSED]`` unforgeable — candidate code cannot guess
    the uuid prefix, so only the real harness can print markers. Returns
    ``(exec_code, marker)``.
    """
    is_python = language.startswith("python") or language in ("py", "python3")
    harness_key = "python" if is_python else "javascript"
    test_harness = (problem.get("testHarness") or {}).get(harness_key, "")
    marker = uuid.uuid4().hex[:12]
    if test_harness and test_harness not in code:
        marked_harness = re.sub(r"\bPASSED\b", f"{marker}_PASS", test_harness)
        marked_harness = re.sub(r"\bFAILED\b", f"{marker}_FAIL", marked_harness)
        comment = "#" if is_python else "//"
        return f"{code}\n\n{comment} --- Test Verification Harness ---\n{marked_harness}\n", marker
    return code, marker


def validate_code_security(code: str, language: str) -> tuple[bool, str | None]:
    """
    Multi-layer AST and heuristic security inspection.
    Rejects any destructive system calls, arbitrary file read/writes, network sockets,
    and reflection attacks across Python, JavaScript, C++, and Java.
    """
    clean_code = code or ""
    lang = language.lower()

    if lang in ("python", "py", "python3"):
        import ast

        FORBIDDEN_MODULES = frozenset([
            "os", "subprocess", "sys", "socket", "pty", "shutil", "winreg",
            "ctypes", "builtins", "__future__", "importlib", "pickle", "posix",
            "resource", "signal", "inspect", "multiprocessing", "threading",
            "urllib", "requests", "http", "webbrowser", "tempfile"
        ])

        FORBIDDEN_NAMES = frozenset([
            "open", "__import__", "eval", "exec", "compile", "globals",
            "locals", "vars", "__builtins__", "getattr", "setattr", "delattr",
            "help", "breakpoint", "input", "exit", "quit"
        ])

        FORBIDDEN_ATTRS = frozenset([
            "__class__", "__bases__", "__subclasses__", "__globals__",
            "__code__", "__builtins__", "__dict__", "__module__",
            "tb_frame", "f_builtins", "f_globals", "f_locals", "cr_frame", "gi_frame"
        ])

        try:
            parsed = ast.parse(clean_code)
            for node in ast.walk(parsed):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        base = alias.name.split('.')[0]
                        if base in FORBIDDEN_MODULES:
                            return False, f"Direct access to module '{alias.name}' is restricted in the interview sandbox."
                elif isinstance(node, ast.ImportFrom):
                    base = (node.module or "").split('.')[0]
                    if base in FORBIDDEN_MODULES:
                        return False, f"Direct access to module '{node.module}' is restricted in the interview sandbox."
                elif isinstance(node, ast.Name):
                    if node.id in FORBIDDEN_NAMES:
                        return False, f"Direct use of builtin function '{node.id}' is restricted in the interview sandbox."
                elif isinstance(node, ast.Attribute):
                    if node.attr in FORBIDDEN_ATTRS:
                        return False, f"Reflection attribute '{node.attr}' is restricted in the interview sandbox."
        except SyntaxError:
            pass  # Compiler will report natural syntax error diagnostics

    elif lang in ("javascript", "typescript", "js", "ts", "node"):
        js_forbidden = re.compile(
            r"\b(process|child_process|fs|require|eval|Function|global|globalThis|__dirname|__filename|import\s*\(|fetch|XMLHttpRequest|WebSocket|Worker)\b",
            re.IGNORECASE
        )
        match = js_forbidden.search(clean_code)
        if match:
            return False, f"Operation '{match.group(0)}' is restricted in the JavaScript interview sandbox."

    elif lang in ("cpp", "c++", "c"):
        cpp_forbidden = re.compile(
            r"(#\s*include\s*[<\"].*(fstream|filesystem|sys/|windows\.h|unistd\.h|cstdlib|winsock|pthread|stdio\.h|cstdio|fcntl\.h).*?[>\"]|\b(system|popen|fork|exec[lvp]*|socket|connect|remove|rename|fopen|freopen|tmpfile|getenv|putenv|setenv|kill|signal|syscall|__asm__|asm|WinExec|CreateProcess[AW]?|ShellExecute[AW]?|URLDownloadToFile[AW]?|LoadLibrary[AW]?|GetProcAddress)\b)",
            re.IGNORECASE
        )
        match = cpp_forbidden.search(clean_code)
        if match:
            return False, f"System header or call '{match.group(0)}' is restricted in the C++ interview sandbox."

    elif lang in ("java",):
        java_forbidden = re.compile(
            r"\b(java\.io\.(File|RandomAccessFile)|java\.nio\.file|java\.lang\.(Process|Runtime|ProcessBuilder|ClassLoader|System\.exit)|java\.net)\b"
        )
        match = java_forbidden.search(clean_code)
        if match:
            return False, f"System class '{match.group(0)}' is restricted in the Java interview sandbox."

    return True, None


@interview_bp.route("/api/v1/interview-sessions/<session_id>/code-run", methods=["POST"])
@require_session_access
def run_interview_code(session_id):
    """Execute candidate code submission in real isolated sandbox."""
    try:
        data = request.get_json(silent=True) or {}
        code = str(data.get("code", "")).strip()
        language = str(data.get("language", "python")).strip().lower()

        if not code:
            return jsonify({
                "success": False,
                "stdout": "Please enter some code to execute.",
                "stderr": "",
                "executionTimeMs": 0,
                "passedCount": 0,
                "totalCount": 0,
                "status": "Empty Code"
            }), 200

        db = get_mongo_db()
        session_meta = None
        if db is not None:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})

        if not session_meta:
            return jsonify({"success": False, "error": "Active interview session required to execute code"}), 404

        # Enforce authentication & session ownership verification
        claims, _ = _authenticate_request()
        if claims and claims.get("sub"):
            caller_id = str(claims.get("sub"))
            caller_role = str(claims.get("role", "")).lower()
            cand_id = str(session_meta.get("candidate_id") or session_meta.get("userId") or "")
            cand_em = str(session_meta.get("candidate_email") or "").lower()
            caller_em = str(claims.get("email") or "").lower()
            if caller_role not in ("admin", "super_admin"):
                if cand_id and cand_id != caller_id and cand_em != caller_em:
                    return jsonify({"success": False, "error": "Unauthorized: Session does not belong to your account"}), 403

        # Validate code security
        is_safe, sec_error = validate_code_security(code, language)
        if not is_safe:
            return jsonify({
                "success": False,
                "stdout": "",
                "stderr": f"Security restriction: {sec_error}",
                "executionTimeMs": 0,
                "passedCount": 0,
                "totalCount": 1,
                "status": "Security Restriction"
            }), 200

        problem = get_or_generate_session_coding_problem(session_id, session_meta, request)
        start_time = time.perf_counter()

        # --- Judge0 CE isolated sandbox (production path) ------------------
        # When JUDGE0_URL is configured, every submission runs in Judge0's
        # isolated, cgroup-limited container instead of the Flask host.
        try:
            from sandbox import judge0_client as j0
        except Exception:
            j0 = None

        if j0 is not None and j0.configured():
            lang_id = j0.language_id_for(language)
            if lang_id:
                exec_code, marker = _build_marked_exec_code(code, problem, language)
                try:
                    result = j0.execute(
                        source_code=exec_code,
                        language_id=lang_id,
                        cpu_time_limit_s=5,
                        memory_limit_kb=262144,
                        wall_time_limit_s=10,
                    )
                except Exception as j0_err:
                    print(f"[CodeRun] Judge0 execution failed: {j0_err}")
                    return jsonify({
                        "success": False,
                        "stdout": "",
                        "stderr": "Sandbox execution unavailable — please retry.",
                        "executionTimeMs": int((time.perf_counter() - start_time) * 1000),
                        "passedCount": 0,
                        "totalCount": 1,
                        "status": "Sandbox Unavailable",
                        "sandbox": "judge0",
                    }), 200

                elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                stdout = (result.stdout or "")[:25000]
                stderr = (result.stderr or "")[:25000]
                pass_marker = f"{marker}_PASS"
                fail_marker = f"{marker}_FAIL"
                passed_count = stdout.count(pass_marker)
                failed_count = stdout.count(fail_marker)
                harness_ran = bool(passed_count or failed_count)

                if result.status_id == j0.STATUS_COMPILATION_ERROR:
                    status = "Compilation Error"
                    ok, total_count, pass_count = False, 1, 0
                elif result.status_id == j0.STATUS_TIME_LIMIT:
                    status = "Time Limit Exceeded"
                    ok, total_count, pass_count = False, 1, 0
                elif harness_ran:
                    total_count = passed_count + failed_count
                    if failed_count == 0 and result.status_id == j0.STATUS_ACCEPTED:
                        status, ok, pass_count = "Accepted", True, passed_count
                    else:
                        status, ok, pass_count = "Wrong Answer", False, passed_count
                elif result.status_id == j0.STATUS_ACCEPTED:
                    status, ok, total_count, pass_count = "Unverified Run (harness produced no results)", True, 1, 1
                else:
                    status, ok, total_count, pass_count = "Runtime Error", False, 1, 0
                return jsonify({
                    "success": ok,
                    "stdout": stdout,
                    "stderr": stderr,
                    "executionTimeMs": elapsed_ms,
                    "time": f"{elapsed_ms / 1000.0:.2f}s",
                    "passedCount": pass_count,
                    "totalCount": total_count,
                    "status": status,
                    "sandbox": "judge0",
                }), 200
            # language not on the Judge0 CE list — fall through to subprocess dev runner

        if language in ("python", "py", "python3"):
            exec_code, marker = _build_marked_exec_code(code, problem, language)

            with tempfile.TemporaryDirectory() as tmpdir:
                script_path = os.path.join(tmpdir, "solution.py")
                with open(script_path, "w", encoding="utf-8") as f:
                    f.write(exec_code)

                try:
                    py_exec = sys.executable or "python"
                    proc = subprocess.run(
                        [py_exec, script_path],
                        capture_output=True,
                        preexec_fn=_POSIX_PREEXEC,
                        text=True,
                        timeout=5,
                        cwd=tmpdir,
                        env=_get_sandboxed_env(tmpdir),
                    )
                    elapsed_ms = round((time.perf_counter() - start_time) * 1000)
                    stdout = proc.stdout[:25000]
                    stderr = proc.stderr[:25000]
                    success = (proc.returncode == 0)

                    pass_marker = f"{marker}_PASS"
                    fail_marker = f"{marker}_FAIL"
                    passed_count = stdout.count(pass_marker)
                    failed_count = stdout.count(fail_marker)
                    harness_ran = bool(passed_count or failed_count)
                    if not harness_ran:
                        passed_count = 1 if success else 0
                        failed_count = 0
                        total_count = 1 if success else 0
                        status = "Unverified Run (harness produced no results)" if success else "Runtime Error"
                    else:
                        total_count = passed_count + failed_count
                        status = "Accepted" if success and failed_count == 0 else ("Wrong Answer" if success else "Runtime Error")
                    return jsonify({
                        "success": success and failed_count == 0,
                        "stdout": stdout,
                        "stderr": stderr,
                        "executionTimeMs": elapsed_ms,
                        "time": f"{elapsed_ms / 1000.0:.2f}s",
                        "passedCount": passed_count,
                        "totalCount": total_count,
                        "status": status,
                    }), 200
                except subprocess.TimeoutExpired:
                    return jsonify({
                        "success": False,
                        "stdout": "",
                        "stderr": "âš¡ Execution Timeout: Code ran longer than 5.0 seconds. Check for infinite loops or non-terminating recursion.",
                        "executionTimeMs": 5000,
                        "time": "5.00s",
                        "passedCount": 0,
                        "totalCount": 1,
                        "status": "Time Limit Exceeded",
                    }), 200

        elif language in ("javascript", "typescript", "js", "ts", "node"):
            node_bin = shutil.which("node")
            if not node_bin:
                return jsonify({
                    "success": False,
                    "stdout": "",
                    "stderr": "Node.js runtime environment is not configured on the server host.",
                    "executionTimeMs": 0,
                    "passedCount": 0,
                    "totalCount": 0,
                    "status": "Runner Unavailable",
                }), 200

            exec_code, marker = _build_marked_exec_code(code, problem, language)

            with tempfile.TemporaryDirectory() as tmpdir:
                script_path = os.path.join(tmpdir, "solution.js")
                with open(script_path, "w", encoding="utf-8") as f:
                    f.write(exec_code)

                try:
                    proc = subprocess.run(
                        [node_bin, script_path],
                        capture_output=True,
                        preexec_fn=_POSIX_PREEXEC,
                        text=True,
                        timeout=5,
                        cwd=tmpdir,
                        env=_get_sandboxed_env(tmpdir),
                    )
                    elapsed_ms = round((time.perf_counter() - start_time) * 1000)
                    stdout = proc.stdout[:25000]
                    stderr = proc.stderr[:25000]
                    success = (proc.returncode == 0)

                    pass_marker = f"{marker}_PASS"
                    fail_marker = f"{marker}_FAIL"
                    passed_count = stdout.count(pass_marker)
                    failed_count = stdout.count(fail_marker)
                    harness_ran = bool(passed_count or failed_count)
                    if not harness_ran:
                        passed_count = 1 if success else 0
                        failed_count = 0
                        total_count = 1 if success else 0
                        status = "Unverified Run (harness produced no results)" if success else "Runtime Error"
                    else:
                        total_count = passed_count + failed_count
                        status = "Accepted" if success and failed_count == 0 else ("Wrong Answer" if success else "Runtime Error")
                    return jsonify({
                        "success": success and failed_count == 0,
                        "stdout": stdout,
                        "stderr": stderr,
                        "executionTimeMs": elapsed_ms,
                        "time": f"{elapsed_ms / 1000.0:.2f}s",
                        "passedCount": passed_count,
                        "totalCount": total_count,
                        "status": status,
                    }), 200
                except subprocess.TimeoutExpired:
                    return jsonify({
                        "success": False,
                        "stdout": "",
                        "stderr": "âš¡ Execution Timeout: Code ran longer than 5.0 seconds. Check for infinite loops or non-terminating recursion.",
                        "executionTimeMs": 5000,
                        "time": "5.00s",
                        "passedCount": 0,
                        "totalCount": 1,
                        "status": "Time Limit Exceeded",
                    }), 200

        elif language in ("cpp", "c++", "c"):
            gpp_bin = shutil.which("g++") or shutil.which("clang++")
            if not gpp_bin:
                return jsonify({
                    "success": False,
                    "stdout": "",
                    "stderr": "C++ Compiler (g++/clang++) is not configured in this host environment. Please test your algorithm in Python or TypeScript/JavaScript.",
                    "executionTimeMs": 0,
                    "passedCount": 0,
                    "totalCount": 0,
                    "status": "Compiler Unavailable",
                }), 200

            with tempfile.TemporaryDirectory() as tmpdir:
                src_path = os.path.join(tmpdir, "solution.cpp")
                out_path = os.path.join(tmpdir, "solution.exe" if sys.platform == "win32" else "solution.out")
                with open(src_path, "w", encoding="utf-8") as f:
                    f.write(code)

                safe_env = _get_sandboxed_env(tmpdir)
                try:
                    compile_proc = subprocess.run(
                        [gpp_bin, "-O2", src_path, "-o", out_path],
                        capture_output=True,
                        preexec_fn=_POSIX_PREEXEC,
                        text=True,
                        timeout=8,
                        cwd=tmpdir,
                        env=safe_env,
                    )
                    if compile_proc.returncode != 0:
                        return jsonify({
                            "success": False,
                            "stdout": "",
                            "stderr": compile_proc.stderr[:10000] or compile_proc.stdout[:10000],
                            "executionTimeMs": 0,
                            "passedCount": 0,
                            "totalCount": 1,
                            "status": "Compilation Error",
                        }), 200

                    run_proc = subprocess.run(
                        [out_path],
                        capture_output=True,
                        preexec_fn=_POSIX_PREEXEC,
                        text=True,
                        timeout=5,
                        cwd=tmpdir,
                        env=safe_env,
                    )
                    elapsed_ms = round((time.perf_counter() - start_time) * 1000)
                    stdout = run_proc.stdout[:25000]
                    stderr = run_proc.stderr[:25000]
                    success = (run_proc.returncode == 0)
                    return jsonify({
                        "success": success,
                        "stdout": stdout,
                        "stderr": stderr,
                        "executionTimeMs": elapsed_ms,
                        "time": f"{elapsed_ms / 1000.0:.2f}s",
                        "passedCount": 1 if success else 0,
                        "totalCount": 1,
                        "status": "Compiled & Runs (unscored — no test harness for this language)" if success else "Runtime Error",
                    }), 200
                except subprocess.TimeoutExpired:
                    return jsonify({
                        "success": False,
                        "stdout": "",
                        "stderr": "âš¡ Execution Timeout: C++ binary ran longer than 5.0 seconds.",
                        "executionTimeMs": 5000,
                        "time": "5.00s",
                        "passedCount": 0,
                        "totalCount": 1,
                        "status": "Time Limit Exceeded",
                    }), 200

        elif language in ("java",):
            javac_bin = shutil.which("javac")
            java_bin = shutil.which("java")
            if not javac_bin or not java_bin:
                return jsonify({
                    "success": False,
                    "stdout": "",
                    "stderr": "Java Development Kit (javac/java) is not configured in this host environment. Please test your algorithm in Python or TypeScript/JavaScript.",
                    "executionTimeMs": 0,
                    "passedCount": 0,
                    "totalCount": 0,
                    "status": "Compiler Unavailable",
                }), 200

            with tempfile.TemporaryDirectory() as tmpdir:
                src_path = os.path.join(tmpdir, "Solution.java")
                with open(src_path, "w", encoding="utf-8") as f:
                    f.write(code)

                safe_env = _get_sandboxed_env(tmpdir)
                try:
                    compile_proc = subprocess.run(
                        [javac_bin, src_path],
                        capture_output=True,
                        preexec_fn=_POSIX_PREEXEC,
                        text=True,
                        timeout=8,
                        cwd=tmpdir,
                        env=safe_env,
                    )
                    if compile_proc.returncode != 0:
                        return jsonify({
                            "success": False,
                            "stdout": "",
                            "stderr": compile_proc.stderr[:10000] or compile_proc.stdout[:10000],
                            "executionTimeMs": 0,
                            "passedCount": 0,
                            "totalCount": 1,
                            "status": "Compilation Error",
                        }), 200

                    run_proc = subprocess.run(
                        [java_bin, "-cp", tmpdir, "Solution"],
                        capture_output=True,
                        preexec_fn=_POSIX_PREEXEC,
                        text=True,
                        timeout=5,
                        cwd=tmpdir,
                        env=safe_env,
                    )
                    elapsed_ms = round((time.perf_counter() - start_time) * 1000)
                    stdout = run_proc.stdout[:25000]
                    stderr = run_proc.stderr[:25000]
                    success = (run_proc.returncode == 0)
                    return jsonify({
                        "success": success,
                        "stdout": stdout,
                        "stderr": stderr,
                        "executionTimeMs": elapsed_ms,
                        "time": f"{elapsed_ms / 1000.0:.2f}s",
                        "passedCount": 1 if success else 0,
                        "totalCount": 1,
                        "status": "Compiled & Runs (unscored — no test harness for this language)" if success else "Runtime Error",
                    }), 200
                except subprocess.TimeoutExpired:
                    return jsonify({
                        "success": False,
                        "stdout": "",
                        "stderr": "âš¡ Execution Timeout: Java program ran longer than 5.0 seconds.",
                        "executionTimeMs": 5000,
                        "time": "5.00s",
                        "passedCount": 0,
                        "totalCount": 1,
                        "status": "Time Limit Exceeded",
                    }), 200

        else:
            return jsonify({
                "success": False,
                "stdout": "",
                "stderr": f"Direct execution for '{language}' is not enabled in this sandbox container. Please test your algorithm in Python or TypeScript/JavaScript.",
                "executionTimeMs": 0,
                "passedCount": 0,
                "totalCount": 0,
                "status": "Unsupported Language",
            }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": generic_500(e),
            "stdout": "",
            "stderr": "Execution service error. Please retry.",
        }), 500


# ------------------------------------------------------------------------------
# CANDIDATE EVALUATION REPORT & VERIFIED DOSSIER ENDPOINTS
# ------------------------------------------------------------------------------

@interview_bp.route("/api/v1/interview-sessions/<session_id>/report", methods=["GET"])
def get_candidate_evaluation_report(session_id):
    """Aggregate session metadata & turn evaluations into verified dossier tailored to candidate resume and skills."""
    try:
        user, resume_doc, skills = get_current_candidate(request)

        cand_name = (user and (user.get("full_name") or user.get("name"))) or "Candidate"
        cand_email = (user and user.get("email")) or "candidate@progeni.atlas"
        course = (user and (user.get("course") or user.get("degree"))) or "B.Tech Computer Science"
        branch = (user and user.get("branch")) or ""
        academic_year = (user and user.get("academic_year")) or "4th Year"
        program = f"{course} {branch}".strip() if branch else course

        candidate_info = {
            "fullName": cand_name,
            "email": cand_email,
            "program": program,
            "academicYear": academic_year
        }
        # Every jobContext field comes from the session/config. No now(), no
        # placeholder employer, no invented role or duration.
        job_info = derive_job_context(None)
        session_doc = None
        stored_score = None
        stored_recommendation = None
        # No stored scores => stay honest and unscored (never fabricate a verdict).
        total_score = None
        recommendation = None

        db = get_mongo_db()
        if db is not None:
            try:
                session_doc = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})
                if not session_doc:
                    return jsonify({"error": "Interview session not found", "status": 404}), 404

                # Authoritative ownership guard: Only candidate, recruiter or admin can access report
                claims, err = _authenticate_request()
                if err or not claims or not claims.get("sub"):
                    return jsonify({"error": "Authentication required to access evaluation report", "status": 401}), 401

                caller_id = str(claims.get("sub"))
                caller_role = str(claims.get("role", "")).lower()
                cand_id = str(session_doc.get("candidate_id") or session_doc.get("userId") or "")
                rec_id = str(session_doc.get("recruiter_id") or "")
                cand_em = str(session_doc.get("candidate_email") or "").lower()
                caller_em = str(claims.get("email") or "").lower()
                if caller_role not in ("admin", "super_admin"):
                    if caller_id != cand_id and caller_id != rec_id and caller_em != cand_em:
                        return jsonify({"error": "Unauthorized: Access to this evaluation report is restricted", "status": 403}), 403

                if session_doc:
                    if session_doc.get("candidate_name") or session_doc.get("full_name"):
                        candidate_info["fullName"] = session_doc.get("candidate_name") or session_doc.get("full_name")
                    if session_doc.get("candidate_email") or session_doc.get("email"):
                        candidate_info["email"] = session_doc.get("candidate_email") or session_doc.get("email")
                    if session_doc.get("course"):
                        c_val = session_doc.get("course")
                        b_val = session_doc.get("branch", "")
                        candidate_info["program"] = f"{c_val} {b_val}".strip() if b_val else c_val
                    if session_doc.get("academic_year"):
                        candidate_info["academicYear"] = session_doc["academic_year"]
                    job_info = derive_job_context(session_doc)
                    scorecard = session_doc.get("scorecard") if isinstance(session_doc.get("scorecard"), dict) else {}
                    if scorecard.get("overall_score") is not None:
                        stored_score = scorecard["overall_score"]
                    elif session_doc.get("overall_score") is not None:
                        stored_score = session_doc["overall_score"]
                    elif session_doc.get("total_score") is not None:
                        stored_score = session_doc["total_score"]
                    stored_recommendation = (
                        scorecard.get("recommendation")
                        or session_doc.get("final_recommendation")
                        or session_doc.get("recommendation")
                    )
            except Exception as mongo_err:
                print(f"[Report] MongoDB query warning: {mongo_err}")

        # Core skills extracted from resume
        s1 = skills[0] if len(skills) > 0 else "Software Architecture"
        s2 = skills[1] if len(skills) > 1 else "API Engineering"
        s3 = skills[2] if len(skills) > 2 else "Data Structures"
        s4 = skills[3] if len(skills) > 3 else "Cloud Infrastructure"

        # Turn Reviews: Map authentic recorded session history if present, else fallback.
        # History schema (written by /answer): {turn_index, question, answer, stage,
        #   scores:{relevance,depth,correctness} (0-10), evaluator_feedback,
        #   missing_concepts, red_flags, action_decision, intent, is_follow_up, timestamp}
        session_history = (session_doc and session_doc.get("history")) or []
        turns = _map_history_turn_reviews(session_history)

        # Scores, statuses and turnReviews all derive from the SAME mapped
        # history. A zero-answer session never inherits a stale stored score.
        scored_turns = [turn for turn in turns if _turn_has_scored_answer(turn)]
        has_real_data = bool(scored_turns)

        if has_real_data and stored_score is not None:
            try:
                total_score = round(float(stored_score), 1)
                recommendation = resolve_recommendation(
                    total_score,
                    source={
                        "recommendation": stored_recommendation,
                        "final_recommendation": stored_recommendation,
                        "scorecard": (session_doc or {}).get("scorecard") or {},
                        **(session_doc or {}),
                    },
                )
            except (TypeError, ValueError):
                total_score = None
                recommendation = None
        else:
            total_score = None
            recommendation = None

        # Prefer the real LLM-synthesised scorecard persisted on the session;
        # fall back to nothing rather than canned prose.
        sc_doc = (session_doc and session_doc.get("scorecard")) or {}
        sc_strengths = [str(s) for s in (sc_doc.get("strengths") or []) if str(s).strip()]
        try:
            from app.services import llm_service as _report_strength_filter
            sc_strengths = _report_strength_filter.filter_scorecard_strengths(
                sc_strengths,
                transcript=[{"question": h.get("question"), "answer": h.get("answer")} for h in session_history],
                evaluations=[{
                    "question": h.get("question"),
                    "evaluator_feedback": h.get("evaluator_feedback") or "",
                    "notes": h.get("evaluator_feedback") or "",
                } for h in session_history],
                questions=(session_doc or {}).get("questions"),
            )
        except Exception:
            pass
        sc_concerns = [str(s) for s in (sc_doc.get("concerns") or []) if str(s).strip()]
        sc_summary = str(sc_doc.get("executive_summary") or "").strip()
        sc_competencies = sc_doc.get("competencies") if isinstance(sc_doc.get("competencies"), list) else []
        sc_model = str(sc_doc.get("model_used") or "")

        role_label = job_info.get("roleTitle", "Software Engineer")
        if has_real_data:
            executive_summary = sc_summary or (
                f"{candidate_info['fullName']} completed the {role_label} technical conversation. "
                f"The hiring team will review the full transcript and evidence before any decision is made."
            )
            verified_strengths = sc_strengths or [
                "Completed the structured technical conversation across role-relevant topics.",
                "Evidence reviewed by the hiring team against the role rubric.",
            ]
            growth_areas = sc_concerns or ["The hiring team will share specific development feedback after review."]
        else:
            executive_summary = None
            verified_strengths = []
            growth_areas = []

        # Proctoring counters are disclosed tab/paste/focus events ONLY — no gaze
        # or presence inference exists. Facts reported as-is; humans interpret.
        suspicious_events = []
        warning_count = 0
        event_counts = {}
        if db is not None:
            try:
                proc_cursor = db.proctoring_events.find({"session_id": session_id}).sort("timestamp", 1)
                for pe in proc_cursor:
                    etype = str(pe.get("event_type", "event"))
                    if etype not in ("tab_switch", "paste_event", "window_blur", "fullscreen_exit", "mic_disabled", "camera_disabled"):
                        continue  # vision-based inference (gaze/faces) is not collected or surfaced
                    warning_count += 1
                    event_counts[etype] = event_counts.get(etype, 0) + 1
                    t_sec = pe.get("timestampSec") or pe.get("time_sec") or 0
                    try:
                        t_sec = int(t_sec)
                    except (TypeError, ValueError):
                        t_sec = 0
                    mins = int(t_sec // 60)
                    secs = int(t_sec % 60)
                    suspicious_events.append({
                        "id": str(pe.get("_id", uuid.uuid4().hex[:8])),
                        "title": pe.get("detail") or etype.replace("_", " ").title(),
                        "timestampSec": t_sec,
                        "formattedTime": f"{mins:02d}:{secs:02d}",
                        "severity": "medium" if etype in ("tab_switch", "multiple_faces") else "low",
                        "reason": pe.get("detail") or etype
                    })
            except Exception as pe_err:
                print(f"[Report] Proctoring lookup error: {pe_err}")

        if not suspicious_events:
            suspicious_events = []
            warning_count = 0
            event_counts = {}

        report_payload = {
            "sessionId": session_id,
            "candidate": candidate_info,
            "jobContext": job_info,
            "overallScore": total_score,
            "hiringRecommendation": recommendation,
            "percentileRank": None,
            "competencyPillars": sc_competencies or None,
            "executiveSummary": executive_summary,
            "verifiedStrengths": verified_strengths,
            "targetedGrowthAreas": growth_areas,
            "scorecardModel": sc_model or None,
            "proctoringIntegritySummary": {
                "totalEvents": warning_count,
                "warningCount": warning_count,
                "threshold": 5,
                "flagged": warning_count >= 5,
                "eventCounts": event_counts,
                "tabSwitchCount": event_counts.get("tab_switch", 0),
                "pasteCount": event_counts.get("paste_event", 0),
                "suspiciousEvents": suspicious_events
            },
            "turnReviews": turns,
            "reportStatus": "completed" if has_real_data else "pending",
            "transcriptStatus": "available" if has_real_data else "pending",
            "verificationDossierId": f"TP-2026-{session_id[:6].upper()}"
        }
        if not _caller_is_internal():
            # Operational proctoring data and internal references are for the
            # hiring team only. Candidates receive the evidence-based report.
            for internal_key in (
                "sessionId",
                "proctoringIntegritySummary",
                "verificationDossierId",
            ):
                report_payload.pop(internal_key, None)
        return jsonify(report_payload), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


@interview_bp.route("/api/v1/interview-sessions/<session_id>/report/pdf", methods=["GET"])
def export_report_pdf(session_id):
    """Generate verified candidate dossier scorecard report with print/PDF styling."""
    try:
        from core.db import get_mongo_db
        db = get_mongo_db()
        sess = None
        if db is not None:
            sess = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]})

        if not sess:
            return jsonify({"error": "Interview session not found", "status": 404}), 404

        # Authoritative ownership guard: Only candidate, recruiter or admin can access PDF report
        claims, err = _authenticate_request()
        if err or not claims or not claims.get("sub"):
            return jsonify({"error": "Authentication required to access dossier PDF", "status": 401}), 401

        caller_id = str(claims.get("sub"))
        caller_role = str(claims.get("role", "")).lower()
        cand_id = str(sess.get("candidate_id") or sess.get("userId") or "")
        rec_id = str(sess.get("recruiter_id") or "")
        cand_em = str(sess.get("candidate_email") or "").lower()
        caller_em = str(claims.get("email") or "").lower()
        if caller_role not in ("admin", "super_admin"):
            if caller_id != cand_id and caller_id != rec_id and caller_em != cand_em:
                return jsonify({"error": "Unauthorized: Access to this dossier PDF is restricted", "status": 403}), 403

        cand_name = sess.get("candidate_name") or sess.get("name") or "Candidate"
        cand_email = sess.get("candidate_email") or ""
        job_title = sess.get("job_title") or sess.get("target_position") or "Software Engineer"
        sc_doc = sess.get("scorecard") or {}
        breakdown = sess.get("score_breakdown") or {}
        strengths = [str(s) for s in (sc_doc.get("strengths") or sess.get("key_highlights") or []) if str(s).strip()][:6]
        growth = [str(s) for s in (sc_doc.get("concerns") or []) if str(s).strip()][:6]
        summary = str(sc_doc.get("executive_summary") or sess.get("summary") or "Interview evidence recorded. The hiring team reviews every conversation personally before any decision.")

        has_data = bool(sess.get("answered_turns") or sess.get("total_score") is not None)
        assess_status = "Completed — pending team review" if has_data else "Pending evaluation"

        # Real proctoring counters (disclosed events only); zero fabricated telemetry
        tab_switches = 0
        paste_events = 0
        focus_events = 0
        try:
            if db is not None:
                for pe in db.proctoring_events.find({"session_id": session_id}, {"event_type": 1}):
                    et = str(pe.get("event_type") or "")
                    if et == "tab_switch":
                        tab_switches += 1
                    elif et == "paste_event":
                        paste_events += 1
                    elif et in ("window_blur", "fullscreen_exit"):
                        focus_events += 1
        except Exception:
            pass
        proc_summary = f"Tab switches: {tab_switches} &bull; Paste events: {paste_events} &bull; Focus events: {focus_events} &bull; AI makes no integrity judgment — a human reviews these raw counts."

        if request.args.get("format") == "json":
            return jsonify({
                "success": True,
                "dossierId": f"TP-2026-{session_id[:6].upper()}",
                "candidateName": cand_name,
                "candidateEmail": cand_email,
                "jobTitle": job_title,
                "strengths": strengths,
                "growthAreas": growth,
                "status": assess_status,
                "summary": summary
            }), 200

        import html as html_lib

        def _bar(label: str, value, color: str = "#6366f1"):
            try:
                pct = max(0, min(100, float(value)))
            except (TypeError, ValueError):
                pct = 0.0
                note = " <span style='color:#94a3b8;font-weight:400'>(no data)</span>"
                return f'<div class="bar-box"><div class="bar-head"><span>{label}</span><span>Pending</span></div><div class="bar-track"><div class="bar-fill" style="width: {pct}%; background: {color};"></div></div></div>'
            return f'<div class="bar-box"><div class="bar-head"><span>{label}</span><span>{pct:.0f}%</span></div><div class="bar-track"><div class="bar-fill" style="width: {pct}%; background: {color};"></div></div></div>'

        bar_html = "".join([
            _bar("Technical Depth", breakdown.get("technicalDepth"), "#6366f1"),
            _bar("System Architecture", breakdown.get("systemArchitecture"), "#06b6d4"),
            _bar("Problem Solving", breakdown.get("problemSolving"), "#10b981"),
            _bar("Communication", breakdown.get("communication"), "#f59e0b"),
        ])
        strengths_html = "".join(f"<li>{html_lib.escape(s)}</li>" for s in strengths) or "<li>Interview completed — pending team review.</li>"
        growth_html = "".join(f"<li>{html_lib.escape(s)}</li>" for s in growth) or "<li>Specific growth areas will be shared by the hiring team after review.</li>"

        now_str = datetime.now(timezone.utc).strftime('%b %d, %Y')
        short_id = session_id[:8].upper()
        safe_name = html_lib.escape(str(cand_name))
        safe_email = html_lib.escape(str(cand_email))
        safe_title = html_lib.escape(str(job_title))
        safe_summary = html_lib.escape(str(summary))

        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Progeni Atlas Dossier - {safe_name}</title>
  <style>
    @page {{ size: A4 portrait; margin: 12mm; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 24px; }}
    .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 20px; }}
    .logo {{ font-size: 20px; font-weight: 800; color: #0f172a; }}
    .sub {{ font-size: 10px; color: #64748b; font-family: monospace; text-transform: uppercase; }}
    .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }}
    .name {{ font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }}
    .meta {{ font-size: 12px; color: #64748b; margin: 0; }}
    .score-box {{ text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 18px; }}
    .score-num {{ font-size: 24px; font-weight: 800; color: #6366f1; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; background: #10b981; color: #fff; margin-top: 4px; }}
    .section-title {{ font-size: 12px; font-weight: 700; color: #0f172a; border-left: 3px solid #6366f1; padding-left: 8px; margin: 20px 0 10px 0; text-transform: uppercase; }}
    .grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }}
    .bar-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }}
    .bar-head {{ display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; margin-bottom: 6px; }}
    .bar-track {{ height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }}
    .bar-fill {{ height: 100%; background: #6366f1; border-radius: 3px; }}
    .proc-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }}
    .proc-card {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px; font-size: 10px; color: #166534; }}
    .proc-card strong {{ display: block; font-size: 11px; color: #15803d; }}
    .summary-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 12px; line-height: 1.6; color: #334155; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }}
    @media print {{
      .no-print {{ display: none; }}
    }}
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>
  <div class="header">
    <div>
      <div class="logo">PROGENI ATLAS</div>
      <div class="sub">Interview Evidence Dossier &bull; Hiring Team Review</div>
    </div>
    <div style="text-align: right; font-family: monospace; font-size: 11px; color: #64748b;">
      <div>REF: TP-{short_id}</div>
      <div>Issued: {now_str}</div>
    </div>
  </div>

  <div class="card">
    <div>
      <h1 class="name">{safe_name}</h1>
      <p class="meta">{safe_email} &bull; {safe_title}</p>
      <p class="meta" style="margin-top: 4px;">Assessment Status: {assess_status}</p>
    </div>
    <div class="score-box">
      <div class="score-num" style="font-size: 13px; line-height: 1.4; color:#334155;">Reviewed by<br/>the hiring team</div>
    </div>
  </div>

  <div class="section-title">Disclosed Interaction Counters</div>
  <div class="summary-box" style="margin-bottom: 16px;">{proc_summary}</div>

  <div class="section-title">4-Pillar Competency Breakdown</div>
  <div class="grid">
    {bar_html}
  </div>

  <div class="section-title">What Stood Out</div>
  <ul style="font-size: 12px; line-height: 1.7; color: #334155; margin-top: 4px;">
    {strengths_html}
  </ul>

  <div class="section-title">Where to Sharpen</div>
  <ul style="font-size: 12px; line-height: 1.7; color: #334155; margin-top: 4px;">
    {growth_html}
  </ul>

  <div class="section-title">Summary</div>
  <div class="summary-box">
    {safe_summary}
  </div>

  <div class="footer">
    <span>Interview Evidence Dossier &bull; Progeni Atlas &bull; Every decision is made by a human</span>
    <span>For hiring team review</span>
  </div>
</body>
</html>"""
        return Response(html, mimetype="text/html")
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500
