"""
One-off / ops migration runner.

The application's boot path (core.db.init_mongo_db) is intentionally light for
serverless cold starts. This script performs the heavy one-time work:

  1. Creates / refreshes the full index set.
  2. De-duplicates user accounts that share a normalized email.
  3. Syncs the canonical package catalog.
  4. Ensures the platform super-admin account exists.

Usage:
    cd backend
    python scripts/migrate_db.py

Safe to re-run; every step is idempotent.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if os.path.exists(os.path.join(ROOT_DIR, ".env")):
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
else:
    load_dotenv(os.path.join(BASE_DIR, ".env"))

from core.db import (  # noqa: E402
    get_mongo_db,
    ensure_indexes,
    dedupe_user_emails,
    sync_canonical_packages,
    ensure_super_admin,
)


def main() -> int:
    db = get_mongo_db()
    if db is None:
        print("[migrate] ERROR: could not reach MongoDB (check MONGO_URI).")
        return 1

    print("[migrate] 1/4 ensuring indexes...")
    ensure_indexes(db)

    print("[migrate] 2/4 deduplicating user emails...")
    dedupe_user_emails(db)

    print("[migrate] 3/4 syncing canonical packages...")
    sync_canonical_packages(db)

    print("[migrate] 4/4 ensuring super-admin account...")
    ensure_super_admin(db)

    print("[migrate] done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
