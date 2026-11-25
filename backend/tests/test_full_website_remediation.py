"""Regression coverage for the 25-Nov full-website audit remediation.

Pure helpers only: no database, network, LLM or browser calls.
"""
import copy
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, g  # noqa: E402

from app.services import interviewer_policy, llm_service  # noqa: E402
from core import wallet as wallet_core  # noqa: E402
from routes import (  # noqa: E402
    aptitude_routes, billing_routes, candidate_routes, interview_routes,
)


# ---------------------------------------------------------------------------
# C1 / C6 / H12 — candidate session and scorecard payloads
# ---------------------------------------------------------------------------

def test_candidate_session_summary_rederives_score_and_hides_internal_fields():
    session = {
        "id": "dd612247",
        "org_id": "org-secret",
        "recruiter_id": "rec-secret",
        "proctoring_events": [{"event_type": "tab_switch"}],
        "overall_score": 90,
        "final_recommendation": "REJECT",
        "history": [{"answer": "I split the monolith into services.", "scores": {"relevance": 9}}],
        "config": {"is_demo": True, "demo_number": 2},
    }
    summary = interview_routes._candidate_session_summary(session)

    assert summary["overall_score"] == 90
    assert summary["final_recommendation"] == "STRONG_HIRE"
    assert summary["isDemo"] is True
    assert summary["demoNumber"] == 2
    for internal_key in ("org_id", "recruiter_id", "proctoring_events", "history", "questions"):
        assert internal_key not in summary


def test_candidate_session_summary_nulls_stale_zero_answer_scores():
    summary = interview_routes._candidate_session_summary({
        "id": "zero",
        "history": [],
        "overall_score": 13,
        "final_recommendation": "HIRE",
    })
    assert summary["overall_score"] is None
    assert summary["final_recommendation"] is None


def test_candidate_scorecard_payload_drops_internal_machinery():
    cleaned = interview_routes._candidate_scorecard_payload({
        "id": "sc-secret",
        "session_id": "session-secret",
        "second_pass": {"dimensions": ["internal"]},
        "review_reasons": ["internal"],
        "needs_human_review": True,
        "overall_score": 88,
        "recommendation": "HIRE",
    })
    assert cleaned["overall_score"] == 88
    assert cleaned["recommendation"] == "HIRE"
    for internal_key in ("id", "session_id", "second_pass", "review_reasons", "needs_human_review"):
        assert internal_key not in cleaned


# ---------------------------------------------------------------------------
# C3 / C4 / C5 / C6 / C7 — shared candidate list DTO
# ---------------------------------------------------------------------------

def _scored_session(**overrides):
    session = {
        "id": "sess-1",
        "job_title": "Role A",
        "company_name": "Acme Systems",
        "duration_minutes": 10,
        "finished_at": "2026-11-22T10:00:00+00:00",
        "total_score": 90,
        "final_recommendation": "REJECT",
        "history": [{"answer": "I designed the service with a queue.", "scores": {"relevance": 9}}],
        "config": {},
    }
    session.update(overrides)
    return session


def test_candidate_session_item_uses_stored_metadata_and_rederived_decision():
    item = candidate_routes._candidate_session_item(
        _scored_session(config={"is_demo": True, "demo_number": 2}),
        ["Python"],
        completed=True,
    )
    assert item["roleTitle"] == "Role A"
    assert item["companyName"] == "Acme Systems"
    assert item["durationMinutes"] == 10
    assert item["completedAt"] == "2026-11-22T10:00:00+00:00"
    assert item["recommendation"] == "STRONG_HIRE"
    assert item["isDemo"] is True
    assert item["demoNumber"] == 2
    assert item["recordingUrl"] is None


def test_candidate_session_item_skips_zero_answer_sessions():
    item = candidate_routes._candidate_session_item(
        _scored_session(history=[], total_score=13, finished_at=None),
        [],
        completed=True,
    )
    assert item is None


def test_demo_profile_markers_are_detected():
    assert candidate_routes._looks_like_demo_profile({
        "bio": "over 5 years of experience",
        "github_url": "github.com/alex-morgan-dev",
    }) is True
    assert candidate_routes._looks_like_demo_profile({
        "bio": "Final-year student interested in distributed systems.",
    }) is False


