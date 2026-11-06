"""
Progeni Atlas - Lifecycle Module
Extracted from interview_engine.py for better code organization.

Handles the interview lifecycle state machine, transition validation and the
server-authoritative session clock.

The state graph itself is pure logic. `transition_session` is the single
mutation point: it stages the new state on the session and appends the
append-only audit row, but never commits. The caller owns the transaction so a
lifecycle change and its audit trail become durable together.
"""

from __future__ import annotations

import json
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import InterviewSession, InterviewSessionTransition, SessionStatus

logger = logging.getLogger("talentpulse.lifecycle")

# -----------------------------------------------------------------------------
# Lifecycle State Constants
# -----------------------------------------------------------------------------

# Entry: the candidate authenticated, then ownership/tenant were proven.
PREFLIGHT_STATES = ("AUTHENTICATED", "INTERVIEW_AUTHORIZED", "LOBBY",
                    "PROCTORING_PREFLIGHT", "MEDIA_READY")

# States a candidate may be in during the turn-by-turn interview flow.
TURN_STATES = (
    "INTERVIEW_STARTED", "AI_GREETING", "QUESTION_GENERATING", "QUESTION_READY",
    "INTERVIEWER_SPEAKING", "LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING",
    "ANSWER_READY", "EVALUATING", "INTERVIEWER_RESPONDING",
    "FOLLOW_UP_OR_NEXT_QUESTION",
)

# States in which the interview is winding down.
CLOSING_STATES = ("INTERVIEW_COMPLETING", "FINAL_SCORING", "REPORT_GENERATED", "COMPLETED")

# Error states from which the interview can be recovered.
RECOVERABLE_ERROR_STATES = (
    "MEDIA_ERROR", "AI_PROVIDER_ERROR", "TRANSCRIPTION_ERROR", "EVALUATION_ERROR",
)

# Error states from which the interview cannot be recovered.
TERMINAL_ERROR_STATES = ("PROCTORING_VIOLATION", "FAILED")

# States in which the interview has ended one way or another.
FINAL_STATES = ("COMPLETED", "EXPIRED", "CANCELLED") + TERMINAL_ERROR_STATES

# States a candidate may be asked to answer from.
ANSWERABLE_STATES = ("LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING", "TRANSCRIPTION_ERROR")

# -----------------------------------------------------------------------------
# Transition Graph
# -----------------------------------------------------------------------------

