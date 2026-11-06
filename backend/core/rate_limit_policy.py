"""Shared rate-limit storage policy — the single source of truth.

Why this module exists
----------------------
Production Gunicorn workers used to crash during application import with::

    RuntimeError: RATE_LIMIT_STORAGE_URI must be a shared Redis/Valkey store
    in production

The same production rule was duplicated in ``core/limiter.py`` (import-time
guard) and ``app/config.py`` (pydantic validator) with two different
implementations, so the guard could drift apart. This module owns the rule
exactly once and is imported by both call sites.

Fail-closed contracts (production)
----------------------------------
1. Rate limiting must be ENABLED: ``RATE_LIMIT_ENABLED=false`` is rejected.
2. Storage must be a shared Redis/Valkey URI: ``redis://``, ``rediss://``,
   ``valkey://``, ``valkeys://`` and their ``+unix`` / ``+cluster`` /
   ``+sentinel`` variants. ``memory://`` is rejected because it is
   per-process — Gunicorn workers and replicas would each keep private
   counters and the limit would not be enforced globally.
3. The store must answer ``PING`` during startup or the process refuses to
   boot (``RateLimitConfigurationError``), so traffic is never served
   without a working shared limiter.
4. At request time the limiter must never fall back to in-memory counting
   (see ``core.limiter``: ``swallow_errors=False``, no in-memory fallback).

Secret hygiene
--------------
No function here ever echoes the configured URI, its host, or its password.
Error messages mention only the URI *scheme* and generic remediation steps,
so the message is safe to print in crash logs and CI output.
"""

from __future__ import annotations

import os
import urllib.parse
from dataclasses import dataclass

#: Environment values that select production behaviour.
PRODUCTION_ENVS = frozenset({"production", "prod"})

#: URI schemes that address a shared (cross-process) store.
#: Accepted forms: ``redis://``, ``rediss://``, ``valkey://``, ``valkeys://``
#: and the ``redis+unix`` / ``redis+cluster`` / ``redis+sentinel`` (and
#: Valkey equivalents) variants registered by the ``limits`` library.
SHARED_SCHEMES = frozenset(
    {"redis", "rediss", "valkey", "valkeys"}
) | {
    f"{family}+{variant}"
    for family in ("redis", "valkey")
    for variant in ("unix", "cluster", "sentinel")
}

#: Only non-production environments may use this per-process store.
MEMORY_SCHEME = "memory"

#: Connect/read budget for the startup PING.
_STARTUP_PING_TIMEOUT_SECONDS = 2.0

#: Connect/read budget for per-request limiter operations.
STORAGE_REQUEST_TIMEOUT_SECONDS = 2.0

_TRUE_VALUES = frozenset({"1", "true", "yes", "y", "on"})
_FALSE_VALUES = frozenset({"0", "false", "no", "n", "off"})

_ALLOWED_SCHEMES_HINT = (
    "redis://<host>:<port>/<db>, rediss://<host>:<port>/<db> (TLS), "
    "valkey://<host>:<port>/<db>, valkeys://<host>:<port>/<db> "
    "(and their +unix / +cluster / +sentinel variants)"
)


class RateLimitConfigurationError(RuntimeError):
    """Raised when rate-limit configuration violates the production policy.

    Subclasses ``RuntimeError`` so every pre-existing ``except RuntimeError``
    call site (including the historical guard) keeps working. Messages are
    actionable but secret-free.
    """


def is_production(app_env: str | None = None, env: dict | None = None) -> bool:
    """True when the effective environment is production."""
    if app_env is None:
        source = os.environ if env is None else env
        app_env = str(source.get("APP_ENV", "development"))
    return str(app_env).strip().lower() in PRODUCTION_ENVS


def _scheme_of(uri: str) -> str:
    return urllib.parse.urlparse(uri).scheme.lower()


def is_shared_storage_scheme(scheme: str) -> bool:
    """True when ``scheme`` addresses a cross-process Redis/Valkey store."""
    return (scheme or "").lower() in SHARED_SCHEMES


def parse_rate_limit_enabled(raw: str | None) -> bool:
    """Parse ``RATE_LIMIT_ENABLED`` strictly; unset means enabled."""
    if raw is None:
        return True
    value = str(raw).strip().lower()
    if value in _TRUE_VALUES:
        return True
    if value in _FALSE_VALUES:
        return False
    raise RateLimitConfigurationError(
        "RATE_LIMIT_ENABLED must be explicitly true or false "
        "(the configured value is not echoed)."
    )