# ---------------------------------------------------------------------------
# H5 — timeouts are absence of evidence, not a 1/10 answer
# ---------------------------------------------------------------------------

TIMEOUT_ANSWER = "No response recorded within the allotted question time limit."


def test_insufficient_assessment_is_unscored():
    assessment = interviewer_policy.insufficient_assessment(TIMEOUT_ANSWER)
    assert assessment.unscored is True
    assert (assessment.relevance, assessment.depth, assessment.correctness) == (0.0, 0.0, 0.0)


def test_legacy_timeout_rows_are_not_scored_or_counted():
    history = [{
        "turn_index": 1,
        "question": "Explain caching.",
        "answer": TIMEOUT_ANSWER,
        "scores": {"relevance": 1, "depth": 1, "correctness": 1},
    }]
    assert interview_routes._compute_zero_turns({"history": history}) is True
    reviews = interview_routes._map_history_turn_reviews(history)
    assert all(score is None for score in reviews[0]["scores"].values())
    assert interview_routes.session_has_scored_answers({"history": history}) is False


# ---------------------------------------------------------------------------
# M5 — voided demos restore quota
# ---------------------------------------------------------------------------

def test_voided_demo_queries_are_excluded_from_quota_usage():
    db = MagicMock()
    db.platform_settings.find_one.return_value = {
        "is_free_quotas_enabled": True,
        "default_free_demo_count": 2,
        "max_demo_duration_seconds": 600,
    }
    db.organizations.find_one.return_value = None
    db.interview_sessions.count_documents.return_value = 0

    quota = wallet_core.get_demo_quota({"id": "cand-1"}, db)
    assert quota["remaining"] == 2

    query = db.interview_sessions.count_documents.call_args.args[0]
    and_clauses = query["$and"]
    assert any("$nor" in clause for clause in and_clauses)
    excluded = next(clause["$nor"] for clause in and_clauses if "$nor" in clause)
    assert {"answered_turns": 0} in excluded
    assert {"completed_reason": "finished_with_zero_turns"} in excluded


# ---------------------------------------------------------------------------
# H4 — never serve a short paper
# ---------------------------------------------------------------------------

def test_aptitude_start_fails_closed_on_short_validated_paper(monkeypatch):
    app = Flask(__name__)
    monkeypatch.setattr(
        aptitude_routes, "get_template_by_id",
        lambda *_args, **_kwargs: {
            "durationMinutes": 30,
            "sections": [{"questionCount": 2}],
        },
    )
    monkeypatch.setattr(
        aptitude_routes, "get_current_candidate",
        lambda _req: ({"id": "cand-1"}, None, []),
    )
    monkeypatch.setattr(aptitude_routes, "get_mongo_db", lambda: None)
    monkeypatch.setattr(
        aptitude_routes, "_assemble_validated_paper",
        lambda *_args, **_kwargs: [],
    )
    with app.test_request_context(
        "/api/aptitude/sessions/start", json={"templateId": "template-campus-general"}
    ):
        response, code = aptitude_routes.start_aptitude_session()
    assert code == 503
    assert "validated question paper" in response.get_json()["error"]


# ---------------------------------------------------------------------------
# H4 — legacy stored aptitude reports are revalidated before publication
# ---------------------------------------------------------------------------

def _aptitude_question(question_id):
    return {
        "id": question_id,
        "index": 1,
        "section": "verbal",
        "topic": "Comprehension",
        "prompt": "Which option is the intended answer in this short verbal reasoning item?",
        "options": ["alpha", "beta", "gamma", "delta"],
        "difficulty": "easy",
        "timeRecommendedSeconds": 60,
    }


def _aptitude_secret(correct_index=0):
    return {
        "correctIndex": correct_index,
        "explanation": "The first option is correct for this item.",
        "formula": "",
        "section": "verbal",
        "topic": "Comprehension",
        "difficulty": "easy",
    }


