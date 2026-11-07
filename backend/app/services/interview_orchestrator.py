"""Single authoritative interview orchestrator.

Every interview stage transition happens here, under one row lock, in one
transaction. Routes validate authorization and then call one of these methods;
they never write `status`/`lifecycle_state` themselves and never decide what
happens next. This extends `interview_engine` (question generation, evaluation,
scorecard) rather than duplicating it.
"""
from __future__ import annotations

import json
import logging
import math
import time
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    ActionDecision,
    InterviewQuestion,
    InterviewResponse,
    InterviewSession,
    ProctoringEvent,
    ProctoringEventType,
    Scorecard,
    Severity,
)
from app.services import interview_engine as engine
from app.services.llm_service import LLMError

logger = logging.getLogger("progeni_atlas.orchestrator")

# Stages that call a provider and therefore need latency/retry observability.
AI_STAGES = ("greeting", "generate_question", "evaluate_answer", "scorecard")


class _StageTimer:
    """Structured per-stage logging with bounded, logged retries."""

    def __init__(self, session_id, stage, *, retries: int = 0):
        self._log = {"session_id": str(session_id), "stage": stage, "retry_count": retries}
        self._started = time.perf_counter()

    def finish(self, success: bool, **fields) -> None:
        entry = {
            **self._log,
            "latency_ms": int((time.perf_counter() - self._started) * 1000),
            "success": success,
            **fields,
        }
        logger.info("interview.stage %s", json.dumps(entry, default=str))


