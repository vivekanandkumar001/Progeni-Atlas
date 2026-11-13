"""
Progeni Atlas — Cost Model & LLM Evaluation Routes
==================================================
Super-admin only. Provider spend, infra TCO, unit economics and an on-demand
LLM evaluation battery for model selection.

All prices are ESTIMATES from public rate cards unless an admin edits them —
nothing is fabricated. The eval battery makes REAL paid API calls and is only
triggered by an explicit admin click (`confirm_spend: true` required).
"""

from __future__ import annotations

import json
import time
import traceback
import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, g

from core.db import get_mongo_db
from core.security import require_super_admin
from core.cost_model import (
    DEFAULT_ASSUMPTIONS,
    EVAL_PROMPTS,
    judge_score,
    ensure_infra_seeded,
    get_cost_assumptions,
    save_cost_assumptions,
)
from core.shadow_metering import cost_for_llm

cost_bp = Blueprint("cost_bp", __name__)

USD_TO_INR = 83.0


# --------------------------------------------------------------------------- pricing (rate card)

@cost_bp.route("/api/super-admin/pricing", methods=["POST"])
@require_super_admin
def pricing_create():
    """Register a new rate-card entry (used by the admin when adding a model)."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"success": False, "error": "Database unavailable"}), 503
        user = getattr(g, "user", None) or {}
        actor_email = str(user.get("email") or "").strip().lower() or "super_admin"

        data = request.get_json(silent=True) or {}
        provider_kind = str(data.get("provider_kind") or "").strip().lower()
        model_pattern = str(data.get("model_pattern") or "").strip().lower()
        match_type = str(data.get("match_type") or "exact").strip().lower()
        if provider_kind not in ("google", "openai", "openrouter", "ollama", "*"):
            return jsonify({"success": False, "error": "provider_kind must be one of: google, openai, openrouter, ollama, *"}), 400
        if not model_pattern or len(model_pattern) > 120:
            return jsonify({"success": False, "error": "model_pattern is required (max 120 chars)"}), 400
        if match_type not in ("exact", "prefix"):
            return jsonify({"success": False, "error": "match_type must be 'exact' or 'prefix'"}), 400

        rates = {}
        for key in ("input_per_1m_tokens", "output_per_1m_tokens", "cached_input_per_1m_tokens"):
            try:
                rates[key] = max(0.0, float(data.get(key, 0) or 0))
            except (TypeError, ValueError):
                return jsonify({"success": False, "error": f"{key} must be a number"}), 400

        pricing_id = str(data.get("id") or f"{provider_kind}-{model_pattern}".replace("/", "-").replace(" ", "-"))[:80]
        existing = db.platform_llm_pricing.find_one({"id": pricing_id})
        if existing:
            pricing_id = f"{pricing_id}-{uuid.uuid4().hex[:6]}"

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "id": pricing_id,
            "call_type": "chat",
            "provider_kind": provider_kind,
            "match_type": match_type,
            "model_pattern": model_pattern,
            "rates": rates,
            "seed_source": "admin-created via Cost & Spend console",
            "active": True,
            "version": 1,
            "created_at": now,
            "created_by": actor_email,
            "updated_at": now,
        }
        db.platform_llm_pricing.insert_one(doc)
        try:
            db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "actor_id": str(user.get("id") or user.get("_id") or actor_email),
                "actor_email": actor_email,
                "actor_name": str(user.get("full_name") or "Super Administrator"),
                "action": f"pricing.create.{pricing_id}",
                "entity_type": "llm_pricing",
                "entity_id": pricing_id,
                "detail": {"provider_kind": provider_kind, "model_pattern": model_pattern, "match_type": match_type, "rates": rates},
                "created_at": now,
            })
        except Exception:
            pass
        return jsonify({"success": True, "id": pricing_id, "item": {k: v for k, v in doc.items() if k != "_id"}}), 201
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


# --------------------------------------------------------------------------- infra inventory

def _infra_row(doc: dict) -> dict:
    unit_usd = float(doc.get("unit_cost_usd") or 0.0)
    qty = float(doc.get("monthly_qty") or 0.0)
    per_month_usd = unit_usd * qty if doc.get("unit", "per month") == "per month" else unit_usd * qty
    per_month_inr = per_month_usd * USD_TO_INR
    # per-month rows with unit != per month (e.g. domain/year) still amortize correctly via qty
    return {
        "id": doc.get("id"),
        "label": doc.get("label"),
        "provider": doc.get("provider"),
        "category": doc.get("category"),
        "unit": doc.get("unit"),
        "unit_cost_usd": unit_usd,
        "unit_cost_inr": round(unit_usd * USD_TO_INR, 4),
        "monthly_qty": qty,
        "monthly_cost_usd": round(per_month_usd, 4),
        "monthly_cost_inr": round(per_month_inr, 4),
        "note": doc.get("note", ""),
        "config": bool(doc.get("config", True)),
        "active": bool(doc.get("active", True)),
    }


@cost_bp.route("/api/super-admin/infra-costs", methods=["GET"])
@require_super_admin
def infra_costs_list():
    """Infra inventory with computed monthly TCO. Admin-editable."""
    try:
        db = get_mongo_db()
        if db is not None:
            ensure_infra_seeded(db)
        docs = list(db.platform_infra_costs.find({"active": True}, {"_id": 0}).sort("category", 1)) if db is not None else []
        rows = [_infra_row(d) for d in docs]
        total_month_usd = sum(r["monthly_cost_usd"] for r in rows)
        total_month_inr = sum(r["monthly_cost_inr"] for r in rows)
        by_category: dict[str, float] = {}
        for r in rows:
            by_category[r["category"]] = by_category.get(r["category"], 0.0) + r["monthly_cost_inr"]
        return jsonify({
            "success": True,
            "currency": "INR",
            "fx_rate_usd_to_inr": USD_TO_INR,
            "items": rows,
            "total_month_usd": round(total_month_usd, 4),
            "total_month_inr": round(total_month_inr, 2),
            "total_month_inr_lakhs": round(total_month_inr / 100000.0, 4),
            "by_category_inr": {k: round(v, 2) for k, v in by_category.items()},
        }), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


@cost_bp.route("/api/super-admin/infra-costs/<infra_id>", methods=["PATCH", "PUT"])
@require_super_admin
def infra_costs_update(infra_id):
    """Edit an infra line item (unit cost / monthly qty / note / active)."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"success": False, "error": "Database unavailable"}), 503
        doc = db.platform_infra_costs.find_one({"id": infra_id})
        if not doc:
            return jsonify({"success": False, "error": "Infra entry not found."}), 404

        user = getattr(g, "user", None) or {}
        actor_email = str(user.get("email") or "").strip().lower() or "super_admin"
        data = request.get_json(silent=True) or {}
        updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": actor_email}

        if "unit_cost_usd" in data:
            try:
                v = float(data["unit_cost_usd"])
                if v < 0:
                    return jsonify({"success": False, "error": "unit_cost_usd cannot be negative"}), 400
                updates["unit_cost_usd"] = v
            except (TypeError, ValueError):
                return jsonify({"success": False, "error": "unit_cost_usd must be a number"}), 400
        if "monthly_qty" in data:
            try:
                v = float(data["monthly_qty"])
                if v < 0:
                    return jsonify({"success": False, "error": "monthly_qty cannot be negative"}), 400
                updates["monthly_qty"] = v
            except (TypeError, ValueError):
                return jsonify({"success": False, "error": "monthly_qty must be a number"}), 400
        if "note" in data:
            updates["note"] = str(data["note"])[:500]
        if "active" in data:
            updates["active"] = bool(data["active"])

        if len(updates) == 2:  # only timestamps
            return jsonify({"success": False, "error": "No editable fields supplied."}), 400

        db.platform_infra_costs.update_one({"id": infra_id}, {"$set": updates})
        try:
            db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "actor_id": str(user.get("id") or user.get("_id") or actor_email),
                "actor_email": actor_email,
                "actor_name": str(user.get("full_name") or "Super Administrator"),
                "action": f"infra_cost.update.{infra_id}",
                "entity_type": "infra_cost",
                "entity_id": infra_id,
                "detail": updates,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass
        updated = db.platform_infra_costs.find_one({"id": infra_id}, {"_id": 0})
        return jsonify({"success": True, "item": _infra_row(updated)}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


# --------------------------------------------------------------------------- assumptions

@cost_bp.route("/api/super-admin/cost-assumptions", methods=["GET", "PATCH", "PUT"])
@require_super_admin
def cost_assumptions():
    """GET current per-interview cost model assumptions; PATCH to update them."""
    try:
        db = get_mongo_db()
        if request.method == "GET":
            cfg = get_cost_assumptions(db)
            return jsonify({"success": True, "assumptions": cfg, "defaults": DEFAULT_ASSUMPTIONS}), 200

        data = request.get_json(silent=True) or {}
        cfg = save_cost_assumptions(db, data)
        user = getattr(g, "user", None) or {}
        try:
            db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "actor_email": str(user.get("email") or "").strip().lower() or "super_admin",
                "actor_name": str(user.get("full_name") or "Super Administrator"),
                "action": "cost_assumptions.update",
                "entity_type": "cost_model",
                "entity_id": "cost_model",
                "detail": data,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass
        return jsonify({"success": True, "assumptions": cfg}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


# --------------------------------------------------------------------------- per-call & per-interview economics

def _rates_for_provider_model(db, provider: str, model: str) -> dict | None:
    """Look up the active chat rate for a provider/model (prefix or exact match)."""
    if db is None:
        return None
    now = datetime.now(timezone.utc).isoformat()
    cands = list(db.platform_llm_pricing.find({"active": True, "call_type": "chat"}))
    best = None
    for doc in cands:
        pk = str(doc.get("provider_kind", "*")).lower()
        if pk not in (provider.lower(), "*"):
            continue
        pattern = str(doc.get("model_pattern") or "").lower()
        mt = str(doc.get("match_type") or "exact").lower()
        m = model.lower()
        ok = (mt == "exact" and pattern == m) or (mt == "prefix" and m.startswith(pattern))
        if not ok:
            continue
        eff_from = str(doc.get("effective_from") or "")
        eff_to = doc.get("effective_to")
        if eff_from and now < eff_from:
            continue
        if eff_to and now >= str(eff_to):
            continue
        if best is None or int(doc.get("version") or 1) > int(best.get("version") or 1):
            best = doc
    return best


def _model_cost_breakdown(db, provider: str, model: str, cfg: dict) -> dict:
    """Compute ₹ cost for one call and for a full 10-min interview profile."""
    rate_doc = _rates_for_provider_model(db, provider, model)
    rates = (rate_doc or {}).get("rates") or {}
    in_rate = float(rates.get("input_per_1m_tokens") or 0)
    out_rate = float(rates.get("output_per_1m_tokens") or 0)
    cached_rate = float(rates.get("cached_input_per_1m_tokens") or 0)

    in_tok = cfg["avg_input_tokens"]
    out_tok = cfg["avg_output_tokens"]
    cached_tok = cfg["avg_cached_tokens"]

    # Per single call
    in_cost = ((max(0, in_tok - cached_tok) / 1_000_000) * in_rate +
               (cached_tok / 1_000_000) * cached_rate +
               (out_tok / 1_000_000) * out_rate) * USD_TO_INR

    # Full interview profile
    llm_calls = cfg["questions_per_interview"] * cfg["llm_calls_per_question"] + cfg["extra_llm_calls"]
    llm_cost = ((max(0, in_tok - cached_tok) / 1_000_000) * in_rate +
                (cached_tok / 1_000_000) * cached_rate +
                (out_tok / 1_000_000) * out_rate) * USD_TO_INR * llm_calls

    # Voice (STT + TTS) and LiveKit — pulled from infra inventory when present
    stt_doc = db.platform_infra_costs.find_one({"id": "voice-stt-whisper", "active": True}) if db is not None else None
    tts_doc = db.platform_infra_costs.find_one({"id": "voice-tts-openai", "active": True}) if db is not None else None
    livekit_doc = db.platform_infra_costs.find_one({"id": "livekit-cloud", "active": True}) if db is not None else None

    stt_min = float(cfg["stt_minutes_per_interview"])
    tts_chars = cfg["tts_chars_per_minute"] * stt_min
    stt_cost = (stt_doc["unit_cost_usd"] * stt_min * USD_TO_INR) if stt_doc else 0.0
    # Production TTS is Edge-TTS by default (free); OpenAI tts-1 is the paid tier — opt-in via assumptions.
    if cfg.get("use_openai_tts"):
        tts_cost = ((tts_doc["unit_cost_usd"] / 1000.0) * tts_chars * USD_TO_INR) if tts_doc else 0.0
    else:
        tts_cost = 0.0  # Edge-TTS — free
    livekit_cost = (float(livekit_doc.get("unit_cost_usd") or 0.0) * float(cfg["livekit_agent_minutes"]) * USD_TO_INR) if livekit_doc else 0.0
    emb_cost = (cfg["embedding_input_tokens"] / 1_000_000) * 0.02 * USD_TO_INR * cfg["embeddings_per_interview"]

    total_inr = llm_cost + stt_cost + tts_cost + livekit_cost + emb_cost
    return {
        "model": model,
        "provider": provider,
        "rate_found": bool(rate_doc),
        "rate_card_version": int((rate_doc or {}).get("version") or 0) if rate_doc else None,
        "rates": rates,
        "cost_per_call_inr": round(in_cost, 6),
        "llm_calls_per_interview": llm_calls,
        "llm_cost_per_interview_inr": round(llm_cost, 6),
        "stt_cost_inr": round(stt_cost, 6),
        "tts_cost_inr": round(tts_cost, 6),
        "livekit_cost_inr": round(livekit_cost, 6),
        "embedding_cost_inr": round(emb_cost, 6),
        "total_interview_cost_inr": round(total_inr, 6),
        "total_interview_cost_usd": round(total_inr / USD_TO_INR, 6),
        "cost_per_1000_interviews_inr": round(total_inr * 1000, 2),
        "cost_per_1000_interviews_lakh": round(total_inr * 1000 / 100000.0, 4),
        "total_tokens_per_interview": in_tok * llm_calls + out_tok * llm_calls,
    }


@cost_bp.route("/api/super-admin/cost-estimate", methods=["GET"])
@require_super_admin
def cost_estimate():
    """Per-model call & interview economics. Recomputed live from the rate card."""
    try:
        db = get_mongo_db()
        cfg = get_cost_assumptions(db)
        pricing = list(db.platform_llm_pricing.find({"active": True, "call_type": "chat"}, {"_id": 0})) if db is not None else []
        seen = set()
        models = []
        for p in pricing:
            key = (p.get("provider_kind"), p.get("model_pattern"))
            if key in seen:
                continue
            seen.add(key)
            models.append((p.get("provider_kind") or "google", p.get("model_pattern") or "unknown"))

        # Always also include the currently configured Gemini model so the UI is never empty
        import os
        configured = (os.environ.get("GEMINI_MODEL") or os.environ.get("LLM_MODEL") or "").strip()
        if configured and all(configured != m for _, m in models):
            models.append(("google", configured))

        breakdowns = [_model_cost_breakdown(db, prov, model, cfg) for prov, model in sorted(models, key=lambda x: x[1])]
        breakdowns.sort(key=lambda b: b["total_interview_cost_inr"])

        infra_total_inr = 0.0
        if db is not None:
            for d in db.platform_infra_costs.find({"active": True}, {"_id": 0}):
                infra_total_inr += float(d.get("unit_cost_usd") or 0.0) * float(d.get("monthly_qty") or 0.0) * USD_TO_INR

        return jsonify({
            "success": True,
            "assumptions": cfg,
            "models": breakdowns,
            "cheapest_model": breakdowns[0] if breakdowns else None,
            "most_expensive_model": breakdowns[-1] if breakdowns else None,
            "infra_total_month_inr": round(infra_total_inr, 2),
            "fx_rate_usd_to_inr": USD_TO_INR,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


# --------------------------------------------------------------------------- LLM evaluation

@cost_bp.route("/api/super-admin/llm-eval/run", methods=["POST"])
@require_super_admin
def llm_eval_run():
    """Run the 6-prompt eval battery across enabled providers.

    REAL PAID API CALLS — only triggered by explicit admin action with
    confirm_spend=true in the JSON body. Judge is a deterministic local rubric
    (₹0 extra). Results are persisted (platform_llm_eval_runs) with full
    metered usage + implied cost for governance.
    """
    try:
        data = request.get_json(silent=True) or {}
        if not data.get("confirm_spend"):
            return jsonify({
                "success": False,
                "error": "Refusing to run paid eval without confirm_spend=true — this makes real API calls.",
            }), 400

        import httpx
        db = get_mongo_db()
        if db is None:
            return jsonify({"success": False, "error": "Database unavailable"}), 503

        user = getattr(g, "user", None) or {}
        actor = str(user.get("email") or "").strip().lower() or "super_admin"

        # Build provider candidates from server config — only providers with keys participate
        from app.config import settings

        providers = []
        if getattr(settings, "effective_gemini_key", None):
            providers.append("google")
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip():
            providers.append("openai")
        if settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip():
            providers.append("openrouter")

        if not providers:
            return jsonify({"success": False, "error": "No LLM providers configured with keys."}), 400

        def _provider_model(p: str) -> str:
            if p == "google":
                return settings.GEMINI_MODEL or "gemini-2.0-flash-lite"
            if p == "openai":
                return settings.LLM_MODEL
            return settings.OPENROUTER_MODEL

        run_id = f"eval-{uuid.uuid4().hex[:10]}"
        results = []
        totals = {"input_tokens": 0, "output_tokens": 0, "calls": 0, "cost_inr": 0.0}

        def _gemini_call(prompt_text: str, max_tokens: int) -> tuple[str, dict]:
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
                "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.2},
            }
            key = settings.effective_gemini_key
            base = (settings.GEMINI_BASE_URL or "").rstrip("/")
            url = f"{base}/models/{settings.GEMINI_MODEL}:generateContent?key={key}"
            r = httpx.post(url, json=payload, timeout=20.0)
            r.raise_for_status()
            data_ = r.json()
            text = (data_.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            um = data_.get("usageMetadata") or {}
            return text, {
                "input_tokens": int(um.get("promptTokenCount") or 0),
                "output_tokens": int(um.get("candidatesTokenCount") or 0),
                "cached_tokens": int(um.get("cachedContentTokenCount") or 0),
            }

        def _openai_compat(provider: str, base: str, key: str, model: str, prompt_text: str, max_tokens: int) -> tuple[str, dict]:
            r = httpx.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": [{"role": "user", "content": prompt_text}], "max_tokens": max_tokens, "temperature": 0.2},
                timeout=20.0,
            )
            r.raise_for_status()
            data_ = r.json()
            text = (data_.get("choices") or [{}])[0].get("message", {}).get("content", "")
            u = data_.get("usage") or {}
            return text, {
                "input_tokens": int(u.get("prompt_tokens") or 0),
                "output_tokens": int(u.get("completion_tokens") or 0),
                "cached_tokens": int((u.get("prompt_tokens_details") or {}).get("cached_tokens") or 0),
            }

        for provider in providers:
            model = _provider_model(provider)
            for spec in EVAL_PROMPTS:
                started = time.time()
                rec: dict = {
                    "provider": provider,
                    "model": model,
                    "prompt_id": spec["id"],
                    "status": "success",
                    "error": None,
                    "text": "",
                    "latency_ms": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "score": None,
                    "cost_inr": None,
                }
                try:
                    if provider == "google":
                        text, usage = _gemini_call(spec["prompt"], spec["max_tokens"])
                    elif provider == "openai":
                        text, usage = _openai_compat("openai", settings.OPENAI_API_BASE, settings.OPENAI_API_KEY, settings.LLM_MODEL, spec["prompt"], spec["max_tokens"])
                    else:
                        text, usage = _openai_compat("openrouter", settings.OPENROUTER_BASE_URL, settings.OPENROUTER_API_KEY, settings.OPENROUTER_MODEL, spec["prompt"], spec["max_tokens"])
                    rec["text"] = (text or "")[:2000]
                    rec["latency_ms"] = int((time.time() - started) * 1000)
                    rec["input_tokens"] = usage["input_tokens"]
                    rec["output_tokens"] = usage["output_tokens"]
                    rec["score"] = judge_score(rec["text"], spec["id"])
                    usage_ns = type("UsageNS", (), usage)()
                    costs = cost_for_llm(provider=provider, model=model, usage=usage_ns, usage_measured=True)
                    rec["cost_inr"] = costs.provider_cost_inr
                    totals["input_tokens"] += rec["input_tokens"]
                    totals["output_tokens"] += rec["output_tokens"]
                    totals["cost_inr"] += (rec["cost_inr"] or 0.0)
                    totals["calls"] += 1
                except Exception as call_err:
                    rec["status"] = "error"
                    rec["error"] = str(call_err)[:200]
                    rec["latency_ms"] = int((time.time() - started) * 1000)
                results.append(rec)

        ok = sum(1 for r in results if r["status"] == "success")
        scores = [r["score"] for r in results if isinstance(r.get("score"), (int, float))]
        run_doc = {
            "id": run_id,
            "run_at": datetime.now(timezone.utc).isoformat(),
            "triggered_by": actor,
            "providers": providers,
            "results": results,
            "totals": {**totals, "ok": ok, "failed": len(results) - ok, "avg_score": round(sum(scores) / len(scores), 1) if scores else None},
            "cost_note": "Metered via LLM rate card / provider-reported tokens. Judge rubric is local (₹0 extra).",
        }
        db.platform_llm_eval_runs.insert_one(run_doc)
        run_doc.pop("_id", None)
        return jsonify({"success": True, "run": run_doc}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


@cost_bp.route("/api/super-admin/llm-eval/runs", methods=["GET"])
@require_super_admin
def llm_eval_runs():
    """Recent eval battery runs."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"success": False, "error": "Database unavailable"}), 503
        runs = []
        for r in db.platform_llm_eval_runs.find({}, {"_id": 0}).sort("run_at", -1).limit(20):
            results = r.get("results") or []
            per_provider: dict[str, dict] = {}
            for res in results:
                prov = per_provider.setdefault(res.get("provider", "unknown"), {"calls": 0, "ok": 0, "scores": [], "inr": 0.0, "latency_ms_sum": 0})
                prov["calls"] += 1
                if res.get("status") == "success":
                    prov["ok"] += 1
                    if isinstance(res.get("score"), (int, float)):
                        prov["scores"].append(res["score"])
                prov["inr"] += (res.get("cost_inr") or 0.0)
                prov["latency_ms_sum"] += int(res.get("latency_ms") or 0)
            summary = {
                prov: {
                    "calls": p["calls"],
                    "ok": p["ok"],
                    "avg_score": round(sum(p["scores"]) / len(p["scores"]), 1) if p["scores"] else None,
                    "cost_inr": round(p["inr"], 4),
                    "avg_latency_ms": round(p["latency_ms_sum"] / max(p["calls"], 1)),
                }
                for prov, p in per_provider.items()
            }
            runs.append({
                "id": r.get("id"),
                "run_at": r.get("run_at"),
                "triggered_by": r.get("triggered_by"),
                "providers": r.get("providers") or [],
                "totals": r.get("totals") or {},
                "per_provider": summary,
            })
        return jsonify({"success": True, "runs": runs}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500
