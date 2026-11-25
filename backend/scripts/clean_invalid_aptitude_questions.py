"""
Quarantine invalid generated aptitude questions in MongoDB.

This is an OPT-IN maintenance script. It is a dry run by default; nothing is
written unless --apply is passed explicitly. It uses the exact same validator
as generation and request-time serving, so the cleanup cannot disagree with
what the application considers a valid item.

Usage:
    cd backend
    python scripts/clean_invalid_aptitude_questions.py            # dry run
    python scripts/clean_invalid_aptitude_questions.py --apply    # quarantine + remove
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
if os.path.exists(os.path.join(ROOT_DIR, ".env")):
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
else:
    load_dotenv(os.path.join(BASE_DIR, ".env"))

from core.aptitude_generator import validate_question_item  # noqa: E402
from core.db import get_mongo_db  # noqa: E402


SOURCE_COLLECTION = "aptitude_generated_bank"
QUARANTINE_COLLECTION = "aptitude_invalid_questions"


def find_invalid_questions(db) -> list[dict]:
    """Return (source document, validation errors) for every invalid row."""
    invalid: list[dict] = []
    for doc in db[SOURCE_COLLECTION].find({}):
        ok, errors = validate_question_item(doc)
        if not ok:
            invalid.append({"doc": doc, "errors": errors})
    return invalid


def quarantine_and_remove(db, invalid: list[dict]) -> tuple[int, int]:
    """Move invalid rows to the quarantine collection, then delete originals."""
    quarantined = 0
    removed = 0
    now = datetime.now(timezone.utc).isoformat()
    for row in invalid:
        doc = row["doc"]
        record = dict(doc)
        record.pop("_id", None)
        record.update({
            "sourceCollection": SOURCE_COLLECTION,
            "sourceId": str(doc.get("_id") or doc.get("id") or ""),
            "validationErrors": row["errors"],
            "quarantinedAt": now,
        })
        db[QUARANTINE_COLLECTION].update_one(
            {"sourceCollection": SOURCE_COLLECTION, "sourceId": record["sourceId"]},
            {"$set": record},
            upsert=True,
        )
        quarantined += 1

        if doc.get("_id") is not None:
            deleted = db[SOURCE_COLLECTION].delete_one({"_id": doc["_id"]}).deleted_count
        elif doc.get("id"):
            deleted = db[SOURCE_COLLECTION].delete_one({"id": doc["id"]}).deleted_count
        else:
            deleted = 0
        removed += int(deleted or 0)
    return quarantined, removed


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually quarantine and remove invalid rows (default: dry run only).",
    )
    args = parser.parse_args()

    db = get_mongo_db()
    if db is None:
        print("[aptitude-clean] ERROR: could not reach MongoDB (check MONGO_URI).")
        return 1

    invalid = find_invalid_questions(db)
    total = db[SOURCE_COLLECTION].count_documents({})
    print(f"[aptitude-clean] scanned {total} generated question(s); {len(invalid)} invalid.")
    for row in invalid[:10]:
        doc = row["doc"]
        print(f"  - {doc.get('id') or doc.get('_id')}: {row['errors']} | {str(doc.get('prompt', ''))[:90]}")

    if not args.apply:
        print("[aptitude-clean] DRY RUN — no writes performed. Re-run with --apply to clean.")
        return 0

    quarantined, removed = quarantine_and_remove(db, invalid)
    print(f"[aptitude-clean] quarantined {quarantined}, removed {removed}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