# This is the single authoritative interview lifecycle. Clients report events;
# they never choose the next state.
LIFECYCLE_TRANSITIONS: dict[str, frozenset[str]] = {
    # Entry: the candidate authenticated, then ownership/tenant were proven.
    "AUTHENTICATED": frozenset({"INTERVIEW_AUTHORIZED", "CANCELLED", "EXPIRED"}),
    "INTERVIEW_AUTHORIZED": frozenset({"LOBBY", "CANCELLED", "EXPIRED"}),
    "LOBBY": frozenset({"PROCTORING_PREFLIGHT", "PROCTORING_VIOLATION", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "PROCTORING_PREFLIGHT": frozenset(
        {"MEDIA_READY", "MEDIA_ERROR", "PROCTORING_VIOLATION", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}
    ),
    "MEDIA_READY": frozenset({"INTERVIEW_STARTED", "QUESTION_GENERATING", "LISTENING", "MEDIA_ERROR", "PAUSED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "INTERVIEW_STARTED": frozenset({"AI_GREETING", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "AI_GREETING": frozenset({"QUESTION_GENERATING", "AI_PROVIDER_ERROR", "PAUSED", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "QUESTION_GENERATING": frozenset({"QUESTION_READY", "AI_PROVIDER_ERROR", "PAUSED", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "QUESTION_READY": frozenset({"INTERVIEWER_SPEAKING", "PAUSED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "INTERVIEWER_SPEAKING": frozenset({"LISTENING", "AI_PROVIDER_ERROR", "PAUSED", "MEDIA_ERROR", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "LISTENING": frozenset(
        {"QUESTION_GENERATING", "CANDIDATE_RESPONDING", "PAUSED", "MEDIA_ERROR", "PROCTORING_VIOLATION",
         "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}
    ),
    "CANDIDATE_RESPONDING": frozenset(
        {"TRANSCRIBING", "QUESTION_GENERATING", "PAUSED", "MEDIA_ERROR", "PROCTORING_VIOLATION",
         "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}
    ),
    "TRANSCRIBING": frozenset({"ANSWER_READY", "TRANSCRIPTION_ERROR", "QUESTION_GENERATING", "PAUSED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "ANSWER_READY": frozenset({"EVALUATING", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "EVALUATING": frozenset({"INTERVIEWER_RESPONDING", "LISTENING", "EVALUATION_ERROR", "AI_PROVIDER_ERROR", "PAUSED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "INTERVIEWER_RESPONDING": frozenset({"FOLLOW_UP_OR_NEXT_QUESTION", "AI_PROVIDER_ERROR", "PAUSED", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "FOLLOW_UP_OR_NEXT_QUESTION": frozenset(
        {"QUESTION_GENERATING", "INTERVIEW_COMPLETING", "PAUSED", "CANCELLED", "EXPIRED"}
    ),
    "INTERVIEW_COMPLETING": frozenset({"FINAL_SCORING", "FAILED", "CANCELLED"}),
    "FINAL_SCORING": frozenset({"REPORT_GENERATED", "EVALUATION_ERROR", "FAILED"}),
    "REPORT_GENERATED": frozenset({"COMPLETED", "FAILED"}),
    "COMPLETED": frozenset(),
    # Pause is resumable: it returns to the state it interrupted.
    "PAUSED": frozenset(
        {"MEDIA_READY", "QUESTION_GENERATING", "INTERVIEWER_SPEAKING", "LISTENING",
         "CANDIDATE_RESPONDING", "TRANSCRIBING", "EVALUATING", "INTERVIEWER_RESPONDING",
         "FOLLOW_UP_OR_NEXT_QUESTION", "CANCELLED", "EXPIRED", "FAILED", "INTERVIEW_COMPLETING"}
    ),
    # Media recovery returns to an interrupted conversation state.
    "MEDIA_ERROR": frozenset(
        {"MEDIA_READY", "LISTENING", "CANDIDATE_RESPONDING", "TRANSCRIBING",
         "PAUSED", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}
    ),
    "AI_PROVIDER_ERROR": frozenset(
        {"QUESTION_GENERATING", "EVALUATING", "INTERVIEWER_RESPONDING", "PAUSED",
         "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}
    ),
    "TRANSCRIPTION_ERROR": frozenset({"CANDIDATE_RESPONDING", "LISTENING", "QUESTION_GENERATING", "PAUSED", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "EVALUATION_ERROR": frozenset({"EVALUATING", "FINAL_SCORING", "PAUSED", "FAILED", "CANCELLED", "EXPIRED", "INTERVIEW_COMPLETING"}),
    "PROCTORING_VIOLATION": frozenset({"FAILED", "CANCELLED"}),
    "EXPIRED": frozenset(),
    "CANCELLED": frozenset(),
    "FAILED": frozenset(),
}

# The legacy session_status enum is deliberately unchanged. A NULL lifecycle_state
# is a legacy row (including rows created by routes not yet using this API).
_LEGACY_STATES = {
    SessionStatus.SCHEDULED: "LOBBY",
    SessionStatus.IN_PROGRESS: "PROCTORING_PREFLIGHT",
    SessionStatus.COMPLETED: "COMPLETED",
    SessionStatus.ABANDONED: "FAILED",
}
# Legacy session_status stays coarse. Recoverable error states map by phase
# instead of a fixed status, because MEDIA_ERROR before the start must not look
# like an interview in progress.
_LEGACY_TARGET_STATUS = {
    **{state: SessionStatus.SCHEDULED for state in PREFLIGHT_STATES},
    **{state: SessionStatus.IN_PROGRESS for state in TURN_STATES + CLOSING_STATES if state != "COMPLETED"},
    "COMPLETED": SessionStatus.COMPLETED,
    "PROCTORING_VIOLATION": SessionStatus.ABANDONED,
    "EXPIRED": SessionStatus.ABANDONED,
    "CANCELLED": SessionStatus.ABANDONED,
    "FAILED": SessionStatus.ABANDONED,
}
_LEGACY_STARTED_STATUS = {
    "PAUSED": SessionStatus.IN_PROGRESS,
    "MEDIA_ERROR": SessionStatus.IN_PROGRESS,
    "AI_PROVIDER_ERROR": SessionStatus.IN_PROGRESS,
    "TRANSCRIPTION_ERROR": SessionStatus.IN_PROGRESS,
    "EVALUATION_ERROR": SessionStatus.IN_PROGRESS,
}
_LEGACY_PRESTART_STATUS = {
    state: SessionStatus.SCHEDULED for state in _LEGACY_STARTED_STATUS
}


# -----------------------------------------------------------------------------
# Exceptions
# -----------------------------------------------------------------------------

class InvalidLifecycleTransition(ValueError):
    """A requested lifecycle transition or its time precondition is invalid."""


class StaleStateVersion(InvalidLifecycleTransition):
    """The caller acted on a lifecycle view the session has already moved past."""

    def __init__(self, current_version: int):
        super().__init__("The interview has advanced since this request was prepared")
        self.current_version = current_version


# -----------------------------------------------------------------------------
# Legacy Status Mapping
# -----------------------------------------------------------------------------

def legacy_status_for(session: InterviewSession, target: str) -> SessionStatus:
    """Coarse legacy status for a lifecycle state, honouring the start phase."""
    if target in _LEGACY_STARTED_STATUS:
        return (_LEGACY_STARTED_STATUS if session.started_at is not None
                else _LEGACY_PRESTART_STATUS)[target]
    return _LEGACY_TARGET_STATUS[target]


# -----------------------------------------------------------------------------
# Transition Metadata
# -----------------------------------------------------------------------------

_METADATA_ALLOWED = {
    "stage", "turn_index", "question_id", "failure_class", "correlation_id",
    "recovery_state", "outcome", "actor_role", "attempt", "limit",
}
_METADATA_MAX_BYTES = 2048


def _safe_metadata(metadata: dict | None) -> dict:
    """Keep transition metadata structured, non-PII and bounded.

    Only known non-sensitive keys survive, so a caller cannot persist prompts,
    transcripts or credentials into the audit trail.
    """
    if not isinstance(metadata, dict):
        return {}
    cleaned = {
        key: value for key, value in metadata.items()
        if key in _METADATA_ALLOWED and isinstance(value, (str, int, float, bool, type(None)))
    }
    encoded = json.dumps(cleaned, default=str, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > _METADATA_MAX_BYTES:
        return {"truncated": True}
    return cleaned


# -----------------------------------------------------------------------------
# State Reading
# -----------------------------------------------------------------------------

def lifecycle_state(session: InterviewSession) -> str:
    """Read explicit state or conservatively map an uninitialized legacy row.

    Neither scheduled nor in_progress is evidence that preflight passed.
    """
    state = session.lifecycle_state
    if state is not None:
        if state not in LIFECYCLE_TRANSITIONS:
            raise InvalidLifecycleTransition(f"Unknown persisted lifecycle state: {state!r}")
        return state
    status = getattr(session.status, "value", session.status)
    if status not in _LEGACY_STATES:
        raise InvalidLifecycleTransition(f"Unknown legacy session status: {status!r}")
    return _LEGACY_STATES[status]


def validate_lifecycle_transition(current: str, target: str) -> None:
    """Pure graph check: no implicit skips, self-transitions or terminal exits."""
    if current not in LIFECYCLE_TRANSITIONS or target not in LIFECYCLE_TRANSITIONS:
        raise InvalidLifecycleTransition(f"Unknown lifecycle transition: {current!r} -> {target!r}")
    if target not in LIFECYCLE_TRANSITIONS[current]:
        raise InvalidLifecycleTransition(f"Invalid lifecycle transition: {current} -> {target}")


# -----------------------------------------------------------------------------
# Time Helpers
# -----------------------------------------------------------------------------

def _aware(value: datetime | None, label: str) -> datetime | None:
    """Normalise a datetime to UTC.

    A naive datetime is assumed to be UTC: the project stores UTC throughout and
    legacy rows pre-date the timezone-aware column convention. Rejecting them
    would make every historical session unreadable.
    """
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc)
    return value.replace(tzinfo=timezone.utc)


def _minutes(value: int | None, label: str, *, allow_zero: bool = False) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < (0 if allow_zero else 1):
        raise InvalidLifecycleTransition(f"{label} must be a valid number of minutes")
    return value


def is_practice_session(session: InterviewSession) -> bool:
    mode = str(getattr(session, "mode", "") or "").lower()
    if mode in ("practice", "drill"):
        return True
    session_type = str(getattr(session, "session_type", "") or "").lower()
    if session_type in ("practice", "drill"):
        return True
    config = getattr(session, "config", {}) or {}
    if isinstance(config, dict):
        cfg_mode = str(config.get("mode") or config.get("session_type") or "").lower()
        if cfg_mode in ("practice", "drill") or config.get("is_practice"):
            return True
    return False


def join_window_bounds(session: InterviewSession) -> tuple[datetime, datetime]:
    """Inclusive start window from scheduled_at +/- join_window_minutes."""
    if is_practice_session(session):
        return datetime.min.replace(tzinfo=timezone.utc), datetime.max.replace(tzinfo=timezone.utc)
    scheduled = _aware(session.scheduled_at, "scheduled_at")
    minutes = _minutes(session.join_window_minutes, "join_window_minutes", allow_zero=True)
    return scheduled - timedelta(minutes=minutes), scheduled + timedelta(minutes=minutes)


def interview_deadline(session: InterviewSession) -> datetime:
    """Hard end time from started_at + duration_minutes; missing start fails closed."""
    started = _aware(session.started_at, "started_at")
    return started + timedelta(minutes=_minutes(session.duration_minutes, "duration_minutes"))


def is_join_window_open(session: InterviewSession, at: datetime) -> bool:
    if is_practice_session(session):
        return True
    earliest, latest = join_window_bounds(session)
    return earliest <= _aware(at, "at") <= latest


def is_interview_overdue(session: InterviewSession, at: datetime) -> bool:
    """True once the hard deadline is reached (inclusive)."""
    return _aware(at, "at") >= interview_deadline(session)


def remaining_seconds(session: InterviewSession, at: datetime | None = None) -> int | None:
    """Server-authoritative remaining interview seconds, or None before start."""
    if session.started_at is None:
        return None
    now = _aware(at if at is not None else datetime.now(timezone.utc), "at")
    # ceil, not trunc: a session with 0.4s left must still report 1s, never 0.
    return max(0, math.ceil((interview_deadline(session) - now).total_seconds()))


# -----------------------------------------------------------------------------
# Transition Mutation
# -----------------------------------------------------------------------------

def transition_session(
    db: Session,
    session: InterviewSession,
    target: str,
    *,
    actor_type: str,
    reason: str,
    actor_id: uuid.UUID | None = None,
    at: datetime | None = None,
    metadata: dict | None = None,
    expected_version: int | None = None,
) -> InterviewSessionTransition:
    """Validate and stage one atomic state change plus append-only audit event.

    Caller MUST load session in the same DB transaction with SELECT ... FOR UPDATE
    (e.g. select(InterviewSession).where(InterviewSession.id == id).with_for_update()).
    Do not write status/lifecycle_state directly. This helper does not commit or
    flush; caller commits after all related writes, or rolls back on failure.
    Check authorization/ownership before acquiring the lock. Call again on retry
    only after re-reading the locked row; self-transitions are invalid.

    `expected_version` enables optimistic concurrency: pass the `state_version`
    the caller last observed and the request is refused if the session has since
    advanced, instead of acting on a stale view. `metadata` is structured,
    non-PII context stored on the audit row.
    """
    now = _aware(at if at is not None else datetime.now(timezone.utc), "at")
    if actor_type not in {"system", "candidate", "recruiter", "admin"}:
        raise InvalidLifecycleTransition("Invalid transition actor_type")
    if actor_id is not None and not isinstance(actor_id, uuid.UUID):
        try:
            actor_id = uuid.UUID(str(actor_id))
        except Exception:
            raise InvalidLifecycleTransition("actor_id must be a UUID")
    if actor_type != "system" and not isinstance(actor_id, uuid.UUID):
        raise InvalidLifecycleTransition("Non-system transition requires an actor_id")
    if not isinstance(reason, str) or not reason.strip() or len(reason) > 1000:
        raise InvalidLifecycleTransition("A concise transition reason is required")

    current = lifecycle_state(session)
    validate_lifecycle_transition(current, target)
    current_version = int(getattr(session, "state_version", 0) or 0)
    if expected_version is not None and int(expected_version) != current_version:
        raise StaleStateVersion(current_version)
    # Self-heal legacy status to match authoritative lifecycle state if out of sync
    expected_legacy = legacy_status_for(session, current)
    curr_status_str = str(getattr(session.status, "value", session.status)).lower()
    exp_status_str = str(getattr(expected_legacy, "value", expected_legacy)).lower()
    if session.lifecycle_state is not None and curr_status_str != exp_status_str:
        session.status = expected_legacy

    if not is_practice_session(session):
        if target in PREFLIGHT_STATES and now > join_window_bounds(session)[1]:
            raise InvalidLifecycleTransition("Join window has expired")
        if target == "INTERVIEW_STARTED":
            if not is_join_window_open(session, now):
                raise InvalidLifecycleTransition("Interview is outside its join window")
            if session.started_at is not None:
                raise InvalidLifecycleTransition("Interview already has a start time")
        if target == "EXPIRED" and now <= join_window_bounds(session)[1]:
            raise InvalidLifecycleTransition("Join window has not expired")
    else:
        if target == "INTERVIEW_STARTED" and session.started_at is not None:
            raise InvalidLifecycleTransition("Interview already has a start time")
    if target in ("COMPLETED", "FAILED", "PROCTORING_VIOLATION"):
        if current in FINAL_STATES:
            raise InvalidLifecycleTransition("Interview has already ended")
    if current in TURN_STATES and target in TURN_STATES and is_interview_overdue(session, now):
        raise InvalidLifecycleTransition("Interview has exceeded its maximum duration")

    event = InterviewSessionTransition(
        session_id=session.id,
        from_state=current,
        to_state=target,
        actor_type=actor_type,
        actor_id=actor_id,
        reason=reason.strip(),
        metadata_json=_safe_metadata(metadata),
        transitioned_at=now,
    )
    session.lifecycle_state = target
    session.status = legacy_status_for(session, target)
    session.state_version = current_version + 1
    if target == "INTERVIEW_STARTED":
        session.started_at = now
    if target in FINAL_STATES:
        session.ended_at = now
    db.add(event)
    logger.info(
        "INTERVIEW_STATE_TRANSITION %s",
        json.dumps({
            "interview_session_id": str(session.id),
            "from_state": current,
            "to_state": target,
            "actor_type": actor_type,
            "state_version": session.state_version,
            "reason": reason.strip(),
            "correlation_id": (metadata or {}).get("correlation_id"),
            "timestamp": now.isoformat(),
        }, default=str),
    )
    return event
