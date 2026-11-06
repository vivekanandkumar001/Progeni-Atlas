"""
Progeni Atlas — Wallet Balance & Billing Helpers
=================================================
Authoritative balance resolution and credit sanitation.
"""

from core.db import get_mongo_db


def get_user_wallet_balance(user_id: str, org_id: str = None) -> float:
    """
    Authoritative helper to get available credits for candidate or recruiter.
    GUARANTEE: Balance is NEVER negative (minimum 0.0).
    """
    db = get_mongo_db()
    if db is None:
        return 40.0

    try:
        db.wallets.update_many({"availableCredits": {"$lt": 0}}, {"$set": {"availableCredits": 0.0}})
        db.billing_accounts.update_many({"availableBalanceUsd": {"$lt": 0}}, {"$set": {"availableBalanceUsd": 0.0}})
        db.billing_accounts.update_many({"availableBalanceNanoUsd": {"$lt": 0}}, {"$set": {"availableBalanceNanoUsd": 0}})
    except Exception:
        pass

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
