"""
Semantic resume search for recruiters.

Pipeline:
  resume upload ─▶ OpenAI-compatible embeddings (via OpenRouter, model from
                   settings.OPENROUTER_EMBEDDING_MODEL — same paid key already
                   used for LLM calls; no new provider, no new infra bill)
                ─▶ vectors stored in MongoDB collection `resume_vectors`
                   (self-contained: no Qdrant, no extra services to keep alive)
                ─▶ recruiter query ─▶ embed query ─▶ cosine rank (pure python)
                ─▶ joined candidate/resume details returned (no raw file URLs;
                   downloads stay behind the existing authenticated /uploads gate)

Design rules:
  * Zero new required dependencies (httpx + pymongo already in requirements).
  * Every public function degrades gracefully: on any failure the endpoint
    falls back to keyword regex search and always returns something useful.
  * Embeddings cost real money — we embed once per resume *content hash*, and
    backfills are explicit (scripts/embed_resumes.py), never silently huge.
"""

from __future__ import annotations

import hashlib
import math
import re
import time
from datetime import datetime, timezone

import httpx

from app.config import settings
from core.db import get_mongo_db

_EMBED_DIM_CACHE: dict[str, int] = {}


# --------------------------------------------------------------------- utils

def _embedding_model() -> str:
    return (getattr(settings, "OPENROUTER_EMBEDDING_MODEL", None) or getattr(settings, "EMBEDDING_MODEL", None) or "openai/text-embedding-3-small").strip()