def _legacy_aptitude_doc():
    return {
        "sessionId": "apt-d6c614bc03fc",
        "candidateId": "cand-1",
        "candidateName": "Legacy Candidate",
        "templateTitle": "Legacy Aptitude",
        "status": "completed",
        "questions": [_aptitude_question("q1"), _aptitude_question("q2")],
        # Second secret is filed under a stale id: validator must reject q2.
        "serverSecretAnswers": {
            "q1": _aptitude_secret(0),
            "q-stale-key": _aptitude_secret(2),
        },
        "answers": {
            "q1": {"selectedOptionIndex": 0, "timeSpentSeconds": 12},
            "q2": {"selectedOptionIndex": 2, "timeSpentSeconds": 8},
        },
        "telemetry": {},
        "scorecard": {
            "overallScore": 100,
            "totalQuestions": 2,
            "review": [
                {
                    "id": "q-stale-key",
                    "options": ["alpha", "Alpha", "gamma", "delta"],
                    "correctIndex": 2,
                    "explanation": "unvalidated legacy explanation",
                }
            ],
        },
    }


def test_published_scorecard_drops_invalid_legacy_items_and_warns():
    published = aptitude_routes._published_scorecard(_legacy_aptitude_doc(), None)
    assert published is not None
    # One correct out of the original two-question denominator: 50%, not 100%.
    assert published["overallScore"] == 50.0
    assert [item["id"] for item in published["review"]] == ["q1"]
    assert published["dataQuality"]["status"] == "partial"
    assert published["dataQuality"]["excludedQuestions"] == 1
    assert "invalid_correct_index" in published["dataQuality"]["issues"]
    assert "validated questions" in published["dataQuality"]["notice"]
    # Candidate answers and invalid secrets never reappear in the payload.
    assert "answers" not in published
    assert "serverSecretAnswers" not in published


def test_valid_legacy_scorecard_is_published_unchanged():
    doc = _legacy_aptitude_doc()
    doc["serverSecretAnswers"] = {"q1": _aptitude_secret(0), "q2": _aptitude_secret(0)}
    assert aptitude_routes._published_scorecard(doc, None) == doc["scorecard"]


def test_unpublishable_legacy_report_fails_closed(monkeypatch):
    doc = _legacy_aptitude_doc()
    doc["questions"] = [{**_aptitude_question("q1"), "options": ["alpha", "Alpha", "gamma", "delta"]}]
    doc["serverSecretAnswers"] = {"q1": _aptitude_secret(0)}
    db = MagicMock()
    db.aptitude_sessions.find_one.return_value = doc
    db.platform_settings.find_one.return_value = {"variant": "B"}
    monkeypatch.setattr(aptitude_routes, "get_mongo_db", lambda: db)
    monkeypatch.setattr(
        aptitude_routes, "get_current_candidate",
        lambda _req: ({"id": "cand-1"}, None, []),
    )

    app = Flask(__name__)
    with app.test_request_context("/api/aptitude/sessions/apt-legacy/report"):
        response, code = aptitude_routes.get_aptitude_session_report("apt-legacy")
    assert code == 409
    assert "validator-approved" in response.get_json()["error"]

    with app.test_request_context("/api/aptitude/sessions/apt-legacy/report/pdf"):
        pdf_response, pdf_code = aptitude_routes.get_aptitude_report_pdf("apt-legacy")
    assert pdf_code == 409
    assert "validator-approved" in pdf_response.get_json()["error"]


# ---------------------------------------------------------------------------
# H5 — timeout / no-answer turns never feed the scorer
# ---------------------------------------------------------------------------

def _timeout_session():
    return {
        "id": "sess-timeouts",
        "job_title": "Backend Engineer",
        "config": {"is_practice": True},
        "history": [
            {
                "turn_index": 1,
                "question": "How would you scale reads?",
                "answer": "I added read replicas and partitioned the busiest tables.",
                "scores": {"relevance": 8, "depth": 7, "correctness": 9},
                "stage": "system_architecture",
            },
            {
                "turn_index": 2,
                "question": "What about caches?",
                "answer": TIMEOUT_ANSWER,
                "scores": {"relevance": 10, "depth": 10, "correctness": 10},
                "stage": "database_design",
                "unscored": True,
            },
            {
                "turn_index": 3,
                "question": "Testing strategy?",
                "answer": "",
                "scores": {"relevance": 10, "depth": 10, "correctness": 10},
                "stage": "quality_assurance",
            },
        ],
    }


