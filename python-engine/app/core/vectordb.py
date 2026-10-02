import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("talentpulse.vectordb")

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    QDRANT_AVAILABLE = True
except ImportError:
    QdrantClient = None
    qmodels = None
    QDRANT_AVAILABLE = False
    logger.info("qdrant-client not installed. VectorDBClient running in mock mode.")

QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", None)
QDRANT_URL = os.environ.get("QDRANT_URL", None)

VECTOR_SIZE = int(os.environ.get("VECTOR_SIZE", "768"))  # 768 or 1536

COLLECTION_RESUMES = "candidate_resumes"
COLLECTION_RUBRICS = "job_rubrics"
COLLECTION_QUESTIONS = "question_banks"


class VectorDBClient:
    """Qdrant Vector DB Client & ANN Search Manager."""

    def __init__(self, vector_size: int = VECTOR_SIZE):
        self.vector_size = vector_size
        self.client: Optional[Any] = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        if not QDRANT_AVAILABLE:
            logger.info("VectorDBClient running in mock mode.")
            return

        try:
            if QDRANT_URL:
                self.client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
                logger.info(f"Connected to Qdrant Cloud at {QDRANT_URL}")
            else:
                self.client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, api_key=QDRANT_API_KEY)
                logger.info(f"Connected to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
        except Exception as e:
            logger.warning(f"Failed to connect to Qdrant server ({e}). Falling back to in-memory Qdrant instance.")
            try:
                self.client = QdrantClient(location=":memory:")
            except Exception:
                self.client = None

    def init_collections(self) -> None:
        if not self.client:
            logger.info("Skipping collection init in mock mode.")
            return

        collections_config = [
            (COLLECTION_RESUMES, "candidate_id"),
            (COLLECTION_RUBRICS, "job_profile_id"),
            (COLLECTION_QUESTIONS, "topic"),
        ]

        for coll_name, index_field in collections_config:
            try:
                exists = self.client.collection_exists(collection_name=coll_name)
                if not exists:
                    self.client.create_collection(
                        collection_name=coll_name,
                        vectors_config=qmodels.VectorParams(
                            size=self.vector_size,
                            distance=qmodels.Distance.COSINE,
                        ),
                    )
                    logger.info(f"Created collection '{coll_name}' with size {self.vector_size} (Cosine).")
                    self.client.create_payload_index(
                        collection_name=coll_name,
                        field_name=index_field,
                        field_schema=qmodels.PayloadSchemaType.KEYWORD,
                    )
                else:
                    logger.info(f"Collection '{coll_name}' exists.")
            except Exception as e:
                logger.error(f"Error provisioning collection '{coll_name}': {e}")
                raise e

    def search_resume_chunks(
        self, candidate_id: str, query: str, query_vector: Optional[List[float]] = None, limit: int = 3
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        vec = query_vector or [0.01] * self.vector_size

        filter_cond = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="candidate_id",
                    match=qmodels.MatchValue(value=candidate_id),
                )
            ]
        )

        try:
            hits = self.client.search(
                collection_name=COLLECTION_RESUMES,
                query_vector=vec,
                query_filter=filter_cond,
                limit=limit,
            )
            return [
                {
                    "resume_id": hit.payload.get("resume_id"),
                    "candidate_id": hit.payload.get("candidate_id"),
                    "chunk_index": hit.payload.get("chunk_index"),
                    "section_type": hit.payload.get("section_type"),
                    "text_chunk": hit.payload.get("text_chunk") or hit.payload.get("text_content"),
                    "score": hit.score,
                }
                for hit in hits
            ]
        except Exception as e:
            logger.error(f"Error searching resume chunks for candidate {candidate_id}: {e}")
            return []

    def search_job_rubrics(
        self, job_profile_id: str, topic: str, query_vector: Optional[List[float]] = None, limit: int = 2
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        vec = query_vector or [0.01] * self.vector_size

        filter_cond = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="job_profile_id",
                    match=qmodels.MatchValue(value=job_profile_id),
                )
            ]
        )

        try:
            hits = self.client.search(
                collection_name=COLLECTION_RUBRICS,
                query_vector=vec,
                query_filter=filter_cond,
                limit=limit,
            )
            return [
                {
                    "job_profile_id": hit.payload.get("job_profile_id"),
                    "criterion_name": hit.payload.get("criterion_name"),
                    "min_expected_depth": hit.payload.get("min_expected_depth"),
                    "weight": hit.payload.get("weight"),
                    "score": hit.score,
                }
                for hit in hits
            ]
        except Exception as e:
            logger.error(f"Error searching job rubrics for job {job_profile_id}: {e}")
            return []


vectordb_client = VectorDBClient()
