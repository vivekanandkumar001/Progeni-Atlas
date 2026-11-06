"""Audit logging to PostgreSQL. Never silently swallows failures."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger(__name__)


def record(
    db: Session,
    *,
    action: str,
    actor_id: uuid.UUID | None = None,
    org_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    request: Request | None = None,
    detail: dict[str, Any] | None = None,
    commit: bool = True,
) -> AuditLog:
    ip = None
    ua = None
    if request is not None:
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")

    entry = AuditLog(
        actor_id=actor_id,
        org_id=org_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        ip_address=ip,
        user_agent=(ua or "")[:400] or None,
        detail=detail or {},
    )
    db.add(entry)
    if commit:
        db.commit()
        db.refresh(entry)
    return entry
