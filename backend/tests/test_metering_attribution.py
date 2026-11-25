"""
Metering attribution — real LLM events must carry session identity.

Before this fix, real provider calls were metered with no session_id /
correlation_id / organization_id / user_id, so ₹/interview economics and the
calibration export only worked for seeded data. No network: emit is stubbed.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services import llm_service  # noqa: E402


def test_metered_event_carries_session_context(monkeypatch):
    captured = {}

    def fake_emit(ctx, **kwargs):
        captured["ctx"] = ctx
        captured["kwargs"] = kwargs
        return {}

    monkeypatch.setattr("core.shadow_metering.emit", fake_emit)
    llm_service.set_operation("assess_turn")
    llm_service.set_session_context(session_id="sess-xyz", organization_id="org-1", user_id="user-1")
    llm_service._record_attempt(
        provider="google", model="gemini-2.0-flash", duration_ms=123, ok=True,
        usage={"input_tokens": 10, "output_tokens": 5},
    )
    ctx = captured["ctx"]
    assert ctx.session_id == "sess-xyz"
    assert ctx.correlation_id == "sess-xyz"
    assert ctx.organization_id == "org-1"
    assert ctx.user_id == "user-1"
    assert ctx.service_category == "llm_chat"
    assert ctx.operation == "assess_turn"


def test_metered_event_without_context_is_still_honest(monkeypatch):
    captured = {}

    def fake_emit(ctx, **kwargs):
        captured["ctx"] = ctx
        return {}

    monkeypatch.setattr("core.shadow_metering.emit", fake_emit)
    llm_service._session_context.set({})  # simulate request with no session bound
    llm_service._record_attempt(
        provider="google", model="gemini-2.0-flash", duration_ms=100, ok=False,
        usage={}, error_code="RuntimeError",
    )
    ctx = captured["ctx"]
    assert ctx.session_id is None
    assert ctx.correlation_id is None
    assert ctx.organization_id is None
