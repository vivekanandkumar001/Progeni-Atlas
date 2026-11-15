"""
Lightweight wallet/credit abuse anomaly detector.

Attached to the single credit-burn hotspot (settle_interview_billing_completion).
Every debit increments a fixed-window counter per user; thresholds trip a
`platform_security_alerts` collection entry that the super-admin console can
display. This detects, cheaply and without touching billing semantics:

  credit_burst   — one wallet spends >25 credits in 60 minutes (≈ more than
                   50 interview-minutes; typically scripted/farming abuse)
  demo_flood     — one account burns >10 complimentary/demo sessions in
                   60 minutes (free-tier farming, e.g. for referral rewards)

Design rules:
  * Additive only — never raises, never blocks a legitimate settle.
  * Mongo is already the project's source of truth; counters use a plain
    fixed window per (user, hour) bucket and expire after 24h.
  * Alerts carry no PII beyond the caller-scoped user id and session id.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

from core.db import get_mongo_db

CREDIT_BURST_LIMIT = 25.0   # credits per 60-minute window
DEMO_FLOOD_LIMIT = 10       # complimentary sessions per 60-minute window


def note_debit(user_id: str, credits: float, session_id: str, *, is_demo: bool) -> None:
    try:
        if not user_id:
            return
        db = get_mongo_db()
        if db is None:
            return

        now = time.time()
        window = int(now) // 3600
        credits = max(0.0, float(credits or 0.0))

        doc = db.platform_anomaly_counters.find_one_and_update(
            {"_id": f"{user_id}:{window}"},
            {
                "$inc": {"credits": credits, "sessions": 1, "demos": 1 if is_demo else 0},
                "$setOnInsert": {"userId": str(user_id), "windowEnd": (window + 1) * 3600},
            },
            upsert=True,
        )
        bucket = None
        # Re-read for the post-update value (BEFORE vs AFTER semantics vary).
        try:
            bucket = db.platform_anomaly_counters.find_one(
                {"_id": f"{user_id}:{window}"},
                {"credits": 1, "sessions": 1, "demos": 1},
            )
        except Exception:
            bucket = doc

        spent = float((bucket or {}).get("credits", credits))
        demos = int((bucket or {}).get("demos", 1 if is_demo else 0))

        alerts = []
        if spent > CREDIT_BURST_LIMIT:
            alerts.append({
                "type": "credit_burst",
                "detail": f"wallet spent {spent:.2f} credits in 60 minutes (limit {CREDIT_BURST_LIMIT})",
            })
        if demos > DEMO_FLOOD_LIMIT:
            alerts.append({
                "type": "demo_flood",
                "detail": f"account consumed {demos} complimentary/demo sessions in 60 minutes (limit {DEMO_FLOOD_LIMIT})",
            })

        for a in alerts:
            try:
                db.platform_security_alerts.update_one(
                    {"type": a["type"], "userId": str(user_id), "window": window},
                    {
                        "$set": {
                            "detail": a["detail"],
                            "credits": spent,
                            "demos": demos,
                            "sessionId": str(session_id),
                            "createdAt": datetime.fromtimestamp(now, tz=timezone.utc).isoformat(),
                            "status": "new",
                        }
                    },
                    upsert=True,
                )
                print(f"[SECURITY-ANOMALY] {a['type']} user={user_id} detail={a['detail']}")
            except Exception:
                pass  # never disrupt billing because of alerting
        # Best-effort GC of stale counter buckets.
        try:
            db.platform_anomaly_counters.create_index("windowEnd", expireAfterSeconds=86400)
        except Exception:
            pass
    except Exception:
        # Absolute last line of defence: monitoring must never break billing.
        pass


def recent_alerts(limit: int = 50) -> list[dict]:
    """Read-only helper for the super-admin console."""
    try:
        db = get_mongo_db()
        if db is None:
            return []
        return list(
            db.platform_security_alerts.find({}, {"_id": 0}).sort("createdAt", -1).limit(max(1, min(200, int(limit or 50))))
        )
    except Exception:
        return []
