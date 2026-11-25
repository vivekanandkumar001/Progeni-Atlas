"""
Phase 0 — Baseline & Instrumentation regression tests.

No LLM, no network, no database. Pure-function guards for the
instrumentation surface added in Phase 0:

  * /answer idempotency de-duplication helper (replay must never re-run the LLM)
  * shadow-metering logical-operation ids + attempt sequencing
  * cost_for_llm honesty invariants (never an invented zero)
  * LLM metering context-var round-trip
  * latency percentile helper used by /api/super-admin/cost-overview
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes import interview_routes  # noqa: E402
from routes import super_admin_routes  # noqa: E402
from core import shadow_metering  # noqa: E402
from app.services import llm_service  # noqa: E402


# ---------------------------------------------------------------- /answer replay de-dup

def test_replay_lookup_finds_stored_item_by_key():
    history = [
        {"turn_index": 1, "idempotency_key": "answer:s:turn-1:q-q1", "interviewer_response": "Nice."},
        {"turn_index": 2, "idempotency_key": "answer:s:turn-2:q-q2", "interviewer_response": "Okay."},
    ]
    hit = interview_routes._find_replayed_answer(history, "answer:s:turn-1:q-q1")
    assert hit is not None
    assert hit["turn_index"] == 1
    assert hit["interviewer_response"] == "Nice."


def test_replay_lookup_returns_latest_matching_item():
    history = [
        {"idempotency_key": "k", "turn_index": 1},
        {"idempotency_key": "k", "turn_index": 2},  # duplicate re-push edge
    ]
    assert interview_routes._find_replayed_answer(history, "k")["turn_index"] == 2


def test_replay_lookup_absent_key_and_garbage_items():
    assert interview_routes._find_replayed_answer([], "k") is None
    assert interview_routes._find_replayed_answer(None, "k") is None
    assert interview_routes._find_replayed_answer([{"no_key": 1}], "k") is None
    assert interview_routes._find_replayed_answer(["garbage", 42], "k") is None
    assert interview_routes._find_replayed_answer([{"idempotency_key": "k"}], "") is None
    assert interview_routes._find_replayed_answer([{"idempotency_key": "k"}], "   ") is None


# ---------------------------------------------------------------- metering identity

def test_resolved_logical_id_stable_across_calls():
    ctx = shadow_metering.MeterContext(service_category="llm_chat", operation="test", provider="google", model="gemini-2.0-flash")
    first = ctx.resolved_logical_id()
    assert first == ctx.resolved_logical_id()
    assert first.startswith("lop_")


def test_next_attempt_monotonic_per_logical_id():
    lop = shadow_metering.new_logical_operation_id()
    a, b = shadow_metering.next_attempt(lop), shadow_metering.next_attempt(lop)
    assert b == a + 1


def test_next_attempt_generates_id_when_missing():
    assert isinstance(shadow_metering.next_attempt(None), int)


def test_cost_for_llm_never_invents_zero_when_usage_missing():
    class _Empty:
        input_tokens = None
        output_tokens = None
        cached_tokens = None
        reasoning_tokens = None

    res = shadow_metering.cost_for_llm(provider="google", model="gemini-2.0-flash", usage=_Empty(), usage_measured=False)
    assert res.provider_cost_amount is None
    assert res.provider_cost_inr is None
    assert res.cost_status == shadow_metering.USAGE_UNAVAILABLE


def test_cost_for_llm_prices_tokens_when_known_model(monkeypatch):
    class _Usage:
        input_tokens = 1_000_000
        output_tokens = 500_000
        cached_tokens = 0
        reasoning_tokens = 0

    monkeypatch.setattr(
        shadow_metering,
        "_lookup_pricing",
        lambda call_type, provider, model: ({"input_per_1m_tokens": 0.10, "output_per_1m_tokens": 0.40,
                                              "cached_input_per_1m_tokens": 0.025}, "google-gemini-2.0-flash@1"),
    )
    res = shadow_metering.cost_for_llm(provider="google", model="gemini-2.0-flash", usage=_Usage(), usage_measured=True)
    assert res.provider_cost_amount is not None
    # 1.0M in * $0.10 + 0.5M out * $0.40 = $0.30
    assert abs(res.provider_cost_amount - 0.30) < 1e-9
    # USD_TO_INR is pinned at 83.00 in the module (documented assumption)
    assert abs(res.provider_cost_inr - 0.30 * 83.0) < 1e-6
    # gemini-2.0-flash is not in VERIFIED_PRICING_SOURCES, so the status must be
    # MEASURED_USAGE_RATE_UNVERIFIED — never VERIFIED (honesty guard).
    assert res.cost_status == shadow_metering.MEASURED_USAGE_RATE_UNVERIFIED


# ---------------------------------------------------------------- metering context var round-trip

def test_record_and_consume_usage_roundtrip():
    llm_service._record_usage({"input_tokens": 10, "output_tokens": 5, "total_tokens": 15})
    got = llm_service._consume_usage()
    assert got == {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15}
    assert llm_service._consume_usage() == {}


def test_consume_usage_degrades_safely():
    llm_service._record_usage(None)  # type: ignore[arg-type]
    assert llm_service._consume_usage() == {}


# ---------------------------------------------------------------- latency percentile helper

def test_percentile_linear_interpolation():
    vals = [1.0, 2.0, 3.0, 4.0, 5.0]
    assert super_admin_routes._percentile(vals, 0.50) == 3.0
    p95 = super_admin_routes._percentile(vals, 0.95)
    assert p95 > 4.0 and p95 <= 5.0


def test_percentile_empty_and_singleton():
    assert super_admin_routes._percentile([], 0.95) is None
    assert super_admin_routes._percentile([7.0], 0.50) == 7.0
    assert super_admin_routes._percentile([7.0], 0.95) == 7.0


def test_latency_block_shape():
    block = super_admin_routes._latency_block([
        {"duration_ms": 100}, {"duration_ms": 200}, {"duration_ms": 900}, {"duration_ms": "oops"}, {"duration_ms": None},
    ])
    assert block["samples"] == 3
    assert block["min"] == 100.0
    assert block["max"] == 900.0
    assert block["p50"] == 200.0


def test_latency_block_empty():
    block = super_admin_routes._latency_block([])
    assert block["samples"] == 0
    assert block["p50"] is None and block["p95"] is None
