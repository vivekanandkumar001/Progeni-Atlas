"""
Interviewer policy engine tests — deterministic, no LLM, no DB.

These guard the behavioural contract of the AI interviewer: clarifications
are never scored, hints never leak, follow-ups stay anchored to the
candidate's answer, and unscored conversational phases stay unscored.
"""
import sys
import os

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import interviewer_policy  # noqa: E402


# ---------------------------------------------------------------- clarifications
def test_clarification_never_scored_fallback():
    a = interviewer_policy.fallback_assessment(
        question="How would you index a column that is queried heavily?",
        answer="Sorry, what do you mean by that?",
    )
    assert a.intent == "clarification"
    assert a.decision == "CLARIFY"


def test_genuine_clarification_not_penalised_via_is_clarification():
    assert interviewer_policy.is_clarification_request("can you repeat the question?")
    assert interviewer_policy.is_clarification_request("could you rephrase that please")
    assert not interviewer_policy.is_clarification_request(
        "I would use a composite index because the query filters on both columns and orders by created_at"
    )


# ---------------------------------------------------------------- hint leakage
@pytest.mark.parametrize("leak", [
    "You should use a composite index here",
    "The answer is a B-tree",
    "Consider using Redis for that",
    "Have you tried sharding?",
    "What I'm looking for is caching",
])
def test_contains_hint_detects_leaks(leak):
    assert interviewer_policy._contains_hint(leak)


def test_contains_hint_tolerates_honest_speech():
    assert not interviewer_policy._contains_hint("I chose a hash index because lookups are exact")


def test_unanswered_expected_concept_is_rejected():
    # Expected concept 'bloom filter' not supplied by candidate → reject
    assert interviewer_policy._reveals_unanswered_concept(
        "You could use a bloom filter",
        answer="I would shard the database",
        expected_concepts=["bloom filter"],
    )


def test_candidate_mentioned_concept_is_allowed():
    assert not interviewer_policy._reveals_unanswered_concept(
        "Right, the bloom filter helps there",
        answer="I added a bloom filter in front of the KV store",
        expected_concepts=["bloom filter"],
    )


# ---------------------------------------------------------------- interviewer line cleaning
def test_interviewer_line_strips_hint_and_returns_empty():
    assert interviewer_policy._clean_interviewer_line(
        "You should use an LRU cache here",
        question="How would you cache this?",
        recent_lines=[],
        answer="some answer",
        expected_concepts=["LRU cache"],
    ) == ""


def test_interviewer_line_keeps_natural_ack():
    line = interviewer_policy._clean_interviewer_line(
        "Got it — makes sense why you chose a write-through cache there.",
        question="How would you cache this?",
        recent_lines=[],
        answer="I used a write-through cache because reads dominate",
        expected_concepts=["write-through cache"],
    )
    assert line  # non-empty
    assert "?" not in line


# ---------------------------------------------------------------- insufficient / timeout
def test_insufficient_assessment_when_no_answer():
    a = interviewer_policy.insufficient_assessment("No response provided within the allotted question time limit.")
    assert a.intent == "insufficient"
    assert a.decision == "SWITCH_TOPIC"
    assert a.degraded


def test_fallback_scores_never_inflate_past_ceiling():
    a = interviewer_policy.fallback_assessment(
        question="Design a queue",
        answer=" ".join(["word"] * 200),
        expected_concepts=["idempotency", "backpressure"],
    )
    assert a.relevance <= 10.0 and a.depth <= 10.0 and a.correctness <= 10.0
    assert 4.0 <= a.correctness


def test_unscored_flag_defaults_false():
    a = interviewer_policy.TurnAssessment()
    assert a.unscored is False


# ---------------------------------------------------------------- follow-up validation
def test_follow_up_rejected_when_unanchored():
    probe = interviewer_policy._validate_follow_up(
        {"question": "Tell me about your hobbies?", "dimension": "depth",
         "anchored_on": "quantum entanglement distillation"},
        base_question="How do you scale Postgres?",
        asked_questions=[],
        answer="I partition tables by tenant and use BRIN indexes.",
        expected_concepts=["partitioning"],
    )
    assert probe is None


def test_follow_up_accepted_when_anchored():
    probe = interviewer_policy._validate_follow_up(
        {"question": "You mentioned BRIN indexes — what breaks first when the range predicates stop being physical?",
         "dimension": "accuracy",
         "anchored_on": "BRIN indexes",
         "rationale": "checks whether they understand index selectivity"},
        base_question="How do you scale Postgres?",
        asked_questions=["How do you scale Postgres?"],
        answer="I partition tables by tenant and use BRIN indexes for time columns.",
        expected_concepts=["partitioning"],
    )
    assert probe is not None
    assert probe.dimension == "accuracy"
    assert probe.question.endswith("?")


def test_follow_up_revealing_expected_concept_rejected():
    probe = interviewer_policy._validate_follow_up(
        {"question": "Why use a bloom filter before the KV store here?",
         "dimension": "depth",
         "anchored_on": "KV store"},
        base_question="Design the read path",
        asked_questions=[],
        answer="I'd put a read-through cache before the KV store and serve hot keys from memory.",
        expected_concepts=["bloom filter"],
    )
    # 'bloom filter' is an expected concept the candidate never mentioned
    assert probe is None
