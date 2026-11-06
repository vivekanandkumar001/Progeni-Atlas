"""Super admin APIs. Backend enforces the boundary; the UI only hides buttons."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_super_admin
from app.database import get_db
from app.models import (
    AuditLog,
    InterviewSession,
    Organization,
    OrgTier,
    Scorecard,
    SessionStatus,
    SystemConfig,
    User,
    UserRole,
    UserStatus,
)
from app.schemas import JobOut, OrgCreate, OrgOut, SessionOut, UserOut
from app.services import audit
from app.services.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _slugify(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "org"
    return base[:120]


@router.get("/overview", response_model=dict)
def overview(
    db: Session = Depends(get_db), _: User = Depends(require_super_admin)
) -> dict:
    org_count = db.scalar(select(func.count()).select_from(Organization)) or 0
    user_rows = db.execute(
        select(User.role, func.count()).group_by(User.role)
    ).all()
    by_role = {role.value: count for role, count in user_rows}
    interview_rows = db.execute(
        select(InterviewSession.status, func.count()).group_by(InterviewSession.status)
    ).all()
    by_status = {s.value: count for s, count in interview_rows}
    scored = db.scalar(select(func.count()).select_from(Scorecard)) or 0
    return {
        "organizations": org_count,
        "users": sum(by_role.values()),
        "users_by_role": by_role,
        "interviews": sum(by_status.values()),
        "interviews_by_status": by_status,
        "scorecards": scored,
    }


@router.get("/organizations", response_model=list[OrgOut])
def list_orgs(
    db: Session = Depends(get_db), _: User = Depends(require_super_admin)
) -> list[Organization]:
    return list(db.scalars(select(Organization).order_by(Organization.created_at.desc())))


@router.post("/organizations", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
def create_org(
    payload: OrgCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
) -> Organization:
    base = _slugify(payload.name)
    slug, suffix = base, 1
    while db.scalar(select(Organization).where(Organization.slug == slug)):
        suffix += 1
        slug = f"{base}-{suffix}"
    try:
        org = Organization(
            name=payload.name,
            slug=slug,
            tier=OrgTier(payload.tier),
            industry=payload.industry,
            website_url=payload.website_url,
            company_size=payload.company_size,
            headquarters_city=payload.headquarters_city,
        )
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid tier: {payload.tier}") from None
    db.add(org)
    db.commit()
    db.refresh(org)
    audit.record(
        db,
        action="admin.org_create",
        actor_id=admin.id,
        org_id=org.id,
        entity_type="organization",
        entity_id=org.id,
        request=request,
    )
    return org


@router.get("/users", response_model=list[dict])
def list_users(
    role: UserRole | None = Query(default=None),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
) -> list[dict]:
    stmt = select(User)
    if role is not None:
        stmt = stmt.where(User.role == role)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(User.full_name.ilike(like) | User.email.ilike(like))
    users = list(db.scalars(stmt.order_by(User.created_at.desc()).limit(limit)))

    org_names = {
        org.id: org.name for org in db.scalars(select(Organization))
    }
    counts = dict(
        db.execute(
            select(InterviewSession.candidate_id, func.count())
            .where(InterviewSession.candidate_id.in_([u.id for u in users] or [None]))
            .group_by(InterviewSession.candidate_id)
        ).all()
    )

    return [
        {
            **{k: v for k, v in UserOut.model_validate(u).model_dump(mode="json").items()},
            "status": u.status.value,
            "organization_name": org_names.get(u.org_id) if u.org_id else None,
            "interview_count": counts.get(u.id, 0),
        }
        for u in users
    ]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
) -> User:
    email = str(payload.get("email", "")).lower().strip()
    password = str(payload.get("password", ""))
    full_name = str(payload.get("full_name", "")).strip()
    role_raw = str(payload.get("role", "candidate"))
    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="A valid email is required")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="password must be at least 8 characters")
    if not full_name:
        raise HTTPException(status_code=422, detail="full_name is required")
    try:
        role = UserRole(role_raw)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {role_raw}") from None
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email is already registered")

    org_id = payload.get("org_id")
    if org_id is not None:
        try:
            org_uuid = uuid.UUID(str(org_id))
        except ValueError:
            raise HTTPException(status_code=422, detail="Malformed org_id") from None
        if db.get(Organization, org_uuid) is None:
            raise HTTPException(status_code=404, detail="Organization not found")
    else:
        org_uuid = None

    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        org_id=org_uuid,
        status=UserStatus.ACTIVE,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit.record(
        db,
        action="admin.user_create",
        actor_id=admin.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={"role": role.value},
    )
    return user


@router.patch("/users/{user_id}/status", response_model=UserOut)
def set_user_status(
    user_id: uuid.UUID,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=409, detail="You cannot change your own status")
    raw = str(payload.get("status", "")).lower()
    try:
        user.status = UserStatus(raw)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {raw}") from None
    db.commit()
    db.refresh(user)
    audit.record(
        db,
        action="admin.user_status_change",
        actor_id=admin.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={"status": raw},
    )
    return user


@router.patch("/users/{user_id}/role", response_model=UserOut)
def set_user_role(
    user_id: uuid.UUID,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=409, detail="You cannot change your own role")
    raw = str(payload.get("role", "")).lower()
    try:
        user.role = UserRole(raw)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {raw}") from None
    db.commit()
    db.refresh(user)
    audit.record(
        db,
        action="admin.user_role_change",
        actor_id=admin.id,
        org_id=user.org_id,
        entity_type="user",
        entity_id=user.id,
        request=request,
        detail={"role": raw},
    )
    return user


@router.get("/interviews", response_model=list[SessionOut])
def list_all_interviews(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
) -> list[InterviewSession]:
    return list(
        db.scalars(
            select(InterviewSession)
            .order_by(InterviewSession.scheduled_at.desc())
            .limit(limit)
        )
    )


@router.get("/audit-logs", response_model=list[dict])
def list_audit_logs(
    action: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
) -> list[dict]:
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    rows = list(db.scalars(stmt.order_by(AuditLog.created_at.desc()).limit(limit)))
    return [
        {
            "id": str(r.id),
            "action": r.action,
            "actor_id": str(r.actor_id) if r.actor_id else None,
            "org_id": str(r.org_id) if r.org_id else None,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "ip_address": r.ip_address,
            "detail": r.detail,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/config", response_model=list[dict])
def list_config(
    db: Session = Depends(get_db), _: User = Depends(require_super_admin)
) -> list[dict]:
    return [
        {"key": c.key, "value": c.value, "description": c.description}
        for c in db.scalars(select(SystemConfig).order_by(SystemConfig.key))
    ]


@router.put("/config/{key}", response_model=dict)
def upsert_config(
    key: str,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin),
) -> dict:
    row = db.scalar(select(SystemConfig).where(SystemConfig.key == key))
    if row is None:
        row = SystemConfig(key=key)
        db.add(row)
    row.value = payload.get("value") or {}
    row.description = payload.get("description")
    row.updated_by = admin.id
    db.commit()
    db.refresh(row)
    audit.record(
        db,
        action="admin.config_update",
        actor_id=admin.id,
        entity_type="system_config",
        entity_id=key,
        request=request,
    )
    return {"key": row.key, "value": row.value, "description": row.description}
