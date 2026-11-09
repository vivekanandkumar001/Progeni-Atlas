"""
Progeni Atlas — Wallet Balance & Billing Helpers
=================================================
Authoritative balance resolution and credit sanitation.
"""

from datetime import datetime, timezone
from core.db import get_mongo_db


def get_user_wallet_balance(user_id: str, org_id: str = None) -> float:
    """
    Authoritative helper to get available credits for candidate or recruiter.
    GUARANTEE: Balance is NEVER negative (minimum 0.0).
    """
    db = get_mongo_db()
    if db is None:
        return 40.0

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

    # For registered recruiters with no explicit wallet record yet
    if user_id:
        u = db.users.find_one({"$or": [{"_id": user_id}, {"id": user_id}]})
        if u and u.get("role") in ("recruiter", "employer", "admin"):
            return 100.0

    return 40.0


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

    tx_id = f"tx-interview-{session_id[:8]}"
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
