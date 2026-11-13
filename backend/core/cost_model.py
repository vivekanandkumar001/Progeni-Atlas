"""
Progeni Atlas — Cost Model (Provider Spend & Unit Economics)
==========================================================
Single source of truth for:
  * Infra inventory & monthly TCO (unit costs are admin-editable estimates)
  * Per-call cost computation for every model in the rate card
  * Per-interview cost model (10-minute default, configurable)
  * LLM evaluation battery (admin-triggered, real API calls, gated by UI)

All prices are SEEDS from public pricing pages — clearly labeled as
ESTIMATED. Admins edit unit costs / quantities in the console; the model
recomputes on every read. Nothing here fabricates numbers: missing/unknown
prices are reported as such, never zero-filled silently.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

logger = logging.getLogger("progeni_atlas.cost_model")

USD_TO_INR = 83.0

# --------------------------------------------------------------------------- infra seed

INFRA_SEEDS: list[dict[str, Any]] = [
    # ---- LLM & AI ----
    {"id": "llm-gemini", "label": "Google Gemini (primary LLM)", "provider": "google", "category": "llm",
     "unit": "per 1M tokens", "unit_cost_usd": 0.075, "monthly_qty": 0.0,
     "note": "Flash-tier list price. Pro-tier priced separately in rate card.", "config": True},
    {"id": "llm-openai", "label": "OpenAI GPT-4o family", "provider": "openai", "category": "llm",
     "unit": "per 1M tokens", "unit_cost_usd": 0.15, "monthly_qty": 0.0,
     "note": "gpt-4o-mini. See rate card for per-model prices.", "config": True},
    {"id": "llm-openrouter", "label": "OpenRouter (fallback LLM)", "provider": "openrouter", "category": "llm",
     "unit": "per 1M tokens", "unit_cost_usd": 0.15, "monthly_qty": 0.0,
     "note": "Pay-per-token via OpenRouter routing.", "config": True},
    {"id": "llm-ollama", "label": "Ollama / local LLM", "provider": "ollama", "category": "llm",
     "unit": "per 1M tokens", "unit_cost_usd": 0.0, "monthly_qty": 0.0,
     "note": "Self-hosted; infra cost counted below (CPU/GPU).", "config": False},

    # ---- Voice (STT / TTS) ----
    {"id": "voice-stt-whisper", "label": "Speech-to-Text (Whisper-compatible)", "provider": "openai", "category": "voice",
     "unit": "per minute audio", "unit_cost_usd": 0.006, "monthly_qty": 0.0,
     "note": "whisper-1 list price.", "config": True},
    {"id": "voice-tts-openai", "label": "Text-to-Speech (OpenAI tts-1)", "provider": "openai", "category": "voice",
     "unit": "per 1K characters", "unit_cost_usd": 0.015, "monthly_qty": 0.0,
     "note": "tts-1 standard quality.", "config": True},
    {"id": "voice-tts-edge", "label": "Text-to-Speech (Edge-TTS, free)", "provider": "microsoft", "category": "voice",
     "unit": "per 1K characters", "unit_cost_usd": 0.0, "monthly_qty": 0.0,
     "note": "Free tier — used as primary TTS. Paid swap possible via config.", "config": False},

    # ---- WebRTC / media ----
    {"id": "livekit-cloud", "label": "LiveKit Cloud (agent + SFU minutes)", "provider": "livekit", "category": "media",
     "unit": "per agent-minute", "unit_cost_usd": 0.008, "monthly_qty": 0.0,
     "note": "Approx. agent + relay minutes. Verify against LiveKit invoice.", "config": True},

    # ---- Data & infra ----
    {"id": "mongo-atlas", "label": "MongoDB Atlas (cluster)", "provider": "mongodb", "category": "data",
     "unit": "per month", "unit_cost_usd": 57.0, "monthly_qty": 1.0,
     "note": "M10 dedicated. M0 free tier = ₹0. Pick tier in Atlas console.", "config": True},
    {"id": "qdrant-cloud", "label": "Qdrant Cloud (vector DB)", "provider": "qdrant", "category": "data",
     "unit": "per month", "unit_cost_usd": 25.0, "monthly_qty": 1.0,
     "note": "Standard 8GB cluster. 1GB free tier possible.", "config": True},
    {"id": "upstash-redis", "label": "Upstash Redis (rate-limit / cache store)", "provider": "upstash", "category": "data",
     "unit": "per month", "unit_cost_usd": 10.0, "monthly_qty": 1.0,
     "note": "Per-request or fixed pricing. Free 256MB tier available.", "config": True},
    {"id": "vercel-pro", "label": "Vercel (hosting + Pro seat)", "provider": "vercel", "category": "hosting",
     "unit": "per seat per month", "unit_cost_usd": 20.0, "monthly_qty": 1.0,
     "note": "Pro team plan. Hobby = ₹0 but non-commercial.", "config": True},
    {"id": "cloudinary", "label": "Cloudinary (recordings & media)", "provider": "cloudinary", "category": "media",
     "unit": "per month", "unit_cost_usd": 0.0, "monthly_qty": 1.0,
     "note": "Free 25GB-bandwidth tier. Paid ≈ $89/mo — set per usage.", "config": True},
    {"id": "aws-ses", "label": "Email delivery (AWS SES-class)", "provider": "amazon", "category": "email",
     "unit": "per 1,000 emails", "unit_cost_usd": 0.10, "monthly_qty": 0.0,
     "note": "Gmail SMTP = ₹0 today (local/dev). SES for prod scale.", "config": True},

    # ---- Edge & misc ----
    {"id": "domain-dns", "label": "Domain + DNS (progeni.live)", "provider": "registrar", "category": "misc",
     "unit": "per year", "unit_cost_usd": 12.0, "monthly_qty": 1.0 / 12.0,
     "note": "Domain renewal amortized monthly.", "config": True},
    {"id": "upi-gateway", "label": "UPI payment gateway (Mayank Multi-Merchant)", "provider": "upi", "category": "payments",
     "unit": "per transaction", "unit_cost_usd": 0.0, "monthly_qty": 0.0,
     "note": "Self-hosted gateway; fee structure unknown — set when invoiced.", "config": True},
]


def ensure_infra_seeded(db) -> None:
    """Insert-if-absent infra inventory (never overwrites admin edits)."""
    try:
        coll = db["platform_infra_costs"]
        now = datetime.now(timezone.utc).isoformat()
        for seed in INFRA_SEEDS:
            doc = {
                **seed,
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
            coll.update_one({"id": seed["id"]}, {"$setOnInsert": doc}, upsert=True)
    except Exception as exc:
        logger.warning("[CostModel] Infra seed note: %s", exc)


# --------------------------------------------------------------------------- assumptions

DEFAULT_ASSUMPTIONS = {
    "questions_per_interview": 10,
    "llm_calls_per_question": 2,      # generation + evaluation
    "extra_llm_calls": 2,             # dynamic params + scorecard
    "avg_input_tokens": 800,
    "avg_output_tokens": 400,
    "avg_cached_tokens": 100,
    "stt_minutes_per_interview": 10,
    "tts_chars_per_minute": 9000,
    "livekit_agent_minutes": 10,
    "embeddings_per_interview": 1,
    "embedding_input_tokens": 1500,
    "use_openai_tts": False,
}


def get_cost_assumptions(db) -> dict[str, Any]:
    """Merge platform_settings.cost_model over code defaults."""
    cfg = dict(DEFAULT_ASSUMPTIONS)
    if db is not None:
        try:
            doc = db.platform_settings.find_one({"key": "cost_model"})
            if doc and isinstance(doc.get("config"), dict):
                stored = doc["config"]
                for k, v in stored.items():
                    if k not in DEFAULT_ASSUMPTIONS:
                        continue
                    if isinstance(DEFAULT_ASSUMPTIONS[k], bool):
                        cfg[k] = bool(v)
                    elif isinstance(v, (int, float)):
                        cfg[k] = v
        except Exception:
            pass
    return cfg


def save_cost_assumptions(db, data: dict[str, Any]) -> dict[str, Any]:
    cfg = get_cost_assumptions(db)
    for k, v in (data or {}).items():
        if k not in DEFAULT_ASSUMPTIONS:
            continue
        default_v = DEFAULT_ASSUMPTIONS[k]
        if isinstance(default_v, bool):
            cfg[k] = bool(v)
        elif isinstance(v, (int, float)) and v >= 0:
            cfg[k] = v
    if db is not None:
        db.platform_settings.update_one(
            {"key": "cost_model"},
            {"$set": {"key": "cost_model", "config": cfg, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    return cfg


# --------------------------------------------------------------------------- LLM eval battery

# Compact battery: exercises the same failure modes the product actually sees.
EVAL_PROMPTS = [
    {"id": "dsa_easy", "prompt": "In one sentence, what is a hash map and when is it better than a sorted array?", "max_tokens": 60},
    {"id": "dsa_tradeoff", "prompt": "Candidate says: 'We should use a distributed lock for every database write.' Give the single strongest counter-argument.", "max_tokens": 120},
    {"id": "system_design", "prompt": "Design a URL shortener in 2 sentences covering storage and the redirect path.", "max_tokens": 120},
    {"id": "hr_behavioral", "prompt": "Candidate says: 'I never make mistakes because I test carefully.' How do you probe this claim?", "max_tokens": 100},
    {"id": "json_out", "prompt": "Return ONLY JSON: {\"recommendation\": \"HIRE|NO_HIRE\", \"reason\": \"<10 words>\"} for: The candidate explained CAP theorem correctly.", "max_tokens": 60},
    {"id": "coding_edge", "prompt": "What edge case will this miss: `return sorted(s) == s` for checking sortedness?", "max_tokens": 80},
]


def judge_score(text: str, prompt_id: str) -> int | None:
    """Cheap heuristic rubric 0-100 (non-LLM): reward structure, signal words. Judge with
    an LLM call only in multi-judge mode — keeps eval cost ₹0.04."""
    t = (text or "").strip().lower()
    if not t:
        return 0
    score = 40
    if len(t) >= 60:
        score += 10
    if len(t) >= 160:
        score += 10
    for marker in ("hash", "index", "lock", "contention", "redirect", "collision", "cap", "sort", "complexity", "tradeoff", "bottleneck", "probe", "follow-up"):
        if marker in t:
            score += 5
    if prompt_id == "json_out":
        try:
            obj = json.loads(t)
            score += 25 if isinstance(obj, dict) and "recommendation" in obj else -10
        except Exception:
            score -= 20
    return max(0, min(100, score))