def _patch_scorecard_dependencies(monkeypatch):
    monkeypatch.setattr(interview_routes, "get_mongo_db", lambda: None)
    monkeypatch.setattr(
        interview_routes, "get_current_candidate",
        lambda _req: ({"id": "cand-1"}, None, []),
    )

    def _no_llm(*_args, **_kwargs):
        raise RuntimeError("LLM disabled in regression test")

    monkeypatch.setattr(llm_service, "generate_scorecard", _no_llm)


def test_dynamic_scorecard_ignores_timeout_scores_and_evidence(monkeypatch):
    _patch_scorecard_dependencies(monkeypatch)
    scorecard = interview_routes.generate_dynamic_scorecard(
        "sess-timeouts", _timeout_session(), None
    )
    scores = {p["name"]: p["score"] for p in scorecard["overall_parameter_scores"]}
    assert scores == {"Relevance": 8.0, "Technical Depth": 7.0, "Correctness & Accuracy": 9.0}
    assert scorecard["recommendation"] != "NOT_EVALUATED"

    rendered = repr(scorecard)
    assert "database_design" not in rendered
    assert "quality_assurance" not in rendered
    assert TIMEOUT_ANSWER not in rendered
    assert [c["competency"] for c in scorecard["competencies"]] == ["System Architecture"]
    assert "1 interactive technical interview stages" in scorecard["executive_summary"]


def test_dynamic_scorecard_with_only_timeouts_stays_unscored(monkeypatch):
    _patch_scorecard_dependencies(monkeypatch)
    session = _timeout_session()
    session["history"] = session["history"][1:]
    scorecard = interview_routes.generate_dynamic_scorecard("sess-timeouts", session, None)
    assert scorecard["overall_score"] is None
    assert scorecard["recommendation"] == "NOT_EVALUATED"
    assert scorecard["strengths"] == []
    assert scorecard["competencies"] == []
    assert all(p["score"] is None for p in scorecard["overall_parameter_scores"])


def test_cached_scorecard_cannot_publish_timeout_strengths(monkeypatch):
    _patch_scorecard_dependencies(monkeypatch)
    session = _timeout_session()
    session["scorecard"] = {
        "overall_score": 96,
        "recommendation": "STRONG_HIRE",
        "executive_summary": "Candidate answered everything at 10/10.",
        "strengths": [f"Strong evidence: \"{TIMEOUT_ANSWER}\" (100%)."],
        "concerns": [],
        "competencies": [{"competency": "Database Design", "score": 100}],
        "overall_parameter_scores": [
            {"name": name, "score": 9, "percentage": 90}
            for name in ("Relevance", "Technical Depth", "Correctness & Accuracy")
        ],
    }
    scorecard = interview_routes.generate_dynamic_scorecard("sess-timeouts", session, None)
    assert scorecard["overall_parameter_scores"][0]["score"] == 8.0
    assert scorecard["recommendation"] != "NOT_EVALUATED"
    assert all(TIMEOUT_ANSWER not in strength for strength in scorecard["strengths"])
    assert "database_design" not in repr(scorecard["competencies"])


# ---------------------------------------------------------------------------
# L5 / M4 — minimal in-memory Mongo fixture
# ---------------------------------------------------------------------------

