"""FastAPI dependencies: authentication, role gates, org isolation (STEP 20)."""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Organization, User, UserRole, UserStatus
from app.services.security import (
    TOKEN_TYPE_ACCESS,
    TokenError,
    decode_token_safe,
    extract_bearer,
)

bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials

    if not token:
        raise CREDENTIALS_ERROR

    try:
        payload = decode_token_safe(extract_bearer(f"Bearer {token}"))
    except TokenError:
        raise CREDENTIALS_ERROR from None

    if not payload or payload.get("type") != TOKEN_TYPE_ACCESS:
        raise CREDENTIALS_ERROR

    subject = payload.get("sub")
    if not subject:
        raise CREDENTIALS_ERROR
    try:
        user_id = uuid.UUID(str(subject))
    except ValueError:
        raise CREDENTIALS_ERROR from None

    user = db.get(User, user_id)
    if user is None:
        raise CREDENTIALS_ERROR
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended"
        )
    return user


def require_role(*roles: UserRole):
    allowed = set(roles)

    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(sorted(r.value for r in allowed))}",
            )
        return user

    return _dep


require_candidate = require_role(UserRole.CANDIDATE)
require_recruiter = require_role(UserRole.RECRUITER)
require_super_admin = require_role(UserRole.SUPER_ADMIN)
require_staff = require_role(UserRole.RECRUITER, UserRole.SUPER_ADMIN)


def require_org_membership(
    user: User, org_id: uuid.UUID, db: Session
) -> Organization:
    """Recruiters may only touch their own org. Super admins may touch any."""
    if user.role == UserRole.SUPER_ADMIN:
        org = db.get(Organization, org_id)
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        return org
    if user.org_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resource belongs to another organization",
        )
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def get_owned_session(
    session_id: uuid.UUID,
    user: User,
    db: Session,
) -> "object":
    """Ownership check for interview sessions (IDOR protection)."""
    from app.models import InterviewSession

    sess = db.get(InterviewSession, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Interview session not found")

    if user.role == UserRole.SUPER_ADMIN:
        return sess
    if user.role == UserRole.CANDIDATE:
        if sess.candidate_id != user.id:
            # 404 (not 403) so existence is not disclosed across candidates.
            raise HTTPException(status_code=404, detail="Interview session not found")
        return sess
    if user.role == UserRole.RECRUITER:
        if sess.org_id != user.org_id:
            raise HTTPException(status_code=404, detail="Interview session not found")
        return sess
    raise HTTPException(status_code=403, detail="Not permitted")


def resolve_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))
