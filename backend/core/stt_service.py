"""
STT (speech-to-text) abstraction — cheapest enterprise-grade provider first.

Provider order (configurable via STT_PROVIDER: auto|groq|openai):
  1. Groq — Whisper Large V3 Turbo ($0.04 / hour = ₹0.055/min at ₹83/$).
     Same open-source Whisper model, SOC 2 Type II, ~216x real-time.
     Free tier: 28,800 audio-seconds/day; paid tier uncapped at 400 RPM.
  2. OpenAI — whisper-1 (~₹0.5/min). Final-choice fallback so existing
     deployments keep working when Groq is not configured.

A single call returns (transcript, provider). Empty transcript + provider=''
is the "nothing recognizable" signal the caller maps to the user-facing
"no clear speech" message, identical to the previous behaviour.
"""

from __future__ import annotations

import os

import httpx

_GROQ_URL = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
_GROQ_MODEL = os.environ.get("GROQ_STT_MODEL", "whisper-large-v3-turbo").strip()
_FALLBACK_MODEL = os.environ.get("STT_MODEL", "whisper-1").strip() or "whisper-1"


def transcribe_file(audio_path: str, language: str = "en") -> tuple[str, str]:
    provider = (os.environ.get("STT_PROVIDER") or "auto").strip().lower()

    if provider in ("auto", "groq"):
        groq_key = (os.environ.get("GROQ_API_KEY") or "").strip()
        if groq_key:
            text = _transcribe_groq(audio_path, groq_key, language)
            if text is not None:
                return (text, "groq")

    if provider in ("auto", "openai"):
        openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
        if openai_key and not openai_key.startswith("sk-proj-your-openai"):
            text = _transcribe_openai(audio_path, openai_key, language)
            if text is not None:
                return (text, "openai")

    return ("", "")


def _transcribe_groq(audio_path: str, api_key: str, language: str) -> str | None:
    try:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        files = {
            "file": (os.path.basename(audio_path), audio_bytes, "audio/webm"),
        }
        data = {
            "model": _GROQ_MODEL,
            "language": language,
            "response_format": "text",
        }
        resp = httpx.post(
            f"{_GROQ_URL}/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files=files,
            data=data,
            timeout=60.0,
        )
        if resp.status_code == 200:
            return (resp.text or "").strip()
        print(f"[Groq STT] HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as w_err:
        print(f"[Groq STT Error] {w_err}")
    return None


def _transcribe_openai(audio_path: str, api_key: str, language: str) -> str | None:
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        with open(audio_path, "rb") as af:
            transcription = client.audio.transcriptions.create(
                model=_FALLBACK_MODEL,
                file=af,
                language=language,
            )
        return (transcription.text or "").strip()
    except Exception as w_err:
        print(f"[OpenAI Whisper Error] {w_err}")
    return None
