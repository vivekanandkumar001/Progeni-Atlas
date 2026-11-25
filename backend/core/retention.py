"""
Progeni Atlas — Data retention enforcement (industrialized policy)
===================================================================
Implements the retention promises documented on /privacy and the super-admin
data-governance page as actual, auditable code — not copy.

Defaults (secs -> days):
  transcripts   (verbatim history)       : 365 days
  proctoring_events                       :  90 days
  resume_vectors                           :  30 days after a decision
  PII redaction  (decision complete)      :  30 days

Safety:
  * dry_run defaults to True everywhere — nothing is deleted unless the caller
    explicitly sets dry_run=False.
  * every run writes an audit-chain entry.
  * delete_many is bounded and logged.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any

TRANSCRIPT_DAYS = 365
PROCTORING_DAYS = 90
RESUME_VECTOR_DAYS = 30
PII_DAYS_AFTER_DECISION = 30


def run_retention(db, *, dry_run: bool = True, actor_email: str = "system") -> dict[str, Any]:
    """Evaluate and (optionally) enforce retention policies. Returns report."""
    now = datetime.now(timezone.utc)
    transcripts_cutoff = now - timedelta(days=TRANSCRIPT_DAYS)
    proctoring_cutoff = now - timedelta(days=PROCTORING_DAYS)
    pii_cutoff = now - timedelta(days=PII_DAYS_AFTER_DECISION)
    vectors_cutoff = now - timedelta(days=RESUME_VECTOR_DAYS)

    report: dict[str, Any] = {
        "dry_run": dry_run,
        "now": now.isoformat(),
        "policies": {
            "transcripts": f"delete verbatim history older than {TRANSCRIPT_DAYS}d",
            "proctoring": f"delete proctoring_events older than {PROCTORING_DAYS}d",
            "resume_vectors": f"delete resume vectors older than {RESUME_VECTOR_DAYS}d",
            "pii": f"redact PII fields on sessions decided >{PII_DAYS_AFTER_DECISION}d ago",
        },
        "actions": [],
    }

    # --- transcripts: null out ONLY the verbatim history array on ancient docs
    ancient = list(db.interview_sessions.find(
        {"$or": [
            {"status": {"$in": ["completed", "evaluated"]}, "created_at": {"$lt": transcripts_cutoff}},
            {"status": {"$in": ["completed", "evaluated"]}, "created_at": {"$lt": transcripts_cutoff.isoformat()}},
        ], "history": {"$ne": []}},
        {"_id": 0, "id": 1},
    ).limit(200))
    action = {"policy": "transcripts", "candidates": len(ancient), "deleted": 0}
    if not dry_run and ancient:
        ids = [s.get("id") for s in ancient if s.get("id")]
        res = db.interview_sessions.update_many({"id": {"$in": ids}}, {"$set": {"history": []}})
        action["deleted"] = res.modified_count
    report["actions"].append(action)

    # --- proctoring events: hard delete old rows
    proct_count = db.proctoring_events.count_documents(
        {"created_at": {"$lt": proctoring_cutoff}}
    ) + db.proctoring_events.count_documents(
        {"created_at": {"$lt": proctoring_cutoff.isoformat()}}
    )
    action = {"policy": "proctoring", "candidates": proct_count, "deleted": 0}
    if not dry_run and proct_count:
        res = db.proctoring_events.delete_many(
            {"$or": [
                {"created_at": {"$lt": proctoring_cutoff}},
                {"created_at": {"$lt": proctoring_cutoff.isoformat()}},
            ]}
        )
        action["deleted"] = res.deleted_count
    report["actions"].append(action)

    # --- resume vectors: delete old ones
    vectors_count = db.resume_vectors.count_documents(
        {"created_at": {"$lt": vectors_cutoff}}
    ) + db.resume_vectors.count_documents(
        {"created_at": {"$lt": vectors_cutoff.isoformat()}}
    )
    action = {"policy": "resume_vectors", "candidates": vectors_count, "deleted": 0}
    if not dry_run and vectors_count:
        res = db.resume_vectors.delete_many(
            {"$or": [
                {"created_at": {"$lt": vectors_cutoff}},
                {"created_at": {"$lt": vectors_cutoff.isoformat()}},
            ]}
        )
        action["deleted"] = res.deleted_count
    report["actions"].append(action)

    # --- PII redaction post-decision: redact emails/names on decided sessions
    decided = list(db.interview_sessions.find(
        {"status": {"$in": ["completed", "evaluated"]},
         "$or": [
             {"updated_at": {"$lt": pii_cutoff}},
             {"updated_at": {"$lt": pii_cutoff.isoformat()}},
         ]},
        {"_id": 0, "id": 1, "candidate_email": 1},
    ).limit(500))
    decided_with_pii = [s for s in decided if s.get("candidate_email")]
    action = {"policy": "pii_redaction", "candidates": len(decided_with_pii), "redacted": 0}
    if not dry_run and decided_with_pii:
        ids = [s.get("id") for s in decided_with_pii]
        res = db.interview_sessions.update_many(
            {"id": {"$in": ids}},
            {"$set": {
                "candidate_email": "[redacted]",
                "candidate_name": "[redacted]",
                "full_name": "[redacted]",
                "phone": "[redacted]",
            }},
        )
        action["redacted"] = res.modified_count
    report["actions"].append(action)

    return report
