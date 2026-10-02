from enum import Enum
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict, HttpUrl

# =============================================================================
# ENUMS
# =============================================================================

class InterviewStage(str, Enum):
    INTRO = "intro"
    RESUME_PROBE = "resume_probe"
    TECHNICAL = "technical"
    SCENARIO = "scenario"
    WRAP_UP = "wrap_up"


class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class FinalRecommendation(str, Enum):
    STRONG_HIRE = "STRONG_HIRE"
    HIRE = "HIRE"
    LEAN_HIRE = "LEAN_HIRE"
    REJECT = "REJECT"


class ActionDecision(str, Enum):
    PASS = "PASS"
    PROBE_FURTHER = "PROBE_FURTHER"
    SWITCH_TOPIC = "SWITCH_TOPIC"
    TERMINATE = "TERMINATE"


class Speaker(str, Enum):
    AI_AGENT = "ai_agent"
    CANDIDATE = "candidate"


class AgentState(str, Enum):
    LISTENING = "listening"
    THINKING = "thinking"
    SPEAKING = "speaking"
    EVALUATING = "evaluating"
    IDLE = "idle"

# =============================================================================
# EVALUATOR AGENT SCHEMAS (PYDANTIC V2 ENFORCED JSON MODE)
# =============================================================================

class TurnEvaluationMetric(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    relevance_score: float = Field(
        ..., ge=0.0, le=10.0, description="Relevance score of candidate answer from 0.0 to 10.0"
    )
    depth_score: float = Field(
        ..., ge=0.0, le=10.0, description="Technical depth score of candidate answer from 0.0 to 10.0"
    )
    correctness_score: float = Field(
        ..., ge=0.0, le=10.0, description="Factual and logical correctness score from 0.0 to 10.0"
    )


class EvaluatorAgentOutput(BaseModel):
    """Enforced JSON schema for Llama / OpenAI Evaluator Agent output."""
    model_config = ConfigDict(from_attributes=True)

    session_id: str = Field(..., description="UUID or session identifier")
    turn_index: int = Field(..., ge=0, description="Zero-indexed sequence number of the interview turn")
    question_asked: str = Field(..., description="The prompt or question asked by the AI agent")
    candidate_answer: str = Field(..., description="Transcribed response given by the candidate")
    expected_concepts: List[str] = Field(
        default_factory=list, description="List of key technical concepts expected in a complete answer"
    )
    metrics: TurnEvaluationMetric = Field(..., description="Quantitative scores assigned to the answer")
    evaluator_notes: str = Field(..., description="Detailed qualitative feedback explaining the evaluation")
    missingConcepts: List[str] = Field(
        default_factory=list, alias="missing_concepts", description="Key concepts omitted by the candidate"
    )
    red_flags_detected: List[str] = Field(
        default_factory=list, description="Any detected plagiarisms, contradictions, or red flags"
    )
    action_decision: ActionDecision = Field(
        ..., description="State machine transition decision (PASS, PROBE_FURTHER, SWITCH_TOPIC, TERMINATE)"
    )
    recommended_follow_up: Optional[str] = Field(
        None, description="Optional targeted follow-up question if action_decision is PROBE_FURTHER"
    )

# =============================================================================
# TRANSCRIPT SCHEMAS
# =============================================================================

class TranscriptTurn(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    turn_index: int = Field(..., ge=0)
    stage: InterviewStage
    speaker: Speaker
    text: str
    audio_url: Optional[str] = None
    audio_latency_ms: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class InterviewTranscript(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: str
    turns: List[TranscriptTurn] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# =============================================================================
# WEBSOCKET STREAMING SCHEMAS
# =============================================================================

class WebSocketMessageType(str, Enum):
    AUDIO_CHUNK = "AUDIO_CHUNK"
    TEXT_CHUNK = "TEXT_CHUNK"
    AGENT_TRANSCRIPT = "AGENT_TRANSCRIPT"
    AGENT_STATE_UPDATE = "AGENT_STATE_UPDATE"


class WSAudioChunkPayload(BaseModel):
    chunk_index: int = Field(..., ge=0)
    audio_base64: str
    mime_type: str = Field(default="audio/webm")
    is_final: bool = Field(default=False)


class WSTextChunkPayload(BaseModel):
    text: str
    is_final: bool = Field(default=False)


class WSAgentTranscriptPayload(BaseModel):
    text: str
    audio_url: Optional[str] = None
    stage: InterviewStage


class WSAgentStateUpdatePayload(BaseModel):
    state: AgentState
    current_stage: InterviewStage
    progress_percentage: float = Field(..., ge=0.0, le=100.0)


class WSClientPayload(BaseModel):
    type: WebSocketMessageType
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Dict[str, Any]


class WSServerPayload(BaseModel):
    type: WebSocketMessageType
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    payload: Dict[str, Any]