def validate_rate_limit_storage_uri(uri: str | None, *, app_env: str) -> str:
    """Validate the storage URI for the given environment.

    Returns the URI to use (a blank non-production value falls back to
    ``memory://``). Raises :class:`RateLimitConfigurationError` for anything
    that violates the policy. Never echoes the URI back in error messages.

    There is deliberately no escape hatch: production always rejects a
    per-process store. An ``RATE_LIMIT_ALLOW_MEMORY``-style flag would let a
    stray ``.env`` file silently disable the guard in production, which is
    exactly the failure mode this module exists to prevent.
    """
    raw = (uri or "").strip()
    production = is_production(app_env)

    if not raw:
        if production:
            raise RateLimitConfigurationError(
                "RATE_LIMIT_STORAGE_URI is not set. Production requires a shared "
                f"Redis/Valkey store, e.g. RATE_LIMIT_STORAGE_URI={_ALLOWED_SCHEMES_HINT}. "
                "Set it in the deployment environment (secret/platform config); the "
                "configured value is never logged."
            )
        return f"{MEMORY_SCHEME}://"

    scheme = _scheme_of(raw)

    if scheme == MEMORY_SCHEME:
        if production:
            raise RateLimitConfigurationError(
                "RATE_LIMIT_STORAGE_URI=memory:// is not allowed in production: "
                "memory storage is per-process, so Gunicorn workers and replicas "
                "would not share counters. RATE_LIMIT_STORAGE_URI must be a "
                "shared Redis/Valkey store in production — configure it in the "
                "deployment environment, e.g. RATE_LIMIT_STORAGE_URI="
                "redis://<host>:<port>/<db> (also rediss://, valkey://, "
                "valkeys://). The configured value is never logged."
            )
        return raw

    if not is_shared_storage_scheme(scheme):
        raise RateLimitConfigurationError(
            f"RATE_LIMIT_STORAGE_URI uses unsupported scheme '{scheme or '<none>'}'. "
            f"Allowed shared-store schemes: {_ALLOWED_SCHEMES_HINT}. "
            f"'{MEMORY_SCHEME}://' is only allowed outside production. "
            "The configured value is never logged."
        )

    return raw


def validate_rate_limit_enabled(enabled: bool, *, app_env: str) -> None:
    """Production may not disable rate limiting (fail closed)."""
    if is_production(app_env) and not enabled:
        raise RateLimitConfigurationError(
            "RATE_LIMIT_ENABLED=false is not allowed in production. Rate limiting "
            "is a required security control; tune per-route limits instead of "
            "disabling it."
        )


def assert_storage_reachable(
    uri: str, *, timeout: float = _STARTUP_PING_TIMEOUT_SECONDS
) -> None:
    """Ping the shared store; raise a secret-free error when unreachable.

    Called at startup in production only. The connection error text is
    deliberately dropped (only its class name is reported) because some
    client libraries embed connection details in ``str(exc)``.
    """
    try:
        import redis  # lazy: only production boot pays the import cost

        client = redis.Redis.from_url(
            uri,
            socket_connect_timeout=timeout,
            socket_timeout=timeout,
            # RESP2: works against every Redis/Valkey version, including
            # servers older than the RESP3 HELLO handshake (Redis < 6).
            protocol=2,
        )
        try:
            client.ping()
        finally:
            try:
                client.close()
            except Exception:  # pragma: no cover - best-effort cleanup
                pass
    except Exception as exc:  # noqa: BLE001 - converted to a policy error
        raise RateLimitConfigurationError(
            "Production rate-limit storage is unreachable: PING failed "
            f"({type(exc).__name__}) within {timeout:g}s. Verify that the "
            "Redis/Valkey service is running and that host, port, network/"
            "firewall, TLS (rediss://), ACL password and DB index are correct "
            "in RATE_LIMIT_STORAGE_URI. The configured value and connection "
            "error details are never logged."
        ) from None


@dataclass(frozen=True)
class RateLimitConfig:
    """Validated, immutable rate-limit configuration."""

    enabled: bool
    storage_uri: str
    app_env: str

    @property
    def is_production(self) -> bool:
        return is_production(self.app_env)

    @property
    def is_shared_store(self) -> bool:
        return is_shared_storage_scheme(_scheme_of(self.storage_uri))


def load_rate_limit_config(env=None) -> RateLimitConfig:
    """Read, validate and (in production) health-check the configuration.

    Raises :class:`RateLimitConfigurationError` on any policy violation —
    callers treat this as a fatal startup error (fail closed).
    """
    source = os.environ if env is None else env
    app_env = str(source.get("APP_ENV", "development"))
    enabled = parse_rate_limit_enabled(source.get("RATE_LIMIT_ENABLED"))
    storage_uri = validate_rate_limit_storage_uri(
        source.get("RATE_LIMIT_STORAGE_URI"),
        app_env=app_env,
    )
    validate_rate_limit_enabled(enabled, app_env=app_env)

    if is_production(app_env) and _scheme_of(storage_uri) != MEMORY_SCHEME:
        assert_storage_reachable(storage_uri)

    return RateLimitConfig(
        enabled=enabled, storage_uri=storage_uri, app_env=app_env
    )