class InterviewFlowError(Exception):
    """A requested operation is not permitted in the current lifecycle state."""

    def __init__(self, message: str, status_code: int = 409, **details):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class ProviderStageError(Exception):
    """A required AI/voice provider stage failed. Never faked, always retryable."""

    def __init__(self, message: str, *, recovery_state: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.recovery_state = recovery_state
        self.status_code = status_code


# Per-interview AI budget. Exceeding a limit is a real refusal, not a silent
# truncation, and no loop here can retry without bound.
DEFAULT_LIMITS = {
    "max_questions": 12,
    "max_follow_ups": 4,
    "max_llm_calls": 40,
    "max_stt_seconds": 900,
    "max_tts_seconds": 900,
}


def _session_mode(session: InterviewSession) -> str:
    return getattr(session, "mode", None) or (session.config or {}).get("mode") or "real"


def _limits(session: InterviewSession) -> dict:
    configured = DEFAULT_LIMITS.copy()
    for key in configured:
        value = (session.config or {}).get(key)
        if isinstance(value, int) and not isinstance(value, bool) and value > 0:
            configured[key] = value
    return configured


def _usage(session: InterviewSession, **kwargs) -> dict:
    """Return the per-interview AI usage ledger.

    Loads the current ledger from session.config["ai_usage"] if present,
    or falls back to default initial values. Any keyword arguments passed
    in will update/override the ledger values.
    """
    raw = (session.config or {}).get("ai_usage")
    base = dict(raw) if isinstance(raw, dict) else {
        "llm_calls": 0, "input_tokens": 0, "output_tokens": 0,
        "stt_seconds": 0, "tts_seconds": 0, "follow_ups": 0,
    }
    for key in ("llm_calls", "input_tokens", "output_tokens", "stt_seconds", "tts_seconds", "follow_ups"):
        base.setdefault(key, 0)
    for k, v in kwargs.items():
        if v is not None:
            base[k] = v
    return base


def record_usage(db: Session, session: InterviewSession, **deltas) -> None:
    usage = _usage(session)
    for key, delta in deltas.items():
        if key in ("input_tokens", "output_tokens", "cached_tokens",
                   "reasoning_tokens", "total_tokens"):
            # Delta represents the new count from caller.
            usage[key] = int(delta)
        elif key in ("stt_seconds", "tts_seconds"):
            usage[key] = round(float(usage.get(key, 0.0)) + float(delta), 3)
        else:
            usage[key] = int(usage.get(key, 0)) + int(delta)
    # Compute cost using documented rates: gpt-4o-mini ($0.15/1M in, $0.60/1M out),
    # STT ($0.006/min = $0.0001/s), and speech ledger's verified tts_cost_usd when available.
    speech_ledger = (usage.get("speech") or {}) if isinstance(usage.get("speech"), dict) else {}
    speech_tts_usd = float(speech_ledger.get("tts_cost_usd") or 0.0)
    tts_fallback_cost = speech_tts_usd if speech_tts_usd > 0 else (0.000015 * float(usage.get("tts_chars", 0) or 0))

    input_t = float(usage.get("input_tokens", 0) or 0)
    output_t = float(usage.get("output_tokens", 0) or 0)

    usage["estimated_cost_usd"] = round(
        0.00000015 * input_t
        + 0.00000060 * output_t
        + 0.00010000 * float(usage.get("stt_seconds", 0) or 0)
        + tts_fallback_cost,
        6,
    )
    config = dict(session.config or {})
    config["ai_usage"] = usage
    session.config = config

    if config.get("is_demo") and session.candidate_id:
        try:
            from core.demo_allowance import record_demo_provider_cost
            cost_usd = float(usage.get("estimated_cost_usd", 0.0))
            cost_nanousd = int(cost_usd * 1_000_000_000)
            if cost_nanousd > 0:
                record_demo_provider_cost(
                    session_id=str(session.id),
                    user_id=str(session.candidate_id),
                    cost_nanousd=cost_nanousd,
                    service_type="llm_interview",
                    tokens=int(input_t + output_t),
                )
        except Exception as _cost_err:
            logger.debug("Demo provider cost tracking: %s", _cost_err)


def _charge_llm_budget(db: Session, session: InterviewSession, stage: str) -> None:
    limits = _limits(session)
    usage = _usage(session)
    if int(usage.get("llm_calls", 0)) >= limits["max_llm_calls"]:
        raise InterviewFlowError("This interview has reached its AI call limit.", 429, stage=stage)


def _transition(db: Session, session: InterviewSession, target: str, *, reason: str,
                actor_type: str = "system", actor_id: uuid.UUID | None = None,
                metadata: dict | None = None) -> None:
    prev_state = engine.lifecycle_state(session)
    try:
        engine.transition_session(
            db, session, target, actor_type=actor_type, actor_id=actor_id,
            reason=reason, metadata=metadata,
        )
        new_state = engine.lifecycle_state(session)
        logger.info(
            "[DIAG_TRANSITION] session_id=%s mode=%s prev_state=%s target=%s new_state=%s state_version=%s reason=%r",
            session.id, getattr(session, "mode", "real"), prev_state, target, new_state,
            getattr(session, "state_version", 0), reason
        )
    except engine.StaleStateVersion as exc:
        # Optimistic concurrency: the caller holds a view the session has left.
        raise InterviewFlowError(
            str(exc), 409,
            current_state=engine.lifecycle_state(session),
            state_version=exc.current_version,
            reason_code="stale_state_version",
        ) from exc
    except engine.InvalidLifecycleTransition as exc:
        raise InterviewFlowError(str(exc), 409, current_state=engine.lifecycle_state(session)) from exc


def _require_state(session: InterviewSession, *allowed: str) -> str:
    state = engine.lifecycle_state(session)
    if state not in allowed:
        raise InterviewFlowError(
            f"This action is not allowed while the interview is {state}.", 409,
            current_state=state, allowed_states=list(allowed),
            state_version=int(getattr(session, "state_version", 0) or 0),
        )
    return state


def authorize_interview(db: Session, session: InterviewSession, *, actor_id: uuid.UUID,
                        actor_role: str = "candidate") -> str:
    """Record the audited AUTHENTICATED -> INTERVIEW_AUTHORIZED -> LOBBY chain.

    Ownership and tenant have already been proven by the route's
    `assert_candidate_session_access` / `assert_session_access` check; this makes
    that decision visible in the lifecycle history instead of implicit. It is
    idempotent: a session already past authorization is returned unchanged.
    """
    state = engine.lifecycle_state(session)
    if state not in ("AUTHENTICATED", "INTERVIEW_AUTHORIZED", "LOBBY"):
        return state
    metadata = {"actor_role": actor_role, "stage": "authorize"}
    if state == "AUTHENTICATED":
        _transition(db, session, "INTERVIEW_AUTHORIZED",
                    reason="candidate ownership and tenant scope verified",
                    actor_type="candidate", actor_id=actor_id, metadata=metadata)
        state = engine.lifecycle_state(session)
    if state == "INTERVIEW_AUTHORIZED":
        _transition(db, session, "LOBBY", reason="candidate entered the interview lobby",
                    actor_type="candidate", actor_id=actor_id, metadata=metadata)
    return engine.lifecycle_state(session)


def _lock_session(db: Session, session_id: uuid.UUID) -> InterviewSession:
    session = db.scalar(
        select(InterviewSession).where(InterviewSession.id == session_id).with_for_update()
    )
    if session is None:
        raise InterviewFlowError("Interview session not found", 404)
    return session


def lock_session(db: Session, session_id: uuid.UUID) -> InterviewSession:
    """Row-lock the session for the caller's transaction (routes call this first)."""
    return _lock_session(db, session_id)


def _latest_question(db: Session, session: InterviewSession) -> InterviewQuestion | None:
    return db.scalar(
        select(InterviewQuestion)
        .where(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.turn_index.desc())
        .limit(1)
    )


def _answered_count(db: Session, session: InterviewSession) -> int:
    return int(db.scalar(
        select(func.count()).select_from(InterviewResponse)
        .where(InterviewResponse.session_id == session.id)
    ) or 0)


def _total_turns(session: InterviewSession) -> int:
    config = session.config or {}
    value = config.get("total_turns", 5)
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return 5


# --------------------------------------------------------------- preflight
def preflight(db: Session, session: InterviewSession, report: dict, *, actor_id: uuid.UUID) -> dict:
    """Verify proctoring + media capabilities, then move to MEDIA_READY.

    `report` is the client-observed hardware/proctoring capability report. It is
    recorded as evidence; a missing required capability fails closed rather than
    marking media ready.
    """
    state = engine.lifecycle_state(session)
    if state == "MEDIA_READY" or state in engine.TURN_STATES or state in engine.CLOSING_STATES:
        evidence = (session.config or {}).get("preflight", {
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "failures": [],
            "report": {k: v for k, v in report.items() if isinstance(v, (str, int, float, bool, type(None)))},
        })
        return evidence

    _require_state(session, "AUTHENTICATED", "INTERVIEW_AUTHORIZED", "LOBBY",
                   "PROCTORING_PREFLIGHT", "MEDIA_ERROR", "PAUSED")
    _transition(db, session, "PROCTORING_PREFLIGHT",
                reason="candidate opened proctoring preflight", actor_id=actor_id)

    config = session.config or {}
    # A realtime screening interview additionally requires the web-only
    # capabilities: LiveKit transport, fullscreen and face monitoring.
    # The server-derived requirement always wins: a client claim can only ever
    # ask for *more* scrutiny, never disable the real-interview gates. Practice
    # sessions (server-side `_requires_livekit()` false) are never forced onto
    # LiveKit, fullscreen or face gates.
    realtime = bool(report.get("requires_livekit")) or _requires_livekit(session)
    failures: list[str] = []
    if not report.get("camera_ok"):
        failures.append("camera permission was not granted")
    if not report.get("microphone_ok"):
        failures.append("microphone permission was not granted")
    if realtime:
        if not report.get("livekit_connected"):
            failures.append("the realtime media session is not connected")
        is_publishing = report.get("livekit_publishing") or (
            report.get("livekit_publishing_video") is not False and report.get("livekit_publishing_audio") is not False and (report.get("livekit_publishing_video") or report.get("livekit_publishing_audio"))
        )
        if not report.get("livekit_publishing") and not is_publishing:
            failures.append("the candidate media track is not being published")
    if config.get("require_fullscreen", realtime) and not report.get("fullscreen"):
        failures.append("fullscreen is required for this interview")
    if config.get("require_single_face", realtime) and not report.get("face_detected"):
        failures.append("no candidate face was detected")
    if config.get("require_single_face", realtime) and report.get("face_count") not in (None, 1):
        failures.append("exactly one candidate face is required")
    if config.get("require_proctoring", realtime) and not report.get("proctoring_model_loaded"):
        failures.append("the proctoring model could not be loaded")

    evidence = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "failures": failures,
        "report": {k: v for k, v in report.items() if isinstance(v, (str, int, float, bool, type(None)))},
    }
    config = dict(session.config or {})
    config["preflight"] = evidence
    session.config = config
    db.add(ProctoringEvent(
        session_id=session.id,
        candidate_id=session.candidate_id,
        event_type=ProctoringEventType.UNAUTHORIZED_ACTION if failures else ProctoringEventType.VISIBILITY_CHANGE,
        severity=Severity.CRITICAL if failures else Severity.INFO,
        detail="preflight capability check failed" if failures else "preflight capability check passed",
        metadata_json={"preflight": evidence},
        occurred_at=datetime.now(timezone.utc),
    ))

    if failures:
        _transition(db, session, "MEDIA_ERROR",
                    reason="preflight failed: " + "; ".join(failures), actor_id=actor_id)
        raise InterviewFlowError(
            "Interview preflight requirements were not met.", 422,
            failures=failures, current_state="MEDIA_ERROR",
        )
    target_state = "LISTENING" if session.started_at is not None else "MEDIA_READY"
    _transition(db, session, target_state, reason="preflight verified", actor_id=actor_id)
    return evidence


