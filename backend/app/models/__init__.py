"""
Progeni Atlas — Domain Models & Enums
=====================================
Pure Python Enumerations and Type Contracts.
Zero ORM / SQLAlchemy dependencies.
"""
from __future__ import annotations

import enum


# ----------------------------------------------------------------- enums
class OrgTier(str, enum.Enum):
    STARTER = "starter"
    GROWTH = "growth"
    ENTERPRISE = "enterprise"


class UserRole(str, enum.Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    SUPER_ADMIN = "super_admin"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class ResumeStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    PARSED = "PARSED"
    FAILED = "FAILED"


class JobStatus(str, enum.Enum):
    DRAFT = "draft"
    OPEN = "open"
    ARCHIVED = "archived"


class RubricStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    ARCHIVED = "archived"


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class SessionStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class InterviewStage(str, enum.Enum):
    INTRO = "intro"
    RESUME_PROBE = "resume_probe"
    TECHNICAL = "technical"
    CODING = "coding"
    SCENARIO = "scenario"
    WRAP_UP = "wrap_up"


class Speaker(str, enum.Enum):
    AI_INTERVIEWER = "ai_interviewer"
    CANDIDATE = "candidate"


class AgentState(str, enum.Enum):
    CONNECTING = "CONNECTING"
    READY = "READY"
    LIVE = "LIVE"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class ProctoringEventType(str, enum.Enum):
    TAB_SWITCH = "tab_switch"
    VISIBILITY_CHANGE = "visibility_change"
    FULLSCREEN_EXIT = "fullscreen_exit"
    WINDOW_BLUR = "window_blur"
    CAMERA_DISABLED = "camera_disabled"
    MIC_DISABLED = "mic_disabled"
    MULTIPLE_FACES = "multiple_faces"
    UNAUTHORIZED_ACTION = "unauthorized_action"
    COPY_PASTE_ATTEMPT = "copy_paste_attempt"
    NETWORK_DROP = "network_drop"


class Severity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Recommendation(str, enum.Enum):
    STRONG_HIRE = "STRONG_HIRE"
    HIRE = "HIRE"
    LEAN_HIRE = "LEAN_HIRE"
    REJECT = "REJECT"


class ActionDecision(str, enum.Enum):
    PASS = "PASS"
    PROBE_FURTHER = "PROBE_FURTHER"
    SWITCH_TOPIC = "SWITCH_TOPIC"
    TERMINATE = "TERMINATE"


class NotificationType(str, enum.Enum):
    INTERVIEW_INVITED = "interview_invited"
    INTERVIEW_RESCHEDULED = "interview_rescheduled"
    INTERVIEW_REMINDER = "interview_reminder"
    INTERVIEW_COMPLETED = "interview_completed"
    SCORECARD_READY = "scorecard_ready"
    RESUME_PARSED = "resume_parsed"
    RESUME_FAILED = "resume_failed"
    SYSTEM = "system"


__all__ = [
    "OrgTier",
    "UserRole",
    "UserStatus",
    "ResumeStatus",
    "JobStatus",
    "RubricStatus",
    "InvitationStatus",
    "SessionStatus",
    "InterviewStage",
    "Speaker",
    "AgentState",
    "ProctoringEventType",
    "Severity",
    "Recommendation",
    "ActionDecision",
    "NotificationType",
]
