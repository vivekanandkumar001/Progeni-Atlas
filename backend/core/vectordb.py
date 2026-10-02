import os
import logging
from typing import List, Dict, Any, Optional, Union
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse

logger = logging.getLogger("talentpulse.vectordb")
logging.basicConfig(level=logging.INFO)

# =============================================================================
# VECTOR DB CONFIGURATION & CONSTANTS
# =============================================================================

QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", None)
QDRANT_URL = os.environ.get("QDRANT_URL", None)

VECTOR_SIZE = int(os.environ.get("VECTOR_SIZE", "768"))  # 768 or 1536

COLLECTION_RESUMES = "candidate_resumes"
COLLECTION_QUESTIONS = "question_banks"
COLLECTION_RUBRICS = "job_rubrics"

# =============================================================================
# QDRANT CLIENT INITIALIZER & MANAGER
# =============================================================================

class VectorDBClient:
    """Enterprise Qdrant Vector Database Manager for TalentPulse AI."""

    def __init__(self, vector_size: int = VECTOR_SIZE):
        self.vector_size = vector_size
        self.client: Optional[QdrantClient] = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        """Instantiate QdrantClient connected to cloud or local instance with in-memory fallback."""
        try:
            if QDRANT_URL:
                self.client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
                logger.info(f"Connected to Qdrant Cloud at {QDRANT_URL}")
            else:
                self.client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, api_key=QDRANT_API_KEY)
                logger.info(f"Connected to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
        except Exception as e:
            logger.warning(f"Failed to connect to Qdrant server ({e}). Falling back to in-memory Qdrant instance.")
            self.client = QdrantClient(location=":memory:")

    def init_collections(self) -> None:
        """Define and ensure existence of required vector collections and payload indexes."""
        if not self.client:
            raise RuntimeError("Qdrant client is not initialized.")

        collections_config = [
            (COLLECTION_RESUMES, "candidate_id"),
            (COLLECTION_QUESTIONS, "topic"),
            (COLLECTION_RUBRICS, "job_profile_id"),
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
                    logger.info(f"Created vector collection '{coll_name}' with dimension {self.vector_size}.")

                    # Create payload index for fast tenant / candidate filtering
                    self.client.create_payload_index(
                        collection_name=coll_name,
                        field_name=index_field,
                        field_schema=qmodels.PayloadSchemaType.KEYWORD,
                    )
                    logger.info(f"Created payload keyword index on '{coll_name}.{index_field}'.")
                else:
                    logger.info(f"Collection '{coll_name}' already exists.")
            except Exception as e:
                logger.error(f"Error provisioning collection '{coll_name}': {e}")
                raise e

    # =========================================================================
    # SEARCH HELPER METHODS
    # =========================================================================

    def search_resume_context(
        self, candidate_id: str, query_vector: List[float], limit: int = 3
    ) -> List[Dict[str, Any]]:
        """Search candidate resume chunks matching candidate_id and nearest to query_vector."""
        if not self.client:
            return []

        filter_condition = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="candidate_id",
                    match=qmodels.MatchValue(value=candidate_id),
                )
            ]
        )

        try:
            results = self.client.search(
                collection_name=COLLECTION_RESUMES,
                query_vector=query_vector,
                query_filter=filter_condition,
                limit=limit,
            )
            return [
                {
                    "score": hit.score,
                    "chunk_index": hit.payload.get("chunk_index"),
                    "section_type": hit.payload.get("section_type"),
                    "text_content": hit.payload.get("text_content"),
                }
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Error searching resume context for candidate {candidate_id}: {e}")
            return []

    def search_relevant_rubrics(
        self, job_id: str, query_vector: List[float], limit: int = 2
    ) -> List[Dict[str, Any]]:
        """Search evaluation rubrics for a specific job profile."""
        if not self.client:
            return []

        filter_condition = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="job_profile_id",
                    match=qmodels.MatchValue(value=job_id),
                )
            ]
        )

        try:
            results = self.client.search(
                collection_name=COLLECTION_RUBRICS,
                query_vector=query_vector,
                query_filter=filter_condition,
                limit=limit,
            )
            return [
                {
                    "score": hit.score,
                    "job_profile_id": hit.payload.get("job_profile_id"),
                    "criterion_name": hit.payload.get("criterion_name"),
                    "min_expected_depth": hit.payload.get("min_expected_depth"),
                    "weight": hit.payload.get("weight"),
                }
                for hit in results
            ]
        except Exception as e:
            logger.error(f"Error searching relevant rubrics for job {job_id}: {e}")
            return []

    # =========================================================================
    # UPSERT HELPER METHODS
    # =========================================================================

    def upsert_resume_chunk(
        self,
        point_id: str,
        vector: List[float],
        candidate_id: str,
        chunk_index: int,
        section_type: str,
        text_content: str,
    ) -> bool:
        """Upsert a single resume chunk into candidate_resumes collection."""
        payload = {
            "candidate_id": candidate_id,
            "chunk_index": chunk_index,
            "section_type": section_type,
            "text_content": text_content,
        }
        try:
            self.client.upsert(
                collection_name=COLLECTION_RESUMES,
                points=[qmodels.PointStruct(id=point_id, vector=vector, payload=payload)],
            )
            return True
        except Exception as e:
            logger.error(f"Failed to upsert resume chunk {point_id}: {e}")
            return False

    def upsert_question(
        self,
        point_id: str,
        vector: List[float],
        topic: str,
        difficulty: str,
        core_concept: str,
        sample_question: str,
    ) -> bool:
        """Upsert a question into question_banks collection."""
        payload = {
            "topic": topic,
            "difficulty": difficulty,
            "core_concept": core_concept,
            "sample_question": sample_question,
        }
        try:
            self.client.upsert(
                collection_name=COLLECTION_QUESTIONS,
                points=[qmodels.PointStruct(id=point_id, vector=vector, payload=payload)],
            )
            return True
        except Exception as e:
            logger.error(f"Failed to upsert question {point_id}: {e}")
            return False

    def upsert_job_rubric(
        self,
        point_id: str,
        vector: List[float],
        job_profile_id: str,
        criterion_name: str,
        min_expected_depth: str,
        weight: float,
    ) -> bool:
        """Upsert a rubric entry into job_rubrics collection."""
        payload = {
            "job_profile_id": job_profile_id,
            "criterion_name": criterion_name,
            "min_expected_depth": min_expected_depth,
            "weight": weight,
        }
        try:
            self.client.upsert(
                collection_name=COLLECTION_RUBRICS,
                points=[qmodels.PointStruct(id=point_id, vector=vector, payload=payload)],
            )
            return True
        except Exception as e:
            logger.error(f"Failed to upsert job rubric {point_id}: {e}")
            return False


# Singleton instance
vectordb_client = VectorDBClient()