def _requires_livekit(session: InterviewSession) -> bool:
    config = session.config or {}
    if "requires_livekit" in config:
        return bool(config["requires_livekit"])
    # A real screening interview is realtime by definition.
    return (session.mode or "real") != "practice"


def report_media_state(db: Session, session: InterviewSession, *, connected: bool,
                       reason: str, actor_id: uuid.UUID) -> str:
    """Record a LiveKit/media disconnect or recovery; never silently continue."""
    state = engine.lifecycle_state(session)
    if not connected:
        if state not in ("MEDIA_ERROR", "FAILED", "EXPIRED", "CANCELLED", "COMPLETED"):
            _transition(db, session, "MEDIA_ERROR", reason=reason, actor_id=actor_id)
        return "MEDIA_ERROR"
    if state in ("MEDIA_ERROR", "PAUSED", "MEDIA_READY"):
        target = "MEDIA_READY" if state == "MEDIA_ERROR" and not session.started_at else "LISTENING"
        _transition(db, session, target, reason=reason, actor_id=actor_id)
    return engine.lifecycle_state(session)


# ------------------------------------------------------------------- turns
def start_interview(db: Session, session: InterviewSession, *, actor_id: uuid.UUID) -> InterviewQuestion:
    """Start the interview and return the active question (idempotent).

    A repeat call resumes the in-progress chain instead of creating a second
    question: no state is rewound and no extra LLM call is charged.
    """
    _require_state(session, "MEDIA_READY", "INTERVIEW_STARTED", "AI_GREETING",
                   "QUESTION_GENERATING", "QUESTION_READY", "INTERVIEWER_SPEAKING",
                   "LISTENING", "AI_PROVIDER_ERROR")

    # 1. If an active question already exists, resume idempotently:
    existing = _latest_question(db, session)
    if existing is not None and existing.timed_out_at is None:
        state = engine.lifecycle_state(session)
        if state == "MEDIA_READY":
            if session.started_at is None:
                # A prewarmed first question may exist before the candidate
                # starts. Start the authoritative overall clock before making
                # that question answerable, while reusing the persisted prompt.
                _transition(db, session, "INTERVIEW_STARTED",
                            reason="media ready and candidate joined",
                            actor_type="candidate", actor_id=actor_id)
                _transition(db, session, "AI_GREETING", reason="opening the interview")
                _transition(db, session, "QUESTION_GENERATING",
                            reason="presenting the pre-generated first question", actor_id=actor_id)
                _transition(db, session, "QUESTION_READY",
                            reason="pre-generated first question is ready", actor_id=actor_id)
            else:
                _transition(db, session, "LISTENING",
                            reason="resuming already-started interview", actor_id=actor_id)
        return existing

    # 2. If NO question exists yet, we MUST generate Question 1:
    state = engine.lifecycle_state(session)
    if state == "MEDIA_READY":
        if session.started_at is None:
            _transition(db, session, "INTERVIEW_STARTED", reason="media ready and candidate joined",
                        actor_type="candidate", actor_id=actor_id)
            try:
                from app.services import notifications
                from app.models import NotificationType
                pos_title = getattr(session, "job_title", None) or "position"
                notifications.push(db, user_id=session.candidate_id,
                                 notification_type=NotificationType.INTERVIEW_STARTED,
                                 title="Interview started",
                                 body=f"Your interview for {pos_title} is now in progress",
                                 payload={"session_id": str(session.id)})
            except Exception as notify_err:
                logger.warning("Failed to push interview started notification: %s", notify_err)
            state = engine.lifecycle_state(session)
        else:
            _transition(db, session, "QUESTION_GENERATING", reason="generating first question for resumed interview", actor_id=actor_id)
            state = engine.lifecycle_state(session)

    if state == "INTERVIEW_STARTED":
        _transition(db, session, "AI_GREETING", reason="opening the interview")
        state = engine.lifecycle_state(session)
    if state == "AI_GREETING":
        _charge_llm_budget(db, session, "greeting")
        _transition(db, session, "QUESTION_GENERATING", reason="generating the first question")
        state = engine.lifecycle_state(session)

    # If state was set to LISTENING with 0 questions (orphaned state), transition to QUESTION_GENERATING:
    if state == "LISTENING":
        _transition(db, session, "QUESTION_GENERATING", reason="generating question for empty session", actor_id=actor_id)
        state = engine.lifecycle_state(session)

    if state == "QUESTION_GENERATING":
        # A question may already be persisted: a retry after a downstream failure
        # must not spend another LLM call or create a duplicate turn.
        existing = _latest_question(db, session)
        if existing is not None and existing.timed_out_at is None:
            _transition(db, session, "QUESTION_READY", reason="resuming with the persisted question")
            return existing
        timer = _StageTimer(session.id, "generate_question")
        try:
            question = engine.generate_and_store_question(db, session)
        except LLMError as exc:
            _transition(db, session, "AI_PROVIDER_ERROR", reason=f"question generation failed: {exc}")
            timer.finish(False, provider="llm", error=type(exc).__name__)
            raise ProviderStageError("Question generation is temporarily unavailable.",
                                     recovery_state="QUESTION_GENERATING") from exc
        record_usage(db, session, llm_calls=1)
        _transition(db, session, "QUESTION_READY", reason="question generated and validated")
        timer.finish(True, provider=question.model_used, turn_index=question.turn_index)
        return question

    # Already generated (a retry, or a resumed session): reuse the persisted turn.
    existing = _latest_question(db, session)
    if existing is None:
        # No question persisted and we're not in a generating state.
        # This can happen when resuming a session that was in MEDIA_READY;
        # the caller should transition to QUESTION_GENERATING first.
        _transition(db, session, "QUESTION_GENERATING", reason="preparing the active question")
        return start_interview(db, session, actor_id=actor_id)
    if state == "AI_PROVIDER_ERROR":
        _transition(db, session, "QUESTION_READY", reason="resuming with the persisted question")
    return existing


