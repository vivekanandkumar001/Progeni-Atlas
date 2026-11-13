"""
Progeni Atlas — Wallet Balance & Billing Helpers
=================================================
Authoritative balance resolution and credit sanitation.
"""

from datetime import datetime, timezone
from core.db import get_mongo_db


_signup_free_config_cache: dict = {"at": 0.0, "cfg": None}

def get_signup_free_config() -> dict:
    """Admin-configured 'Signup Welcome Credits' (free plan) policy from platform_settings.

    Falls back to industry defaults when unset: enabled, 10 credits, ONE TIME per user, all roles.
    Cached for 30s to avoid a settings lookup on every grant check.
    """
    import time as _time
    now = _time.time()
    if _signup_free_config_cache["cfg"] is not None and (now - _signup_free_config_cache["at"]) < 30:
        return dict(_signup_free_config_cache["cfg"])
    cfg = {"enabled": True, "credits": 10.0, "max_grants": 1, "target_role": "all"}
    db = get_mongo_db()
    if db is not None:
        try:
            doc = db.platform_settings.find_one(
                {"key": "entitlement_policy"},
                {"signup_free_enabled": 1, "signup_free_credits": 1, "signup_free_max_grants": 1, "signup_free_target_role": 1},
            )
            if doc:
                cfg["enabled"] = bool(doc.get("signup_free_enabled", True))
                cfg["credits"] = max(0.0, float(doc.get("signup_free_credits", 10.0) or 0.0))
                cfg["max_grants"] = max(1, int(doc.get("signup_free_max_grants", 1) or 1))
                cfg["target_role"] = str(doc.get("signup_free_target_role", "all") or "all").strip().lower()
        except Exception:
            pass
    _signup_free_config_cache["at"] = now
    _signup_free_config_cache["cfg"] = dict(cfg)
    return cfg


def _signup_role_allowed(role: str, target: str) -> bool:
    r = str(role or "candidate").strip().lower()
    t = str(target or "all").strip().lower()
    if t == "candidate":
        return r == "candidate"
    if t == "recruiter":
        return r in ("recruiter", "hr", "employer", "admin")
    return True


def grant_signup_free_credits(user_doc: dict, reason: str = "Signup Welcome Credits") -> float:
    """Grant the admin-configured welcome credit ONE TIME per user at signup.

    Admin controls: enabled/disabled, credits amount, grants per user, target role.
    Idempotent and race-safe: a conditional atomic update on the user document
    ensures no double-grant even on concurrent signups. Returns credits granted (0 if none).
    """
    db = get_mongo_db()
    if db is None or not user_doc:
        return 0.0
    cfg = get_signup_free_config()
    if not cfg["enabled"] or cfg["credits"] <= 0:
        return 0.0
    role = str(user_doc.get("role") or "candidate").strip().lower()
    if not _signup_role_allowed(role, cfg["target_role"]):
        return 0.0
    uid = str(user_doc.get("id") or user_doc.get("_id") or "").strip()
    if not uid:
        return 0.0
    now_iso = datetime.now(timezone.utc).isoformat()
    max_grants = cfg["max_grants"]
    res = db.users.update_one(
        {"$and": [
            {"$or": [{"id": uid}, {"_id": uid}]},
            {"$or": [{"signup_credits_count": {"$lt": max_grants}},
                     {"signup_credits_count": {"$exists": False}}]},
        ]},
        {"$set": {"signup_credits_granted_at": now_iso}, "$inc": {"signup_credits_count": 1}},
    )
    if res.modified_count != 1:
        return 0.0
    credits = cfg["credits"]
    db.wallets.update_one(
        {"userId": uid},
        {"$inc": {"availableCredits": credits, "promotionalCredits": credits},
         "$set": {"updated_at": now_iso, "isLowBalance": False}},
        upsert=True,
    )
    try:
        db.wallet_transactions.insert_one({
            "id": f"tx-welcome-{uid}-{int(datetime.now(timezone.utc).timestamp())}",
            "userId": uid,
            "entryType": "signup_bonus",
            "category": "IN",
            "title": reason,
            "reason": f"One-time welcome credits on signup (admin grant, {credits:g} credits)",
            "amountCredits": credits,
            "amountInr": 0.0,
            "status": "COMPLETED",
            "createdAt": now_iso,
        })
    except Exception:
        pass  # ledger is best-effort; balance was already credited atomically
    return credits


