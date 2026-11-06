"""Environment-driven configuration. No secrets are hardcoded here."""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

MISSING_PEPPER_MESSAGE = "OTP_PEPPER or JWT_SECRET must be set"


class ConfigurationError(RuntimeError):
    """Raised at startup when a required secret is missing."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR.parent / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- server ---
    APP_ENV: str = "development"
    PORT: int = 5000

    # --- database (PostgreSQL is the ONLY application database) ---
    DATABASE_URL: str | None = None

    # --- auth ---
    JWT_SECRET: str | None = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # --- cloudinary (the ONLY persistent file/media store) ---
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    # --- vector db (Qdrant for Embeddings & Semantic Retrieval) ---
    QDRANT_URL: str | None = None
    QDRANT_API_KEY: str | None = None
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # --- llm ---
    LLM_PROVIDER: str = "openai"
    LLM_FALLBACK_PROVIDER: str = "openrouter"
    OPENAI_API_KEY: str | None = None
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"

    # --- openrouter (secondary fallback) ---
    OPENROUTER_API_KEY: str | None = None
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "meta-llama/llama-3.2-3b-instruct"
    OPENROUTER_EMBEDDING_MODEL: str = "openai/text-embedding-3-small"

    # --- ollama (final fallback inside docker) ---
    OLLAMA_BASE_URL: str | None = None
    OLLAMA_HOST: str | None = None
    OLLAMA_MODEL: str = "llama3.2:1b"

    @property
    def effective_ollama_url(self) -> str:
        url = self.OLLAMA_BASE_URL or self.OLLAMA_HOST or "http://ollama:11434"
        return url.rstrip("/")

    # --- cors ---
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8081,http://127.0.0.1:8081,http://172.16.1.107:8081,http://172.16.1.107:3000,http://172.16.1.107:8000"

    # --- uploads ---
    MAX_UPLOAD_BYTES: int = 20 * 1024 * 1024
    ALLOWED_RESUME_MIME: str = "application/pdf"

    # --- smtp (optional; OTP flow) ---
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 465
    SMTP_USER: str | None = None
    SMTP_PASS: str | None = None
    SMTP_FROM_NAME: str = "Progeni Atlas"
    SMTP_FROM: str | None = None

    # --- otp security policy (single source of truth) ---
    OTP_PEPPER: str | None = None
    OTP_TTL_SEC: int = 120
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SEC: int = 120

    @property
    def effective_otp_pepper(self) -> str:
        """Pepper for HMAC-SHA256 OTP hashing.

        Prefers OTP_PEPPER, falls back to SWAMI_SECRET_KEY (from Flask),
        then JWT_SECRET, ensuring consistent hash verification across environments.

        There is deliberately NO hardcoded fallback: a missing pepper must be a
        loud startup failure, never a silently-usable fixed key.
        """
        pepper = self.OTP_PEPPER or os.environ.get("SWAMI_SECRET_KEY") or self.JWT_SECRET
        if not pepper:
            raise ConfigurationError(MISSING_PEPPER_MESSAGE)
        return pepper

    @property
    def effective_smtp_from(self) -> str:
        if self.SMTP_FROM and self.SMTP_FROM.strip():
            return self.SMTP_FROM.strip()
        user = (self.SMTP_USER or "").strip()
        name = (self.SMTP_FROM_NAME or "Progeni Atlas").strip()
        if user:
            return f'"{name}" <{user}>'
        return name

    # --- rate limiting ---
    RATE_LIMIT_ENABLED: bool = True

    @field_validator("DATABASE_URL")
    @classmethod
    def _strip_async_scheme(cls, v: str | None) -> str | None:
        if v and v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        if v and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @model_validator(mode="after")
    def _require_otp_pepper(self) -> "Settings":
        """Fail fast at settings-load time if no OTP pepper source is configured.

        The OTP HMAC pepper must come from a real secret (OTP_PEPPER,
        SWAMI_SECRET_KEY, or JWT_SECRET). Booting with a hardcoded fallback
        would make stored OTP hashes trivially forgeable.
        """
        if not (self.OTP_PEPPER or os.environ.get("SWAMI_SECRET_KEY") or self.JWT_SECRET):
            raise ConfigurationError(MISSING_PEPPER_MESSAGE)
        if self.APP_ENV.lower() not in {"development", "dev", "test"}:
            if self.CORS_ORIGINS == "http://localhost:3000,http://127.0.0.1:3000":
                logging.getLogger("talentpulse.config").warning(
                    "CORS_ORIGINS is using localhost default in non-development environment '%s'",
                    self.APP_ENV,
                )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_resume_mimes(self) -> set[str]:
        return {m.strip() for m in self.ALLOWED_RESUME_MIME.split(",") if m.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def missing_required_secrets() -> list[str]:
    """Names of required env vars that are not set. Used by startup + /health."""
    required = {
        "DATABASE_URL": settings.DATABASE_URL,
        "JWT_SECRET": settings.JWT_SECRET,
        "CLOUDINARY_CLOUD_NAME": settings.CLOUDINARY_CLOUD_NAME,
        "CLOUDINARY_API_KEY": settings.CLOUDINARY_API_KEY,
        "CLOUDINARY_API_SECRET": settings.CLOUDINARY_API_SECRET,
    }
    if settings.LLM_PROVIDER.lower() == "openai" and (not settings.LLM_FALLBACK_PROVIDER or settings.LLM_FALLBACK_PROVIDER.lower() == "none"):
        required["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
    return [name for name, value in required.items() if not value]


def assert_configured() -> None:
    missing = missing_required_secrets()
    if missing:
        raise ConfigurationError(
            "Missing required environment variables: " + ", ".join(missing)
        )


def is_production() -> bool:
    return os.getenv("APP_ENV", "development").lower() in {"production", "prod"}
