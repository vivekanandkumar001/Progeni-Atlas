from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class UserRole(str, Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class InterviewStage(str, Enum):
    INTRO = "intro"
    RESUME_PROBE = "resume_probe"
    TECHNICAL = "technical"
    SCENARIO = "scenario"
    WRAP_UP = "wrap_up"


class ActionDecision(str, Enum):
    PASS = "PASS"
    PROBE_FURTHER = "PROBE_FURTHER"
    SWITCH_TOPIC = "SWITCH_TOPIC"
    TERMINATE = "TERMINATE"


class ProctoringMetrics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    gazeConfidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score for candidate gaze focus")
    audioVoiceCount: int = Field(default=1, ge=0, description="Number of distinct voices detected in audio stream")
    tabFocusLost: bool = Field(default=False, description="Whether candidate switched tab or lost browser focus")


class TurnMetrics(BaseModel):
    model_config = ConfigDict(extra="ignore")

    relevanceScore: float = Field(..., ge=0.0, le=10.0, description="Relevance of candidate response (0-10)")
    depthScore: float = Field(..., ge=0.0, le=10.0, description="Technical depth of candidate response (0-10)")
    correctnessScore: float = Field(..., ge=0.0, le=10.0, description="Factual and logical correctness (0-10)")


class EvaluatorOutput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sessionId: str = Field(..., description="UUID of interview session")
    turnIndex: int = Field(..., ge=0, description="Sequential turn index")
    questionAsked: str = Field(..., description="The prompt or question delivered by AI")
    candidateAnswer: str = Field(..., description="Transcribed response of candidate")
    metrics: TurnMetrics = Field(..., description="Scores for relevance, depth, and correctness")
    proctoring: Optional[ProctoringMetrics] = Field(default_factory=ProctoringMetrics)
    missingConcepts: List[str] = Field(default_factory=list, description="Key concepts missed in answer")
    redFlagsDetected: List[str] = Field(default_factory=list, description="Hallucinations, plagiarism, or red flags")
    actionDecision: ActionDecision = Field(..., description="Decision logic for next AI turn")
    recommendedFollowUp: Optional[str] = Field(default=None, description="Suggested follow-up topic or question")


class CandidateResumeMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    candidateId: str
    fileName: str
    fileSizeBytes: int
    fileUrl: str
    mimeType: str = "application/pdf"
    parsedTextClean: Optional[str] = None
    isActive: bool = True


class PresignedUrlRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    key: str = Field(..., description="Storage key path")
    contentType: str = Field(..., description="MIME content type")
    expiresInSec: int = Field(default=300, ge=1, le=86400)
