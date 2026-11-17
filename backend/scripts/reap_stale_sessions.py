"""
Stale interview / aptitude session reaper (ops script).

Finds sessions that are stuck in progress past their deadline and marks them
EXPIRED so they stop polluting dashboards, wallets and counters.
Zero-turn sessions are voided (₹0, demo quota restored) — service was never
delivered, so no charge may ever be applied.

Usage:
    cd backend
    python scripts/reap_stale_sessions.py            # dry run (lists only)
    python scripts/reap_stale_sessions.py --apply    # apply changes

Idempotent. Designed to be run by cron / Task Scheduler daily.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if os.path.exists(os.path.join(ROOT_DIR, ".env")):
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
else:
    load_dotenv(os.path.join(BASE_DIR, ".env"))

from core.db import get_mongo_db  # noqa: E402
from core.wallet import settle_interview_billing_completion  # noqa: E402

STALE_AFTER_MINUTES = int(os.getenv("REAPER_STALE_MINUTES", "90"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="apply changes (default is dry-run)")
    parser.add_argument("--stale-minutes", type=int, default=STALE_AFTER_MINUTES)
    args = parser.parse_args()

    db = get_mongo_db()
    if db is None:
        print("[REAPER] no DB connection — aborting")
        return 1

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=args.stale_minutes)

    stale = list(db.interview_sessions.find(
        {"status": "in_progress", "updated_at": {"$lt": cutoff.isoformat()}},
        {"_id": 0, "id": 1, "session_id": 1, "status": 1, "answered_turns": 1, "updated_at": 1},
    ))
    print(f"[REAPER] stale in_progress sessions older than {args.stale_minutes}m: {len(stale)}")

    voided = settled = 0
    for s in stale:
        sid = s.get("id") or s.get("session_id")
        if not sid:
            continue
        answered = s.get("answered_turns") or 0
        print(f"  - session {sid} answered_turns={answered} updated_at={s.get('updated_at')}")
        if not args.apply:
            continue
        session_doc = db.interview_sessions.find_one(
            {"$or": [{"id": sid}, {"_id": sid}, {"session_id": sid}]}
        )
        if not session_doc:
            continue
        if answered < 1:
            db.interview_sessions.update_one(
                {"$or": [{"id": sid}, {"_id": sid}, {"session_id": sid}]},
                {"$set": {
                    "status": "expired",
                    "state": "EXPIRED",
                    "completed_reason": "reaper_zero_turns",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            try:
                settle_interview_billing_completion(sid, {**session_doc, "answered_turns": 0, "status": "expired"})
            except Exception as e:
                print(f"    [warn] zero-turn void settle failed for {sid}: {e}")
            voided += 1
        else:
            db.interview_sessions.update_one(
                {"$or": [{"id": sid}, {"_id": sid}, {"session_id": sid}]},
                {"$set": {
                    "status": "completed",
                    "state": "COMPLETED",
                    "completed_reason": "reaper_expired",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
            try:
                settle_interview_billing_completion(sid, session_doc)
            except Exception as e:
                print(f"    [warn] settle failed for {sid}: {e}")
            settled += 1

    # Stale aptitude attempts: mark abandoned so history stops showing 'in_progress'
    apt_cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    apt = list(db.aptitude_attempts.find(
        {"status": "in_progress", "startedAt": {"$lt": apt_cutoff}},
        {"_id": 0, "sessionId": 1, "startedAt": 1},
    ))
    print(f"[REAPER] stale aptitude attempts older than 7d: {len(apt)}")
    if args.apply and apt:
        db.aptitude_attempts.update_many(
            {"status": "in_progress", "startedAt": {"$lt": apt_cutoff}},
            {"$set": {"status": "abandoned",
                      "updatedAt": datetime.now(timezone.utc).isoformat()}},
        )

    if not args.apply:
        print("[REAPER] dry-run complete — re-run with --apply to apply changes")
    else:
        print(f"[REAPER] done: voided={voided} completed={settled}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
