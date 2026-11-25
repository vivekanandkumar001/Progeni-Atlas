"""
B7 — LLM provider resilience: circuit breaker + total budget.

No network: provider callables are monkeypatched. The suite proves:
  * a single _chat call never exceeds ~_LLM_TOTAL_BUDGET_SECONDS wall-clock
    when providers are failing/hanging
  * 3 consecutive failures open a provider's circuit (skipped thereafter)
  * a provider that fails twice then succeeds does NOT open the circuit
"""
import os
import sys
import time
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import llm_service  # noqa: E402


def _reset_breaker():
    with llm_service._PROVIDER_STATE_LOCK:
        llm_service._PROVIDER_FAILURES.clear()


def _fake_settings():
    return SimpleNamespace(
        effective_gemini_key="dummy-key",
        LLM_PROVIDER="gemini",
        GEMINI_MODEL="gemini-2.0-flash",
        LLM_MODEL="gpt-4o-mini",
        OPENROUTER_MODEL="openai/gpt-4o-mini",
        OLLAMA_MODEL="llama3.2:1b",
    )


def test_budget_caps_total_wall_clock_with_failing_providers(monkeypatch):
    _reset_breaker()
    calls = {"n": 0}

    def _fail(*a, **k):
        calls["n"] += 1
        raise llm_service._LLMFallbackTrigger("simulated outage")

    monkeypatch.setattr(llm_service, "_call_gemini", _fail)
    monkeypatch.setattr(llm_service, "_call_openai", _fail)
    monkeypatch.setattr(llm_service, "_call_openrouter", _fail)
    monkeypatch.setattr(llm_service, "_call_ollama", _fail)
    monkeypatch.setattr(llm_service, "settings", _fake_settings())

    started = time.monotonic()
    try:
        llm_service._chat("sys", "usr")
        assert False, "expected LLMError when every provider is down"
    except llm_service.LLMError:
        elapsed = time.monotonic() - started
        # Headroom: budget (20s) + slack for the raise/return overhead
        assert elapsed < llm_service._LLM_TOTAL_BUDGET_SECONDS + 2.0, f"budget violated: {elapsed:.2f}s"


def test_circuit_opens_after_three_failures_and_skips_provider(monkeypatch):
    _reset_breaker()

    def _fail_gemini(*a, **k):
        raise llm_service._LLMFallbackTrigger("sim")

    def _fail_others(*a, **k):
        raise llm_service._LLMFallbackTrigger("sim")

    monkeypatch.setattr(llm_service, "_call_gemini", _fail_gemini)
    monkeypatch.setattr(llm_service, "_call_openai", _fail_others)
    monkeypatch.setattr(llm_service, "_call_openrouter", _fail_others)
    monkeypatch.setattr(llm_service, "_call_ollama", _fail_others)
    monkeypatch.setattr(llm_service, "settings", _fake_settings())

    for _ in range(3):
        try:
            llm_service._chat("sys", "usr")
        except llm_service.LLMError:
            pass

    assert llm_service._provider_in_cooldown("google") is True

    # google must be skipped on the 4th call — track by counting google invocations
    calls = {"n": 0}

    def _count_google(*a, **k):
        calls["n"] += 1
        raise llm_service._LLMFallbackTrigger("sim")

    monkeypatch.setattr(llm_service, "_call_gemini", _count_google)
    try:
        llm_service._chat("sys", "usr")
    except llm_service.LLMError:
        pass
    assert calls["n"] == 0, "cool-downed provider must be skipped, not retried"


def test_failure_then_success_does_not_open_circuit(monkeypatch):
    _reset_breaker()

    state = {"n": 0}

    def _flaky_gemini(*a, **k):
        state["n"] += 1
        if state["n"] <= 2:
            raise llm_service._LLMFallbackTrigger("transient")
        return ("ok-response", "google/gemini-2.0-flash")

    def _fast_fail(*a, **k):
        raise llm_service._LLMFallbackTrigger("offline-fast-fail")

    monkeypatch.setattr(llm_service, "_call_gemini", _flaky_gemini)
    monkeypatch.setattr(llm_service, "_call_openai", _fast_fail)
    monkeypatch.setattr(llm_service, "_call_openrouter", _fast_fail)
    monkeypatch.setattr(llm_service, "_call_ollama", _fast_fail)
    monkeypatch.setattr(llm_service, "settings", _fake_settings())

    try:
        llm_service._chat("sys", "usr")
    except llm_service.LLMError:
        pass
    try:
        llm_service._chat("sys", "usr")
    except llm_service.LLMError:
        pass
    result = llm_service._chat("sys", "usr")
    assert result[0] == "ok-response"
    assert llm_service._provider_in_cooldown("google") is False


def test_provider_open_reports_budget_exhaustion(monkeypatch):
    _reset_breaker()
    past = time.time() - 10_000
    ok, reason = llm_service._provider_open("x", past)
    assert ok is False
    assert "budget" in (reason or "")


def test_usage_roundtrip_for_gemini_style_payload():
    llm_service._record_usage({
        "input_tokens": 123, "output_tokens": 45,
        "total_tokens": 168, "cached_tokens": 12, "reasoning_tokens": 3,
    })
    got = llm_service._consume_usage()
    assert got["input_tokens"] == 123
    assert got["output_tokens"] == 45
    assert got["total_tokens"] == 168
