"""Notification creation helpers (PostgreSQL only)."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import Notification, NotificationType


def push(
    db: Session,
    *,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    note = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title[:255],
        body=body,
        payload=payload or {},
    )
    db.add(note)
    return note