def prewarm_first_question(db: Session, session: InterviewSession) -> InterviewQuestion | None:
    """Pre-generates Question 1 in advance (during lobby or session creation)
    so when the candidate enters the interview room, the question is already in the database
    and loads in ~10ms without any LLM wait time."""
    try:
        existing = _latest_question(db, session)
        if existing is not None:
            return existing
        question = engine.generate_and_store_question(db, session)
        logger.info("[PREWARM] Question 1 pre-generated successfully for session %s (turn=%s)", session.id, question.turn_index)
        return question
    except Exception as e:
        logger.warning("[PREWARM] Failed to pre-generate Question 1 for session %s: %s", session.id, e)
        return None


def trigger_prewarm_first_question(session_id: uuid.UUID | str) -> None:
    """Spawns an asynchronous daemon thread to pre-generate Question 1 while candidate is in lobby."""
    import threading

    def _worker():
        try:
            from app.database import SessionLocal
            from app.models import InterviewSession
            from sqlalchemy import select

            db = SessionLocal()
            try:
                sid = uuid.UUID(str(session_id))
                sess = db.scalar(select(InterviewSession).where(InterviewSession.id == sid))
                if sess:
                    if prewarm_first_question(db, sess) is not None:
                        db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning("[PREWARM] Background worker failed for session %s: %s", session_id, e)

    t = threading.Thread(target=_worker, name=f"prewarm-q1-{session_id}", daemon=True)
    t.start()


def present_question(db: Session, session: InterviewSession, question: InterviewQuestion,
                     *, actor_id: uuid.UUID) -> InterviewQuestion:
    """Move a delivered question into LISTENING for the candidate to answer."""
    limit_seconds = getattr(session, "question_time_limit_seconds", None)
    if (
        session.started_at is not None
        and isinstance(limit_seconds, int)
        and not isinstance(limit_seconds, bool)
        and limit_seconds > 0
        and question.question_deadline_at is None
        and question.timed_out_at is None
    ):
        question.question_deadline_at = datetime.now(timezone.utc) + timedelta(seconds=limit_seconds)
    state = engine.lifecycle_state(session)
    if state == "QUESTION_READY":
        _transition(db, session, "INTERVIEWER_SPEAKING", reason="interviewer is speaking the question",
                    actor_id=actor_id)
        _transition(db, session, "LISTENING", reason="question delivered; awaiting the answer",
                    actor_id=actor_id)
    elif state not in ("LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING", "MEDIA_ERROR", "PAUSED"):
        raise InterviewFlowError("The question is not ready to be presented.", 409,
                                 current_state=state)
    return question


def question_deadline_reached(question: InterviewQuestion, at: datetime) -> bool:
    """Compare exact server timestamps; do not use display-rounded seconds."""
    deadline = getattr(question, "question_deadline_at", None)
    if deadline is None:
        return False
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    now = at if at.tzinfo is not None else at.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc) >= deadline.astimezone(timezone.utc)


def overall_deadline_reached(session: InterviewSession, at: datetime) -> bool:
    if session.started_at is None:
        return False
    return engine.is_interview_overdue(session, at)


