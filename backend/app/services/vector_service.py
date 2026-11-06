"""Vector Database service for semantic retrieval and embeddings.

Integrates with Qdrant (Cloud or on-premise) for storing and querying
high-dimensional embeddings for:
  1. candidate_resumes (chunks of parsed candidate resumes)
  2. job_rubrics (semantic competency rubrics & requirements)
  3. question_banks (technical and scenario questions)
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("talentpulse.vector")

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    _QDRANT_AVAILABLE = True
except ImportError:
    _QDRANT_AVAILABLE = False
    QdrantClient = None
    qmodels = None

COLLECTION_RESUMES = "candidate_resumes"
COLLECTION_RUBRICS = "job_rubrics"
COLLECTION_QUESTIONS = "question_banks"
DEFAULT_VECTOR_SIZE = 1536  # Standard size for text-embedding-3-small


def get_embedding(text: str) -> list[float]:
    """Generates embeddings via configured LLM/AI embedding endpoint."""
    if not text.strip():
        return [0.0] * DEFAULT_VECTOR_SIZE

    provider = settings.LLM_PROVIDER.lower()
    fallback = (settings.LLM_FALLBACK_PROVIDER or "").lower()

    if provider == "openai" and settings.OPENAI_API_KEY:
        try:
            url = f"{settings.OPENAI_API_BASE.rstrip('/')}/embeddings"
            headers = {
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "input": text[:8000],
                "model": settings.EMBEDDING_MODEL,
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data["data"][0]["embedding"]
                logger.warning("OpenAI embedding returned HTTP %s: %s", res.status_code, res.text[:200])
        except Exception as exc:
            logger.warning("Failed to generate OpenAI embedding: %s", exc)

    if settings.OPENROUTER_API_KEY:
        try:
            url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/embeddings"
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "input": text[:8000],
                "model": settings.OPENROUTER_EMBEDDING_MODEL,  # Verified openai/text-embedding-3-small (1536-dim)
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    return data["data"][0]["embedding"]
                logger.warning("OpenRouter embedding returned HTTP %s: %s", res.status_code, res.text[:200])
        except Exception as exc:
            logger.warning("Failed to generate OpenRouter embedding: %s", exc)

    if provider == "ollama" or fallback == "ollama":
        try:
            base_url = settings.effective_ollama_url
            url = f"{base_url}/api/embeddings"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "prompt": text[:8000],
            }
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    emb = data.get("embedding", [])
                    if emb:
                        return emb
        except Exception as exc:
            logger.warning("Failed to generate Ollama embedding: %s", exc)

    # Deterministic fallback vector if API key is not configured or in testing
    import hashlib
    h = hashlib.sha256(text.encode("utf-8")).digest()
    vals = [((b / 255.0) - 0.5) * 2 for b in h]
    # repeat up to DEFAULT_VECTOR_SIZE
    repeated = (vals * ((DEFAULT_VECTOR_SIZE // len(vals)) + 1))[:DEFAULT_VECTOR_SIZE]
    return repeated


class VectorService:
    def __init__(self):
        self._client: Any = None
        self._init_client()

    def _init_client(self):
        if not _QDRANT_AVAILABLE:
            logger.warning("qdrant-client not installed; VectorService disabled.")
            return

        try:
            if settings.QDRANT_URL:
                self._client = QdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY,
                    timeout=10,
                )
                logger.info("Connected to Qdrant Cloud at %s", settings.QDRANT_URL)
            elif settings.QDRANT_HOST:
                self._client = QdrantClient(
                    host=settings.QDRANT_HOST,
                    port=settings.QDRANT_PORT,
                    api_key=settings.QDRANT_API_KEY,
                    timeout=5,
                )
                logger.info("Connected to Qdrant at %s:%s", settings.QDRANT_HOST, settings.QDRANT_PORT)
        except Exception as e:
            logger.warning("Could not connect to Qdrant (%s); running in fallback mode.", e)
            self._client = None

    def ensure_collections(self):
        """Initializes collections with cosine distance and keyword payload indices."""
        if not self._client:
            return

        configs = [
            (COLLECTION_RESUMES, "candidate_id"),
            (COLLECTION_RUBRICS, "job_id"),
            (COLLECTION_QUESTIONS, "topic"),
        ]
        for coll_name, index_field in configs:
            try:
                if not self._client.collection_exists(collection_name=coll_name):
                    self._client.create_collection(
                        collection_name=coll_name,
                        vectors_config=qmodels.VectorParams(
                            size=DEFAULT_VECTOR_SIZE,
                            distance=qmodels.Distance.COSINE,
                        ),
                    )
                    self._client.create_payload_index(
                        collection_name=coll_name,
                        field_name=index_field,
                        field_schema=qmodels.PayloadSchemaType.KEYWORD,
                    )
                    logger.info("Created Qdrant collection: %s", coll_name)
            except Exception as exc:
                logger.warning("Error ensuring collection %s: %s", coll_name, exc)

    def index_resume_chunks(
        self,
        candidate_id: uuid.UUID,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Chunks resume text into semantic units and indexes them in Vector DB."""
        if not self._client or not text:
            return 0

        self.ensure_collections()

        # Split text into meaningful paragraphs / chunks
        paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
        if not paragraphs:
            paragraphs = [p.strip() for p in text.split("\n") if len(p.strip()) > 30]
        if not paragraphs:
            paragraphs = [text[:2000]]

        points = []
        for idx, chunk in enumerate(paragraphs[:20]):
            vector = get_embedding(chunk)
            point_id = str(uuid.uuid5(candidate_id, f"chunk_{idx}"))
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "candidate_id": str(candidate_id),
                        "chunk_index": idx,
                        "text": chunk,
                        **(metadata or {}),
                    },
                )
            )

        try:
            self._client.upsert(
                collection_name=COLLECTION_RESUMES,
                points=points,
            )
            logger.info("Indexed %d resume chunks for candidate %s in Vector DB", len(points), candidate_id)
            return len(points)
        except Exception as exc:
            logger.warning("Failed to upsert resume chunks to Qdrant: %s", exc)
            return 0

    def search_resume_context(
        self,
        candidate_id: uuid.UUID,
        query: str,
        limit: int = 3,
    ) -> list[str]:
        """Performs ANN semantic search against candidate's indexed resume chunks."""
        if not self._client:
            return []

        try:
            query_vector = get_embedding(query)
            filter_condition = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="candidate_id",
                        match=qmodels.MatchValue(value=str(candidate_id)),
                    )
                ]
            )
            if hasattr(self._client, "query_points"):
                res = self._client.query_points(
                    collection_name=COLLECTION_RESUMES,
                    query=query_vector,
                    query_filter=filter_condition,
                    limit=limit,
                )
                hits = res.points
            else:
                hits = self._client.search(
                    collection_name=COLLECTION_RESUMES,
                    query_vector=query_vector,
                    query_filter=filter_condition,
                    limit=limit,
                )
            return [hit.payload.get("text", "") for hit in hits if hit.payload]
        except Exception as exc:
            logger.warning("Qdrant resume search failed: %s", exc)
            return []


# Global singleton
vector_db = VectorService()
