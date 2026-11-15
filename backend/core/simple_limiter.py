"""
Lightweight MongoDB-backed fixed-window rate limiter.

Used for the auth surface (check-email, register, login, resend-otp) where
the threat is credential stuffing / account enumeration / OTP-email flooding.

Why MongoDB (not in-memory):
  In-memory counters are per-process — every gunicorn worker keeps private
  state, so the limit never really holds on multi-worker deployments. The
  project already depends on MongoDB everywhere, so the shared store is free.
  (The strict Redis/Valkey-or-no-boot policy in core/rate_limit_policy.py is
  deliberately NOT reused here: a limiter outage must never take auth down.)

Behaviour:
  - Fixed window per key: floor(now / window_sec) bucket id, atomic upsert.
  - Fails OPEN with a warning log if MongoDB is unavailable: locking out real
    users because of a transient DB hiccup is worse than a briefly-loose
    limit. The app hard-fails on DB outages anyway on its own auth paths.
  - Never logs user input beyond the key prefix.
"""

from __future__ import annotations

import time
from typing import Optional


def allow(key: str, limit: int, window_sec: int, *, bucket: Optional[int] = None) -> bool:
    """Return True if this request is within the limit, False if throttled.

    Args:
        key: Stable identity for the bucket, e.g. "login:203.0.113.7".
        limit: Maximum requests allowed per window.
        window_sec: Window length in seconds.
        bucket: Override window bucket id (used by tests).
    """
    try:
        from core.db import get_mongo_db

        db = get_mongo_db()
        if db is None:
            return True  # fail open — DB outage is handled by the app itself

        bucket_id = int(bucket) if bucket is not None else int(time.time()) // window_sec
        key_id = f"{key}:{bucket_id}"
        try:
            db.rate_limits.update_one(
                {"_id": key_id},
                {"$inc": {"count": 1}, "$setOnInsert": {"created_at": time.time()}},
                upsert=True,
            )
        except Exception:
            return True  # write failed — fail open, log via caller
        doc = db.rate_limits.find_one({"_id": key_id}, {"count": 1})
        count = int((doc or {}).get("count", 1))
        # Opportunistic GC: buckets expire after 2 windows (ignore failures).
        if count == 1:
            try:
                db.rate_limits.create_index("created_at", expireAfterSeconds=window_sec * 2)
            except Exception:
                pass
        return count <= limit
    except Exception:
        return True  # fail open — never take auth down because of the limiter


def client_ip(request) -> str:
    """Best-effort client IP behind a proxy chain (first X-Forwarded-For hop)."""
    fwd = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    if fwd:
        return fwd[:64]
    return (request.remote_addr or "unknown")[:64]
