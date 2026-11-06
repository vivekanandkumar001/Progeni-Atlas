"""Recruiter/HR APIs. Every query is constrained to the caller's organization."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_org_membership, require_recruiter
from app.database import get_db
from app.models import (
    InterviewInvitation,
    InterviewSession,
    InterviewStage,
    InvitationStatus,
    Job,
    JobStatus,
    NotificationType,
    Organization,
    RubricStatus,
    RubricVersion,
    Scorecard,
    SessionStatus,
    User,
    UserRole,
    utcnow,
)
from app.schemas import (
    InterviewScheduleRequest,
    InterviewRescheduleRequest,
    InvitationOut,
    JobCreate,
    JobOut,
    JobUpdate,
    RecruiterProfileUpdate,
    RubricOut,
    RubricUpdate,
    SessionOut,
    UserOut,
)
from app.services import audit, notifications, rubric_service

router = APIRouter(prefix="/api/recruiter", tags=["recruiter"])


def _require_org_id(user: User) -> uuid.UUID:
    if user.org_id is None:
        raise HTTPException(
            status_code=403, detail="Your account is not attached to an organization"
        )
    return user.org_id


def _owned_job(job_id: uuid.UUID, db: Session, current: User) -> Job:
    """Load a job, hiding jobs that belong to another organization behind a 404."""
    job = db.get(Job, job_id)
    if job is None or job.org_id != _require_org_id(current):
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/profile", response_model=dict)
def get_profile(
    db: Session = Depends(get_db), current: User = Depends(require_recruiter)
) -> dict:
    org = db.get(Organization, _require_org_id(current))
    return {
        "user": UserOut.model_validate(current).model_dump(mode="json"),
        "organization": (
            {
                "id": str(org.id),
                "name": org.name,
                "slug": org.slug,
                "tier": org.tier.value,
                "industry": org.industry,
                "website_url": org.website_url,
                "company_size": org.company_size,
                "headquarters_city": org.headquarters_city,
                "bio": org.bio,
            }
            if org
            else None
        ),
    }


@router.patch("/profile", response_model=dict)
def update_profile(
    payload: RecruiterProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> dict:
    data = payload.model_dump(exclude_unset=True)
    org_fields = {
        "org_name": "name",
        "org_website": "website_url",
        "org_industry": "industry",
        "org_company_size": "company_size",
        "org_headquarters": "headquarters_city",
        "org_bio": "bio",
    }
    user_fields = {"full_name", "designation", "department", "phone", "linkedin_url"}

    org = db.get(Organization, _require_org_id(current))
    for key, value in data.items():
        if key in org_fields and org is not None:
            setattr(org, org_fields[key], value)
        elif key in user_fields:
            setattr(current, key, value)
    db.commit()
    db.refresh(current)
    audit.record(
        db,
        action="recruiter.profile_update",
        actor_id=current.id,
        org_id=current.org_id,
        entity_type="user",
        entity_id=current.id,
        request=request,
    )
    return get_profile(db=db, current=current)


@router.get("/dashboard", response_model=dict)
def dashboard(
    db: Session = Depends(get_db), current: User = Depends(require_recruiter)
) -> dict:
    org_id = _require_org_id(current)
    now = datetime.now(timezone.utc)

    total_candidates = db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.org_id.is_(None), User.role == UserRole.CANDIDATE)
    ) or 0
    scheduled = db.scalar(
        select(func.count())
        .select_from(InterviewSession)
        .where(
            InterviewSession.org_id == org_id,
            InterviewSession.status == SessionStatus.SCHEDULED,
        )
    ) or 0
    active = db.scalar(
        select(func.count())
        .select_from(InterviewSession)
        .where(
            InterviewSession.org_id == org_id,
            InterviewSession.status == SessionStatus.IN_PROGRESS,
        )
    ) or 0
    completed = db.scalar(
        select(func.count())
        .select_from(InterviewSession)
        .where(
            InterviewSession.org_id == org_id,
            InterviewSession.status == SessionStatus.COMPLETED,
        )
    ) or 0
    open_jobs = db.scalar(
        select(func.count())
        .select_from(Job)
        .where(Job.org_id == org_id, Job.status == JobStatus.OPEN, Job.is_archived.is_(False))
    ) or 0
    scored = db.execute(
        select(func.avg(Scorecard.overall_score), func.count())
        .join(InterviewSession, InterviewSession.id == Scorecard.session_id)
        .where(InterviewSession.org_id == org_id)
    ).one()
    avg_score = float(scored[0]) if scored[0] is not None else None
    scored_count = scored[1] or 0

    recent = db.scalars(
        select(InterviewSession)
        .where(InterviewSession.org_id == org_id)
        .order_by(InterviewSession.created_at.desc())
        .limit(8)
    ).all()

    return {
        "total_candidates": total_candidates,
        "active_interviews": active,
        "scheduled_interviews": scheduled,
        "completed_interviews": completed,
        "open_jobs": open_jobs,
        "assessment": {
            "average_score": avg_score,
            "scored_sessions": scored_count,
            "scoring_rate": round(scored_count / completed * 100, 1) if completed else None,
        },
        "recent_sessions": [SessionOut.model_validate(s).model_dump(mode="json") for s in recent],
    }


# ------------------------------------------------------------------- jobs
@router.get("/jobs", response_model=list[JobOut])
def list_jobs(
    include_archived: bool = Query(default=False),
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> list[Job]:
    org_id = _require_org_id(current)
    stmt = select(Job).where(Job.org_id == org_id)
    if not include_archived:
        stmt = stmt.where(Job.is_archived.is_(False))
    return list(db.scalars(stmt.order_by(Job.created_at.desc())))


@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(
    payload: JobCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> Job:
    org_id = _require_org_id(current)
    job = Job(
        org_id=org_id,
        created_by=current.id,
        title=payload.title,
        job_description=payload.job_description,
        department=payload.department,
        experience_level=payload.experience_level,
        skills_required=payload.skills_required,
        status=payload.status,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    audit.record(
        db,
        action="recruiter.job_create",
        actor_id=current.id,
        org_id=org_id,
        entity_type="job",
        entity_id=job.id,
        request=request,
        detail={"title": job.title},
    )
    return job


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> Job:
    return _owned_job(job_id, db, current)


@router.patch("/jobs/{job_id}", response_model=JobOut)
def update_job(
    job_id: uuid.UUID,
    payload: JobUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> Job:
    job = _owned_job(job_id, db, current)
    data = payload.model_dump(exclude_unset=True)
    if data.pop("is_archived", None) is not None:
        job.is_archived = payload.is_archived
        job.archived_at = utcnow() if payload.is_archived else None
        if payload.is_archived:
            job.status = JobStatus.ARCHIVED
    for key, value in data.items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    audit.record(
        db,
        action="recruiter.job_update",
        actor_id=current.id,
        org_id=job.org_id,
        entity_type="job",
        entity_id=job.id,
        request=request,
    )
    return job


@router.delete("/jobs/{job_id}", response_model=JobOut)
def archive_job(
    job_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> Job:
    job = _owned_job(job_id, db, current)
    job.is_archived = True
    job.status = JobStatus.ARCHIVED
    job.archived_at = utcnow()
    db.commit()
    db.refresh(job)
    audit.record(
        db,
        action="recruiter.job_archive",
        actor_id=current.id,
        org_id=job.org_id,
        entity_type="job",
        entity_id=job.id,
        request=request,
    )
    return job


# ---------------------------------------------------------------- rubrics
# Rubrics are versioned: a recruiter edits a DRAFT, and only an explicit
# approval promotes it. Editing an already-approved rubric opens the next
# version rather than rewriting the one that past interviews were scored with.
@router.get("/jobs/{job_id}/rubric", response_model=RubricOut)
def get_rubric(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> RubricVersion:
    """Latest rubric version for a job, seeded as a v1 DRAFT when none exists."""
    job = _owned_job(job_id, db, current)
    return rubric_service.get_or_create_default_rubric(db, job, current.id)


@router.get("/jobs/{job_id}/rubric/versions", response_model=list[RubricOut])
def get_rubric_versions(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> list[RubricVersion]:
    """Full version history, newest first. Superseded versions stay readable."""
    job = _owned_job(job_id, db, current)
    return rubric_service.list_rubric_versions(db, job.id)


@router.patch("/jobs/{job_id}/rubric", response_model=RubricOut)
def update_rubric(
    job_id: uuid.UUID,
    payload: RubricUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> RubricVersion:
    """Edit the rubric. Content only — approval is a separate explicit action."""
    job = _owned_job(job_id, db, current)
    data = payload.model_dump(exclude_unset=True)
    if not any(
        data.get(f) is not None
        for f in ("weights", "competencies", "custom_instructions", "title")
    ):
        raise HTTPException(
            status_code=422, detail="Provide at least one of: weights, competencies, custom_instructions, title"
        )

    competencies = data.get("competencies")
    if competencies is not None:
        competencies = [dict(c) for c in competencies]

    weights = data.get("weights")
    if weights is None and competencies is not None:
        # A caller editing only the competency list still means those weights;
        # keeping the previous weight map would validate the wrong numbers.
        weights = {c["name"]: float(c["weight"]) for c in competencies}

    previous = rubric_service.get_latest_rubric(db, job.id)
    rubric = rubric_service.update_rubric(
        db,
        job,
        weights=weights,
        competencies=competencies,
        custom_instructions=data.get("custom_instructions"),
        title=data.get("title"),
        user_id=current.id,
    )
    db.refresh(job)
    audit.record(
        db,
        action="recruiter.rubric_update",
        actor_id=current.id,
        org_id=job.org_id,
        entity_type="rubric_version",
        entity_id=rubric.id,
        request=request,
        detail={
            "job_id": str(job.id),
            "version": rubric.version,
            "status": rubric.status.value,
            "opened_new_version": previous is None or previous.id != rubric.id,
        },
    )
    return rubric


@router.post("/jobs/{job_id}/rubric/approve", response_model=RubricOut)
def approve_rubric(
    job_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> RubricVersion:
    """Explicitly promote the current draft to APPROVED."""
    job = _owned_job(job_id, db, current)
    latest = rubric_service.get_latest_rubric(db, job.id)
    if latest is not None and latest.status == RubricStatus.APPROVED:
        # Idempotent: approving twice must not stack version numbers.
        return latest

    rubric = rubric_service.approve_rubric(db, job, current.id)
    audit.record(
        db,
        action="recruiter.rubric_approve",
        actor_id=current.id,
        org_id=job.org_id,
        entity_type="rubric_version",
        entity_id=rubric.id,
        request=request,
        detail={"job_id": str(job.id), "version": rubric.version},
    )
    return rubric


# ---------------------------------------------------------------- sessions
@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    session_status: SessionStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> list[InterviewSession]:
    org_id = _require_org_id(current)
    stmt = select(InterviewSession).where(InterviewSession.org_id == org_id)
    if session_status is not None:
        stmt = stmt.where(InterviewSession.status == session_status)
    return list(db.scalars(stmt.order_by(InterviewSession.scheduled_at.desc())))


@router.post("/sessions", response_model=InvitationOut, status_code=status.HTTP_201_CREATED)
def schedule_interview(
    payload: InterviewScheduleRequest,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> InvitationOut:
    org_id = _require_org_id(current)
    candidate = db.get(User, payload.candidate_id)
    if candidate is None or candidate.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status != "active":
        raise HTTPException(status_code=409, detail="Candidate account is not active")

    if payload.job_id is not None:
        job = db.get(Job, payload.job_id)
        if job is None or job.org_id != org_id:
            raise HTTPException(status_code=404, detail="Job not found")

    if payload.scheduled_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="scheduled_at must be in the future")

    session = InterviewSession(
        org_id=org_id,
        job_id=payload.job_id,
        candidate_id=candidate.id,
        recruiter_id=current.id,
        session_type=payload.session_type,
        status=SessionStatus.SCHEDULED,
        current_stage=InterviewStage.INTRO,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        join_window_minutes=payload.join_window_minutes,
        config=payload.config,
    )
    db.add(session)
    db.flush()

    invitation = InterviewInvitation(
        session_id=session.id,
        candidate_id=candidate.id,
        org_id=org_id,
        recruiter_id=current.id,
        status=InvitationStatus.PENDING,
        message=payload.message,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    db.refresh(session)

    notifications.push(
        db,
        user_id=candidate.id,
        notification_type=NotificationType.INTERVIEW_INVITED,
        title="You have a new interview invitation",
        body=f"Scheduled for {payload.scheduled_at.isoformat()}",
        payload={"session_id": str(session.id), "invitation_id": str(invitation.id)},
    )
    db.commit()

    audit.record(
        db,
        action="recruiter.interview_schedule",
        actor_id=current.id,
        org_id=org_id,
        entity_type="interview_session",
        entity_id=session.id,
        request=request,
        detail={"candidate_id": str(candidate.id), "job_id": str(payload.job_id or "")},
    )
    job = db.get(Job, session.job_id) if session.job_id else None
    org = db.get(Organization, org_id)
    return InvitationOut(
        id=invitation.id,
        session_id=invitation.session_id,
        candidate_id=invitation.candidate_id,
        status=invitation.status,
        responded_at=invitation.responded_at,
        message=invitation.message,
        created_at=invitation.created_at,
        session=SessionOut.model_validate(session),
        job_title=job.title if job else None,
        org_name=org.name if org else None,
    )


@router.patch("/sessions/{session_id}/reschedule", response_model=SessionOut)
def reschedule_interview(
    session_id: uuid.UUID,
    payload: InterviewRescheduleRequest,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> InterviewSession:
    session = db.get(InterviewSession, session_id)
    if session is None or session.org_id != _require_org_id(current):
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.status in {SessionStatus.COMPLETED, SessionStatus.IN_PROGRESS}:
        raise HTTPException(status_code=409, detail="Session can no longer be rescheduled")
    if payload.scheduled_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="scheduled_at must be in the future")

    session.scheduled_at = payload.scheduled_at
    if payload.duration_minutes is not None:
        session.duration_minutes = payload.duration_minutes
    db.commit()
    db.refresh(session)

    notifications.push(
        db,
        user_id=session.candidate_id,
        notification_type=NotificationType.INTERVIEW_RESCHEDULED,
        title="Your interview was rescheduled",
        body=f"New time: {payload.scheduled_at.isoformat()}",
        payload={"session_id": str(session.id)},
    )
    db.commit()
    audit.record(
        db,
        action="recruiter.interview_reschedule",
        actor_id=current.id,
        org_id=session.org_id,
        entity_type="interview_session",
        entity_id=session.id,
        request=request,
    )
    return session


# ------------------------------------------------------------- candidates
@router.get("/candidates", response_model=list[dict])
def list_candidates(
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> list[dict]:
    require_org_membership(current, _require_org_id(current), db)
    stmt = select(User).where(User.role == UserRole.CANDIDATE, User.status == "active")
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(User.full_name.ilike(like) | User.email.ilike(like))
    rows = list(db.scalars(stmt.order_by(User.created_at.desc()).limit(limit)))

    out: list[dict] = []
    for candidate in rows:
        session_count = db.scalar(
            select(func.count())
            .select_from(InterviewSession)
            .where(
                InterviewSession.candidate_id == candidate.id,
                InterviewSession.org_id == _require_org_id(current),
            )
        ) or 0
        out.append(
            {
                "id": str(candidate.id),
                "full_name": candidate.full_name,
                "email": candidate.email,
                "headline": candidate.headline,
                "years_experience": candidate.years_experience,
                "college_name": candidate.college_name,
                "interview_count": session_count,
            }
        )
    return out


@router.get("/sessions/{session_id}/report", response_model=dict)
def session_report(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_recruiter),
) -> dict:
    from app.schemas import ScorecardOut

    session = db.get(InterviewSession, session_id)
    if session is None or session.org_id != _require_org_id(current):
        raise HTTPException(status_code=404, detail="Interview session not found")
    scorecard = db.scalar(select(Scorecard).where(Scorecard.session_id == session.id))
    candidate = db.get(User, session.candidate_id)
    job = db.get(Job, session.job_id) if session.job_id else None
    return {
        "session": SessionOut.model_validate(session).model_dump(mode="json"),
        "candidate": (
            {"id": str(candidate.id), "full_name": candidate.full_name, "email": candidate.email}
            if candidate
            else None
        ),
        "job_title": job.title if job else None,
        "scorecard": (
            ScorecardOut.model_validate(scorecard).model_dump(mode="json")
            if scorecard
            else {"status": "pending", "overall_score": None, "competencies": []}
        ),
    }
