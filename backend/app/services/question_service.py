"""
Progeni Atlas - Question Service Module
Extracted from interview_engine.py for better code organization.

Handles question generation, validation and storage for interview turns, plus
the evaluation of the candidate's answer. Depends on llm_service.py,
app.models and context.py.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActionDecision, InterviewQuestion, InterviewResponse, InterviewSession, InterviewStage
from app.services import llm_service
from app.services.context import _candidate_context
from app.services.llm_service import AnswerEvaluation, GeneratedQuestion, LLMError

logger = logging.getLogger("talentpulse.question_service")

__all__ = [
    "AnswerEvaluation",
    "GeneratedQuestion",
    "LLMError",
    "_meter_context",
    "_validate_evaluation",
    "_validate_generated_question",
    "evaluate_and_store_response",
    "generate_and_store_question",
    "next_turn_index",
]


def next_turn_index(db: Session, session_id: uuid.UUID) -> int:
    """Number of questions already asked in this session."""
    count = db.scalar(
        select(func.count())
        .select_from(InterviewQuestion)
        .where(InterviewQuestion.session_id == session_id)
    ) or 0
    return count


def _validate_generated_question(generated: GeneratedQuestion) -> None:
    """Reject malformed model output before persisting a turn (no fabricated fallback)."""
    if not isinstance(generated.prompt_text, str) or not generated.prompt_text.strip() or len(generated.prompt_text) > 4000:
        raise LLMError("LLM returned an invalid question")
    if not isinstance(generated.stage, InterviewStage):
        raise LLMError("LLM returned an invalid question stage")
    if (not isinstance(generated.expected_concepts, list)
            or len(generated.expected_concepts) > 12
            or any(not isinstance(c, str) or not c.strip() or len(c) > 500 for c in generated.expected_concepts)):
        raise LLMError("LLM returned invalid expected concepts")
    if not isinstance(generated.model_used, str) or not generated.model_used.strip():
        raise LLMError("LLM did not identify the question model")


def _validate_evaluation(evaluation: AnswerEvaluation) -> None:
    """Reject malformed model output before persisting an evaluation."""
    for score in (evaluation.relevance_score, evaluation.depth_score, evaluation.correctness_score):
        if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 10:
            raise LLMError("LLM returned an invalid evaluation score")
    if not isinstance(evaluation.action_decision, ActionDecision):
        raise LLMError("LLM returned an invalid evaluation decision")
    if not isinstance(evaluation.evaluator_notes, str) or not evaluation.evaluator_notes.strip():
        raise LLMError("LLM returned empty evaluation notes")
    if not isinstance(evaluation.model_used, str) or not evaluation.model_used.strip():
        raise LLMError("LLM did not identify the evaluation model")
    for values in (evaluation.missing_concepts, evaluation.red_flags):
        if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
            raise LLMError("LLM returned an invalid evaluation list")


def _meter_context(session: InterviewSession, operation: str):
    """Build a trusted shadow-metering context for one LLM operation.

    Only server-side identifiers are carried (organization, candidate, session)
    so every event is correctly tenant-scoped. Returns ``None`` when the
    metering layer cannot be imported, which makes metering a no-op rather than
    a failure in the interview path.
    """
    try:
        from core import shadow_metering as sm

        return sm.context_from_session(
            session,
            service_category=sm.SERVICE_LLM,
            operation=operation,
        )
    except Exception:  # pragma: no cover - metering must never break a turn
        logger.debug("shadow metering context unavailable", exc_info=True)
        return None


def generate_and_store_question(db: Session, session: InterviewSession) -> InterviewQuestion:
    """Generate the next question for the interview and persist it.

    The caller owns the transaction: the row is flushed, not committed, so the
    question becomes durable together with the caller's own state changes (for
    example the lifecycle transition that produced it).
    """
    ctx = _candidate_context(db, session)
    if ctx["candidate"] is None:
        raise LLMError("Candidate record is missing")

    previous = db.execute(
        select(InterviewQuestion, InterviewResponse)
        .outerjoin(
            InterviewResponse,
            (InterviewResponse.question_id == InterviewQuestion.id)
            & (InterviewResponse.session_id == InterviewQuestion.session_id),
        )
        .where(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.turn_index)
    ).all()

    previous_questions = [q.prompt_text for q, _ in previous]
    previous_qa = [
        {"question": q.prompt_text, "answer": (r.answer_text if r else "")}
        for q, r in previous
        if r is not None
    ]

    turn_index = next_turn_index(db, session.id)
    started = time.perf_counter()

    generated = llm_service.generate_question(
        job_title=ctx["job"].title if ctx["job"] else (session.config or {}).get("job_role"),
        job_description=ctx["job"].job_description if ctx["job"] else (session.config or {}).get("job_description"),
        candidate_name=ctx["candidate"].full_name,
        candidate_skills=ctx["skills"],
        resume_text=ctx["resume_text"],
        experience_level=ctx["job"].experience_level if ctx["job"] else None,
        config=session.config or {},
        previous_questions=previous_questions,
        previous_qa=previous_qa,
        turn_index=turn_index,
    )
    _validate_generated_question(generated)

    question = InterviewQuestion(
        session_id=session.id,
        turn_index=turn_index,
        stage=generated.stage,
        prompt_text=generated.prompt_text,
        expected_concepts=generated.expected_concepts,
        model_used=generated.model_used,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
    db.add(question)
    session.current_stage = generated.stage
    # The orchestrator/route owns the transaction. Committing here would release
    # the caller's session row lock before the lifecycle transition is durable.
    db.flush()
    db.refresh(question)
    return question


def evaluate_and_store_response(
    db: Session,
    session: InterviewSession,
    question: InterviewQuestion,
    answer_text: str,
) -> InterviewResponse:
    """Evaluate the candidate's answer and stage the response row."""
    ctx = _candidate_context(db, session)
    response = InterviewResponse(
        session_id=session.id,
        question_id=question.id,
        turn_index=question.turn_index,
        answer_text=answer_text,
    )
    db.add(response)
    db.flush()

    evaluation = llm_service.evaluate_answer(
        question=question.prompt_text,
        expected_concepts=[c for c in (question.expected_concepts or []) if not str(c).startswith("__competency__:")],
        answer=answer_text,
        job_description=ctx["job"].job_description if ctx["job"] else (session.config or {}).get("job_description"),
        turn_index=question.turn_index,
    )
    _validate_evaluation(evaluation)
    response.relevance_score = evaluation.relevance_score
    response.depth_score = evaluation.depth_score
    response.correctness_score = evaluation.correctness_score
    response.evaluator_notes = evaluation.evaluator_notes
    response.missing_concepts = evaluation.missing_concepts
    response.red_flags = evaluation.red_flags
    response.action_decision = evaluation.action_decision
    response.recommended_follow_up = evaluation.recommended_follow_up
    response.evaluated_at = datetime.now(timezone.utc)
    response.model_used = evaluation.model_used
    db.flush()
    return response
