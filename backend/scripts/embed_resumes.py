"""
Backfill resume embeddings for semantic search.

Run from the backend/ directory:
    python scripts/embed_resumes.py            # embed everything missing/stale
    python scripts/embed_resumes.py --limit 25 # embed at most 25 docs

Idempotent: documents whose text hash matches resume_vectors.hash are skipped.
Estimated cost: ~1-2 paise per resume (OpenAI text-embedding-3-small).
"""

import argparse
import sys
import time

sys.path.insert(0, ".")

from app.config import settings  # noqa: F401  (loads .env)
from core.db import get_mongo_db
from core.semantic_search import reindex_active_resumes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=500, help="max resumes to embed in this run")
    args = parser.parse_args()

    db = get_mongo_db()
    if db is None:
        print("ERROR: MongoDB unavailable (MONGO_URI not set or cluster down)")
        return 2

    active = db.candidate_resumes.count_documents({"is_active": True, "parsed_text": {"$exists": True, "$ne": ""}})
    print(f"Active parseable resumes: {active}")
    if active == 0:
        print("Nothing to embed yet — resumes will be embedded automatically on upload.")
        return 0

    t0 = time.time()
    stats = reindex_active_resumes(limit=args.limit)
    elapsed = time.time() - t0
    print(f"Done in {elapsed:.1f}s — scanned={stats['scanned']} embedded={stats['embedded']} skipped={stats['skipped']} failed={stats['failed']}")
    return 0 if stats["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
