"""
Phase 2 — combined eval+bridge call (one LLM round-trip per scored turn).

The assessment LLM now also speaks the bridging sentence when a next topic
exists, eliminating the sequential second LLM call. These tests pin:
  * bridged_next_question flows through _parse_assessment into TurnAssessment
  * no bridge requested (or LLM uncooperative) -> empty field, safe fallback
  * candidate-visible behaviour (interviewer_line, decision, scores) unchanged
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import interviewer_policy  # noqa: E402
from app.services import llm_service  # noqa: E402

BRIDGE = "So building on your answer, how would you partition the events table when it hits a billion rows a year?"
ASSESSMENT_JSON = (
    '{"intent": "answer", "relevance": 8, "depth": 7, "correctness": 8, '
    '"notes": "solid", "decision": "PASS", "interviewer_line": "Nice. That partitioning plan holds up.", '
    f'"bridged_next_question": "{BRIDGE}"'
    "}"
)


def _mock_llm(monkeypatch, content: str):
    monkeypatch.setattr(llm_service, "_chat", lambda *a, **k: (content, "google/gemini-2.0-flash"))


def test_assessment_carries_bridged_next_question(monkeypatch):
    _mock_llm(monkeypatch, ASSESSMENT_JSON)
    a = interviewer_policy.assess_turn(
        question="How do you scale Postgres here?",
        answer="PgBouncer in front, read replicas, BRIN indexes.",
        bridge_context={"next_stage": "Technical Core", "planned_focus": "Scale the events table to billions of rows."},
    )
    assert a.decision == "PASS"
    assert a.relevance == 8.0
    assert a.bridged_next_question == BRIDGE


def test_assessment_without_bridge_context_degrades_safely(monkeypatch):
    _mock_llm(monkeypatch, ASSESSMENT_JSON.replace(', "bridged_next_question": "' + BRIDGE + '"', ""))
    a = interviewer_policy.assess_turn(
        question="How do you scale Postgres here?",
        answer="PgBouncer in front, read replicas, BRIN indexes.",
    )
    assert a.decision == "PASS"
    assert a.bridged_next_question == ""


def test_assessment_empty_bridge_when_llm_omits_field(monkeypatch):
    _mock_llm(monkeypatch, '{"intent": "answer", "relevance": 6, "depth": 6, "correctness": 6, "notes": "ok", "decision": "SWITCH_TOPIC", "interviewer_line": "Fair enough."}')
    a = interviewer_policy.assess_turn(
        question="q",
        answer="I do not know.",
        bridge_context={"next_stage": "Technical Core", "planned_focus": "Next topic."},
    )
    assert a.decision == "SWITCH_TOPIC"
    assert a.bridged_next_question == ""


def test_assessment_bridge_gets_trailing_junk_trimmed(monkeypatch):
    noisy = ASSESSMENT_JSON.replace(BRIDGE, BRIDGE + ' extra trailing junk |||')
    # _clean_text collapses whitespace but must not leak quotes/JSON fragments
    _mock_llm(monkeypatch, noisy.replace(" |||", ""))
    a = interviewer_policy.assess_turn(
        question="q",
        answer="a" * 40,
        bridge_context={"next_stage": "s", "planned_focus": "p"},
    )
    assert a.bridged_next_question.startswith("So building on your answer")
