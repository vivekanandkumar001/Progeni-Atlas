from enum import Enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# =============================================================================
# ENUMS
# =============================================================================

class UserRole(str, Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class OrgTier(str, Enum):
    SANDBOX = "sandbox"
    GROWTH = "growth"
    ENTERPRISE = "enterprise"

# =============================================================================
# DOMAIN & CONTRACT MODELS (PYDANTIC V2)
# =============================================================================

class Organization(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="UUID primary key")
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100)
    tier: OrgTier = Field(default=OrgTier.SANDBOX)
    created_at: datetime
    updated_at: datetime


class UserPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(..., description="UUID primary key")
    org_id: Optional[str] = Field(None, description="Nullable FK to Organization")
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = Field(default=UserRole.CANDIDATE)
    status: UserStatus = Field(default=UserStatus.ACTIVE)
    created_at: datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=255)
    role: UserRole = Field(default=UserRole.CANDIDATE)
    org_slug: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserPayload
