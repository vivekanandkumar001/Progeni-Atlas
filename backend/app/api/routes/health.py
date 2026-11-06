"""Health endpoint. Reports real dependency reachability, never fakes 'healthy'."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import missing_required_secrets, settings
from app.database import get_db
from app.services.cloudinary_service import StorageError, get_client

router = APIRouter(tags=["system"])


@router.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    postgres_ok = True
    postgres_detail = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        postgres_ok = False
        postgres_detail = str(exc)[:200]

    cloudinary_ok = True
    cloudinary_detail = None
    try:
        get_client()
        from cloudinary import api as cloudinary_api

        cloudinary_api.ping()
    except Exception as exc:  # noqa: BLE001
        cloudinary_ok = False
        cloudinary_detail = str(exc)[:200]

    from app.services.llm_service import check_provider_health
    llm_health = check_provider_health()

    missing = missing_required_secrets()
    healthy = (
        postgres_ok
        and cloudinary_ok
        and not missing
        and (
            llm_health["openai"]["available"]
            or llm_health["openrouter"]["available"]
            or llm_health["ollama"]["available"]
        )
    )
    return {
        "status": "healthy" if healthy else "degraded",
        "postgresql": {"reachable": postgres_ok, "detail": postgres_detail},
        "cloudinary": {"reachable": cloudinary_ok, "detail": cloudinary_detail},
        "openai": llm_health["openai"],
        "openrouter": llm_health["openrouter"],
        "ollama": llm_health["ollama"],
        "active_provider": llm_health["active_provider"],
        "llm": llm_health,
        "missing_secrets": missing,
    }