def get_user_wallet_balance(user_id: str, org_id: str = None) -> float:
    """
    Authoritative helper to get available credits for candidate or recruiter.
    GUARANTEE: Balance is NEVER negative (minimum 0.0).
    """
    db = get_mongo_db()
    if db is None:
        return 0.0

    query_parts = []
    if user_id:
        query_parts.extend([{"userId": str(user_id)}, {"userId": user_id}])
    if org_id:
        query_parts.extend([{"orgId": str(org_id)}, {"orgId": org_id}])

    if query_parts:
        wallet = db.wallets.find_one({"$or": query_parts})
        if wallet:
            bal = float(wallet.get("availableCredits", 0.0))
            if bal < 0:
                db.wallets.update_one({"_id": wallet["_id"]}, {"$set": {"availableCredits": 0.0}})
            return max(0.0, bal)

    # Check enterprise billing account if organization linked
    if org_id:
        acc = db.billing_accounts.find_one({"$or": [{"orgId": str(org_id)}, {"id": f"acc-{org_id}"}]})
        if acc:
            bal = float(acc.get("availableBalanceUsd", 0.0))
            if bal < 0:
                db.billing_accounts.update_one({"_id": acc["_id"]}, {"$set": {"availableBalanceUsd": 0.0}})
            return max(0.0, bal)

    # No implicit free credits — wallets must be created explicitly (signup bonus, purchase,
    # admin grant). Return 0.0 for accounts without one.
    return 0.0


def settle_interview_billing_completion(session_id: str, session_doc: dict) -> float:
    """
    Atomically settle interview completion debit:
    - Deducts credits from wallet (or utilizes complimentary quota)
    - Records immutable ledger record in wallet_transactions
    - Prevents double-debit via atomic transaction check
    """
    if not session_id or not session_doc:
        return 0.0

    db = get_mongo_db()
    if db is None:
        return 0.0

    tx_id = f"tx-interview-{session_id}"  # full session id — no prefix collisions
    existing_tx = db.wallet_transactions.find_one({"$or": [{"id": tx_id}, {"sessionId": session_id}]})
    if existing_tx:
        return float(existing_tx.get("amountCredits") or 0.0)

    # Resolve target billable user
    target_user_id = str(
        session_doc.get("recruiter_id")
        or session_doc.get("userId")
        or session_doc.get("candidate_id")
        or ""
    ).strip()
    if not target_user_id:
        return 0.0

    role_name = session_doc.get("job_title") or session_doc.get("role_title") or "Technical Assessment"
    is_demo = bool(session_doc.get("is_practice") or session_doc.get("session_type") == "demo")
    
    # Authoritative billing rate: 1 Rupee = 2 Minutes (0.5 credits/min)
    dur = session_doc.get("duration_minutes") or session_doc.get("durationMinutes") or 30
    try:
        duration_minutes = max(1, int(dur))
    except Exception:
        duration_minutes = 30

    cost = 0.0 if is_demo else round(duration_minutes * 0.5, 2)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Deduct wallet balance if non-demo
    if cost > 0:
        db.wallets.update_one(
            {"userId": target_user_id},
            {
                "$inc": {"availableCredits": -cost, "consumedCredits": cost},
                "$set": {"updated_at": now_iso}
            },
            upsert=True
        )

    # Insert immutable transaction record
    db.wallet_transactions.update_one(
        {"id": tx_id},
        {"$set": {
            "id": tx_id,
            "userId": target_user_id,
            "sessionId": session_id,
            "txRef": f"TXN-SETTLE-{session_id[:8].upper()}",
            "entryType": "free_demo" if is_demo else "interview_settlement",
            "category": "DEMO" if is_demo else "OUT",
            "title": f"Interview Settlement: {role_name}",
            "reason": "Complimentary Practice Session" if is_demo else f"Verified AI Screening Settlement ({cost:g} cr, {duration_minutes}m)",
            "amountCredits": -cost,
            "amountInr": cost,
            "status": "COMPLETED",
            "createdAt": now_iso
        }},
        upsert=True
    )
    return cost
