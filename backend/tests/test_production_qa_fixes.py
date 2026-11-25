"""Focused regression tests for the production QA fixes.

Pure helpers plus one mocked-LLM test — no database, no network, no real LLM.
"""
import json
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask  # noqa: E402
from app.services import llm_service  # noqa: E402
from core import scoring_contract  # noqa: E402
from routes import interview_routes  # noqa: E402


# ---------------------------------------------------------------- recommendation thresholds
def test_threshold_helper_is_single_source_of_truth():
    assert scoring_contract.compute_recommendation(90) == "STRONG_HIRE"
    assert scoring_contract.compute_recommendation(85) == "STRONG_HIRE"
    assert scoring_contract.compute_recommendation(84.9) == "HIRE"
    assert scoring_contract.compute_recommendation(70) == "HIRE"
    assert scoring_contract.compute_recommendation(69.9) == "LEAN_HIRE"
    assert scoring_contract.compute_recommendation(55) == "LEAN_HIRE"
    assert scoring_contract.compute_recommendation(54.9) == "REJECT"


def test_score_wins_over_generated_recommendation_but_human_override_wins_over_score():
    # A stored AI recommendation is not a human decision.
    assert scoring_contract.resolve_recommendation(90, source={"recommendation": "REJECT"}) == "STRONG_HIRE"
    # Explicit documented human overrides are preserved verbatim.
    assert scoring_contract.resolve_recommendation(90, source={"recommendation_override": "REJECT"}) == "REJECT"
    assert scoring_contract.resolve_recommendation(90, source={"manual_decision": {"recommendation": "HIRE"}}) == "HIRE"
    assert scoring_contract.resolve_recommendation(72, human_override="STRONG HIRE") == "STRONG_HIRE"


def test_generate_scorecard_normalizes_llm_verdict_and_filters_strengths(monkeypatch):
    payload = {
        "overall_score": 90,
        "recommendation": "REJECT",
        "executive_summary": "Strong, specific answers across the transcript.",
        "competencies": [
            {"competency": "technicalDepth", "score": 90, "weight": 40, "evidence": "BRIN indexes explained."}
        ],
        "strengths": [
            "Hi Vivekanand Kumar, great to meet you! I'm Sarah, leading your technical conversation today.",
            "Excellent use of BRIN indexes and tenant partitioning.",
        ],
        "concerns": [],
    }
    monkeypatch.setattr(llm_service, "_chat", lambda *a, **k: (json.dumps(payload), "fake-model"))

    transcript = [{
        "question": "How would you scale Postgres?",
        "answer": "I used BRIN indexes and tenant partitioning on the orders table.",
    }]
    result = llm_service.generate_scorecard(
        job_title="Backend Engineer",
        candidate_name="Vivekanand Kumar",
        config={},
        transcript=transcript,
        evaluations=[{"question": transcript[0]["question"], "evaluator_feedback": "Precise and correct."}],
        proctoring_summary={"warning_count": 0, "flagged": False},
    )

    assert result.recommendation == "STRONG_HIRE"
    assert result.overall_score == 90.0
    assert all("great to meet you" not in s.lower() for s in result.strengths)
    assert any("BRIN indexes" in s for s in result.strengths)


# ---------------------------------------------------------------- job context derivation
def test_job_context_uses_session_fields_and_stored_timestamp():
    context = interview_routes.derive_job_context({
        "job_title": "Senior Backend Engineer",
        "company_name": "Acme Labs",
        "duration_minutes": 60,
        "started_at": "2026-11-18T10:00:00Z",
        "created_at": "2026-01-01T00:00:00Z",
    })
    assert context == {
        "roleTitle": "Senior Backend Engineer",
        "companyName": "Acme Labs",
        "interviewDate": "2026-11-18T10:00:00+00:00",
        "durationMinutes": 60,
    }


def test_job_context_falls_back_to_config_and_converts_timezone():
    context = interview_routes.derive_job_context({
        "config": {
            "custom_instructions": "Role: Payments Platform Engineer\nKeep questions concise.",
            "max_duration_seconds": 2700,
        },
        "org_id": "org-42",
        "finished_at": "2026-11-18T15:30:00+05:30",
    })
    assert context["roleTitle"] == "Payments Platform Engineer"
    assert context["companyName"] == "org-42"
    assert context["durationMinutes"] == 45
    assert context["interviewDate"] == "2026-11-18T10:00:00+00:00"


def test_job_context_never_fabricates_values_or_calls_now():
    context = interview_routes.derive_job_context(None)
    assert context["roleTitle"] == "Interview Session"
    assert context["companyName"] == "Not specified"
    assert context["interviewDate"] is None
    assert context["durationMinutes"] is None