def begin_answer(db: Session, session: InterviewSession, question: InterviewQuestion,
                 *, actor_id: uuid.UUID) -> str:
    """Move LISTENING -> CANDIDATE_RESPONDING when the candidate starts speaking.

    `/transcribe` calls this so an STT failure lands in TRANSCRIPTION_ERROR with a
    live retry target instead of an untracked state. The transcript itself is
    submitted through `accept_answer`, which continues the graph.
    """
    _require_state(session, "LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING")
    if db.scalar(select(InterviewResponse).where(
        InterviewResponse.session_id == session.id,
        InterviewResponse.question_id == question.id,
    )) is not None:
        raise InterviewFlowError("This question has already been answered.", 409)
    if engine.lifecycle_state(session) == "LISTENING":
        _transition(db, session, "CANDIDATE_RESPONDING", reason="candidate started answering",
                    actor_type="candidate", actor_id=actor_id)
    return engine.lifecycle_state(session)


def begin_transcription(db: Session, session: InterviewSession) -> str:
    """Enter TRANSCRIBING so a provider failure lands in a tracked error state."""
    if engine.lifecycle_state(session) == "CANDIDATE_RESPONDING":
        _transition(db, session, "TRANSCRIBING", reason="transcribing the recorded answer")
    return engine.lifecycle_state(session)


def accept_answer(db: Session, session: InterviewSession, question: InterviewQuestion,
                  answer: str, *, request_id: str | None = None,
                  actor_id: uuid.UUID) -> tuple[InterviewResponse, dict]:
    """Evaluate one answer and decide follow-up vs next question vs completion."""
    now = datetime.now(timezone.utc)
    if overall_deadline_reached(session, now):
        raise InterviewFlowError("The overall interview deadline has expired.", 409,
                                 reason_code="interview_expired")
    if question_deadline_reached(question, now):
        raise InterviewFlowError("The question deadline has expired.", 409,
                                 reason_code="question_expired")
    _require_state(session, *engine.ANSWERABLE_STATES)
    limits = _limits(session)

    existing = db.scalar(select(InterviewResponse).where(
        InterviewResponse.session_id == session.id,
        InterviewResponse.question_id == question.id,
    ))
    if existing is not None:
        # Idempotent retry: return the persisted turn, never re-evaluate.
        return existing, _turn_outcome(db, session, existing, limits)

    question_count = int(db.scalar(
        select(func.count()).select_from(InterviewQuestion)
        .where(InterviewQuestion.session_id == session.id)
    ) or 0)
    if question_count >= limits["max_questions"]:
        raise InterviewFlowError("This interview has reached its question limit.", 409)

    # LISTENING -> CANDIDATE_RESPONDING -> TRANSCRIBING -> ANSWER_READY.
    # The graph forbids skipping, so each hop is explicit.
    current = engine.lifecycle_state(session)
    if current in ("LISTENING", "TRANSCRIPTION_ERROR"):
        _transition(db, session, "CANDIDATE_RESPONDING",
                    reason="candidate submitted an answer", actor_type="candidate", actor_id=actor_id)
    if current in ("LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIPTION_ERROR"):
        _transition(db, session, "TRANSCRIBING", reason="transcribing the recorded answer")
    if engine.lifecycle_state(session) == "TRANSCRIBING":
        _transition(db, session, "ANSWER_READY", reason="transcript persisted")
    _charge_llm_budget(db, session, "evaluate_answer")
    _transition(db, session, "EVALUATING", reason="evaluating the candidate answer")

    config = dict(session.config or {})
    config["_inflight_request_id"] = request_id
    session.config = config

    timer = _StageTimer(session.id, "evaluate_answer")
    try:
        response = engine.evaluate_and_store_response(db, session, question, answer)
    except Exception as exc:
        logger.exception("Answer evaluation failed for session %s: %s", session.id, exc)
        timer.finish(False, provider="llm", error=type(exc).__name__)
        # Auto-recover session to LISTENING so candidate can retry without being locked out
        try:
            _transition(db, session, "LISTENING", reason=f"answer evaluation failed: {exc}")
            db.commit()
        except Exception:
            db.rollback()
        raise ProviderStageError("Answer evaluation is temporarily unavailable. Please retry your answer.",
                                 recovery_state="LISTENING") from exc
    finally:
        config = dict(session.config or {})
        config.pop("_inflight_request_id", None)
        session.config = config
    record_usage(db, session, llm_calls=1)
    timer.finish(True, provider=response.model_used,
                 decision=str(getattr(response.action_decision, "value", response.action_decision)))

    _transition(db, session, "INTERVIEWER_RESPONDING", reason="interviewer response generated")
    _transition(db, session, "FOLLOW_UP_OR_NEXT_QUESTION", reason="evaluator notes reviewed")

    # Auto-advance to QUESTION_GENERATING so the next question is ready for the client
    # This eliminates the "break in between" where the loop would stall at FOLLOW_UP_OR_NEXT_QUESTION
    if engine.lifecycle_state(session) == "FOLLOW_UP_OR_NEXT_QUESTION":
        _transition(db, session, "QUESTION_GENERATING", reason="preparing the next question after evaluation")

    return response, _turn_outcome(db, session, response, limits)


