"""Interview WebSocket: two-way AI interview with an explicit state machine.

States: CONNECTING -> READY -> LIVE -> PROCESSING -> LIVE ... -> COMPLETED | ERROR
Every turn is persisted to PostgreSQL. The LLM is the only source of questions.
"""
from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import AgentState, InterviewQuestion, InterviewSession, SessionStatus, User, UserRole
from app.services import interview_engine
from app.services.llm_service import LLMError
from app.services.security import decode_token_safe

router = APIRouter()


def _authenticate(token: str) -> User | None:
    payload = decode_token_safe(token) if token else None
    if not payload or payload.get("type") != "access":
        return None
    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError):
        return None
    with SessionLocal() as db:
        return db.get(User, user_id)


def _load_session(db: Session, session_id: uuid.UUID, user: User) -> InterviewSession | None:
    session = db.get(InterviewSession, session_id)
    if session is None:
        return None
    if user.role == UserRole.CANDIDATE and session.candidate_id != user.id:
        return None
    if user.role == UserRole.RECRUITER and session.org_id != user.org_id:
        return None
    if user.role == UserRole.SUPER_ADMIN:
        return session
    return None


async def _send(ws: WebSocket, kind: str, **payload) -> None:
    await ws.send_text(json.dumps({"type": kind, **payload}))


@router.websocket("/ws/interview/{session_id}")
async def interview_socket(
    websocket: WebSocket,
    session_id: uuid.UUID,
    token: str = Query(default=""),
) -> None:
    user = _authenticate(token)
    if user is None:
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await websocket.accept()

    with SessionLocal() as db:
        session = _load_session(db, session_id, user)
        if session is None:
            await _send(websocket, "ERROR", message="Session not found or not permitted")
            await websocket.close(code=4404, reason="Not found")
            return

        if session.status != SessionStatus.IN_PROGRESS:
            await _send(
                websocket,
                "STATE",
                state=session.agent_state.value,
                message=f"Session is {session.status.value}",
            )
            await websocket.close(code=4409, reason="Session not in progress")
            return

        await _send(
            websocket,
            "READY",
            state=AgentState.READY.value,
            session_id=str(session.id),
            candidate_id=str(session.candidate_id),
        )

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, "ERROR", message="Malformed JSON")
                continue

            kind = message.get("type")

            if kind == "PING":
                await _send(websocket, "PONG")
                continue

            if kind == "NEXT_QUESTION":
                with SessionLocal() as db:
                    session = _load_session(db, session_id, user)
                    if session is None:
                        await _send(websocket, "ERROR", message="Session unavailable")
                        break
                    session.agent_state = AgentState.PROCESSING
                    db.commit()
                    await _send(websocket, "STATE", state=AgentState.PROCESSING.value)
                    try:
                        question = interview_engine.generate_and_store_question(db, session)
                    except LLMError as exc:
                        session.agent_state = AgentState.ERROR
                        db.commit()
                        await _send(websocket, "ERROR", message=f"LLM error: {exc}")
                        await _send(websocket, "STATE", state=AgentState.ERROR.value)
                        continue
                    session.agent_state = AgentState.LIVE
                    db.commit()
                    await _send(
                        websocket,
                        "QUESTION",
                        state=AgentState.LIVE.value,
                        question_id=str(question.id),
                        turn_index=question.turn_index,
                        stage=question.stage.value,
                        text=question.prompt_text,
                    )
                continue

            if kind == "ANSWER":
                answer_text = (message.get("text") or "").strip()
                question_id = message.get("question_id")
                if not answer_text or not question_id:
                    await _send(websocket, "ERROR", message="question_id and text are required")
                    continue
                with SessionLocal() as db:
                    session = _load_session(db, session_id, user)
                    if session is None:
                        await _send(websocket, "ERROR", message="Session unavailable")
                        break
                    try:
                        question = db.get(InterviewQuestion, uuid.UUID(str(question_id)))
                    except ValueError:
                        await _send(websocket, "ERROR", message="Malformed question_id")
                        continue
                    if question is None or question.session_id != session.id:
                        await _send(websocket, "ERROR", message="Question not found")
                        continue
                    session.agent_state = AgentState.PROCESSING
                    db.commit()
                    await _send(websocket, "STATE", state=AgentState.PROCESSING.value)
                    try:
                        response = interview_engine.evaluate_and_store_response(
                            db, session, question, answer_text
                        )
                    except LLMError as exc:
                        session.agent_state = AgentState.ERROR
                        db.commit()
                        await _send(websocket, "ERROR", message=f"LLM error: {exc}")
                        await _send(websocket, "STATE", state=AgentState.ERROR.value)
                        continue
                    session.agent_state = AgentState.LIVE
                    db.commit()
                    await _send(
                        websocket,
                        "EVALUATION",
                        state=AgentState.LIVE.value,
                        turn_index=response.turn_index,
                        relevance_score=response.relevance_score,
                        depth_score=response.depth_score,
                        correctness_score=response.correctness_score,
                        action_decision=(
                            response.action_decision.value if response.action_decision else None
                        ),
                        recommended_follow_up=response.recommended_follow_up,
                    )
                continue

            if kind == "COMPLETE":
                from datetime import datetime, timezone

                with SessionLocal() as db:
                    session = _load_session(db, session_id, user)
                    if session is None:
                        await _send(websocket, "ERROR", message="Session unavailable")
                        break
                    session.status = SessionStatus.COMPLETED
                    session.ended_at = datetime.now(timezone.utc)
                    session.agent_state = AgentState.COMPLETED
                    db.commit()
                await _send(websocket, "STATE", state=AgentState.COMPLETED.value)
                await websocket.close(code=1000, reason="Completed")
                break

            if kind == "PROCTORING":
                from app.models import ProctoringEvent, ProctoringEventType, Severity

                event_type_raw = str(message.get("event_type") or "")
                try:
                    event_type = ProctoringEventType(event_type_raw)
                except ValueError:
                    await _send(websocket, "ERROR", message="Unknown proctoring event type")
                    continue
                severity_raw = str(message.get("severity") or "info").lower()
                try:
                    severity = Severity(severity_raw)
                except ValueError:
                    severity = Severity.INFO
                with SessionLocal() as db:
                    session = _load_session(db, session_id, user)
                    if session is None:
                        continue
                    db.add(
                        ProctoringEvent(
                            session_id=session.id,
                            candidate_id=session.candidate_id,
                            event_type=event_type,
                            severity=severity,
                            detail=(message.get("detail") or "")[:2000] or None,
                            metadata_json=message.get("metadata") or {},
                        )
                    )
                    db.commit()
                await _send(websocket, "ACK", event=event_type.value)
                continue

            await _send(websocket, "ERROR", message=f"Unsupported message type: {kind}")

    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001 - surface, never swallow
        try:
            await _send(websocket, "ERROR", message=f"Server error: {exc}")
            await _send(websocket, "STATE", state=AgentState.ERROR.value)
        except Exception:
            pass
