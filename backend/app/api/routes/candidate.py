"""Candidate-facing APIs. Every query is scoped to the authenticated candidate."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_session, require_candidate
from app.config import settings
from app.database import get_db
from app.models import (
    AgentState,
    CandidateSkill,
    CandidateResume,
    InterviewInvitation,
    InterviewSession,
    InterviewStage,
    InvitationStatus,
    Job,
    JobStatus,
    Notification,
    NotificationType,
    Organization,
    ResumeStatus,
    SessionStatus,
    Skill,
    User,
    UserRole,
)
from app.schemas import (
    InvitationOut,
    NotificationOut,
    ProfileUpdate,
    ResumeOut,
    SessionOut,
    SkillIn,
    SkillOut,
    SkillsUpdate,
    UserOut,
)
from app.services import audit, notifications
from app.services.cloudinary_service import StorageError, delete, upload_bytes
from app.services.resume_parser import ParseError, derive_skills, extract_text, parse_resume_text
from app.services.vector_service import vector_db

router = APIRouter(prefix="/api/candidate", tags=["candidate"])


@router.get("/profile", response_model=UserOut)
def get_profile(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> User:
    return current


@router.patch("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> User:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current, field, value)
    db.commit()
    db.refresh(current)
    audit.record(
        db,
        action="candidate.profile_update",
        actor_id=current.id,
        org_id=current.org_id,
        entity_type="user",
        entity_id=current.id,
        request=request,
        detail={"fields": list(payload.model_dump(exclude_unset=True).keys())},
    )
    return current


@router.post("/avatar", response_model=UserOut)
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> User:
    """Uploads candidate avatar directly to Cloudinary. Zero binary blobs in PostgreSQL."""
    allowed = {"image/jpeg", "image/png", "image/webp"}
    mime = (file.content_type or "").lower().split(";")[0].strip()
    if mime not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, and WebP images are supported for avatars",
        )
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Avatar image exceeds 5 MB limit",
        )
    if current.avatar_public_id:
        try:
            delete(current.avatar_public_id, resource_type="image")
        except StorageError:
            pass

    filename = (file.filename or f"avatar_{current.id}.jpg").strip()[:255]
    try:
        stored = upload_bytes(
            data,
            folder=f"talentpulse/avatars/{current.id}",
            filename=filename,
            mime_type=mime,
            resource_type="image",
            purpose="avatar",
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    current.avatar_public_id = stored.public_id
    current.avatar_url = stored.secure_url
    db.commit()
    db.refresh(current)
    audit.record(
        db,
        action="candidate.avatar_upload",
        actor_id=current.id,
        org_id=current.org_id,
        entity_type="user",
        entity_id=current.id,
        request=request,
    )
    return current


@router.delete("/avatar", response_model=UserOut)
def delete_avatar(
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> User:
    """Deletes candidate avatar from Cloudinary and clears metadata in PostgreSQL."""
    if current.avatar_public_id:
        try:
            delete(current.avatar_public_id, resource_type="image")
        except StorageError:
            pass
    current.avatar_public_id = None
    current.avatar_url = None
    db.commit()
    db.refresh(current)
    audit.record(
        db,
        action="candidate.avatar_delete",
        actor_id=current.id,
        org_id=current.org_id,
        entity_type="user",
        entity_id=current.id,
        request=request,
    )
    return current


# ------------------------------------------------------------------- skills
@router.get("/skills", response_model=list[SkillOut])
def list_skills(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> list[dict]:
    rows = db.execute(
        select(CandidateSkill, Skill)
        .join(Skill, Skill.id == CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id == current.id)
        .order_by(Skill.name)
    ).all()
    return [
        {
            "name": skill.name,
            "category": skill.category,
            "proficiency": link.proficiency,
            "years_experience": link.years_experience,
        }
        for link, skill in rows
    ]


@router.put("/skills", response_model=list[SkillOut])
def replace_skills(
    payload: SkillsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> list[dict]:
    for link in db.scalars(
        select(CandidateSkill).where(CandidateSkill.candidate_id == current.id)
    ):
        db.delete(link)
    db.flush()

    for item in payload.skills:
        name = item.name.strip()
        skill = db.scalar(select(Skill).where(Skill.name == name))
        if skill is None:
            skill = Skill(name=name, category=item.category)
            db.add(skill)
            db.flush()
        db.add(
            CandidateSkill(
                candidate_id=current.id,
                skill_id=skill.id,
                proficiency=item.proficiency,
                years_experience=item.years_experience,
            )
        )
    db.commit()
    audit.record(
        db,
        action="candidate.skills_replace",
        actor_id=current.id,
        entity_type="user",
        entity_id=current.id,
        request=request,
        detail={"count": len(payload.skills)},
    )
    return list_skills(db=db, current=current)


@router.get("/skills/suggestions", response_model=list[str])
def skill_suggestions(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> list[str]:
    """Derived from the candidate's own parsed resume. Not a source of truth."""
    resume = db.scalar(
        select(CandidateResume)
        .where(CandidateResume.candidate_id == current.id, CandidateResume.is_active.is_(True))
        .order_by(CandidateResume.uploaded_at.desc())
    )
    if resume is None or not resume.parsed_text:
        return []
    return derive_skills(resume.parsed_text)