def _base_url() -> str:
    return (settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1").rstrip("/")


def _hash_text(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8", errors="ignore")).hexdigest()


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


# --------------------------------------------------------------- embeddings

def embed_texts(texts: list[str], *, timeout: float = 60.0) -> list[list[float]]:
    """Embed a batch of texts. Raises RuntimeError on provider failure."""
    key = (settings.OPENROUTER_API_KEY or "").strip()
    if not key or "your-" in key or key.endswith("here"):
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    clean = [(t or "").strip() for t in texts]
    if not any(clean):
        return [[0.0] for _ in clean]

    resp = httpx.post(
        f"{_base_url()}/embeddings",
        json={"model": _embedding_model(), "input": clean},
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://atlas.progeni.live",
            "X-Title": "Progeni Atlas Resume Search",
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    items = data.get("data") or []
    if len(items) != len(clean):
        raise RuntimeError(f"embedding provider returned {len(items)} vectors for {len(clean)} inputs")
    return [list(map(float, item.get("embedding") or [])) for item in items]


# ------------------------------------------------------------------ upsert

def embed_resume_doc(doc: dict) -> bool:
    """Embed one candidate_resumes document. Returns True when (re)embedded.

    Skips the API call entirely when the resume text hash is unchanged.
    Never raises; safe to call inline in the upload path.
    """
    try:
        text = (doc.get("parsed_text") or "").strip()
        if not text:
            return False
        candidate_id = str(doc.get("candidate_id") or "").strip()
        if not candidate_id:
            return False

        text = text[:15000]
        text_hash = _hash_text(text)
        resume_id = str(doc.get("id") or doc.get("_id") or "")

        db = get_mongo_db()
        if db is None:
            return False

        existing = db.resume_vectors.find_one(
            {"candidate_id": candidate_id, "resume_id": resume_id},
            {"hash": 1},
        )
        if existing and existing.get("hash") == text_hash:
            return False

        vec = embed_texts([text])[0]

        db.resume_vectors.update_one(
            {"candidate_id": candidate_id, "resume_id": resume_id},
            {
                "$set": {
                    "candidate_id": candidate_id,
                    "candidate_email": str(doc.get("candidate_email") or "").lower().strip(),
                    "resume_id": resume_id,
                    "hash": text_hash,
                    "skills": list(doc.get("extracted_skills") or [])[:40],
                    "file_name": doc.get("file_name"),
                    "vector": vec,
                    "dims": len(vec),
                    "model": _embedding_model(),
                    "is_active": True,
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
            },
            upsert=True,
        )
        # Supersede any older vector for this candidate's older resumes.
        db.resume_vectors.update_many(
            {"candidate_id": candidate_id, "resume_id": {"$ne": resume_id}},
            {"$set": {"is_active": False}},
        )
        return True
    except Exception as e:  # embedding must never break uploads
        print(f"[SemanticSearch] resume embed skipped: {e}")
        return False


def reindex_active_resumes(*, limit: int = 100) -> dict:
    """Backfill/reembed active resumes. Returns stats; never raises."""
    stats = {"scanned": 0, "embedded": 0, "skipped": 0, "failed": 0}
    try:
        db = get_mongo_db()
        if db is None:
            return stats
        docs = list(
            db.candidate_resumes.find(
                {"is_active": True, "parsed_text": {"$exists": True, "$ne": ""}},
                {"parsed_text": 1, "extracted_skills": 1, "candidate_id": 1, "candidate_email": 1, "id": 1, "file_name": 1},
            ).limit(max(1, min(500, int(limit or 100))))
        )
        stats["scanned"] = len(docs)
        for doc in docs:
            try:
                ok = embed_resume_doc(doc)
                if ok:
                    stats["embedded"] += 1
                else:
                    stats["skipped"] += 1
            except Exception:
                stats["failed"] += 1
        return stats
    except Exception as e:
        print(f"[SemanticSearch] reindex failed: {e}")
        return stats


# ------------------------------------------------------------------ search

def semantic_resume_search(query: str, *, limit: int = 10, skills: list[str] | None = None) -> list[dict]:
    """Rank active resumes against a free-text query.

    Returns [{candidate_id, name, skills, score, file_name, uploaded_at}].
    Falls back to keyword matching when embeddings are unavailable/failing.
    """
    query = (query or "").strip()
    if not query:
        return []
    limit = max(1, min(50, int(limit or 10)))
    skills_norm = [str(s).strip().lower() for s in (skills or []) if str(s).strip()]

    db = get_mongo_db()
    if db is None:
        return []

    # ---- semantic path -----------------------------------------------------
    try:
        qvec = embed_texts([query[:4000]])[0]
        docs = list(
            db.resume_vectors.find(
                {"is_active": True},
                {"candidate_id": 1, "resume_id": 1, "skills": 1, "vector": 1, "file_name": 1, "candidate_email": 1, "updatedAt": 1},
            )
        )
        scored = []
        for d in docs:
            vec = d.get("vector") or []
            if not vec:
                continue
            if skills_norm:
                have = {str(s).lower() for s in (d.get("skills") or [])}
                if not all(any(sk in h for h in have) for sk in skills_norm):
                    continue
            scored.append((cosine(qvec, vec), d))
        scored.sort(key=lambda item: item[0], reverse=True)
        top = [s for s in scored if s[0] > 0.0][:limit]
        return _hydrate(db, [d for _, d in top], [s for s, _ in top])
    except Exception as e:
        print(f"[SemanticSearch] semantic path failed, falling back to keywords: {e}")

    # ---- keyword fallback (never fails hard) --------------------------------
    try:
        rx = re.compile(re.escape(query), re.IGNORECASE)
    except Exception:
        rx = None

    docs = list(db.candidate_resumes.find({"is_active": True}, {"parsed_text": 1, "extracted_skills": 1, "candidate_id": 1, "candidate_email": 1, "file_name": 1, "uploaded_at": 1}).limit(200))
    scored = []
    for d in docs:
        text = (d.get("parsed_text") or "")[:20000]
        skills_list = [str(s) for s in (d.get("extracted_skills") or [])]
        haystack = text.lower() + " " + " ".join(skills_list).lower()
        if skills_norm and not all(s in haystack for s in skills_norm):
            continue
        count = haystack.count(query.lower()) if query else 0
        if count or rx is None:
            scored.append((min(1.0, count / 12.0), d))
    scored.sort(key=lambda item: item[0], reverse=True)
    out = []
    for score, d in scored[:limit]:
        cid = str(d.get("candidate_id") or "")
        out.append({
            "candidate_id": cid,
            "name": _display_name(db, cid),
            "skills": list(d.get("extracted_skills") or [])[:15],
            "score": round(score, 4),
            "match_type": "keyword",
            "file_name": d.get("file_name"),
            "uploaded_at": d.get("uploaded_at"),
        })
    return out


def _hydrate(db, docs: list[dict], scores: list[float]) -> list[dict]:
    out = []
    ids = [str(d.get("candidate_id") or "") for d in docs]
    users = {str(u.get("id") or u.get("_id")): u for u in db.users.find({"$or": [{"id": {"$in": ids}}, {"_id": {"$in": ids}}]}, {"name": 1, "full_name": 1, "email": 1, "role": 1})}
    for d, score in zip(docs, scores):
        cid = str(d.get("candidate_id") or "")
        u = users.get(cid) or {}
        out.append({
            "candidate_id": cid,
            "name": (u.get("full_name") or u.get("name") or (d.get("candidate_email") or "").split("@")[0]).strip() or "Candidate",
            "skills": list(d.get("skills") or [])[:15],
            "score": round(float(score), 4),
            "match_type": "semantic",
            "file_name": d.get("file_name"),
            "uploaded_at": d.get("updatedAt"),
        })
    return out


def _display_name(db, candidate_id: str) -> str:
    try:
        u = db.users.find_one({"$or": [{"id": candidate_id}, {"_id": candidate_id}]}, {"name": 1, "full_name": 1, "email": 1})
        if not u:
            return "Candidate"
        return (u.get("full_name") or u.get("name") or (u.get("email") or "").split("@")[0]).strip() or "Candidate"
    except Exception:
        return "Candidate"