def _turn_outcome(db: Session, session: InterviewSession, response: InterviewResponse,
                  limits: dict) -> dict:
    """Deterministic backend decision: follow-up, next question, or completion.

    The LLM recommends; this layer decides. The model never sets session status.
    """
    state = engine.lifecycle_state(session)
    answered = _answered_count(db, session)
    decision = response.action_decision
    usage = _usage(session)
    follow_ups = int(usage.get("follow_ups", 0))

    if state in engine.FINAL_STATES or state in ("INTERVIEW_COMPLETING", "FINAL_SCORING"):
        return {"finished": True, "outcome": "COMPLETE"}

    # Backend time limit is authoritative; the client countdown is informational.
    remaining = engine.remaining_seconds(session)
    if remaining is not None and remaining <= 0:
        return {"finished": True, "outcome": "TIME_LIMIT"}

    if answered >= _total_turns(session) or answered >= limits["max_questions"]:
        return {"finished": True, "outcome": "TURN_LIMIT"}
    if decision == ActionDecision.TERMINATE:
        # In practice mode or on early turns, never abort the candidate's drill early; guide them with a follow-up or next question.
        if _session_mode(session) == "practice" and answered < _total_turns(session):
            if bool((response.recommended_follow_up or "").strip()) and follow_ups < limits["max_follow_ups"]:
                record_usage(db, session, follow_ups=1)
                return {"finished": False, "outcome": "FOLLOW_UP"}
            return {"finished": False, "outcome": "NEXT_QUESTION"}
        return {"finished": True, "outcome": "TERMINATE"}

    wants_follow_up = decision == ActionDecision.PROBE_FURTHER and bool(
        (response.recommended_follow_up or "").strip()
    )
    if wants_follow_up and follow_ups >= limits["max_follow_ups"]:
        return {"finished": False, "outcome": "NEXT_QUESTION", "follow_up_blocked": True}
    if wants_follow_up:
        record_usage(db, session, follow_ups=1)
        return {"finished": False, "outcome": "FOLLOW_UP"}
    return {"finished": False, "outcome": "NEXT_QUESTION"}


def advance_to_question(db: Session, session: InterviewSession, *, actor_id: uuid.UUID) -> InterviewQuestion:
    """Generate or reuse the next question for the current turn cycle."""
    _require_state(session, "FOLLOW_UP_OR_NEXT_QUESTION", "QUESTION_GENERATING",
                   "TRANSCRIPTION_ERROR", "AI_PROVIDER_ERROR")
    if engine.lifecycle_state(session) == "FOLLOW_UP_OR_NEXT_QUESTION":
        _transition(db, session, "QUESTION_GENERATING", reason="preparing the next question")
    _charge_llm_budget(db, session, "generate_question")
    try:
        question = engine.generate_and_store_question(db, session)
    except LLMError as exc:
        _transition(db, session, "AI_PROVIDER_ERROR", reason=f"question generation failed: {exc}")
        raise ProviderStageError("Question generation is temporarily unavailable.",
                                 recovery_state="QUESTION_GENERATING") from exc
    record_usage(db, session, llm_calls=1)
    _transition(db, session, "QUESTION_READY", reason="question generated and validated")
    return question


def record_question_timeout(
    db: Session,
    session: InterviewSession,
    question: InterviewQuestion,
    partial_answer: str | None,
    *,
    actor_id: uuid.UUID | None,
    actor_type: str = "candidate",
    at: datetime | None = None,
) -> dict:
    """Persist one explicit question timeout; caller holds the session row lock.

    The timeout response is stored even when its answer text is empty. The unique
    (session, question) constraint plus the lock makes retries and competing tabs
    idempotent. Overall expiry is always checked first.
    """
    now = at or datetime.now(timezone.utc)
    if overall_deadline_reached(session, now):
        complete_and_finalize(db, session, actor_id=actor_id, reason="overall interview deadline reached")
        return {"finished": True, "outcome": "TIME_LIMIT_REACHED", "idempotent": False}

    existing = db.scalar(select(InterviewResponse).where(
        InterviewResponse.session_id == session.id,
        InterviewResponse.question_id == question.id,
    ))
    if question.timed_out_at is not None:
        return {"finished": engine.lifecycle_state(session) in engine.FINAL_STATES,
                "outcome": "QUESTION_TIMEOUT", "idempotent": True}
    if existing is not None:
        # An answer request won the row-lock race. Never replace it with a timeout.
        return {"finished": False, "outcome": "ANSWER_ALREADY_ACCEPTED", "idempotent": True}

    latest = _latest_question(db, session)
    if latest is None or latest.id != question.id:
        raise InterviewFlowError("This question is no longer active.", 409, reason_code="stale_question")
    if question.question_deadline_at is None:
        raise InterviewFlowError("This interview has no question deadline.", 409,
                                 reason_code="question_timer_unavailable")
    if not question_deadline_reached(question, now):
        raise InterviewFlowError("The question deadline has not expired.", 409,
                                 reason_code="question_not_expired")
    _require_state(session, *engine.ANSWERABLE_STATES)

    answer_text = str(partial_answer or "").strip()[:20000]
    response = InterviewResponse(
        session_id=session.id,
        question_id=question.id,
        turn_index=question.turn_index,
        answer_text=answer_text,
        submitted_at=now,
        is_timeout_result=True,
    )
    db.add(response)
    question.timed_out_at = now
    db.flush()

    limits = _limits(session)
    answered = _answered_count(db, session)
    question_count = int(db.scalar(
        select(func.count()).select_from(InterviewQuestion)
        .where(InterviewQuestion.session_id == session.id)
    ) or 0)
    if answered >= _total_turns(session) or question_count >= limits["max_questions"]:
        complete_and_finalize(db, session, actor_id=actor_id,
                              reason="question timeout reached the interview limit")
        return {"finished": True, "outcome": "TURN_LIMIT", "idempotent": False}

    _transition(db, session, "QUESTION_GENERATING", reason="question deadline expired",
                actor_type=actor_type, actor_id=actor_id,
                metadata={"stage": "question_timeout", "turn_index": question.turn_index,
                          "question_id": str(question.id)})
    return {"finished": False, "outcome": "QUESTION_TIMEOUT", "idempotent": False}


