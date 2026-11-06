"""
Progeni Atlas - Interview Engine (Facade)
============================================

The interview engine used to be a single ~1000 line module. It is now split
into focused modules, and this file is the stable public surface that callers
import:

  - app.services.lifecycle         - state machine, transitions, session clock
  - app.services.context           - grounding context resolution and caching
  - app.services.question_service  - question generation, answer evaluation
  - app.services.evaluation_service- server-authoritative scoring
  - app.services.scorecard_service - scorecard assembly and persistence
  - app.services.summary_service   - structured interview summary

This module only re-exports those names. It intentionally defines no wrapper
functions of its own: a wrapper that calls a same-named import would shadow
the import and recurse into itself.
"""

from __future__ import annotations

from app.services.context import (
    _CandidateContext,
    _JobContext,
    _cache_get,
    _cache_put,
    _candidate_context,
    clear_candidate_context,
    clear_session_context,
)
from app.services.evaluation_service import (
    AnswerEvaluation,
    RubricError,
    _clamp,
    build_scorecard_from_evaluations,
    compute_recommendation,
    evaluate_answer,
)
from app.services.lifecycle import (
    ANSWERABLE_STATES,
    CLOSING_STATES,
    FINAL_STATES,
    LIFECYCLE_TRANSITIONS,
    PREFLIGHT_STATES,
    RECOVERABLE_ERROR_STATES,
    TERMINAL_ERROR_STATES,
    TURN_STATES,
    InvalidLifecycleTransition,
    StaleStateVersion,
    interview_deadline,
    is_interview_overdue,
    is_join_window_open,
    is_practice_session,
    join_window_bounds,
    legacy_status_for,
    lifecycle_state,
    remaining_seconds,
    transition_session,
    validate_lifecycle_transition,
)
from app.services.llm_service import LLMError
from app.services.question_service import (
    GeneratedQuestion,
    _validate_evaluation,
    _validate_generated_question,
    evaluate_and_store_response,
    generate_and_store_question,
    next_turn_index,
)
from app.services.scorecard_service import build_scorecard
from app.services.summary_service import generate_interview_summary

__all__ = [
    # lifecycle
    "ANSWERABLE_STATES",
    "CLOSING_STATES",
    "FINAL_STATES",
    "LIFECYCLE_TRANSITIONS",
    "PREFLIGHT_STATES",
    "RECOVERABLE_ERROR_STATES",
    "TERMINAL_ERROR_STATES",
    "TURN_STATES",
    "InvalidLifecycleTransition",
    "StaleStateVersion",
    "interview_deadline",
    "is_interview_overdue",
    "is_join_window_open",
    "is_practice_session",
    "join_window_bounds",
    "legacy_status_for",
    "lifecycle_state",
    "remaining_seconds",
    "transition_session",
    "validate_lifecycle_transition",
    # context
    "_CandidateContext",
    "_JobContext",
    "_cache_get",
    "_cache_put",
    "_candidate_context",
    "clear_candidate_context",
    "clear_session_context",
    # questions and evaluation
    "AnswerEvaluation",
    "GeneratedQuestion",
    "LLMError",
    "RubricError",
    "_clamp",
    "_validate_evaluation",
    "_validate_generated_question",
    "build_scorecard_from_evaluations",
    "compute_recommendation",
    "evaluate_and_store_response",
    "evaluate_answer",
    "generate_and_store_question",
    "next_turn_index",
    # scorecard and summary
    "build_scorecard",
    "generate_interview_summary",
]
