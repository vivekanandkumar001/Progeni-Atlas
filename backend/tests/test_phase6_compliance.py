"""
Phase 6 — compliance subsystems: hash-chained audit log + retention job.

No MongoDB, no network. A tiny in-memory fake collection exercises the
verification and dry-run logic end-to-end.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.audit_chain import chain_append, verify_chain  # noqa: E402
from core.retention import run_retention  # noqa: E402


# ------------------------------------------------------------------ fake db
class FakeCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def insert_one(self, doc):
        self.docs.append(dict(doc))
        return type("InsertResult", (), {"inserted_id": doc.get("seq", 1)})()

    def find_one(self, query=None, sort=None, projection=None):
        docs = list(self.docs)
        if query:
            if "auditHash" in query:
                if not query["auditHash"].get("$exists"):
                    docs = [d for d in docs if d.get("auditHash") is None]
            if query.get("$or"):
                pass
        if sort:
            for key, direction in reversed(sort):
                docs.sort(key=lambda d: d.get(key) or 0, reverse=(direction == -1))
        if projection:
            proj = dict(projection or {})
            keep = {k for k, v in proj.items() if v == 1}
            exclude_id = proj.get("_id") == 0
            docs = [self._project(d, keep, exclude_id) for d in docs]
        return docs[0] if docs else None

    @staticmethod
    def _project(d, keep, exclude_id):
        if keep:
            out = {k: d.get(k) for k in keep}
        else:
            out = dict(d)
        if exclude_id:
            out.pop("_id", None)
        return out

    def find(self, query=None, projection=None):
        docs = list(self.docs)
        if projection and projection.get("_id") == 0:
            drop = True
            docs = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
        else:
            docs = list(docs)
        return _FakeCursor(docs)

    def count_documents(self, query):
        return len(self.docs)

    def update_many(self, query, update):
        n = 0
        data = update.get("$set", {})
        for d in self.docs:
            d.update(data)
            n += 1
        return type("UpdateResult", (), {"modified_count": n})()

    def delete_many(self, query):
        n = len(self.docs)
        self.docs.clear()
        return type("DeleteResult", (), {"deleted_count": n})()


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, key, direction):
        self.docs.sort(key=lambda d: d.get(key) or 0)
        if direction == -1:
            self.docs.reverse()
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    def __iter__(self):
        return iter(self.docs)

    def __len__(self):
        return len(self.docs)


class FakeDB:
    def __init__(self):
        self.audit_logs = FakeCollection()
        self.interview_sessions = FakeCollection()
        self.proctoring_events = FakeCollection()
        self.resume_vectors = FakeCollection()


def test_chain_append_sequence():
    coll = FakeCollection()
    docs = []
    for i in range(5):
        d = chain_append(coll, {"action": f"a{i}", "entity_id": f"e{i}"})
        docs.append(d)
    assert [d["seq"] for d in docs] == [1, 2, 3, 4, 5]
    assert docs[0]["prev_hash"] == "GENESIS"
    assert docs[1]["prev_hash"] == docs[0]["auditHash"]


def test_verify_chain_passes_after_append():
    coll = FakeCollection()
    docs = [chain_append(coll, {"action": f"a{i}"}) for i in range(6)]
    report = verify_chain(docs)
    assert report["verified"] is True
    assert report["chained_events_checked"] == 6
    assert report["broken_at_seq"] is None


def test_verify_chain_detects_tampering():
    coll = FakeCollection()
    docs = [chain_append(coll, {"action": f"a{i}", "entity_id": f"e{i}"}) for i in range(4)]
    # Attacker edits the entity_id of seq=3
    docs[2]["entity_id"] = "HACKED"
    report = verify_chain(docs)
    assert report["verified"] is False
    assert report["broken_at_seq"] == 3


def test_verify_chain_ignores_legacy_docs():
    coll = FakeCollection()
    docs = [chain_append(coll, {"action": "x"})]
    legacy = {"action": "old", "entity_id": "legacy"}  # no seq / no auditHash
    report = verify_chain(docs + [legacy])
    assert report["verified"] is True
    assert report["legacy_unchained"] == 1


def test_verify_tolerates_mongo_millisecond_truncation():
    from datetime import datetime, timezone

    coll = FakeCollection()
    chain_append(coll, {
        "action": "audit.ms_test",
        "created_at": datetime(2026, 11, 18, 19, 20, 0, 123456, tzinfo=timezone.utc),
    })
    chain_append(coll, {"action": "audit.ms_test_2"})
    # simulate Mongo round-trip: microseconds truncated to milliseconds on write
    for d in coll.docs:
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].replace(microsecond=(d["created_at"].microsecond // 1000) * 1000)
    report = verify_chain(coll.docs)
    assert report["verified"] is True
    assert report["chained_events_checked"] == 2


def test_run_retention_dry_run_never_deletes():
    db = FakeDB()
    db.proctoring_events.docs = [{"id": "p1"}, {"id": "p2"}]
    db.resume_vectors.docs = [{"id": "v1"}]
    db.interview_sessions.docs = [
        {"id": "s1", "candidate_email": "x@y.z", "status": "completed"},
        {"id": "s2", "candidate_email": "old@y.z", "status": "completed"},
    ]
    before = (len(db.proctoring_events.docs), len(db.resume_vectors.docs))
    report = run_retention(db, dry_run=True)
    after = (len(db.proctoring_events.docs), len(db.resume_vectors.docs))
    assert before == after
    assert report["dry_run"] is True
    assert any(a["policy"] == "proctoring" for a in report["actions"])
    assert any(a["policy"] == "pii_redaction" for a in report["actions"])
