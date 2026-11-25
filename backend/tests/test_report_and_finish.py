"""
Report contract & finish-gate tests — no LLM, no DB.

Regression guards for the two bugs that silently broke the product:
  B1: finish route voided every manually-finished interview (zero_turns bug)
  B2: report endpoint never read the evidence the LLM produced
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes import interview_routes  # noqa: E402


# ---------------------------------------------------------------- zero-turns gate
def test_zero_turns_when_session_missing():
    assert interview_routes._compute_zero_turns(None) is True


def test_zero_turns_when_answered_zero():
    assert interview_routes._compute_zero_turns({"answered_turns": 0}) is True


def test_answered_turns_from_int_field():
    assert interview_routes._compute_zero_turns({"answered_turns": 3}) is False


def test_answered_turns_falls_back_to_history_excluding_clarifications():
    history = [
        {"turn_index": 1, "is_clarification": True, "answer": "can you repeat?"},
        {"turn_index": 2, "is_clarification": True, "answer": "sorry what?"},
    ]
    assert interview_routes._compute_zero_turns({"history": history}) is True

    history.append({"turn_index": 3, "answer": "I would partition by tenant and use BRIN indexes."})
    assert interview_routes._compute_zero_turns({"history": history}) is False


# ---------------------------------------------------------------- report turn mapping
SAMPLE_HISTORY = [
    {
        "turn_index": 1,
        "stage": "warm_open",
        "question": "Tell me about yourself",
        "answer": "I build distributed systems.",
        "scores": None,  # warm open is unscored
        "evaluator_feedback": "Conversation opener.",
        "timestamp": "2026-11-18T10:00:00+00:00",
    },
    {
        "turn_index": 3,
        "stage": "technical_core",
        "question": "How do you scale Postgres?",
        "answer": "Partition by tenant and use BRIN indexes.",
        "scores": {"relevance": 8.5, "depth": 9.0, "correctness": 9.5},
        "evaluator_feedback": "Strong, specific, correct.",
        "missing_concepts": ["partition pruning"],
        "red_flags": [],
        "action_decision": "PASS",
        "timestamp": "2026-11-18T10:05:00+00:00",
    },
    {
        "turn_index": 5,
        "stage": "behavioral",
        "question": "Tell me about a conflict",
        "answer": "Hmm...",
        "scores": {"relevance": 3.0, "depth": 2.0, "correctness": 4.0},
        "action_decision": "SWITCH_TOPIC",
        "timestamp": "2026-11-18T10:12:00+00:00",
    },
]


def test_report_turn_reviews_reads_nested_scores():
    turns = interview_routes._map_history_turn_reviews(SAMPLE_HISTORY)
    assert len(turns) == 3

    tech = next(t for t in turns if t["turnIndex"] == 3)
    assert tech["scores"]["relevance"] == 8.5
    assert tech["scores"]["depth"] == 9.0
    assert tech["scores"]["correctness"] == 9.5
    assert tech["candidateAnswerSummary"].startswith("Partition")
    assert tech["evaluatorFeedback"].startswith("Strong")
    assert tech["isWeakAnswer"] is False
    assert tech["missingConcepts"] == ["partition pruning"]

    warm = next(t for t in turns if t["turnIndex"] == 1)
    assert warm["scores"]["relevance"] is None
    assert warm["isClarification"] is False

    behavioral = next(t for t in turns if t["turnIndex"] == 5)
    assert behavioral["isWeakAnswer"] is True
    assert behavioral["scores"]["relevance"] == 3.0


def test_report_turn_reviews_empty_history():
    assert interview_routes._map_history_turn_reviews([]) == []


def test_report_turn_reviews_tolerates_garbage_scores():
    history = [{"turn_index": 1, "question": "q", "answer": "a",
                "scores": {"relevance": "not-a-number", "depth": None}}]
    turns = interview_routes._map_history_turn_reviews(history)
    assert turns[0]["scores"]["relevance"] is None
    assert turns[0]["scores"]["depth"] is None


# ---------------------------------------------------------------- arc module
def test_arc_starting_levels():
    import core.interview_arc as arc
    assert arc.starting_level("Senior Staff Engineer") == 5
    assert arc.starting_level("SDE-2 (Senior)") == 4
    assert arc.starting_level("Campus Graduate") == 1
    assert arc.starting_level("mid") == 2


def test_arc_difficulty_adapts():
    import core.interview_arc as arc
    assert arc.adjust_difficulty(2, {"relevance": 9, "depth": 9, "correctness": 9}) == 3
    assert arc.adjust_difficulty(2, {"relevance": 2, "depth": 2, "correctness": 2}) == 1
    assert arc.adjust_difficulty(2, {"relevance": 6, "depth": 6, "correctness": 6}) == 2
    assert arc.adjust_difficulty(5, {"relevance": 9, "depth": 9, "correctness": 9}) == 5
    assert arc.adjust_difficulty(1, {"relevance": 1, "depth": 1, "correctness": 1}) == 1


def test_arc_unscored_phases():
    import core.interview_arc as arc
    assert arc.phase_is_scored(arc.TECHNICAL_CORE) is True
    assert arc.phase_is_scored(arc.BEHAVIORAL) is True
    assert arc.phase_is_scored(arc.WARM_OPEN) is False
    assert arc.phase_is_scored(arc.CANDIDATE_QUESTIONS) is False
