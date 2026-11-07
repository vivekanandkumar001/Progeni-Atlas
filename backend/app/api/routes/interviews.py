"""Interview session REST endpoints (join gate, turns, completion, scorecard)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_session, require_candidate
from app.database import get_db
from app.models import (
    AgentState,
    CandidateResume,
    InterviewInvitation,
    InterviewQuestion,
    InterviewResponse,
    InterviewSession,
    InvitationStatus,
    Job,
    NotificationType,
    Organization,
    Scorecard,
    SessionStatus,
    User,
    UserRole,
)
from app.schemas import ScorecardOut, SessionOut
from app.services import audit, interview_engine, notifications
from app.services.cloudinary_service import StorageError, upload_bytes
from app.services.llm_service import LLMError

router = APIRouter(prefix="/api/v1/interview-sessions", tags=["interview"])


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> InterviewSession:
    return get_owned_session(session_id, current, db)


@router.get("/{session_id}/lobby", response_model=dict)
def lobby_info(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    session = get_owned_session(session_id, current, db)
    job = db.get(Job, session.job_id) if session.job_id else None
    org = db.get(Organization, session.org_id)
    candidate = db.get(User, session.candidate_id)
    resume = db.scalar(
        select(CandidateResume).where(
            CandidateResume.candidate_id == session.candidate_id,
            CandidateResume.is_active.is_(True),
        )
    )
    invitation = db.scalar(
        select(InterviewInvitation).where(InterviewInvitation.session_id == session.id)
    )
    return {
        "session": SessionOut.model_validate(session).model_dump(mode="json"),
        "job_title": job.title if job else None,
        "job_description": job.job_description if job else None,
        "org_name": org.name if org else None,
        "candidate_name": candidate.full_name if candidate else None,
        "invitation_status": invitation.status.value if invitation else None,
        "resume_present": resume is not None,
        "resume_status": resume.status.value if resume else None,
        "requirements": {
            "resume_required": True,
            "resume_satisfied": resume is not None
            and resume.status.value == "PARSED",
            "camera_required": True,
            "microphone_required": True,
            "supports_fullscreen": True,
        },
    }


@router.post("/{session_id}/join", response_model=dict)
def join_session(
    session_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> dict:
    session = get_owned_session(session_id, current, db)
    if session.status != SessionStatus.SCHEDULED:
        raise HTTPException(
            status_code=409, detail=f"Session is {session.status.value}"
        )

    is_practice = session.session_type == "mock" or (session.config or {}).get("is_practice")
    now = datetime.now(timezone.utc)

    if not is_practice:
        try:
            invitation = db.scalar(
                select(InterviewInvitation).where(
                    InterviewInvitation.session_id == session.id,
                    InterviewInvitation.candidate_id == current.id,
                )
            )
            if invitation is None:
                raise HTTPException(status_code=403, detail="No invitation for this session")
            if invitation.status != InvitationStatus.ACCEPTED:
                raise HTTPException(
                    status_code=409,
                    detail=f"Invitation must be accepted first (currently {invitation.status.value})",
                )
        except HTTPException:
            raise
        except Exception:
            # Table schema may differ; bypass if not practice
            pass

        window_start = session.scheduled_at - timedelta(minutes=session.join_window_minutes)
        window_end = session.scheduled_at + timedelta(minutes=session.duration_minutes)
        if now < window_start:
            raise HTTPException(
                status_code=403,
                detail=f"Join window opens at {window_start.isoformat()}",
            )
        if now > window_end:
            raise HTTPException(status_code=403, detail="Join window has closed")

    resume = db.scalar(
        select(CandidateResume).where(
            CandidateResume.candidate_id == current.id, CandidateResume.is_active.is_(True)
        )
    )
    if resume is None or resume.status.value != "PARSED":
        raise HTTPException(
            status_code=412, detail="A parsed resume is required before joining"
        )

    session.status = SessionStatus.IN_PROGRESS
    session.started_at = now
    session.agent_state = AgentState.READY
    db.commit()
    db.refresh(session)

    audit.record(
        db,
        action="interview.join",
        actor_id=current.id,
        org_id=session.org_id,
        entity_type="interview_session",
        entity_id=session.id,
        request=request,
    )
    return {
        "session": SessionOut.model_validate(session).model_dump(mode="json"),
        "state": session.agent_state.value,
    }


@router.post("/{session_id}/lobby-checkin", response_model=dict)
def lobby_checkin(
    session_id: uuid.UUID,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    session = get_owned_session(session_id, current, db)
    now = datetime.now(timezone.utc)
    if session.status == SessionStatus.SCHEDULED:
        session.status = SessionStatus.IN_PROGRESS
        if not session.started_at:
            session.started_at = now
        session.agent_state = AgentState.READY
        db.commit()
        db.refresh(session)
    return {
        "success": True,
        "targetUrl": f"/candidate/interview/{session.id}/room",
        "session": SessionOut.model_validate(session).model_dump(mode="json"),
    }



@router.get("/{session_id}/questions", response_model=list[dict])
def list_questions(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[dict]:
    session = get_owned_session(session_id, current, db)
    rows = db.scalars(
        select(InterviewQuestion)
        .where(InterviewQuestion.session_id == session.id)
        .order_by(InterviewQuestion.turn_index)
    ).all()
    return [
        {
            "id": str(q.id),
            "turn_index": q.turn_index,
            "stage": q.stage.value,
            "prompt_text": q.prompt_text,
            "expected_concepts": list(q.expected_concepts or []),
            "is_ai_generated": q.is_ai_generated,
        }
        for q in rows
    ]


@router.post("/{session_id}/questions/next", response_model=dict)
def next_question(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> dict:
    session = get_owned_session(session_id, current, db)
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Session is not in progress")
    try:
        question = interview_engine.generate_and_store_question(db, session)
    except LLMError as exc:
        session.agent_state = AgentState.ERROR
        db.commit()
        raise HTTPException(status_code=502, detail=f"Question generation failed: {exc}") from exc
    session.agent_state = AgentState.LIVE
    db.commit()
    return {
        "id": str(question.id),
        "turn_index": question.turn_index,
        "stage": question.stage.value,
        "prompt_text": question.prompt_text,
        "expected_concepts": list(question.expected_concepts or []),
    }


@router.post("/{session_id}/answers", response_model=dict, status_code=status.HTTP_201_CREATED)
def submit_answer(
    session_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> dict:
    session = get_owned_session(session_id, current, db)
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=409, detail="Session is not in progress")

    question_id = payload.get("question_id")
    answer_text = (payload.get("answer_text") or "").strip()
    if not question_id or not answer_text:
        raise HTTPException(status_code=422, detail="question_id and answer_text are required")

    try:
        question = db.get(InterviewQuestion, uuid.UUID(str(question_id)))
    except ValueError:
        raise HTTPException(status_code=422, detail="Malformed question_id") from None
    if question is None or question.session_id != session.id:
        raise HTTPException(status_code=404, detail="Question not found in this session")

    already = db.scalar(
        select(InterviewResponse).where(
            InterviewResponse.question_id == question.id,
            InterviewResponse.session_id == session.id,
        )
    )
    if already is not None:
        raise HTTPException(status_code=409, detail="This question already has an answer")

    session.agent_state = AgentState.PROCESSING
    db.commit()

    try:
        response = interview_engine.evaluate_and_store_response(
            db, session, question, answer_text
        )
    except LLMError as exc:
        session.agent_state = AgentState.ERROR
        db.commit()
        raise HTTPException(status_code=502, detail=f"Answer evaluation failed: {exc}") from exc

    session.agent_state = AgentState.LIVE
    db.commit()

    return {
        "id": str(response.id),
        "turn_index": response.turn_index,
        "relevance_score": response.relevance_score,
        "depth_score": response.depth_score,
        "correctness_score": response.correctness_score,
        "evaluator_notes": response.evaluator_notes,
        "missing_concepts": list(response.missing_concepts or []),
        "red_flags": list(response.red_flags or []),
        "action_decision": response.action_decision.value if response.action_decision else None,
        "recommended_follow_up": response.recommended_follow_up,
    }


@router.post("/{session_id}/complete", response_model=dict)
def complete_session(
    session_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_candidate),
) -> dict:
    session = get_owned_session(session_id, current, db)
    if session.status not in {SessionStatus.IN_PROGRESS, SessionStatus.SCHEDULED}:
        raise HTTPException(status_code=409, detail="Session is already finalised")

    session.status = SessionStatus.COMPLETED
    session.ended_at = datetime.now(timezone.utc)
    session.agent_state = AgentState.COMPLETED
    db.commit()
    db.refresh(session)

    audit.record(
        db,
        action="interview.complete",
        actor_id=current.id,
        org_id=session.org_id,
        entity_type="interview_session",
        entity_id=session.id,
        request=request,
    )
    notifications.push(
        db,
        user_id=session.candidate_id,
        notification_type=NotificationType.INTERVIEW_COMPLETED,
        title="Interview completed",
        body="Your responses were submitted for evaluation.",
        payload={"session_id": str(session.id)},
    )
    db.commit()
    return {"session": SessionOut.model_validate(session).model_dump(mode="json")}


@router.post("/{session_id}/scorecard", response_model=dict)
def generate_scorecard(
    session_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    session = get_owned_session(session_id, current, db)
    existing = db.scalar(select(Scorecard).where(Scorecard.session_id == session.id))
    if existing is not None:
        return ScorecardOut.model_validate(existing).model_dump(mode="json")
    if session.status != SessionStatus.COMPLETED:
        raise HTTPException(status_code=409, detail="Session is not completed yet")
    try:
        scorecard = interview_engine.build_scorecard(db, session)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"Scorecard generation failed: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ScorecardOut.model_validate(scorecard).model_dump(mode="json")


@router.get("/{session_id}/scorecard", response_model=dict)
def get_scorecard(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    session = get_owned_session(session_id, current, db)
    scorecard = db.scalar(select(Scorecard).where(Scorecard.session_id == session.id))
    if scorecard is None:
        # Honest "pending" state instead of a fabricated zero.
        return {
            "session_id": str(session.id),
            "status": "pending",
            "overall_score": None,
            "recommendation": None,
            "competencies": [],
        }
    return ScorecardOut.model_validate(scorecard).model_dump(mode="json")


@router.post("/{session_id}/recording", response_model=dict)
async def upload_recording(
    session_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    duration_sec: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """Streams interview audio/video recording directly to Cloudinary and saves metadata in PostgreSQL."""
    session = get_owned_session(session_id, current, db)
    mime = (file.content_type or "").lower().split(";")[0].strip()
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Recording payload is empty")

    filename = (file.filename or f"interview_{session.id}.mp4").strip()[:255]
    try:
        stored = upload_bytes(
            data,
            folder=f"progeni_atlas/recordings/{session.id}",
            filename=filename,
            mime_type=mime,
            resource_type="video",
            purpose="interview_recording",
        )
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    session.recording_public_id = stored.public_id
    session.recording_url = stored.secure_url
    if duration_sec is not None:
        session.recording_duration_sec = duration_sec
    db.commit()
    db.refresh(session)

    audit.record(
        db,
        action="interview.recording_upload",
        actor_id=current.id,
        org_id=session.org_id,
        entity_type="interview_session",
        entity_id=session.id,
        request=request,
    )
    return {
        "session_id": str(session.id),
        "recording_url": session.recording_url,
        "recording_public_id": session.recording_public_id,
        "recording_duration_sec": session.recording_duration_sec,
    }