def _query_matches(doc, query):
    """Small Mongo-like matcher for the queries used by these regression tests."""
    if not isinstance(query, dict):
        return True

    def _match_clause(value, clause):
        if isinstance(clause, dict):
            for op, expected in clause.items():
                if op == "$in":
                    if value not in expected:
                        return False
                elif op == "$ne":
                    if value == expected:
                        return False
                elif op == "$or":
                    if not any(_match_clause(value, sub) for sub in expected):
                        return False
                elif op in ("$gt", "$lt", "$gte", "$lte"):
                    try:
                        if op == "$gt" and not value > expected:
                            return False
                        if op == "$lt" and not value < expected:
                            return False
                        if op == "$gte" and not value >= expected:
                            return False
                        if op == "$lte" and not value <= expected:
                            return False
                    except TypeError:
                        return False
                else:
                    return False
            return True
        return value == clause

    for key, clause in query.items():
        if key == "$and":
            if not all(_query_matches(doc, part) for part in clause):
                return False
            continue
        if key == "$or":
            if not any(_query_matches(doc, part) for part in clause):
                return False
            continue
        if key == "$nor":
            if any(_query_matches(doc, part) for part in clause):
                return False
            continue
        value = doc
        for part in key.split("."):
            if not isinstance(value, dict) or part not in value:
                value = None
                break
            value = value[part]
        if not _match_clause(value, clause):
            return False
    return True


class _Cursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, field, direction=1):
        self.docs.sort(
            key=lambda d: d.get(field) or "", reverse=direction < 0
        )
        return self

    def limit(self, count):
        self.docs = self.docs[:count]
        return self

    def __iter__(self):
        return iter(self.docs)


class _MemoryCollection:
    def __init__(self, docs=None):
        self.docs = copy.deepcopy(list(docs or []))

    def find(self, query=None, _projection=None, **_kwargs):
        return _Cursor(
            copy.deepcopy(d) for d in self.docs if _query_matches(d, query or {})
        )

    def find_one(self, query=None, *_args, **_kwargs):
        for doc in self.docs:
            if _query_matches(doc, query or {}):
                return copy.deepcopy(doc)
        return None

    def count_documents(self, query=None):
        return sum(1 for d in self.docs if _query_matches(d, query or {}))

    def update_one(self, query, update, upsert=False):
        for doc in self.docs:
            if _query_matches(doc, query or {}):
                if "$setOnInsert" in update:
                    return SimpleNamespace(matched_count=1, upserted_id=None)
                for key, value in (update.get("$set") or {}).items():
                    doc[key] = value
                return SimpleNamespace(matched_count=1, upserted_id=None)
        if upsert:
            new_doc = copy.deepcopy(update.get("$setOnInsert") or update.get("$set") or {})
            for key, value in (update.get("$set") or {}).items():
                new_doc[key] = value
            self.docs.append(new_doc)
            return SimpleNamespace(matched_count=0, upserted_id=new_doc.get("_id", "generated"))
        return SimpleNamespace(matched_count=0, upserted_id=None)

    def insert_one(self, doc):
        self.docs.append(copy.deepcopy(doc))
        return SimpleNamespace(inserted_id=doc.get("_id", "generated"))


# ---------------------------------------------------------------------------
# L5 — historical completion notices are backfilled once per session
# ---------------------------------------------------------------------------

def test_completed_session_notification_backfill_is_idempotent(monkeypatch):
    sessions = _MemoryCollection([
        {
            "id": "legacy-session-1",
            "candidate_id": "cand-1",
            "job_title": "Legacy Backend Interview",
            "status": "completed",
            "history": [],
        },
        {
            "id": "legacy-session-2",
            "candidate_id": "cand-1",
            "job_title": "Already Notified",
            "status": "evaluated",
        },
        {"id": "other-candidate", "candidate_id": "cand-2", "status": "completed"},
        {"id": "still-running", "candidate_id": "cand-1", "status": "in_progress"},
    ])
    notifications = _MemoryCollection([{
        "_id": "interview_completed:legacy-session-2",
        "id": "notif-existing",
        "dedupe_key": "interview_completed:legacy-session-2",
        "candidate_id": "cand-1",
        "notification_type": "interview_completed",
        "title": "Interview Completed: Already Notified",
        "body": "",
        "payload": {"sessionId": "legacy-session-2"},
        "is_read": False,
        "created_at": "2026-01-01T00:00:00+00:00",
    }])
    db = SimpleNamespace(
        interview_sessions=sessions, candidate_notifications=notifications
    )
    monkeypatch.setattr(candidate_routes, "get_mongo_db", lambda: db)

    app = Flask(__name__)
    user = {"id": "cand-1", "email": "cand1@example.com"}
    with app.test_request_context("/api/candidate/notifications"):
        g.user = user
        first, code = candidate_routes.get_candidate_notifications.__wrapped__()
        second, second_code = candidate_routes.get_candidate_notifications.__wrapped__()

    assert code == 200 and second_code == 200
    assert len(first.get_json()) == 2
    assert len(second.get_json()) == 2
    assert notifications.count_documents({"notification_type": "interview_completed"}) == 2
    inserted = notifications.find_one({"payload.sessionId": "legacy-session-1"})
    assert inserted["dedupe_key"] == "interview_completed:legacy-session-1"
    assert inserted["_id"] == "interview_completed:legacy-session-1"
    assert notifications.count_documents({"candidate_id": "cand-2"}) == 0
    assert [s["id"] for s in sessions.docs] == [
        "legacy-session-1", "legacy-session-2", "other-candidate", "still-running"
    ]