# ------------------------------------------------------------------ resumes
@router.get("/resume", response_model=list[ResumeOut])
def list_resumes(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> list[CandidateResume]:
    return list(
        db.scalars(
            select(CandidateResume)
            .where(CandidateResume.candidate_id == current.id)
            .order_by(CandidateResume.uploaded_at.desc())
        )
    )


@router.post("/resume", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> CandidateResume:
    allowed = settings.allowed_resume_mimes
    mime = (file.content_type or "").lower().split(";")[0].strip()
    if mime not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(allowed))}",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
        )

    # Check the magic bytes so a renamed .exe is not accepted.
    if not data.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content is not a valid PDF",
        )

    filename = (file.filename or "resume.pdf").strip()[:255]
    try:
        stored = upload_bytes(
            data,
            folder=f"talentpulse/resumes/{current.id}",
            filename=filename,
            mime_type=mime,
            resource_type="raw",
            purpose="resume",
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    for old in db.scalars(
        select(CandidateResume).where(
            CandidateResume.candidate_id == current.id, CandidateResume.is_active.is_(True)
        )
    ):
        old.is_active = False

    resume = CandidateResume(
        candidate_id=current.id,
        cloudinary_public_id=stored.public_id,
        secure_url=stored.secure_url,
        resource_type=stored.resource_type,
        purpose="resume",
        file_name=filename,
        file_size=stored.file_size,
        mime_type=mime,
        status=ResumeStatus.UPLOADED,
        is_active=True,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    # Parse inline. Status reflects the real outcome; never faked as PARSED.
    try:
        text = extract_text(data, mime)
    except ParseError as exc:
        resume.status = ResumeStatus.FAILED
        resume.parse_error = str(exc)[:1000]
        db.commit()
        db.refresh(resume)
        notifications.push(
            db,
            user_id=current.id,
            notification_type=NotificationType.RESUME_FAILED,
            title="Resume could not be parsed",
            body=str(exc)[:400],
            payload={"resume_id": str(resume.id)},
        )
        db.commit()
    else:
        resume.status = ResumeStatus.PARSED
        resume.parsed_text = text
        try:
            parsed_data = parse_resume_text(text)
            if parsed_data.get("phone") and not current.phone:
                current.phone = parsed_data["phone"]
            if parsed_data.get("linkedin") and not current.linkedin_url:
                current.linkedin_url = parsed_data["linkedin"]
            if parsed_data.get("github") and not current.github_url:
                current.github_url = parsed_data["github"]
            if parsed_data.get("website") and not current.portfolio_url:
                current.portfolio_url = parsed_data["website"]
        except Exception:
            pass
        db.commit()
        db.refresh(resume)
        try:
            vector_db.index_resume_chunks(
                current.id, text, {"filename": filename, "resume_id": str(resume.id)}
            )
        except Exception:
            pass
        notifications.push(
            db,
            user_id=current.id,
            notification_type=NotificationType.RESUME_PARSED,
            title="Resume uploaded and parsed",
            body=f"{filename} is ready for interview matching.",
            payload={"resume_id": str(resume.id)},
        )
        db.commit()

    audit.record(
        db,
        action="candidate.resume_upload",
        actor_id=current.id,
        org_id=current.org_id,
        entity_type="candidate_resume",
        entity_id=resume.id,
        request=request,
        detail={"public_id": stored.public_id, "status": resume.status.value},
    )
    return resume


@router.delete(
    "/resume/{resume_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete_resume(
    resume_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> None:
    resume = db.get(CandidateResume, resume_id)
    if resume is None or resume.candidate_id != current.id:
        raise HTTPException(status_code=404, detail="Resume not found")
    public_id, is_active = resume.cloudinary_public_id, resume.is_active
    db.delete(resume)
    db.commit()
    try:
        delete(public_id, resource_type="raw")
    except StorageError:
        # Row is already gone; surface it rather than claiming full success.
        raise HTTPException(
            status_code=502, detail="Resume record deleted but Cloudinary cleanup failed"
        ) from None
    audit.record(
        db,
        action="candidate.resume_delete",
        actor_id=current.id,
        entity_type="candidate_resume",
        entity_id=resume_id,
        request=request,
        detail={"was_active": is_active},
    )


# ---------------------------------------------------------------- resumes
@router.get("/dashboard", response_model=dict)
def dashboard(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> dict:
    now = datetime.now(timezone.utc)
    active_resume = db.scalar(
        select(CandidateResume)
        .where(CandidateResume.candidate_id == current.id, CandidateResume.is_active.is_(True))
        .order_by(CandidateResume.uploaded_at.desc())
    )
    skill_count = db.scalar(
        select(func.count()).select_from(CandidateSkill).where(
            CandidateSkill.candidate_id == current.id
        )
    ) or 0
    upcoming = db.scalars(
        select(InterviewSession)
        .where(
            InterviewSession.candidate_id == current.id,
            InterviewSession.status == SessionStatus.SCHEDULED,
            InterviewSession.scheduled_at >= now - timedelta(hours=2),
        )
        .order_by(InterviewSession.scheduled_at.asc())
        .limit(10)
    ).all()
    recent = db.scalars(
        select(InterviewSession)
        .where(
            InterviewSession.candidate_id == current.id,
            InterviewSession.status.in_([SessionStatus.COMPLETED, SessionStatus.ABANDONED]),
        )
        .order_by(InterviewSession.scheduled_at.desc())
        .limit(10)
    ).all()
    unread = db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current.id, Notification.is_read.is_(False)
        )
    ) or 0

    profile_fields = [
        current.full_name, current.phone, current.headline, current.bio, current.location,
        current.college_name, current.course, current.branch, current.academic_year,
        current.github_url, current.linkedin_url, current.portfolio_url,
    ]
    filled = sum(1 for f in profile_fields if f)
    completion = round((filled + (1 if active_resume else 0) + (1 if skill_count else 0))
                       / (len(profile_fields) + 2) * 100)

    return {
        "profile_completion": completion,
        "has_resume": active_resume is not None,
        "resume_status": active_resume.status.value if active_resume else None,
        "skill_count": skill_count,
        "unread_notifications": unread,
        "upcoming_interviews": [SessionOut.model_validate(s).model_dump(mode="json") for s in upcoming],
        "recent_interviews": [SessionOut.model_validate(s).model_dump(mode="json") for s in recent],
    }


# ------------------------------------------------------------- interviews
@router.get("/interviews", response_model=list[SessionOut])
def list_interviews(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> list[InterviewSession]:
    return list(
        db.scalars(
            select(InterviewSession)
            .where(InterviewSession.candidate_id == current.id)
            .order_by(InterviewSession.scheduled_at.desc())
        )
    )


@router.get("/invitations", response_model=list[InvitationOut])
def list_invitations(
    db: Session = Depends(get_db), current: User = Depends(require_candidate)
) -> list[InvitationOut]:
    try:
        rows = db.execute(
            select(InterviewInvitation, InterviewSession, Job, Organization)
            .outerjoin(InterviewSession, InterviewSession.id == InterviewInvitation.session_id)
            .outerjoin(Job, Job.id == InterviewSession.job_id)
            .outerjoin(Organization, Organization.id == InterviewInvitation.org_id)
            .where(InterviewInvitation.candidate_id == current.id)
        ).all()
        out: list[InvitationOut] = []
        for invite, session, job, org in rows:
            out.append(
                InvitationOut(
                    **{
                        "id": invite.id,
                        "session_id": invite.session_id,
                        "candidate_id": invite.candidate_id,
                        "status": invite.status,
                        "responded_at": invite.responded_at,
                        "message": invite.message,
                        "created_at": invite.created_at,
                    },
                    session=SessionOut.model_validate(session) if session else None,
                    job_title=job.title if job else None,
                    org_name=org.name if org else None,
                )
            )
        return out
    except Exception as e:
        return []


def _load_invitation(
    invitation_id: uuid.UUID, current: User, db: Session
) -> tuple[InterviewInvitation, InterviewSession]:
    invite = db.get(InterviewInvitation, invitation_id)
    if invite is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if current.role == UserRole.CANDIDATE and invite.candidate_id != current.id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    session = db.get(InterviewSession, invite.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return invite, session


@router.post("/invitations/{invitation_id}/accept", response_model=InvitationOut)
def accept_invitation(
    invitation_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> InvitationOut:
    invite, session = _load_invitation(invitation_id, current, db)
    if invite.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=409, detail=f"Invitation is already {invite.status.value}"
        )
    invite.status = InvitationStatus.ACCEPTED
    invite.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invite)
    audit.record(
        db,
        action="candidate.invitation_accept",
        actor_id=current.id,
        org_id=invite.org_id,
        entity_type="interview_invitation",
        entity_id=invite.id,
        request=request,
    )
    return _invitation_out(db, invite, session)


@router.post("/invitations/{invitation_id}/decline", response_model=InvitationOut)
def decline_invitation(
    invitation_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> InvitationOut:
    invite, session = _load_invitation(invitation_id, current, db)
    if invite.status not in {InvitationStatus.PENDING, InvitationStatus.ACCEPTED}:
        raise HTTPException(
            status_code=409, detail=f"Invitation is already {invite.status.value}"
        )
    invite.status = InvitationStatus.DECLINED
    invite.responded_at = datetime.now(timezone.utc)
    if session.status == SessionStatus.SCHEDULED:
        session.status = SessionStatus.ABANDONED
    db.commit()
    db.refresh(invite)
    audit.record(
        db,
        action="candidate.invitation_decline",
        actor_id=current.id,
        org_id=invite.org_id,
        entity_type="interview_invitation",
        entity_id=invite.id,
        request=request,
    )
    return _invitation_out(db, invite, session)


def _invitation_out(
    db: Session, invite: InterviewInvitation, session: InterviewSession
) -> InvitationOut:
    from app.models import Organization

    job = db.get(Job, session.job_id) if session.job_id else None
    org = db.get(Organization, invite.org_id)
    return InvitationOut(
        id=invite.id,
        session_id=invite.session_id,
        candidate_id=invite.candidate_id,
        status=invite.status,
        responded_at=invite.responded_at,
        message=invite.message,
        created_at=invite.created_at,
        session=SessionOut.model_validate(session),
        job_title=job.title if job else None,
        org_name=org.name if org else None,
    )


# ------------------------------------------------------------------ proctoring
@router.post("/sessions/{session_id}/proctoring-events", status_code=status.HTTP_201_CREATED)
def report_proctoring_event(
    session_id: uuid.UUID,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> dict:
    from app.models import ProctoringEvent, ProctoringEventType, Severity

    session = get_owned_session(session_id, current, db)
    if session.status not in {SessionStatus.SCHEDULED, SessionStatus.IN_PROGRESS}:
        raise HTTPException(status_code=409, detail="Session is not accepting events")

    try:
        event_type = ProctoringEventType(str(payload.get("event_type")))
    except ValueError:
        raise HTTPException(
            status_code=422, detail="Unknown proctoring event type"
        ) from None
    try:
        severity = Severity(str(payload.get("severity", "info")).lower())
    except ValueError:
        severity = Severity.INFO

    event = ProctoringEvent(
        session_id=session.id,
        candidate_id=current.id,
        event_type=event_type,
        severity=severity,
        detail=(payload.get("detail") or "")[:2000] or None,
        metadata_json=payload.get("metadata") or {},
    )
    db.add(event)
    db.commit()
    return {"id": str(event.id), "status": "recorded", "occurred_at": event.occurred_at.isoformat()}


# ---------------------------------------------------------------- notifications
@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[Notification]:
    stmt = select(Notification).where(Notification.user_id == current.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return list(
        db.scalars(stmt.order_by(Notification.created_at.desc()).limit(limit))
    )


@router.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db), current: User = Depends(get_current_user)
) -> dict:
    rows = db.scalars(
        select(Notification).where(
            Notification.user_id == current.id, Notification.is_read.is_(False)
        )
    ).all()
    now = datetime.now(timezone.utc)
    for row in rows:
        row.is_read = True
        row.read_at = now
    db.commit()
    return {"updated": len(rows)}


# ------------------------------------------------------------- practice interview
@router.post("/practice-interview", response_model=dict, status_code=status.HTTP_201_CREATED)
@router.post("/practice", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_practice_interview(
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> dict:
    """Creates a real practice interview tailored to the candidate's target job role,
    supplied job description (via upload or pasted text), and active parsed resume.
    """
    # 1. Fetch candidate's active resume if available (optional for practice sessions)
    active_resume = db.scalar(
        select(CandidateResume)
        .where(
            CandidateResume.candidate_id == current.id,
            CandidateResume.is_active.is_(True),
        )
        .order_by(CandidateResume.uploaded_at.desc())
    )

    # 2. Extract payload fields based on content type
    content_type = request.headers.get("content-type", "").lower()
    job_role: str | None = None
    job_description: str | None = None
    jd_file: UploadFile | None = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        job_role = form.get("job_role") or form.get("jobRole")
        job_description = form.get("job_description") or form.get("jobDescription")
        file_val = form.get("jd_file") or form.get("jdFile") or form.get("file")
        if file_val is not None and hasattr(file_val, "read"):
            jd_file = file_val
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        job_role = body.get("job_role") or body.get("jobRole")
        job_description = body.get("job_description") or body.get("jobDescription")

    # 3. Validate job role
    if not job_role or not str(job_role).strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target job role is required.",
        )
    target_role = str(job_role).strip()

    # 4. Extract & validate job description
    jd_text = ""
    if jd_file is not None:
        file_bytes = await jd_file.read()
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Uploaded JD file is empty.",
            )
        if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"JD file exceeds {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
            )
        filename = (jd_file.filename or "jd.txt").lower()
        mime = (jd_file.content_type or "").lower().split(";")[0].strip()
        if not mime or mime == "application/octet-stream":
            if filename.endswith(".pdf"):
                mime = "application/pdf"
            elif filename.endswith(".docx"):
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif filename.endswith(".txt") or filename.endswith(".md"):
                mime = "text/plain"
        try:
            jd_text = extract_text(file_bytes, mime)
        except ParseError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not extract text from JD file: {exc}",
            )
    elif job_description and str(job_description).strip():
        jd_text = str(job_description).strip()
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a job description (either upload a file or paste text).",
        )

    if len(jd_text.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job description is too short to personalize your interview.",
        )

    # 5. Resolve org_id
    org_id = current.org_id
    if not org_id:
        default_org = db.scalar(select(Organization).order_by(Organization.created_at.asc()).limit(1))
        if default_org:
            org_id = default_org.id
        else:
            default_org = Organization(name="TalentPulse Practice", slug="talentpulse-practice")
            db.add(default_org)
            db.flush()
            org_id = default_org.id

    # 6. Create Job record
    job = Job(
        org_id=org_id,
        created_by=current.id,
        title=target_role,
        department="Engineering",
        experience_level="mid",
        skills_required=[],
        job_description=jd_text.strip(),
        status=JobStatus.OPEN,
    )
    db.add(job)
    db.flush()

    # 7. Create InterviewSession record
    now = datetime.now(timezone.utc)
    session = InterviewSession(
        id=uuid.uuid4(),
        org_id=org_id,
        job_id=job.id,
        candidate_id=current.id,
        recruiter_id=None,
        session_type="mock",
        status=SessionStatus.SCHEDULED,
        current_stage=InterviewStage.INTRO,
        agent_state=AgentState.READY,
        scheduled_at=now - timedelta(minutes=1),
        duration_minutes=45,
        join_window_minutes=120,
        config={
            "is_practice": True,
            "job_role": target_role,
            "job_description": jd_text.strip()[:2000],
        },
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    audit.record(
        db,
        action="candidate.practice_session_create",
        actor_id=current.id,
        org_id=org_id,
        entity_type="interview_session",
        entity_id=session.id,
        request=request,
        detail={"job_role": target_role, "job_id": str(job.id)},
    )

    return {
        "session_id": str(session.id),
        "job_id": str(job.id),
        "target_url": f"/candidate/interview/{session.id}",
        "status": session.status.value,
    }

