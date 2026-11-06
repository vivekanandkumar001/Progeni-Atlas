"""Live coding submission endpoint. Code is persisted in PostgreSQL.

There is no in-browser-only storage and no fabricated "all tests passed".
"""
from __future__ import annotations

import subprocess
import sys
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_owned_session
from app.database import get_db
from app.models import CodeSubmission, InterviewSession, SessionStatus, User
from app.schemas import CodeRunRequest

router = APIRouter(prefix="/api/v1/interview-sessions", tags=["coding"])

RUN_TIMEOUT_SEC = 10
SUPPORTED = {
    "python": ("py", ["-c"]),
    "python3": ("py", ["-c"]),
    "javascript": ("node", ["-e"]),
    "node": ("node", ["-e"]),
}


@router.post("/{session_id}/code", status_code=status.HTTP_201_CREATED)
def submit_code(
    session_id: uuid.UUID,
    payload: CodeRunRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    session = get_owned_session(session_id, current, db)
    if session.status not in {SessionStatus.IN_PROGRESS, SessionStatus.COMPLETED}:
        raise HTTPException(status_code=409, detail="Session is not accepting code")

    language = payload.language.strip().lower()
    if language not in SUPPORTED:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported language '{payload.language}'. Supported: python, javascript",
        )

    started = datetime.now(timezone.utc)
    stdout = stderr = None
    exit_code: int | None = None

    runner, prefix = SUPPORTED[language]
    try:
        proc = subprocess.run(  # noqa: S603 - fixed argv, no shell
            [runner, *prefix, payload.code],
            capture_output=True,
            text=True,
            timeout=RUN_TIMEOUT_SEC,
        )
        stdout = proc.stdout[-20000:]
        stderr = proc.stderr[-20000:]
        exit_code = proc.returncode
    except FileNotFoundError:
        raise HTTPException(
            status_code=503, detail=f"Runtime '{runner}' is not available on the server"
        ) from None
    except subprocess.TimeoutExpired:
        stdout, stderr, exit_code = "", "Execution timed out", -1

    duration_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)

    submission = CodeSubmission(
        session_id=session.id,
        turn_index=payload.turn_index,
        language=language,
        source_code=payload.code,
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        execution_time_ms=duration_ms,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    return {
        "id": str(submission.id),
        "language": language,
        "stdout": stdout or "",
        "stderr": stderr or "",
        "exit_code": exit_code,
        "success": exit_code == 0,
        "execution_time_ms": duration_ms,
        "submitted_at": submission.created_at.isoformat(),
    }


@router.get("/{session_id}/code", response_model=list[dict])
def list_code(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[dict]:
    session = get_owned_session(session_id, current, db)
    rows = db.scalars(
        select(CodeSubmission)
        .where(CodeSubmission.session_id == session.id)
        .order_by(CodeSubmission.turn_index, CodeSubmission.created_at)
    ).all()
    return [
        {
            "id": str(r.id),
            "turn_index": r.turn_index,
            "language": r.language,
            "source_code": r.source_code,
            "stdout": r.stdout,
            "stderr": r.stderr,
            "exit_code": r.exit_code,
            "execution_time_ms": r.execution_time_ms,
            "submitted_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
