"""Voice (STT/TTS) shadow-metering emitters.

Voice providers are billed per minute (STT) and per character (TTS), not per
token, so they never appear in the LLM rate card. Events land in the same
``platform_shadow_usage_events`` collection with their own service categories
so the admin console can account for every provider rupee — including the
zero-cached voice tier.

Every function is best-effort: a metering failure must never break a
transcription or a voice synthesis call.
"""

from __future__ import annotations


def emit_voice_event(
    *,
    service_category: str,
    provider: str,
    model: str,
    status: str,
    duration_ms: int | None,
    measured_usage: dict,
    usage_unit: str,
    session_id: str | None,
    organization_id: str | None = None,
    user_id: str | None = None,
    error_code: str | None = None,
) -> None:
    try:
        from core.shadow_metering import MeterContext, emit

        ctx = MeterContext(
            service_category=service_category,
            operation="voice",
            provider=provider or "unknown",
            model=model or "",
            correlation_id=session_id,
            session_id=session_id,
            organization_id=organization_id,
            user_id=user_id,
        )
        emit(
            ctx,
            measured_usage=measured_usage,
            usage_unit=usage_unit,
            status=status,
            duration_ms=duration_ms,
            error_code=error_code,
        )
    except Exception:
        pass


def emit_stt_event(
    *,
    provider: str,
    status: str,
    duration_ms: int | None,
    audio_bytes: int | None,
    session_id: str | None = None,
    organization_id: str | None = None,
    user_id: str | None = None,
    error_code: str | None = None,
) -> None:
    usage = (
        {"audio_bytes": audio_bytes, "seconds": None}
        if audio_bytes is not None
        else {"provenance": "unavailable", "reason": "audio file unreadable"}
    )
    emit_voice_event(
        service_category="voice_stt",
        provider=provider,
        model=provider,
        status=status,
        duration_ms=duration_ms,
        measured_usage=usage,
        usage_unit="audio_bytes",
        session_id=session_id,
        organization_id=organization_id,
        user_id=user_id,
        error_code=error_code,
    )


def emit_tts_event(
    *,
    provider: str,
    model: str,
    status: str,
    duration_ms: int | None,
    characters: int | None,
    session_id: str | None = None,
    organization_id: str | None = None,
    user_id: str | None = None,
    error_code: str | None = None,
) -> None:
    usage = (
        {"characters": characters}
        if characters is not None
        else {"provenance": "unavailable", "reason": "character count unavailable"}
    )
    emit_voice_event(
        service_category="voice_tts",
        provider=provider,
        model=model,
        status=status,
        duration_ms=duration_ms,
        measured_usage=usage,
        usage_unit="characters",
        session_id=session_id,
        organization_id=organization_id,
        user_id=user_id,
        error_code=error_code,
    )
