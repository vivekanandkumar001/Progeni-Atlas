"""FastAPI application factory.

Schema is created only by Alembic. Nothing here calls create_all().
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import admin, auth, candidate, coding, health, interviews, recruiter
from app.config import missing_required_secrets, settings
from app.ws import interview as ws_interview

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("progeni_atlas")

limiter = Limiter(key_func=get_remote_address)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Progeni Atlas API",
        version="1.0.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    if settings.RATE_LIMIT_ENABLED:
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(candidate.router)
    app.include_router(recruiter.router)
    app.include_router(admin.router)
    app.include_router(coding.router)
    app.include_router(interviews.router)
    app.include_router(ws_interview.router)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": exc.errors(), "message": "Request validation failed"},
        )

    @app.on_event("startup")
    def on_startup() -> None:
        missing = missing_required_secrets()
        if missing:
            logger.error(
                "STARTING DEGRADED - missing environment variables: %s", ", ".join(missing)
            )
        else:
            logger.info("All required services configured")

    return app


app = create_app()
