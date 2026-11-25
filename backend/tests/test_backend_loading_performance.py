"""Regression coverage for low-risk backend loading/performance remediations.

Pure tests only: no live database, network, or LLM calls.
"""
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, g  # noqa: E402

from app.services import llm_service  # noqa: E402
from core import context, db as db_core  # noqa: E402
from routes import aptitude_routes, candidate_routes, interview_routes  # noqa: E402


class _FakeCursor:
    """Minimal find() cursor supporting .sort().limit() and iteration."""

    def __init__(self, docs):
        self.docs = docs

    def sort(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def __iter__(self):
        return iter(self.docs)


# ---------------------------------------------------------------------------
# Request-scoped candidate context memoization
# ---------------------------------------------------------------------------

def test_current_candidate_memoized_per_request(monkeypatch):
    app = Flask(__name__)
    db = MagicMock()
    db.candidate_resumes.find_one.return_value = None
    user = {"id": "cand-memo", "role": "candidate", "status": "active"}

    monkeypatch.setattr(context, "get_mongo_db", lambda: db)
    resolve = MagicMock(return_value=user)
    monkeypatch.setattr(context, "resolve_user", resolve)
    monkeypatch.setattr(context, "_authenticate_request", lambda: ({"sub": "cand-memo"}, None))

    with app.test_request_context("/"):
        first = context.get_current_candidate()
        second = context.get_current_candidate()

        assert first == second
        assert first[0] is user
        assert resolve.call_count == 1
        # Active-resume query plus its latest-upload fallback happen once each.
        assert db.candidate_resumes.find_one.call_count == 2

        # A different verified identity in the same request gets its own entry.
        g.user_claims = {"sub": "cand-other"}
        resolve.return_value = dict(user, id="cand-other")
        other = context.get_current_candidate()
        assert other[0]["id"] == "cand-other"
        assert resolve.call_count == 2

    # A fresh request must redo lookups: the memo never crosses requests.
    with app.test_request_context("/"):
        context.get_current_candidate()
    assert resolve.call_count == 3


def test_current_candidate_uses_g_user_without_resolve_lookup(monkeypatch):
    app = Flask(__name__)
    db = MagicMock()
    db.candidate_resumes.find_one.return_value = None
    user = {"id": "cand-g", "role": "candidate", "status": "active"}
    monkeypatch.setattr(context, "get_mongo_db", lambda: db)
    resolve = MagicMock()
    monkeypatch.setattr(context, "resolve_user", resolve)

    with app.test_request_context("/"):
        g.user = user
        g.user_claims = {"sub": "cand-g"}
        first = context.get_current_candidate()
        second = context.get_current_candidate()

    assert first == second
    assert first[0] is user
    assert resolve.call_count == 0
    assert db.candidate_resumes.find_one.call_count == 2


def test_current_candidate_works_outside_request_context(monkeypatch):
    monkeypatch.setattr(context, "get_mongo_db", lambda: None)
    assert context.get_current_candidate() == (None, None, [])


# ---------------------------------------------------------------------------
# Aptitude history query
# ---------------------------------------------------------------------------

def test_aptitude_history_uses_plain_candidate_filter(monkeypatch):
    app = Flask(__name__)
    db = MagicMock()
    cursor = MagicMock()
    cursor.sort.return_value.limit.return_value = _FakeCursor([
        {"sessionId": "apt-1", "status": "completed", "startedAt": "2026-11-20T10:00:00+00:00"},
    ])
    db.aptitude_sessions.find.return_value = cursor

    monkeypatch.setattr(
        aptitude_routes, "get_current_candidate", lambda _req: ({"id": "cand-1"}, None, [])
    )
    monkeypatch.setattr(aptitude_routes, "get_mongo_db", lambda: db)
    monkeypatch.setattr(aptitude_routes, "_published_scorecard", lambda _doc, _db: None)

    with app.test_request_context("/api/candidate/aptitude/history"):
        payload, code = aptitude_routes.get_candidate_aptitude_history()

    assert code == 200
    assert payload.get_json()["attempts"][0]["sessionId"] == "apt-1"
    assert db.aptitude_sessions.find.call_args.args[0] == {"candidateId": "cand-1"}
    cursor.sort.assert_called_once_with("startedAt", -1)
    cursor.sort.return_value.limit.assert_called_once_with(20)


# ---------------------------------------------------------------------------
# Scorecard read path
# ---------------------------------------------------------------------------

def test_scorecard_get_reuses_session_document_from_auth_decorator(monkeypatch):
    app = Flask(__name__)
    session_doc = {"id": "sess-1", "scorecard": {}}
    seen = {}

    def _generate(_session_id, doc, _req):
        seen["doc"] = doc
        return {"ok": True}

    monkeypatch.setattr(interview_routes, "generate_dynamic_scorecard", _generate)
    monkeypatch.setattr(interview_routes, "_caller_is_internal", lambda: True)

    def _fail_db():
        raise AssertionError("session document should come from flask.g")

    monkeypatch.setattr(interview_routes, "get_mongo_db", _fail_db)

    with app.test_request_context("/api/v1/interview-sessions/sess-1/scorecard"):
        g.session_document = session_doc
        payload, code = interview_routes.get_interview_session_scorecard.__wrapped__("sess-1")

    assert code == 200
    assert payload.get_json() == {"ok": True}
    assert seen["doc"] is session_doc


def test_cached_scorecard_skips_strength_filter_when_list_empty(monkeypatch):
    app = Flask(__name__)
    calls = []

    def _filter(*_args, **_kwargs):
        calls.append(True)
        return ["should-not-appear"]

    monkeypatch.setattr(llm_service, "filter_scorecard_strengths", _filter)
    monkeypatch.setattr(interview_routes, "get_mongo_db", lambda: None)
    monkeypatch.setattr(
        interview_routes, "get_current_candidate", lambda _req: (None, None, [])
    )
    session_doc = {
        "id": "sess-1",
        "history": [],
        "scorecard": {
            "strengths": [],
            "concerns": [],
            "competencies": [],
            "executive_summary": "cached",
            "overall_score": 80,
            "recommendation": "HIRE",
            "overall_parameter_scores": [
                {"name": "A", "score": 8},
                {"name": "B", "score": 8},
                {"name": "C", "score": 8},
            ],
        },
    }

    with app.test_request_context("/"):
        scorecard = interview_routes.generate_dynamic_scorecard("sess-1", session_doc, None)

    assert calls == []
    assert scorecard["strengths"] == []


# ---------------------------------------------------------------------------
# Dashboard single-pass session projection
# ---------------------------------------------------------------------------

def test_dashboard_projects_sessions_in_one_pass_with_same_order(monkeypatch):
    app = Flask(__name__)
    scored_history = [{"answer": "I designed a queue-based pipeline.", "scores": {"relevance": 9}}]
    sessions = [
        {"id": "done-1", "status": "completed", "job_title": "Role A",
         "history": scored_history, "total_score": 90},
        {"id": "next-1", "status": "scheduled", "job_title": "Role B"},
        {"id": "done-2", "status": "evaluated", "job_title": "Role C",
         "history": scored_history, "total_score": 70},
        {"id": "closed-1", "status": "cancelled", "job_title": "Role D"},
    ]
    db = MagicMock()
    db.interview_sessions.find.return_value = _FakeCursor(sessions)
    db.candidate_notifications.count_documents.return_value = 0

    monkeypatch.setattr(candidate_routes, "get_mongo_db", lambda: db)
    monkeypatch.setattr(
        candidate_routes, "get_current_candidate", lambda _req: (None, None, ["Python"])
    )
    monkeypatch.setattr(candidate_routes, "_load_practice_sessions", lambda _user_id: [])
    monkeypatch.setattr(
        candidate_routes, "get_demo_quota",
        lambda _user, _db: {
            "free_demos_total": 0, "free_demos_used": 0, "free_demos_remaining": 0,
            "demo_duration_limit_minutes": 0,
        },
    )
    monkeypatch.setattr(candidate_routes, "backfill_completed_session_notifications", lambda *_a: 0)

    with app.test_request_context("/api/candidate/dashboard"):
        g.user = {"id": "cand-1", "email": "cand1@example.com", "full_name": "Candidate"}
        payload = candidate_routes.get_candidate_dashboard_data.__wrapped__()

    body = payload.get_json()
    assert [item["sessionId"] for item in body["recent_interviews"]] == ["done-1", "done-2"]
    assert body["upcoming_interviews"][0]["sessionId"] == "next-1"
    assert db.interview_sessions.find.call_count == 1


# ---------------------------------------------------------------------------
# Index set / notification backfill batching
# ---------------------------------------------------------------------------

def test_ensure_indexes_covers_hot_query_shapes():
    db = MagicMock()
    db_core.ensure_indexes(db)

    def index_keys(collection):
        return [call.args[0] for call in collection.create_index.call_args_list]

    assert [("userId", 1), ("created_at", -1)] in index_keys(db.interview_sessions)
    assert [("user_id", 1), ("created_at", -1)] in index_keys(db.interview_sessions)
    assert [("candidate_id", 1), ("created_at", -1)] in index_keys(db.interview_sessions)
    assert [("candidate_email", 1), ("created_at", -1)] in index_keys(db.interview_sessions)

    notif_keys = index_keys(db.candidate_notifications)
    assert [("candidate_id", 1), ("created_at", -1)] in notif_keys
    assert [("candidate_email", 1), ("created_at", -1)] in notif_keys
    assert [("candidate_id", 1), ("is_read", 1), ("created_at", -1)] in notif_keys
    assert any(
        call.args[0] == "dedupe_key" and call.kwargs.get("unique") and call.kwargs.get("sparse")
        for call in db.candidate_notifications.create_index.call_args_list
    )

    assert [("session_id", 1), ("timestamp", 1)] in index_keys(db.proctoring_events)
    apt_keys = index_keys(db.aptitude_sessions)
    assert [("templateId", 1), ("status", 1), ("completedAt", -1)] in apt_keys
    assert [("templateId", 1), ("scorecard.overallScore", 1)] in apt_keys

    meta_call = db["_meta"].update_one.call_args
    assert meta_call.args[0] == {"_id": "schema_version"}
    assert meta_call.args[1]["$set"]["v"] == db_core._SCHEMA_VERSION == 6


def test_notification_backfill_batches_existence_check():
    db = MagicMock()
    db.interview_sessions.find.return_value = _FakeCursor([
        {"id": "s1", "candidate_id": "cand-1", "job_title": "Role A", "status": "completed"},
        {"id": "s2", "candidate_id": "cand-1", "job_title": "Role B", "status": "evaluated"},
    ])
    db.candidate_notifications.find.return_value = []

    inserted = candidate_routes.backfill_completed_session_notifications(db, {"id": "cand-1"})

    assert inserted == 2
    assert db.candidate_notifications.find.call_count == 1
    assert db.candidate_notifications.find_one.call_count == 0
    query = db.candidate_notifications.find.call_args.args[0]
    assert query["$or"][0] == {
        "dedupe_key": {"$in": ["interview_completed:s1", "interview_completed:s2"]}
    }