def reconcile_overall_timeout(
    db: Session,
    session: InterviewSession,
    *,
    actor_id: uuid.UUID | None,
    actor_type: str = "system",
    at: datetime | None = None,
) -> bool:
    """Durably finalize an overall expiry when a request observes it."""
    if not overall_deadline_reached(session, at or datetime.now(timezone.utc)):
        return False
    if engine.lifecycle_state(session) not in engine.FINAL_STATES:
        complete_and_finalize(db, session, actor_id=actor_id,
                              actor_type=actor_type,
                              reason="overall interview deadline reached")
    return True


def create_follow_up(db: Session, session: InterviewSession, question: InterviewQuestion,
                     prompt: str, *, actor_id: uuid.UUID) -> InterviewQuestion:
    """Persist an evaluator-recommended follow-up as the next turn."""
    _require_state(session, "FOLLOW_UP_OR_NEXT_QUESTION")
    text = (prompt or "").strip()[:4000]
    if not text:
        raise InterviewFlowError("Follow-up text is required", 400)
    limits = _limits(session)
    if int(_usage(session).get("follow_ups", 0)) >= limits["max_follow_ups"]:
        raise InterviewFlowError("This interview has reached its follow-up limit.", 409)
    turn = int(db.scalar(select(func.count()).select_from(InterviewQuestion)
                         .where(InterviewQuestion.session_id == session.id)) or 0)
    follow_up = InterviewQuestion(
        session_id=session.id,
        turn_index=turn,
        stage=question.stage,
        prompt_text=text,
        expected_concepts=list(question.expected_concepts or []),
        is_ai_generated=True,
        model_used="evaluator-follow-up",
    )
    db.add(follow_up)
    db.flush()
    record_usage(db, session, follow_ups=1)
    _transition(db, session, "QUESTION_GENERATING", reason="preparing a follow-up question")
    _transition(db, session, "QUESTION_READY", reason="follow-up question ready")
    return follow_up


def record_transcription_error(db: Session, session: InterviewSession, *, reason: str,
                               actor_id: uuid.UUID) -> str:
    """Record a real STT failure so the candidate has an explicit retry target."""
    if engine.lifecycle_state(session) not in ("CANDIDATE_RESPONDING", "TRANSCRIBING"):
        raise InterviewFlowError("This interview is not transcribing audio.", 409,
                                 current_state=engine.lifecycle_state(session))
    _transition(db, session, "TRANSCRIPTION_ERROR", reason=reason, actor_id=actor_id)
    return "TRANSCRIPTION_ERROR"


def recover_stage(db: Session, session: InterviewSession, *, retry_of: str,
                  actor_id: uuid.UUID) -> str:
    """Retry an interrupted stage. Returns the state the candidate may retry."""
    state = engine.lifecycle_state(session)
    if state not in ("MEDIA_ERROR", "AI_PROVIDER_ERROR", "TRANSCRIPTION_ERROR",
                     "EVALUATION_ERROR", "PAUSED"):
        raise InterviewFlowError("There is no failed stage to retry.", 409, current_state=state)
    if retry_of not in LIFECYCLE_RETRY_TARGETS.get(state, frozenset()):
        raise InterviewFlowError("That retry target is not available from this state.", 409,
                                 current_state=state, retry_of=retry_of)
    _transition(db, session, retry_of, reason=f"candidate retried after {state}", actor_id=actor_id)
    return retry_of


LIFECYCLE_RETRY_TARGETS = {
    "MEDIA_ERROR": frozenset({"MEDIA_READY", "LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING"}),
    "AI_PROVIDER_ERROR": frozenset({"QUESTION_GENERATING", "EVALUATING", "INTERVIEWER_RESPONDING"}),
    "TRANSCRIPTION_ERROR": frozenset({"CANDIDATE_RESPONDING", "TRANSCRIBING"}),
    "EVALUATION_ERROR": frozenset({"EVALUATING", "FINAL_SCORING"}),
    "PAUSED": frozenset({"MEDIA_READY", "LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING",
                         "QUESTION_GENERATING", "EVALUATING", "INTERVIEWER_RESPONDING",
                         "FOLLOW_UP_OR_NEXT_QUESTION"}),
}


# -------------------------------------------------------------- completion
def complete_interview(db: Session, session: InterviewSession, *, actor_id: uuid.UUID | None,
                       actor_type: str = "candidate",
                       reason: str = "candidate finished the interview") -> None:
    current = engine.lifecycle_state(session)
    if current in engine.FINAL_STATES:
        if current == "COMPLETED":
            return
        raise InterviewFlowError("Interview session has already ended.", 409)
    if current in ("INTERVIEW_COMPLETING", "FINAL_SCORING", "REPORT_GENERATED"):
        return
    _require_state(session, *engine.TURN_STATES, "FOLLOW_UP_OR_NEXT_QUESTION", "PAUSED",
                   "LOBBY", "PROCTORING_PREFLIGHT", "MEDIA_READY", "MEDIA_ERROR",
                   "AI_PROVIDER_ERROR", "TRANSCRIPTION_ERROR", "EVALUATION_ERROR")
    session.ended_at = None
    _transition(db, session, "INTERVIEW_COMPLETING", reason=reason,
                actor_type=actor_type, actor_id=actor_id)
    try:
        from app.services import notifications
        from app.models import NotificationType
        notifications.push(db, user_id=session.candidate_id,
                           notification_type=NotificationType.INTERVIEW_COMPLETED,
                           title="Interview completed",
                           body="Your interview has been completed",
                           payload={"session_id": str(session.id)})
        if session.recruiter_id:
            pos_title = getattr(session, "job_title", None) or "position"
            notifications.push(db, user_id=session.recruiter_id,
                               notification_type=NotificationType.INTERVIEW_COMPLETED,
                               title="Interview completed",
                               body=f"Interview for {pos_title} has been completed",
                               payload={"session_id": str(session.id)})
    except Exception as notify_err:
        logger.warning("Failed to push complete notification: %s", notify_err)


