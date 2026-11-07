"""SQLAlchemy models — PostgreSQL is the single source of truth."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    BigInteger,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=text("now()")
    )


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


# ------------------------------------------------------------- organizations
class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    tier: Mapped[OrgTier] = mapped_column(
        Enum(OrgTier, name="organization_tier", values_callable=lambda x: [e.value for e in x]), default=OrgTier.STARTER
    )
    logo_url: Mapped[str | None] = mapped_column(Text)
    website_url: Mapped[str | None] = mapped_column(String(500))
    industry: Mapped[str | None] = mapped_column(String(120))
    company_size: Mapped[str | None] = mapped_column(String(60))
    headquarters_city: Mapped[str | None] = mapped_column(String(120))
    bio: Mapped[str | None] = mapped_column(Text)
    billing_email: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    jobs: Mapped[list["Job"]] = relationship(back_populates="organization")


# --------------------------------------------------------------------- users
class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
        # Credit pack pricing configured per role
    # Candidate packs: ₹49 (30 credits), ₹99 (70 credits), ₹199 (150 credits)
    # Recruiter packs: ₹999 (800 credits), ₹1999 (1800 credits), ₹4999 (4500 credits)
    credit_pack_prices: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )  # Stores pack configurations per role
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]),
        default=UserRole.CANDIDATE,
        index=True,
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status", values_callable=lambda x: [e.value for e in x]),
        default=UserStatus.ACTIVE,
    )
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    avatar_public_id: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    email_otp: Mapped[str | None] = mapped_column(String(6), nullable=False, default="")
    email_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_otp: Mapped[str | None] = mapped_column(String(6), nullable=False, default="")
    phone_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # candidate profile
    bio: Mapped[str | None] = mapped_column(Text)
    course: Mapped[str | None] = mapped_column(String(120))
    branch: Mapped[str | None] = mapped_column(String(160))
    academic_year: Mapped[str | None] = mapped_column(String(40))
    college_name: Mapped[str | None] = mapped_column(String(255))
    github_url: Mapped[str | None] = mapped_column(String(500))
    linkedin_url: Mapped[str | None] = mapped_column(String(500))
    portfolio_url: Mapped[str | None] = mapped_column(String(500))
    years_experience: Mapped[float | None] = mapped_column(Float)
    headline: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(160))

    # recruiter profile
    designation: Mapped[str | None] = mapped_column(String(160))
    department: Mapped[str | None] = mapped_column(String(160))
    is_org_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    monthly_hiring_quota: Mapped[int] = mapped_column(Integer, default=20)

    organization: Mapped[Organization | None] = relationship(back_populates="users")
    skills: Mapped[list["CandidateSkill"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    resumes: Mapped[list["CandidateResume"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_users_org_role", "org_id", "role"),)


# ------------------------------------------------------------------ resumes
class Purchase(TimestampMixin, Base):
    __tablename__ = "purchases"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    credits_added: Mapped[int] = mapped_column(Integer, nullable=False)
    pack_name: Mapped[str] = mapped_column(String(50), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), nullable=False, default="credit_purchase")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now"))

    user: Mapped["User"] = relationship(back_populates="purchases")

User.purchases: Mapped[list["Purchase"]] = relationship(back_populates="user")

class CandidateResume(Base):
    """Cloudinary reference + PostgreSQL metadata. No binary in PG."""

    __tablename__ = "candidate_resumes"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    cloudinary_public_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    secure_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    resource_type: Mapped[str] = mapped_column(String(40), default="raw")
    purpose: Mapped[str] = mapped_column(String(60), default="resume")
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, default=0)
    file_url: Mapped[str | None] = mapped_column(Text, default="")
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False, default="application/pdf")
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    status: Mapped[ResumeStatus] = mapped_column(
        Enum(ResumeStatus, name="resume_status"), default=ResumeStatus.UPLOADED
    )
    parse_error: Mapped[str | None] = mapped_column(Text)
    parsed_text: Mapped[str | None] = mapped_column(Text)
    parsed_text_clean: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    candidate: Mapped[User] = relationship(back_populates="resumes")

    __table_args__ = (Index("ix_resumes_candidate_active", "candidate_id", "is_active"),)


# ------------------------------------------------------------------- skills
class Skill(TimestampMixin, Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(80))


class CandidateSkill(TimestampMixin, Base):
    __tablename__ = "candidate_skills"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("skills.id", ondelete="CASCADE"), index=True
    )
    proficiency: Mapped[int | None] = mapped_column(Integer)
    years_experience: Mapped[float | None] = mapped_column(Float)

    user: Mapped[User] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship()

    __table_args__ = (UniqueConstraint("candidate_id", "skill_id", name="uq_candidate_skill"),)


# ---------------------------------------------------------------- job / jd
class Job(TimestampMixin, Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(120))
    experience_level: Mapped[str | None] = mapped_column(String(40))
    job_description: Mapped[str] = mapped_column(Text, nullable=False)
    skills_required: Mapped[list[str]] = mapped_column(ARRAY(String(120)), default=list)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", values_callable=lambda x: [e.value for e in x]),
        default=JobStatus.DRAFT,
        index=True,
    )
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rubric_weights: Mapped[dict | None] = mapped_column(JSONB, default=None)

    organization: Mapped[Organization] = relationship(back_populates="jobs")
    rubric_versions: Mapped[list["RubricVersion"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="RubricVersion.version.desc()"
    )

    __table_args__ = (Index("ix_jobs_org_status", "org_id", "status"),)


# ---------------------------------------------------------------- rubrics
class RubricVersion(TimestampMixin, Base):
    __tablename__ = "rubric_versions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[RubricStatus] = mapped_column(
        Enum(RubricStatus, name="rubric_status", values_callable=lambda x: [e.value for e in x]),
        default=RubricStatus.DRAFT,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    weights: Mapped[dict] = mapped_column(JSONB, default=dict)
    competencies: Mapped[list] = mapped_column(JSONB, default=list)
    custom_instructions: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    job: Mapped["Job"] = relationship(back_populates="rubric_versions")

    __table_args__ = (
        UniqueConstraint("job_id", "version", name="uq_job_rubric_version"),
        Index("ix_rubric_versions_job_status", "job_id", "status"),
    )


# -------------------------------------------------------------- invitations
class InterviewInvitation(TimestampMixin, Base):
    __tablename__ = "interview_invitations"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[InvitationStatus] = mapped_column(
        Enum(InvitationStatus, name="invitation_status", values_callable=lambda x: [e.value for e in x]),
        default=InvitationStatus.PENDING,
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    message: Mapped[str | None] = mapped_column(Text)


# ------------------------------------------------------------------ sessions
class InterviewSession(TimestampMixin, Base):
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="SET NULL"), index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    session_type: Mapped[str] = mapped_column(String(30), default="live")
    mode: Mapped[str] = mapped_column(String(20), default="real", index=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status", values_callable=lambda x: [e.value for e in x]),
        default=SessionStatus.SCHEDULED,
        index=True,
    )
    # NULL means a pre-lifecycle session; resolve it conservatively from status.
    # Readiness is only ever set through an explicit lifecycle transition.
    lifecycle_state: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    # Monotonic counter incremented on every committed transition. Lets clients
    # and callers detect a stale view instead of acting on one.
    state_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    current_stage: Mapped[InterviewStage] = mapped_column(
        Enum(InterviewStage, name="interview_stage", values_callable=lambda x: [e.value for e in x]),
        default=InterviewStage.INTRO,
    )
    agent_state: Mapped[AgentState] = mapped_column(
        Enum(AgentState, name="agent_state"), default=AgentState.CONNECTING
    )

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    join_window_minutes: Mapped[int] = mapped_column(Integer, default=15)
    # Nullable for interviews already active when question timing was introduced.
    # New and not-yet-started sessions receive the rollout default.
    question_time_limit_seconds: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=120, server_default="120"
    )

    # interview configuration
    config: Mapped[dict] = mapped_column(JSONB, default=dict)

    # recording (Cloudinary)
    recording_public_id: Mapped[str | None] = mapped_column(String(255))
    recording_url: Mapped[str | None] = mapped_column(Text)
    recording_duration_sec: Mapped[int | None] = mapped_column(Integer)

    # denormalised outcome (source of truth is scorecards)
    total_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    final_recommendation: Mapped[Recommendation | None] = mapped_column(
        Enum(Recommendation, name="final_recommendation")
    )

    questions: Mapped[list["InterviewQuestion"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="InterviewQuestion.turn_index"
    )
    answers: Mapped[list["InterviewResponse"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="InterviewResponse.turn_index"
    )
    scorecard: Mapped["Scorecard | None"] = relationship(
        back_populates="session", cascade="all, delete-orphan", uselist=False
    )
    proctoring_events: Mapped[list["ProctoringEvent"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "total_score IS NULL OR (total_score >= 0 AND total_score <= 100)",
            name="ck_sessions_total_score",
        ),
        Index("ix_sessions_candidate_status", "candidate_id", "status"),
        Index("ix_sessions_org_status", "org_id", "status"),
    )


# ------------------------------------------------------- lifecycle audit trail
class InterviewSessionTransition(Base):
    """Append-only audit of explicit lifecycle changes (including legacy origin)."""

    __tablename__ = "interview_session_transitions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_state: Mapped[str] = mapped_column(String(40), nullable=False)
    to_state: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    # Structured, non-PII context for the transition (stage, turn index, failure
    # class, correlation id). Never stores credentials or raw candidate content.
    metadata_json: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'")
    )
    transitioned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=text("now()"), nullable=False
    )

    __table_args__ = (
        Index("ix_session_transitions_session_time", "session_id", "transitioned_at"),
    )


# ----------------------------------------------------------------- questions
class InterviewQuestion(TimestampMixin, Base):
    __tablename__ = "interview_questions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    stage: Mapped[InterviewStage] = mapped_column(
        Enum(InterviewStage, name="interview_stage", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    expected_concepts: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    question_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timed_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=True)
    model_used: Mapped[str | None] = mapped_column(String(120))
    latency_ms: Mapped[int | None] = mapped_column(Integer)

    session: Mapped[InterviewSession] = relationship(back_populates="questions")

    __table_args__ = (
        UniqueConstraint("session_id", "turn_index", name="uq_question_turn"),
    )


# ------------------------------------------------------------------ responses
class InterviewResponse(TimestampMixin, Base):
    __tablename__ = "interview_responses"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_questions.id", ondelete="CASCADE")
    )
    turn_index: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[Speaker] = mapped_column(
        Enum(Speaker, name="speaker"), default=Speaker.CANDIDATE
    )
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_timeout_result: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    audio_url: Mapped[str | None] = mapped_column(Text)
    audio_latency_ms: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )

    # LLM evaluation of this answer
    relevance_score: Mapped[float | None] = mapped_column(Float)
    depth_score: Mapped[float | None] = mapped_column(Float)
    correctness_score: Mapped[float | None] = mapped_column(Float)
    evaluator_notes: Mapped[str | None] = mapped_column(Text)
    missing_concepts: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    red_flags: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    action_decision: Mapped[ActionDecision | None] = mapped_column(
        Enum(ActionDecision, name="action_decision")
    )
    recommended_follow_up: Mapped[str | None] = mapped_column(Text)
    evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    model_used: Mapped[str | None] = mapped_column(String(120))

    session: Mapped[InterviewSession] = relationship(back_populates="answers")


# ----------------------------------------------------------------- coding
class CodeSubmission(TimestampMixin, Base):
    __tablename__ = "code_submissions"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    turn_index: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[str] = mapped_column(String(40), nullable=False)
    source_code: Mapped[str] = mapped_column(Text, nullable=False)
    stdout: Mapped[str | None] = mapped_column(Text)
    stderr: Mapped[str | None] = mapped_column(Text)
    exit_code: Mapped[int | None] = mapped_column(Integer)
    passed_count: Mapped[int | None] = mapped_column(Integer)
    total_count: Mapped[int | None] = mapped_column(Integer)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer)


# --------------------------------------------------------------- scorecards
class Scorecard(TimestampMixin, Base):
    __tablename__ = "scorecards"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    overall_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    recommendation: Mapped[Recommendation | None] = mapped_column(
        Enum(Recommendation, name="final_recommendation")
    )
    executive_summary: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    concerns: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    model_used: Mapped[str | None] = mapped_column(String(120))
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[InterviewSession] = relationship(back_populates="scorecard")
    competencies: Mapped[list["CompetencyScore"]] = relationship(
        back_populates="scorecard", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)",
            name="ck_scorecard_overall",
        ),
    )


class CompetencyScore(TimestampMixin, Base):
    __tablename__ = "competency_scores"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    scorecard_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scorecards.id", ondelete="CASCADE"), index=True
    )
    competency: Mapped[str] = mapped_column(String(120), nullable=False)
    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    weight: Mapped[float | None] = mapped_column(Numeric(5, 2))
    evidence: Mapped[str | None] = mapped_column(Text)
    evaluator_comment: Mapped[str | None] = mapped_column(Text)

    scorecard: Mapped[Scorecard] = relationship(back_populates="competencies")


# --------------------------------------------------------------- proctoring
class ProctoringEvent(TimestampMixin, Base):
    __tablename__ = "proctoring_events"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[ProctoringEventType] = mapped_column(
        Enum(ProctoringEventType, name="proctoring_event_type"), nullable=False
    )
    severity: Mapped[Severity] = mapped_column(
        Enum(Severity, name="severity"), default=Severity.INFO
    )
    detail: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )

    session: Mapped[InterviewSession] = relationship(back_populates="proctoring_events")


# ----------------------------------------------------------------- reports
class CandidateReport(TimestampMixin, Base):
    __tablename__ = "candidate_reports"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    summary: Mapped[str | None] = mapped_column(Text)
    recommendation: Mapped[Recommendation | None] = mapped_column(
        Enum(Recommendation, name="final_recommendation")
    )
    pdf_public_id: Mapped[str | None] = mapped_column(String(255))
    pdf_url: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ------------------------------------------------------------ notifications
class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)


# -------------------------------------------------------------- audit logs
class AuditLog(TimestampMixin, Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    org_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(400))
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)


# -------------------------------------------------------- refresh tokens
class RefreshToken(TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(400))


# ------------------------------------------------------------- system config
class SystemConfig(TimestampMixin, Base):
    __tablename__ = "system_config"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    value: Mapped[dict] = mapped_column(JSONB, default=dict)
    description: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


# ----------------------------------------------------------------- otp codes
class OtpCode(TimestampMixin, Base):
    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(PgUUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), default="REGISTRATION_VERIFY", nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_otp_codes_lookup", "email", "purpose", "created_at"),
    )