# ---------------------------------------------------------------- terminal gates
def test_terminal_gate_recognises_finished_sessions():
    assert interview_routes.is_terminal_session({"status": "completed"}) is True
    assert interview_routes.is_terminal_session({"status": "expired"}) is True
    assert interview_routes.is_terminal_session({"state": "COMPLETED"}) is True
    assert interview_routes.is_terminal_session({"status": "in_progress", "state": "QUESTION_READY"}) is False
    assert interview_routes.is_terminal_session(None) is False

    error = interview_routes.terminal_session_error({"id": "sess-1", "status": "completed"})
    assert error["error_code"] == "SESSION_TERMINAL"
    assert error["status"] == "expired"
    assert "already ended" in error["error"]
    assert interview_routes.terminal_session_error({"status": "in_progress"}) is None


def test_media_token_and_checkin_refuse_terminal_session(monkeypatch):
    app = Flask(__name__)
    terminal = {"id": "sess-1", "status": "completed", "state": "COMPLETED"}
    db = MagicMock()
    db.interview_sessions.find_one.return_value = terminal
    monkeypatch.setattr(interview_routes, "get_mongo_db", lambda: db)

    with app.test_request_context("/", method="POST"):
        response, code = interview_routes.get_candidate_media_token.__wrapped__("sess-1")
    assert code == 409
    assert response.get_json()["error_code"] == "SESSION_TERMINAL"

    with app.test_request_context("/", method="POST", json={"consentGiven": True, "hardwareDiagnostic": {}}):
        response, code = interview_routes.log_lobby_checkin.__wrapped__("sess-1")
    assert code == 409
    # Check-in must never overwrite a finished session with in_progress or
    # flip its canonical status (that would hide it from completed reports).
    assert db.interview_sessions.update_one.call_count == 1
    set_payload = db.interview_sessions.update_one.call_args.args[1]["$set"]
    assert set_payload["lobby_access_closed_reason"] == "terminal_session_reentry_blocked"
    assert "status" not in set_payload
    assert "started_at" not in set_payload


def test_candidate_completion_notification_is_idempotent():
    db = MagicMock()
    db.candidate_notifications.find_one.side_effect = [None, {"id": "already-there"}]

    assert interview_routes.ensure_candidate_completion_notification(
        db, "sess-1", {"candidate_id": "c-1"}, job_title="Backend Engineer", now_iso="2026-11-23T00:00:00+00:00"
    ) is True
    assert interview_routes.ensure_candidate_completion_notification(
        db, "sess-1", {"candidate_id": "c-1"}, job_title="Backend Engineer", now_iso="2026-11-23T00:00:00+00:00"
    ) is False
    assert db.candidate_notifications.update_one.call_count == 1
    inserted = db.candidate_notifications.update_one.call_args.args[1]["$setOnInsert"]
    assert inserted["dedupe_key"] == "interview_completed:sess-1"
    assert inserted["payload"]["sessionId"] == "sess-1"


# ---------------------------------------------------------------- evidence / scored answers
def test_strength_filter_rejects_interviewer_prompt_and_stage_labels():
    transcript = [{
        "question": "Hi Vivekanand Kumar, great to meet you! I'm Sarah, leading your technical conversation today.",
        "answer": "I partitioned the orders table by tenant and used BRIN indexes for time-range scans.",
    }]
    evaluations = [{
        "question": "How would you scale Postgres?",
        "evaluator_feedback": "Candidate explained partition pruning clearly.",
    }]
    strengths = [
        "Hi Vivekanand Kumar, great to meet you! I'm Sarah, leading your technical conversation today.",
        "Strong performance in Technical Core ('How would you scale Postgres?'): structured reasoning.",
        "Excellent use of BRIN indexes and tenant partitioning for time-range scans.",
    ]
    filtered = llm_service.filter_scorecard_strengths(
        strengths, transcript=transcript, evaluations=evaluations
    )
    assert filtered == ["Excellent use of BRIN indexes and tenant partitioning for time-range scans."]


def test_scored_answer_gate_requires_answer_and_score():
    history = [
        {"turn_index": 1, "question": "q?", "answer": "No answer recorded.", "scores": {"relevance": 8}},
    ]
    assert interview_routes.session_has_scored_answers({"history": history}) is False

    history.append({"turn_index": 2, "question": "q2?", "answer": "I used BRIN indexes.", "scores": {"relevance": 8}})
    assert interview_routes.session_has_scored_answers({"history": history}) is True
    # The finish gate is authoritative: an explicitly zero-turn session stays unscored.
    assert interview_routes.session_has_scored_answers({"answered_turns": 0, "history": history}) is False
