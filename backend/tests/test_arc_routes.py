"""
End-to-end route tests for the interview answer pipeline — no LLM, no real DB.

These exercise the *unscored arc phases* (warm_open, candidate_questions)
through the real Flask route with an in-memory fake MongoDB. This is the
regression harness for "Sarah behaves like a conversation, not a quiz".
"""
import copy
import json
import os
import sys
import types

import pytest
from flask import Flask

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import core.security as security  # noqa: E402
import routes.interview_routes as ir  # noqa: E402
import app.services.llm_service as llm  # noqa: E402


class FakeCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find_one(self, query=None, *args, **kwargs):
        return copy.deepcopy(self.docs[0]) if self.docs else None

    def find(self, query=None, projection=None):
        return iter([copy.deepcopy(d) for d in self.docs])

    def insert_one(self, doc):
        self.docs.append(copy.deepcopy(doc))
        return types.SimpleNamespace(inserted_id="fake-id")

    def update_one(self, query, update, upsert=False):
        doc = self.docs[0] if self.docs else {}
        for k, v in (update or {}).get("$set", {}).items():
            doc[k] = v
        for k, v in (update or {}).get("$push", {}).items():
            arr = doc.setdefault(k, [])
            if isinstance(v, dict) and "$each" in v:
                arr.extend(v["$each"])
            else:
                arr.append(v)
        if not self.docs:
            self.docs.append(doc)
        else:
            self.docs[0] = doc
        return types.SimpleNamespace(modified_count=1)

    def update_many(self, query, update):
        return types.SimpleNamespace(modified_count=1)

    def count_documents(self, query):
        return len(self.docs)


class FakeDB:
    def __init__(self, session_doc):
        self.interview_sessions = FakeCollection([session_doc])
        self.proctoring_events = FakeCollection()
        self.candidate_resumes = FakeCollection()
        self.candidate_notifications = FakeCollection()
        self.recruiter_notifications = FakeCollection()
        self.notifications = FakeCollection()
        self.interview_invitations = FakeCollection()
        self.users = FakeCollection()


def _baseline_session(turn_index=1, questions=None, **overrides):
    doc = {
        "id": "sess-it-1",
        "_id": "sess-it-1",
        "session_id": "sess-it-1",
        "candidate_id": "cand1",
        "candidate_email": "c@x.com",
        "candidate_name": "Asha Verma",
        "job_title": "Backend Engineer",
        "company_name": "Northwind Labs",
        "status": "in_progress",
        "state": "QUESTION_READY",
        "turn_index": turn_index,
        "turn_started_at": "2026-11-18T10:00:00+00:00",
        "started_at": "2026-11-18T09:50:00+00:00",
        "answered_turns": 0,
        "pending_probe": None,
        "probe_counts": {},
        "clarification_counts": {},
        "history": [],
        "config": {"is_practice": True, "experience_level": "Senior", "job_description": "Build APIs and data pipelines for a payments platform."},
        "duration_minutes": 10,
        "difficulty_level": 4,
    }
    if questions is not None:
        doc["questions"] = questions
    doc.update(overrides)
    return doc


@pytest.fixture()
def fake_env(monkeypatch):
    state = {"docs": None}

    def _mk(session_doc):
        state["docs"] = FakeDB(session_doc)
        fake = state["docs"]
        monkeypatch.setattr(security, "_authenticate_request", lambda: ({"sub": "cand1", "email": "c@x.com", "role": "candidate"}, None))
        monkeypatch.setattr(security, "resolve_user", lambda _sub: {"id": "cand1", "email": "c@x.com", "role": "candidate", "status": "active"})
        monkeypatch.setattr(security, "get_mongo_db", lambda: fake)
        monkeypatch.setattr(ir, "get_mongo_db", lambda: fake)
        monkeypatch.setattr(ir, "get_current_candidate", lambda req=None: (None, None, ["Go", "Postgres"]))
        monkeypatch.setattr(llm, "call_llm", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("LLM offline in test")))
        monkeypatch.setattr(llm, "_chat", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("LLM offline in test")))
        return fake

    return _mk


def test_warm_open_turn_is_unscored_and_advances(fake_env):
    fake = fake_env(_baseline_session())
    app = Flask(__name__)
    with app.test_request_context(
        "/api/interview/sess-it-1/answer",
        method="POST",
        json={"answer": "Hi Sarah — I build backend services, mostly Go and Postgres, currently leading migration of our ledger service."},
    ):
        resp = ir.interview_answer_route("sess-it-1")
        if isinstance(resp, tuple):
            resp, status = resp
            assert status == 200, status
        payload = json.loads(resp.get_data(as_text=True))

    assert payload["scores"] is None, "warm_open must never be scored"
    assert payload.get("interviewer_response"), "an acknowledgement is spoken"
    stored = fake.interview_sessions.docs[0]
    assert stored["history"][0]["scores"] is None
    assert stored["history"][0]["intent"] == "answer"
    # 6-turn arc persisted
    assert [q["phase"] for q in stored["questions"]] == [
        "warm_open", "rapport", "technical_core", "technical_core", "behavioral", "candidate_questions",
    ]


def test_candidate_questions_phase_gets_honest_answer_not_a_rubric(fake_env):
    questions = [
        {"id": f"q{i+1}", "turn_index": i + 1, "stage": s, "phase": s,
         "prompt_text": f"Phase {s} prompt text with plenty of words for the arc test", "expected_concepts": []}
        for i, s in enumerate(["warm_open", "rapport", "technical_core", "technical_core", "behavioral", "candidate_questions"])
    ]
    fake = fake_env(_baseline_session(turn_index=6, questions=questions, answered_turns=5))
    app = Flask(__name__)
    with app.test_request_context(
        "/api/interview/sess-it-1/answer",
        method="POST",
        json={"answer": "What is the team size and who would I work with?"},
    ):
        resp = ir.interview_answer_route("sess-it-1")
        if isinstance(resp, tuple):
            resp, status = resp
            assert status == 200, status
        payload = json.loads(resp.get_data(as_text=True))

    line = payload.get("interviewer_response") or ""
    assert payload["scores"] is None, "candidate questions are never scored"
    assert line, "Sarah must answer the candidate's question"
    # Deterministic honest fallback (LLM offline): must not fabricate specifics
    assert "names" in line.lower() or "follow" in line.lower() or "team" in line.lower()
    assert payload.get("finished") is True  # turn 6 was the last


def test_clarification_budget_and_turn_state(fake_env):
    questions = [
        {"id": f"q{i+1}", "turn_index": i + 1, "stage": s, "phase": s,
         "prompt_text": f"Phase {s} prompt text with plenty of words for the arc test", "expected_concepts": ["indexing"]}
        for i, s in enumerate(["warm_open", "rapport", "technical_core", "technical_core", "behavioral", "candidate_questions"])
    ]
    fake = fake_env(_baseline_session(turn_index=3, questions=questions, answered_turns=2))
    app = Flask(__name__)
    with app.test_request_context(
        "/api/interview/sess-it-1/answer",
        method="POST",
        json={"answer": "Sorry, can you repeat the question?"},
    ):
        resp = ir.interview_answer_route("sess-it-1")
        if isinstance(resp, tuple):
            resp, status = resp
            assert status == 200
        payload = json.loads(resp.get_data(as_text=True))
    assert payload.get("clarification") is True
    assert payload["scores"] is None
    stored = fake.interview_sessions.docs[0]
    assert stored["clarification_counts"].get("3") == 1
    assert stored["history"][-1]["is_clarification"] is True