def finalize(db: Session, session: InterviewSession, *, actor_id: uuid.UUID | None) -> Scorecard:
    """Run deterministic final scoring, then generate the report. Idempotent."""
    _require_state(session, "INTERVIEW_COMPLETING", "FINAL_SCORING", "REPORT_GENERATED")
    existing = db.scalar(select(Scorecard).where(Scorecard.session_id == session.id))
    if existing is not None and engine.lifecycle_state(session) == "REPORT_GENERATED":
        return existing

    if engine.lifecycle_state(session) == "INTERVIEW_COMPLETING":
        _transition(db, session, "FINAL_SCORING", reason="computing the final score")
    if existing is None:
        _charge_llm_budget(db, session, "scorecard")
        try:
            scorecard = engine.build_scorecard(db, session)
        except LLMError as exc:
            _transition(db, session, "EVALUATION_ERROR", reason=f"final scoring failed: {exc}")
            raise ProviderStageError("Final scoring is temporarily unavailable.",
                                     recovery_state="FINAL_SCORING") from exc
        record_usage(db, session, llm_calls=1)
    else:
        scorecard = existing
    _transition(db, session, "REPORT_GENERATED", reason="scorecard and report persisted")
    
    # Notify candidate that scorecard is ready
    from app.services import notifications
    from app.models import NotificationType
    notifications.push(db, user_id=session.candidate_id,
                     notification_type=NotificationType.SCORECARD_READY,
                     title="Your scorecard is ready",
                     body=f"Overall score: {scorecard.overall_score}",
                     payload={"session_id": str(session.id)})
    
    return scorecard


def complete_and_finalize(
    db: Session,
    session: InterviewSession,
    *,
    actor_id: uuid.UUID | None,
    actor_type: str = "candidate",
    reason: str = "candidate finished the interview",
) -> Scorecard | None:
    """Idempotently complete and score a session while its row lock is held."""
    state = engine.lifecycle_state(session)
    if state == "COMPLETED":
        return db.scalar(select(Scorecard).where(Scorecard.session_id == session.id))
    if state in engine.FINAL_STATES:
        raise InterviewFlowError("Interview session has already ended.", 409,
                                 current_state=state)
    if state not in ("INTERVIEW_COMPLETING", "FINAL_SCORING", "REPORT_GENERATED"):
        complete_interview(db, session, actor_id=actor_id, actor_type=actor_type, reason=reason)
    scorecard = finalize(db, session, actor_id=actor_id)
    if engine.lifecycle_state(session) == "REPORT_GENERATED":
        _transition(db, session, "COMPLETED", reason="interview report generated and session completed",
                    actor_type=actor_type, actor_id=actor_id)
    return scorecard


# ------------------------------------------------------------ observability
def state_contract(db: Session, session: InterviewSession, *, answerable_state: bool = False) -> dict:
    """The single response contract every client renders from."""
    state = engine.lifecycle_state(session)

    # Stuck-State Watchdog: if session is in EVALUATING, TRANSCRIBING or EVALUATION_ERROR for > 20s,
    # auto-recover to LISTENING so candidates are never permanently trapped.
    if state in ("EVALUATING", "TRANSCRIBING", "EVALUATION_ERROR"):
        updated_at = getattr(session, "updated_at", None) or getattr(session, "created_at", None)
        if updated_at is not None:
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if (now - updated_at).total_seconds() > 20.0:
                logger.warning("[STUCK_WATCHDOG] Session %s in state %s for > 20s; auto-recovering to LISTENING", session.id, state)
                try:
                    _transition(db, session, "LISTENING", reason="stuck-state watchdog auto-recovery to LISTENING")
                    db.commit()
                    state = "LISTENING"
                    answerable_state = True
                except Exception as exc:
                    logger.warning("[STUCK_WATCHDOG] Exception during watchdog recovery: %s", exc, exc_info=True)
                    db.rollback()

    question = _latest_question(db, session)
    response = None
    if question is not None:
        response = db.scalar(select(InterviewResponse).where(
            InterviewResponse.question_id == question.id,
            InterviewResponse.session_id == session.id,
        ))
    config = session.config or {}
    now = datetime.now(timezone.utc)
    question_deadline = question.question_deadline_at if question else None
    question_remaining = None
    if question_deadline is not None:
        if question_deadline.tzinfo is None:
            question_deadline = question_deadline.replace(tzinfo=timezone.utc)
        question_remaining = max(0, math.ceil((question_deadline - now).total_seconds()))
    question_expired = question is not None and question_deadline_reached(question, now)
    proctoring_status = "active" if session.started_at else "pending"
    if state in ("MEDIA_ERROR", "PROCTORING_VIOLATION"):
        proctoring_status = "violation"
    elif config.get("proctoring_flagged"):
        proctoring_status = "flagged"
    return {
        "session_id": str(session.id),
        "state": state,
        "status": session.status.value if hasattr(session.status, "value") else str(session.status),
        "mode": getattr(session, "mode", "real"),
        "question_id": str(question.id) if question else None,
        "question": question.prompt_text if question else None,
        "turn_index": question.turn_index if question else None,
        "total_turns": _total_turns(session),
        "answered_turns": _answered_count(db, session),
        "interviewer_response": response.interviewer_response if response else None,
        "can_answer": bool(
            (answerable_state or state in engine.ANSWERABLE_STATES)
            and state in engine.ANSWERABLE_STATES
            and question is not None
            and response is None
            and not question_expired
        ),
        "remaining_time_seconds": engine.remaining_seconds(session),
        "question_deadline_at": question.question_deadline_at.isoformat() if question and question.question_deadline_at else None,
        "question_remaining_seconds": question_remaining,
        "question_expired": question_expired,
        "proctoring_status": proctoring_status,
        "error": None,
    }
