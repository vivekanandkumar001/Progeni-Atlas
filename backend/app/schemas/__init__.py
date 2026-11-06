"""Request/response schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models import (
    InvitationStatus,
    InterviewStage,
    JobStatus,
    ResumeStatus,
    RubricStatus,
    SessionStatus,
    Severity,
    UserRole,
)

# ------------------------------------------------------------------ auth
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole = UserRole.CANDIDATE
    org_name: str | None = Field(default=None, max_length=255)
    headline: str | None = Field(default=None, max_length=255)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "workEmail" in data and "email" not in data:
                data["email"] = data["workEmail"]
            if "fullName" in data and "full_name" not in data:
                data["full_name"] = data["fullName"]
            if "companyName" in data and "org_name" not in data:
                data["org_name"] = data["companyName"]
            if "role" in data and isinstance(data["role"], str):
                data["role"] = data["role"].lower()
        return data


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: UserRole
    org_id: uuid.UUID | None
    is_email_verified: bool
    status: str
    avatar_url: str | None = None
    headline: str | None = None
    phone: str | None = None
    bio: str | None = None
    course: str | None = None
    branch: str | None = None
    academic_year: str | None = None
    college_name: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
    years_experience: float | None = None
    location: str | None = None
    designation: str | None = None
    department: str | None = None
    is_org_admin: bool = False
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserOut


class RegisterResponse(BaseModel):
    success: bool = True
    email: EmailStr
    role: UserRole
    is_email_verified: bool = False
    otp_required: bool = True
    expires_in_sec: int
    redirect_url: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    purpose: str = "REGISTRATION_VERIFY"

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "otp" in data and "code" not in data:
                data["code"] = data["otp"]
        return data


class ResendOtpRequest(BaseModel):
    email: EmailStr
    purpose: str = "REGISTRATION_VERIFY"


class ResendOtpResponse(BaseModel):
    success: bool = True
    message: str
    expires_in_sec: int
    cooldown_sec: int


class OtpStatusResponse(BaseModel):
    expires_in_sec: int
    cooldown_remaining_sec: int
    ttl_sec: int
    cooldown_sec: int


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    success: bool = True
    email: EmailStr
    expiresInSec: int
    redirectUrl: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    newPassword: str = Field(min_length=8, max_length=128)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "new_password" in data and "newPassword" not in data:
                data["newPassword"] = data["new_password"]
            if "code" in data and "otp" not in data:
                data["otp"] = data["code"]
        return data


class ResetPasswordResponse(BaseModel):
    success: bool = True
    message: str
    redirectUrl: str = "/login"



# -------------------------------------------------------------- profile
class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    headline: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=160)
    years_experience: float | None = Field(default=None, ge=0, le=60)
    course: str | None = Field(default=None, max_length=120)
    branch: str | None = Field(default=None, max_length=160)
    academic_year: str | None = Field(default=None, max_length=40)
    college_name: str | None = Field(default=None, max_length=255)
    github_url: str | None = Field(default=None, max_length=500)
    linkedin_url: str | None = Field(default=None, max_length=500)
    portfolio_url: str | None = Field(default=None, max_length=500)


class RecruiterProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    designation: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=20)
    linkedin_url: str | None = Field(default=None, max_length=500)
    org_name: str | None = Field(default=None, max_length=255)
    org_website: str | None = Field(default=None, max_length=500)
    org_industry: str | None = Field(default=None, max_length=120)
    org_company_size: str | None = Field(default=None, max_length=60)
    org_headquarters: str | None = Field(default=None, max_length=120)
    org_bio: str | None = Field(default=None, max_length=5000)


# ---------------------------------------------------------------- skills
class SkillIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str | None = Field(default=None, max_length=80)
    proficiency: int | None = Field(default=None, ge=1, le=10)
    years_experience: float | None = Field(default=None, ge=0, le=60)


class SkillOut(BaseModel):
    name: str
    category: str | None = None
    proficiency: int | None = None
    years_experience: float | None = None


class SkillsUpdate(BaseModel):
    skills: list[SkillIn] = Field(default_factory=list, max_length=100)


# ---------------------------------------------------------------- resume
class ResumeOut(BaseModel):
    id: uuid.UUID
    cloudinary_public_id: str
    secure_url: str
    resource_type: str
    file_name: str
    file_size: int
    mime_type: str
    status: ResumeStatus
    uploaded_at: datetime
    parse_error: str | None = None
    is_active: bool


# ------------------------------------------------------------------- job
class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    job_description: str = Field(min_length=1, max_length=20000)
    department: str | None = Field(default=None, max_length=120)
    experience_level: str | None = Field(default=None, max_length=40)
    skills_required: list[str] = Field(default_factory=list, max_length=50)
    status: JobStatus = JobStatus.OPEN

    @field_validator("skills_required")
    @classmethod
    def _clean_skills(cls, v: list[str]) -> list[str]:
        return [s.strip() for s in v if s and s.strip()]


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    job_description: str | None = Field(default=None, min_length=1, max_length=20000)
    department: str | None = Field(default=None, max_length=120)
    experience_level: str | None = Field(default=None, max_length=40)
    skills_required: list[str] | None = Field(default=None, max_length=50)
    status: JobStatus | None = None
    is_archived: bool | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    department: str | None
    experience_level: str | None
    job_description: str
    skills_required: list[str]
    status: JobStatus
    is_archived: bool
    created_at: datetime
    rubric_weights: dict[str, float] | None = None


# ------------------------------------------------------------------ rubrics
class CompetencyItem(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=120)
    weight: float = Field(ge=0, le=100)
    is_must_have: bool = False
    description: str | None = None
    evidence_signals: list[str] = Field(default_factory=list)


class RubricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    version: int
    status: RubricStatus
    title: str
    weights: dict[str, float]
    competencies: list[dict[str, Any]]
    custom_instructions: str | None = None
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None = None
    approved_by: uuid.UUID | None = None


class RubricUpdate(BaseModel):
    """Content edits only.

    Promotion of a draft to APPROVED is deliberately absent: it is a separate
    explicit action (`POST /jobs/{job_id}/rubric/approve`) so that an AI
    proposal can never become the scoring rubric as a side effect of a save.
    """

    weights: dict[str, float] | None = None
    competencies: list[CompetencyItem] | None = Field(default=None, max_length=50)
    custom_instructions: str | None = Field(default=None, max_length=8000)
    title: str | None = Field(default=None, max_length=255)


# ------------------------------------------------------------ scheduling
class InterviewScheduleRequest(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID | None = None
    scheduled_at: datetime
    duration_minutes: int = Field(default=45, ge=5, le=240)
    join_window_minutes: int = Field(default=15, ge=0, le=120)
    session_type: str = Field(default="live", max_length=30)
    config: dict[str, Any] = Field(default_factory=dict)
    message: str | None = Field(default=None, max_length=2000)


class InterviewRescheduleRequest(BaseModel):
    scheduled_at: datetime
    duration_minutes: int | None = Field(default=None, ge=5, le=240)


# ---------------------------------------------------------------- session
class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    org_id: uuid.UUID
    job_id: uuid.UUID | None
    candidate_id: uuid.UUID
    recruiter_id: uuid.UUID | None
    session_type: str
    status: SessionStatus
    current_stage: InterviewStage
    agent_state: str
    scheduled_at: datetime
    duration_minutes: int
    started_at: datetime | None
    ended_at: datetime | None
    config: dict[str, Any]
    total_score: float | None
    final_recommendation: str | None


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID | None = None
    candidate_id: uuid.UUID
    status: InvitationStatus
    responded_at: datetime | None
    message: str | None
    created_at: datetime
    session: SessionOut | None = None
    job_title: str | None = None
    org_name: str | None = None


# --------------------------------------------------------------- proctoring
class ProctoringEventIn(BaseModel):
    event_type: str
    severity: Severity = Severity.INFO
    detail: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    occurred_at: datetime | None = None


# ----------------------------------------------------------------- coding
class CodeRunRequest(BaseModel):
    language: str = Field(min_length=1, max_length=40)
    code: str = Field(min_length=1, max_length=200000)
    turn_index: int = Field(default=0, ge=0)


# ------------------------------------------------------------ notifications
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    notification_type: str
    title: str
    body: str | None
    payload: dict[str, Any]
    is_read: bool
    created_at: datetime


# -------------------------------------------------------------- scorecard
class CompetencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    competency: str
    score: float | None
    weight: float | None
    evidence: str | None
    evaluator_comment: str | None


class ScorecardOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    overall_score: float | None
    recommendation: str | None
    executive_summary: str | None
    strengths: list[str]
    concerns: list[str]
    model_used: str | None
    generated_at: datetime | None
    competencies: list[CompetencyOut]


# ------------------------------------------------------------------- admin
class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    tier: str = Field(default="starter", max_length=20)
    industry: str | None = None
    website_url: str | None = None
    company_size: str | None = None
    headquarters_city: str | None = None


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    tier: str
    industry: str | None
    website_url: str | None
    company_size: str | None
    headquarters_city: str | None
    is_active: bool
    created_at: datetime


class AdminUserOut(UserOut):
    organization_name: str | None = None
    interview_count: int = 0
