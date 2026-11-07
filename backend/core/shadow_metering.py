"""Shadow usage metering for every billable provider integration.

Purpose
-------
Phase 1 instrumentation. This module **measures** real provider usage and
records it as auditable events. It deliberately does **not**:

* deduct, reserve or refund customer credits;
* touch ``billing_accounts`` balances, packages or entitlements;
* alter any interview, candidate, recruiter or Super Admin behaviour.

A shadow-metric failure is never allowed to break an interview: every public
function is best-effort and swallows (and logs) its own errors.

Design
------
One *logical operation* (e.g. "generate question 3 of session X") may involve
several *provider attempts* (retry, failover). Each attempt is one event,
linked by ``logical_operation_id`` so a retry can never inflate the logical
total. ``attempt_index`` is assigned atomically, and ``(logical_operation_id,
attempt_index)`` is the idempotency key, so a replay of the same attempt
collapses to a single stored document.

Cost discipline
---------------
Three independent things are recorded and never conflated:

* ``measured_usage``      — what the provider actually reported.
* ``provider_cost_amount`` — ``None`` when cost cannot be computed defensibly.
* ``cost_status``         — one of :data:`COST_STATUSES`.

``USAGE_UNAVAILABLE`` and ``COST_UNKNOWN`` never become ``0``.

Collection: ``platform_shadow_usage_events``
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterator

logger = logging.getLogger("progeni_atlas.shadow_metering")

COLLECTION = "platform_shadow_usage_events"
PRICING_COLLECTION = "platform_llm_pricing"

PROVIDER_COST_CURRENCY = "USD"

# --------------------------------------------------------------------------- statuses

VERIFIED_RATE_AND_USAGE = "VERIFIED_RATE_AND_USAGE"
MEASURED_USAGE_RATE_UNVERIFIED = "MEASURED_USAGE_RATE_UNVERIFIED"
ESTIMATED = "ESTIMATED"
USAGE_UNAVAILABLE = "USAGE_UNAVAILABLE"
COST_UNKNOWN = "COST_UNKNOWN"

COST_STATUSES = (
    VERIFIED_RATE_AND_USAGE,
    MEASURED_USAGE_RATE_UNVERIFIED,
    ESTIMATED,
    USAGE_UNAVAILABLE,
    COST_UNKNOWN,
)

# Service categories actually discovered in the repository.
SERVICE_LLM = "llm_chat"
SERVICE_STT = "voice_stt"
SERVICE_TTS = "voice_tts"
SERVICE_EMBEDDING = "embeddings"
SERVICE_CODE_EXECUTION = "code_execution"
SERVICE_MEDIA_STORAGE = "media_storage"

# Verified versus merely-measured rates.
#
# ``VERIFIED_PRICING_SOURCES`` lists ``(provider_kind, model)`` pairs whose rate
# has been corroborated against a provider-published price page that the repo
# records verbatim (see ``PRICE_SOURCE_*`` in ``app/services/speech_usage.py``).
# Anything absent from this set yields ``MEASURED_USAGE_RATE_UNVERIFIED`` — a
# mathematically correct conversion of an *assumed* rate, never presented as a
# verified production cost.
VERIFIED_PRICING_SOURCES: dict[tuple[str, str], str] = {
    ("openai", "tts-1"): "OpenAI published API pricing $15.00/1M characters",
    ("openai", "tts-1-hd"): "OpenAI published API pricing $30.00/1M characters",
}

# Effective USD->INR assumption. Mirrors ``billing_rates.INR_REFERENCE_RATES``
# (83.00) and is *not* a live FX feed. Kept explicit so every event states the
# rate and date it was converted with.
USD_TO_INR = Decimal("83.00")
USD_TO_INR_SOURCE = "billing_rates.INR_REFERENCE_RATES (assumption, not live FX)"

NANO = Decimal(1_000_000_000)
PER_MILLION = Decimal(1_000_000)

# --------------------------------------------------------------------------- indexes

_index_lock = threading.Lock()
_indexes_ready = False


def ensure_indexes() -> None:
    """Create the shadow-event indexes once per process (best-effort).

    Bounded retention: ``expires_at`` carries a documented TTL (see
    :data:`RETENTION_DAYS`) so the collection cannot grow without bound.
    """
    global _indexes_ready
    if _indexes_ready:
        return
    with _index_lock:
        if _indexes_ready:
            return
        try:
            from core.db import get_mongo_db

            coll = get_mongo_db()[COLLECTION]
            # ``event_id`` and the logical-attempt pair are unique only when
            # actually present. A plain unique index also treats every document
            # that omits them as the same (null) key, so a second id-less insert
            # fails with E11000. Legacy indexes created before this guard are
            # dropped and recreated as partial indexes.
            _ensure_partial_unique_index(coll, "event_id", "event_id_1")
            _ensure_partial_unique_index(
                coll,
                ("logical_operation_id", "attempt_index"),
                "logical_operation_id_1_attempt_index_1",
            )
            coll.create_index("correlation_id")
            coll.create_index([("organization_id", 1), ("created_at", -1)])
            coll.create_index([("service_category", 1), ("created_at", -1)])
            coll.create_index("expires_at", expireAfterSeconds=0)
            _indexes_ready = True
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("shadow metering index setup failed: %s", type(exc).__name__)


def _ensure_partial_unique_index(coll, keys, name: str) -> None:
    """Create a unique index that only covers documents where the key exists.

    Missing keys are stored as null, so a plain unique index rejects the
    second document that omits them. The partial filter limits uniqueness to
    real string ids, which is what the write path always generates.
    """
    key = keys if isinstance(keys, str) else keys[0]
    try:
        existing = coll.index_information().get(name)
    except Exception:  # pragma: no cover - defensive
        existing = None
    if existing is not None and "partialFilterExpression" not in existing:
        coll.drop_index(name)
    coll.create_index(
        keys,
        name=name,
        unique=True,
        partialFilterExpression={key: {"$type": "string"}},
    )


RETENTION_DAYS = 365

# --------------------------------------------------------------------------- identity

# Per-process monotonic counter feeding attempt_index assignment.
_attempt_lock = threading.Lock()
_attempt_store: dict[str, int] = {}


def new_logical_operation_id() -> str:
    return f"lop_{uuid.uuid4().hex}"


def new_event_id() -> str:
    return f"evt_{uuid.uuid4().hex}"


def _next_attempt_index(logical_operation_id: str) -> int:
    with _attempt_lock:
        nxt = _attempt_store.get(logical_operation_id, 0) + 1
        _attempt_store[logical_operation_id] = nxt
        # Bound memory: keep the most recent 4096 logical operations.
        if len(_attempt_store) > 4096:
            for key in list(_attempt_store)[:2048]:
                _attempt_store.pop(key, None)
        return nxt


def next_attempt(logical_operation_id: str | None) -> int:
    """Reserve the next attempt number for a logical operation.

    Deterministic and atomic per process, so concurrent retries cannot claim
    the same ``(logical_operation_id, attempt_index)`` pair and double count.
    """
    return _next_attempt_index(logical_operation_id or new_logical_operation_id())


# --------------------------------------------------------------------------- feature flag


def shadow_metering_enabled() -> bool:
    """Read the shadow metering feature flag.

    Uses the repository's existing pydantic-settings convention
    (a plain boolean in ``app.config.settings``). The call path is wrapped so
    that an ImportError from a partial test environment cannot crash the
    application: an unusable flag means "off".
    """
    try:
        from app.config import settings

        return bool(getattr(settings, "SHADOW_METERING_ENABLED", True))
    except Exception:  # pragma: no cover - defensive
        return True


# --------------------------------------------------------------------------- context


@dataclass
class MeterContext:
    """Trusted, server-side identifiers for one initiating action.

    Only identifiers are stored — never prompts, resumes, answers, transcripts
    or media. ``logical_operation_id`` links retries/failovers; when omitted a
    fresh one is generated.
    """

    service_category: str
    operation: str
    provider: str = ""
    model: str = ""
    correlation_id: str | None = None
    organization_id: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    request_id: str | None = None
    retry_number: int = 0
    is_fallback: bool = False
    usage_measured: bool = True
    logical_operation_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def resolved_logical_id(self) -> str:
        """Return this context's logical id, minting one once and caching it.

        Caching matters: a single MeterContext is reused across provider
        attempts, so every attempt must resolve to the *same* logical id or a
        failover would be recorded as unrelated operations.
        """
        if not self.logical_operation_id:
            self.logical_operation_id = new_logical_operation_id()
        return self.logical_operation_id


def context_from_session(
    session: Any,
    *,
    service_category: str,
    operation: str,
    provider: str = "",
    model: str = "",
    **overrides: Any,
) -> MeterContext:
    """Build a :class:`MeterContext` from an ORM interview session.

    Only safe identifiers are copied; ``session.config`` is never persisted.
    """
    org_id = getattr(session, "organization_id", None)
    user_id = getattr(session, "candidate_id", None)
    session_id = getattr(session, "id", None)
    config = getattr(session, "config", None) or {}
    job_id = config.get("job_id") if isinstance(config, dict) else None

    ctx = MeterContext(
        service_category=service_category,
        operation=operation,
        provider=provider,
        model=model,
        correlation_id=str(session_id) if session_id else None,
        organization_id=str(org_id) if org_id else None,
        user_id=str(user_id) if user_id else None,
        session_id=str(session_id) if session_id else None,
        metadata={"job_id": str(job_id)} if job_id else {},
    )
    for key, value in overrides.items():
        setattr(ctx, key, value)
    return ctx


def context_from_user(
    user: Any,
    *,
    service_category: str,
    operation: str,
    organization_id: str | None = None,
    provider: str = "",
    model: str = "",
    metadata: dict[str, Any] | None = None,
) -> MeterContext:
    """Build a :class:`MeterContext` from the authenticated request user.

    Used by route-level operations that are not bound to an interview session
    (rubric generation, job-description suggestions, report ideal answers).
    ``user`` is the trusted server-side dict from ``g.user``; only identifiers
    are read. Organization is preferred from ``user`` when present, falling back
    to the caller-supplied value.
    """
    user = user if isinstance(user, dict) else {}
    uid = user.get("id") or user.get("user_id")
    org = user.get("organization_id") or user.get("org_id") or organization_id
    return MeterContext(
        service_category=service_category,
        operation=operation,
        provider=provider,
        model=model,
        correlation_id=str(uid) if uid else None,
        organization_id=str(org) if org else None,
        user_id=str(uid) if uid else None,
        metadata=dict(metadata or {}),
    )


# --------------------------------------------------------------------------- cost


@dataclass(frozen=True)
class CostResult:
    provider_cost_amount: float | None
    provider_cost_currency: str
    provider_cost_inr: float | None
    pricing_rule_version: str | None
    cost_status: str
    cost_estimation_method: str


def _dec(value: Any) -> Decimal | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        return Decimal(str(value))
    except Exception:
        return None


def _round(value: Decimal, places: str) -> float:
    return float(value.quantize(Decimal(places), rounding=ROUND_HALF_UP))


def _lookup_pricing(call_type: str, provider: str, model: str) -> tuple[dict[str, Any] | None, str | None]:
    """Read the versioned pricing registry (read-only).

    Returns ``(rates, "id@version")``. Never raises.
    """
    try:
        from core.db import get_mongo_db

        now = datetime.now(timezone.utc).isoformat()
        query = {
            "call_type": call_type,
            "active": True,
            "provider_kind": {"$in": [str(provider or "").lower(), "*"]},
        }
        best = None
        for doc in get_mongo_db()[PRICING_COLLECTION].find(query):
            pattern = str(doc.get("model_pattern") or "")
            match_type = str(doc.get("match_type") or "exact")
            if match_type == "exact":
                if pattern.lower() != str(model or "").lower():
                    continue
            elif not str(model or "").lower().startswith(pattern.lower()):
                continue
            eff_from = str(doc.get("effective_from") or "")
            eff_to = doc.get("effective_to")
            if eff_from and now < eff_from:
                continue
            if eff_to and now >= str(eff_to):
                continue
            if best is None or int(doc.get("version") or 1) > int(best.get("version") or 1):
                best = doc
        if best is None:
            return None, None
        ref = f"{best.get('id')}@{int(best.get('version') or 1)}"
        return dict(best.get("rates") or {}), ref
    except Exception:
        return None, None


def _is_verified(provider: str, model: str) -> str | None:
    key = (str(provider or "").lower(), str(model or "").lower())
    return VERIFIED_PRICING_SOURCES.get(key)


def cost_for_llm(
    *,
    provider: str,
    model: str,
    usage: Any,
    usage_measured: bool = True,
) -> CostResult:
    """Price one chat/embedding call from a rate card and provider usage."""
    input_tokens = getattr(usage, "input_tokens", None)
    output_tokens = getattr(usage, "output_tokens", None)
    cached_tokens = getattr(usage, "cached_tokens", None)
    reasoning_tokens = getattr(usage, "reasoning_tokens", None)
    if input_tokens is None and output_tokens is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                          USAGE_UNAVAILABLE, "no provider-reported token usage")

    rates, ref = _lookup_pricing("chat", provider, model)
    if not rates:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                          MEASURED_USAGE_RATE_UNVERIFIED,
                          "provider usage measured; no pricing record for this provider/model")
    in_rate = _dec(rates.get("input_per_1m_tokens"))
    out_rate = _dec(rates.get("output_per_1m_tokens"))
    cached_rate = _dec(rates.get("cached_input_per_1m_tokens"))
    r_rate = _dec(rates.get("reasoning_per_1m_tokens"))
    if in_rate is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, ref,
                          MEASURED_USAGE_RATE_UNVERIFIED, "pricing record has no input rate")

    total = Decimal(0)
    it = Decimal(int(input_tokens or 0))
    ct = Decimal(int(cached_tokens or 0))
    if cached_rate is not None and ct > 0:
        total += (max(Decimal(0), it - ct) / PER_MILLION) * in_rate
        total += (ct / PER_MILLION) * cached_rate
    else:
        total += (it / PER_MILLION) * in_rate
    if out_rate is not None:
        total += (Decimal(int(output_tokens or 0)) / PER_MILLION) * out_rate
    if r_rate is not None and reasoning_tokens:
        total += (Decimal(int(reasoning_tokens)) / PER_MILLION) * r_rate

    usd = _round(total, "0.000000001")
    return CostResult(
        usd, PROVIDER_COST_CURRENCY, _round(Decimal(str(usd)) * USD_TO_INR, "0.0001"),
        ref,
        VERIFIED_RATE_AND_USAGE if (usage_measured and _is_verified(provider, model)) else (
            "ESTIMATED" if not usage_measured else MEASURED_USAGE_RATE_UNVERIFIED
        ),
        "rate_card x provider_reported_usage" if usage_measured else "rate_card x local_estimate",
    )


def cost_for_tts(
    *,
    provider: str,
    model: str,
    characters: int | None,
    usage_measured: bool = True,
) -> CostResult:
    if characters is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                          USAGE_UNAVAILABLE, "no measurable character count")
    rates, ref = _lookup_pricing("tts", provider, model)
    rate = _dec((rates or {}).get("per_1m_characters"))
    if rate is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                          MEASURED_USAGE_RATE_UNVERIFIED,
                          "character usage measured; no pricing record for this provider/model")
    total = (Decimal(int(characters)) / PER_MILLION) * rate
    usd = _round(total, "0.000000001")
    verified = _is_verified(provider, model)
    return CostResult(
        usd, PROVIDER_COST_CURRENCY, _round(Decimal(str(usd)) * USD_TO_INR, "0.0001"),
        ref,
        VERIFIED_RATE_AND_USAGE if (usage_measured and verified) else (
            "ESTIMATED" if not usage_measured else MEASURED_USAGE_RATE_UNVERIFIED
        ),
        "rate_card x measured_characters",
    )


def cost_for_stt(
    *,
    provider: str,
    model: str,
    seconds: float | None,
    usage_measured: bool = True,
) -> CostResult:
    """STT cost.

    Audio duration is measured, but the platform's STT pricing collection has no
    recorded rate for the configured STT models, so the honest answer is
    ``MEASURED_USAGE_RATE_UNVERIFIED`` (never a fabricated zero).
    """
    if seconds is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                          USAGE_UNAVAILABLE, "audio duration unavailable")
    rates, ref = _lookup_pricing("stt", provider, model)
    rate = _dec((rates or {}).get("per_minute"))
    if rate is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None, None,
                          MEASURED_USAGE_RATE_UNVERIFIED,
                          "audio duration measured; no verified STT rate recorded")
    total = (Decimal(str(seconds)) / Decimal(60)) * rate
    usd = _round(total, "0.000000001")
    return CostResult(
        usd, PROVIDER_COST_CURRENCY, _round(Decimal(str(usd)) * USD_TO_INR, "0.0001"),
        ref,
        VERIFIED_RATE_AND_USAGE if usage_measured else ESTIMATED,
        "rate_card x measured_seconds",
    )


def cost_for_embedding(
    *,
    provider: str,
    model: str,
    input_tokens: int | None,
    usage_measured: bool = True,
) -> CostResult:
    if input_tokens is None:
        # Embedding endpoints in this repo return only the vector, so token
        # usage is genuinely unavailable. Recorded as such - never zero.
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                          USAGE_UNAVAILABLE, "embedding provider returned no token usage")
    rates, ref = _lookup_pricing("embedding", provider, model)
    rate = _dec((rates or {}).get("input_per_1m_tokens"))
    if rate is None:
        return CostResult(None, PROVIDER_COST_CURRENCY, None, None, None,
                          MEASURED_USAGE_RATE_UNVERIFIED,
                          "token usage measured; no pricing record for this embedding model")
    total = (Decimal(int(input_tokens)) / PER_MILLION) * rate
    usd = _round(total, "0.000000001")
    return CostResult(
        usd, PROVIDER_COST_CURRENCY, _round(Decimal(str(usd)) * USD_TO_INR, "0.0001"),
        ref,
        VERIFIED_RATE_AND_USAGE if usage_measured else ESTIMATED,
        "rate_card x measured_tokens",
    )


# --------------------------------------------------------------------------- events


def emit(
    ctx: MeterContext,
    *,
    measured_usage: dict[str, Any] | None = None,
    usage_unit: str | None = None,
    cost: CostResult | None = None,
    status: str = "success",
    duration_ms: int | None = None,
    attempt_index: int | None = None,
    error_code: str | None = None,
) -> dict[str, Any] | None:
    """Persist exactly one provider-attempt event.

    Idempotent on ``(logical_operation_id, attempt_index)``. Returns the stored
    document, or ``None`` when metering is disabled or persistence failed.
    Never raises into the caller's path.
    """
    if not shadow_metering_enabled():
        return None

    logical_id = ctx.resolved_logical_id()
    idx = attempt_index if attempt_index is not None else _next_attempt_index(logical_id)
    usage = dict(measured_usage or {})
    cost = cost or CostResult(None, PROVIDER_COST_CURRENCY, None, None,
                              COST_UNKNOWN, "no cost computed")

    now = datetime.now(timezone.utc)
    doc = {
        "event_id": new_event_id(),
        "schema_version": 1,
        "logical_operation_id": logical_id,
        "attempt_index": int(idx),
        "correlation_id": ctx.correlation_id,
        "organization_id": ctx.organization_id,
        "user_id": ctx.user_id,
        "session_id": ctx.session_id,
        "service_category": ctx.service_category,
        "provider": ctx.provider,
        "model": ctx.model,
        "operation": ctx.operation,
        "status": status,
        "error_code": error_code,
        "duration_ms": duration_ms,
        "retry_number": int(ctx.retry_number or 0),
        "is_fallback": bool(ctx.is_fallback),
        "provider_request_id": ctx.request_id,
        "measured_usage": usage,
        "usage_unit": usage_unit,
        "provider_cost_amount": cost.provider_cost_amount,
        "provider_cost_currency": cost.provider_cost_currency,
        "provider_cost_inr": cost.provider_cost_inr,
        "usd_to_inr_rate": float(USD_TO_INR),
        "usd_to_inr_source": USD_TO_INR_SOURCE,
        "pricing_rule_version": cost.pricing_rule_version,
        "cost_status": cost.cost_status,
        "cost_estimation_method": cost.cost_estimation_method,
        "recorded_at": now.isoformat(),
        "created_at": now,
        "expires_at": datetime.fromtimestamp(
            now.timestamp() + RETENTION_DAYS * 86400, tz=timezone.utc
        ),
        "metadata": dict(ctx.metadata or {}),
    }

    try:
        ensure_indexes()
        from core.db import get_mongo_db

        coll = get_mongo_db()[COLLECTION]
        coll.update_one(
            {"logical_operation_id": logical_id, "attempt_index": int(idx)},
            {"$setOnInsert": doc},
            upsert=True,
        )
        return doc
    except Exception as exc:  # pragma: no cover - never break the caller
        logger.warning(
            "shadow metering emit failed (service=%s op=%s): %s",
            ctx.service_category, ctx.operation, type(exc).__name__,
        )
        return None


@contextmanager
def attempt(
    ctx: MeterContext,
    *,
    measured_usage: dict[str, Any] | None = None,
    usage_unit: str | None = None,
    cost: CostResult | None = None,
) -> Iterator[dict[str, Any]]:
    """Time one provider attempt and emit it on exit (success or failure).

    ``measured_usage``/``cost`` may be supplied as mutable containers that the
    caller fills in after the provider responds; the containers are re-read on
    exit so a partly-known call is still recorded.
    """
    started = time.perf_counter()
    outcome: dict[str, Any] = {"status": "success", "error_code": None}
    try:
        yield outcome
    except BaseException as exc:
        outcome["status"] = "error"
        outcome["error_code"] = type(exc).__name__
        raise
    finally:
        emit(
            ctx,
            measured_usage=measured_usage,
            usage_unit=usage_unit,
            cost=cost,
            status=outcome.get("status") or "success",
            duration_ms=int((time.perf_counter() - started) * 1000),
            error_code=outcome.get("error_code"),
        )


# --------------------------------------------------------------------------- usage adapters


def usage_dict_from_token_usage(usage: Any) -> dict[str, Any]:
    """Minimal numeric usage snapshot from a provider ``TokenUsage``.

    Never copies prompt text, completions or identifiers other than the counts.
    """
    if usage is None:
        return {}
    return {
        "input_tokens": getattr(usage, "input_tokens", None),
        "output_tokens": getattr(usage, "output_tokens", None),
        "cached_tokens": getattr(usage, "cached_tokens", None),
        "reasoning_tokens": getattr(usage, "reasoning_tokens", None),
        "total_tokens": getattr(usage, "total_tokens", None),
        "provenance": getattr(usage, "provenance", "unavailable"),
    }


def usage_unavailable(reason: str) -> dict[str, Any]:
    """Explicit "we could not measure this" payload - never an empty zero."""
    return {"provenance": "unavailable", "reason": reason}


# --------------------------------------------------------------------------- read helpers


def summarize(*, organization_id: str | None = None, limit: int = 500) -> dict[str, Any]:
    """Read-only rollup used by tests and the implementation report.

    Grouping by ``logical_operation_id`` means the totals count each logical
    operation once even when it involved several attempts (correct for
    cost-of-operation reporting) while ``attempts`` still exposes the raw count.
    """
    try:
        from core.db import get_mongo_db

        query: dict[str, Any] = {}
        if organization_id:
            query["organization_id"] = organization_id
        docs = list(get_mongo_db()[COLLECTION].find(query).limit(limit))
    except Exception as exc:
        return {"error": type(exc).__name__, "events": 0}

    by_status: dict[str, int] = {}
    by_service: dict[str, int] = {}
    logical: dict[str, Decimal] = {}
    attempts = 0
    for doc in docs:
        attempts += 1
        by_status[str(doc.get("cost_status"))] = by_status.get(str(doc.get("cost_status")), 0) + 1
        by_service[str(doc.get("service_category"))] = by_service.get(str(doc.get("service_category")), 0) + 1
        lop = str(doc.get("logical_operation_id"))
        amount = doc.get("provider_cost_amount")
        logical.setdefault(lop, Decimal(0))
        if amount is not None:
            # Only the first attempt contributes to the logical total so a retry
            # cannot silently double-count.
            if int(doc.get("attempt_index") or 0) == 1:
                logical[lop] += Decimal(str(amount))
    return {
        "attempts": attempts,
        "logical_operations": len(logical),
        "cost_status_counts": by_status,
        "service_category_counts": by_service,
        "logical_cost_usd_sum": _round(sum(logical.values(), Decimal(0)), "0.000000001"),
    }
