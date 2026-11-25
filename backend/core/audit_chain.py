"""
Progeni Atlas — Hash-chained audit log (EU AI Act Article 12 evidence)
==================================================================
Append-only tamper-evidence for the ``audit_logs`` collection.

Every NEW event written through :func:`chain_append` carries:
  seq        — monotonically increasing integer (new-style chain starts at 1)
  prev_hash  — auditHash of the previous new-style event ("GENESIS" at the root)
  auditHash  — SHA-256 of (sorted-json payload + prev_hash)

Legacy (pre-chaining) documents have no seq/auditHash and are left untouched;
``verify_chain`` reports them as ``legacy_unchained`` count so auditors can see
the chain boundary honestly.
"""

from __future__ import annotations

import hashlib
import json
import threading
from datetime import datetime, timezone

_index_lock = threading.Lock()
_index_ready = False


def _ensure_chain_index(coll) -> None:
    """Unique seq index so racing workers collapse instead of duplicating."""
    global _index_ready
    if _index_ready:
        return
    with _index_lock:
        if _index_ready:
            return
        try:
            # partial filter: only new-style chained docs participate, so legacy
            # (pre-chaining) documents, which lack seq, cannot collide.
            coll.create_index(
                "seq",
                unique=True,
                partialFilterExpression={"auditHash": {"$type": "string"}},
                name="audit_chain_seq_1",
            )
            _index_ready = True
        except Exception:
            pass


def _normalize_ts(ts):
    if ts is None:
        return "UNSET"
    if isinstance(ts, datetime):
        if ts.tzinfo is not None:
            ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
        # Mongo stores datetime at millisecond precision and truncates on write;
        # mirror that here so payload hashes round-trip unchanged.
        return ts.replace(microsecond=(ts.microsecond // 1000) * 1000).isoformat(timespec="microseconds")
    return str(ts)


def _payload(seq: int, doc: dict) -> dict:
    return {
        "seq": seq,
        "timestamp": _normalize_ts(doc.get("created_at")),
        "action": doc.get("action"),
        "user_id": doc.get("user_id"),
        "user_email": doc.get("user_email"),
        "entity_type": doc.get("entity_type"),
        "entity_id": doc.get("entity_id"),
        "detail": doc.get("detail"),
    }


def chain_append(coll, doc: dict) -> dict:
    """Append ``doc`` to the chain atomically enough for a Flask process.

    Reads the tail inside the same request that writes — acceptable for
    moderate write rates; if two gunicorn workers race, the unique index
    collapses the loser (never duplicates).
    """
    # Normalize the doc so it is verifiable later: the payload digest depends
    # on doc fields, so they must be frozen on the stored document. Mongo
    # truncates datetime to millisecond precision on write, so mirror it.
    ts = doc.get("created_at")
    if isinstance(ts, datetime):
        if ts.tzinfo is not None:
            ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
        doc["created_at"] = ts.replace(microsecond=(ts.microsecond // 1000) * 1000)
    _ensure_chain_index(coll)
    last = coll.find_one(
        {"auditHash": {"$exists": True}},
        sort=[("seq", -1)],
        projection={"seq": 1, "auditHash": 1},
    )
    seq = (int(last.get("seq")) if last else 0) + 1
    prev_hash = str(last.get("auditHash")) if last else "GENESIS"

    payload = _payload(seq, doc)
    digest = hashlib.sha256(
        (json.dumps(payload, sort_keys=True, default=str) + prev_hash).encode("utf-8")
    ).hexdigest()

    doc = {
        **doc,
        "seq": seq,
        "prev_hash": prev_hash,
        "auditHash": digest,
        "chained_at": datetime.now(timezone.utc).isoformat(),
    }
    coll.insert_one(doc)
    return doc


def verify_chain(docs: list[dict]) -> dict:
    """Verify chained events ``docs`` (any order); returns a report dict.

    ``docs`` should contain ONLY new-style events (auditHash present); legacy
    documents are excluded up front.
    """
    chained = [d for d in docs if d.get("auditHash")]
    chained.sort(key=lambda d: int(d.get("seq") or 0))

    expected_prev = "GENESIS"
    broken_at = None
    ok = 0
    for d in chained:
        payload = _payload(int(d.get("seq") or 0), d)
        digest = hashlib.sha256(
            (json.dumps(payload, sort_keys=True, default=str) + expected_prev).encode("utf-8")
        ).hexdigest()
        if digest != d.get("auditHash"):
            broken_at = int(d.get("seq") or 0)
            break
        expected_prev = str(d.get("auditHash"))
        ok += 1

    return {
        "verified": broken_at is None,
        "chained_events_checked": ok,
        "broken_at_seq": broken_at,
        "legacy_unchained": len(docs) - len(chained),
    }