# ---------------------------------------------------------------------------
# M4 — ledger presentation is whole-credit and honestly labelled
# ---------------------------------------------------------------------------

def test_wallet_transaction_endpoint_normalizes_fractional_legacy_rows(monkeypatch):
    transactions = _MemoryCollection([
        {
            "id": "t1", "userId": "u1", "amountCredits": 2.5,
            "createdAt": "2026-01-01T00:00:00+00:00", "entryType": "upi_credit",
            "title": "Money Added via Progeni Atlas UPI", "reason": "UPI recharge",
            "status": "COMPLETED",
        },
        {
            "id": "t2", "userId": "u1", "amountCredits": -1.5,
            "createdAt": "2026-01-02T00:00:00+00:00", "entryType": "interview_settlement",
            "title": "Interview Settlement: Backend Engineer",
            "reason": "Verified AI Screening Settlement (1.5 cr, 3m pro-rated)",
            "ratePerMinute": 0.5,
        },
        {
            "id": "t3", "userId": "u1", "amountCredits": 0.0,
            "createdAt": "2026-01-03T00:00:00+00:00", "entryType": "free_demo",
            "title": "Complimentary Practice Session",
            "reason": "Complimentary Practice Session",
        },
    ])
    wallets = _MemoryCollection([{"userId": "u1", "availableCredits": 1.0, "consumedCredits": 1.5}])
    db = SimpleNamespace(wallet_transactions=transactions, wallets=wallets)
    monkeypatch.setattr(billing_routes, "get_mongo_db", lambda: db)

    app = Flask(__name__)
    with app.test_request_context("/api/billing/wallet/transactions"):
        g.user = {"id": "u1"}
        response, code = billing_routes.get_billing_wallet_transactions.__wrapped__()

    assert code == 200
    payload = response.get_json()
    rows = {tx["id"]: tx for tx in payload["transactions"]}
    assert rows["t1"]["amountCredits"] == 2
    assert rows["t1"]["balanceAfter"] == 2
    assert rows["t1"]["title"] == "Money Added"
    assert rows["t1"]["auditTitle"] == "Money Added via Progeni Atlas UPI"
    assert rows["t1"]["amountCreditsExact"] == 2.5

    assert rows["t2"]["amountCredits"] == -1
    assert rows["t2"]["balanceAfter"] == 1
    assert rows["t2"]["title"] == "Interview Settlement"
    assert rows["t2"]["auditReason"].startswith("Verified AI Screening Settlement")
    assert rows["t2"]["ratePerMinute"] == 0.5

    assert rows["t3"]["title"] == "Free Demo Interview"
    assert rows["t3"]["amountCredits"] == 0

    assert payload["summary"] == {
        "availableCredits": 1,
        "availableCreditsExact": 1.0,
        "totalCredited": 2,
        "totalDebited": 1,
        "count": 3,
    }
    # Immutable ledger rows were not rewritten.
    assert transactions.find_one({"id": "t2"})["title"] == "Interview Settlement: Backend Engineer"
