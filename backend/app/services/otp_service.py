"""OTP Authentication Service.

Single source of truth for email OTP generation, HMAC-SHA256 hashing,
SMTP delivery, rate-limiting, and constant-time verification.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import OtpCode, User

logger = logging.getLogger("progeni_atlas.otp")

OTP_RE = re.compile(r"^\d{6}$")


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP (CSPRNG)."""
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(otp_code: str) -> str:
    """HMAC-SHA256 OTP hash peppered with server secret.

    Matching Flask reference implementation at backend/app.py:77-83.
    """
    pepper = settings.effective_otp_pepper
    return hmac.new(
        pepper.encode("utf-8"), otp_code.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def check_otp_hash(otp_code: str, stored_hash: str) -> bool:
    """Verify an OTP hash using constant-time comparison.

    Only HMAC-SHA256 hashes are accepted. Plain SHA-256 hashes are explicitly
    rejected: ``otp_codes`` is a new table (migration 0009) with no legacy
    plain-hash rows, so accepting them would only add a downgrade attack surface.
    """
    return hmac.compare_digest(hash_otp(otp_code), stored_hash)


def send_otp_email_smtp(
    to_email: str, otp_code: str, purpose: str = "REGISTRATION_VERIFY"
) -> tuple[bool, str | None]:
    """Dispatch email OTP via SMTP using SSL (port 465) or STARTTLS (port 587).

    SECURITY:
    - Never log the raw OTP value.
    - Fail closed: never report success if SMTP credentials are missing or send fails.
    """
    smtp_host = (settings.SMTP_HOST or "smtp.gmail.com").strip()
    smtp_port = settings.SMTP_PORT or 465
    smtp_user = (settings.SMTP_USER or "").strip()
    smtp_pass = (settings.SMTP_PASS or "").strip()
    smtp_from = settings.effective_smtp_from
    from_name = settings.SMTP_FROM_NAME or "Progeni Atlas"

    subject = "Progeni Atlas — Verify Your Email Address"
    if purpose == "FORGOT_PASSWORD":
        subject = "Progeni Atlas — Password Reset Verification Code"
    elif purpose == "LOGIN_VERIFY":
        subject = "Progeni Atlas — Login Verification Code"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #1e293b;">
      <h2 style="color: #06b6d4; margin-bottom: 8px;">{from_name}</h2>
      <p style="color: #94a3b8; font-size: 14px;">Verification Security Code</p>
      <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8;">{otp_code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">This single-use code is valid for <strong>{settings.OTP_TTL_SEC} seconds (2 minutes)</strong>.</p>
      <p style="color: #64748b; font-size: 11px;">If you did not request this verification code, please ignore this message.</p>
    </div>
    """

    if not smtp_user or not smtp_pass:
        logger.warning(
            "[OTP] Email delivery failed: SMTP_USER/SMTP_PASS not configured for recipient=%s",
            to_email,
        )
        return False, "Email service is not configured. Please set SMTP_USER and SMTP_PASS."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_from
        msg["To"] = to_email
        msg.attach(MIMEText(html_content, "html"))

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, [to_email], msg.as_string())

        logger.info("[OTP] Email accepted by SMTP server for recipient=%s purpose=%s", to_email, purpose)
        return True, None
    except smtplib.SMTPAuthenticationError as auth_err:
        logger.error("[OTP] SMTP authentication rejected for recipient=%s: %s", to_email, auth_err)
        return False, "SMTP Authentication failed. Please check SMTP_USER and SMTP_PASS."
    except Exception as err:
        logger.error("[OTP] Failed to deliver email to recipient=%s: %s", to_email, err)
        return False, f"Failed to deliver email: {str(err)}"


def create_and_send_otp(
    db: Session,
    *,
    email: str,
    user_id: uuid.UUID | None = None,
    purpose: str = "REGISTRATION_VERIFY",
) -> tuple[OtpCode, str, bool, str | None]:
    """Generate, securely hash, and persist a fresh OTP, then dispatch via SMTP.

    Invalidates any prior unconsumed OTP records for this email and purpose.
    Returns (otp_record, raw_code, email_sent, email_err).
    """
    normalized_email = email.lower().strip()
    raw_code = generate_otp()
    code_hash = hash_otp(raw_code)
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(seconds=settings.OTP_TTL_SEC)

    # Invalidate prior unconsumed OTPs for this email and purpose
    db.execute(
        delete(OtpCode).where(
            OtpCode.email == normalized_email,
            OtpCode.purpose == purpose,
            OtpCode.consumed_at.is_(None),
        )
    )

    otp_record = OtpCode(
        user_id=user_id,
        email=normalized_email,
        code_hash=code_hash,
        purpose=purpose,
        expires_at=expires_at,
        attempts=0,
        max_attempts=settings.OTP_MAX_ATTEMPTS,
        consumed_at=None,
    )
    db.add(otp_record)
    db.commit()
    db.refresh(otp_record)

    email_sent, email_err = send_otp_email_smtp(normalized_email, raw_code, purpose)
    return otp_record, raw_code, email_sent, email_err


def verify_otp(
    db: Session,
    *,
    email: str,
    code: str,
    purpose: str = "REGISTRATION_VERIFY",
) -> tuple[bool, str, User | None]:
    """Verify an OTP code with fail-safe atomic attempt tracking.

    CRITICAL SECURITY GUARANTEES:
    1. Generic error messages: Never distinguish expired vs wrong code (prevents oracle attacks).
    2. Atomic increment: attempts is incremented and COMMITTED to the database
       BEFORE checking the code hash. This ensures mid-flight client cancellations
       cannot bypass the attempt counter.
    3. Brute-force protection: Locks out and rejects if attempts >= max_attempts.
    """
    normalized_email = email.lower().strip()
    clean_code = code.strip()

    if not OTP_RE.match(clean_code):
        return False, "Invalid or expired verification code.", None

    record = db.scalar(
        select(OtpCode)
        .where(
            OtpCode.email == normalized_email,
            OtpCode.purpose == purpose,
            OtpCode.consumed_at.is_(None),
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )

    if not record:
        return False, "Invalid or expired verification code.", None

    # Check lock-out threshold
    if record.attempts >= record.max_attempts:
        return False, "Too many invalid attempts. Please request a new verification code.", None

    # ATOMIC INCREMENT BEFORE CHECK: Persist to DB immediately so cancellations cannot evade limit
    record.attempts += 1
    db.commit()
    db.refresh(record)

    now_utc = datetime.now(timezone.utc)
    if record.expires_at < now_utc:
        return False, "Invalid or expired verification code.", None

    # Constant-time comparison
    if not check_otp_hash(clean_code, record.code_hash):
        if record.attempts >= record.max_attempts:
            return False, "Too many invalid attempts. Please request a new verification code.", None
        return False, "Invalid or expired verification code.", None

    # Success: mark consumed
    record.consumed_at = now_utc

    user = None
    if record.user_id:
        user = db.scalar(select(User).where(User.id == record.user_id))
    if not user:
        user = db.scalar(select(User).where(User.email == normalized_email))

    if user:
        user.is_email_verified = True

    db.commit()
    if user:
        db.refresh(user)

    return True, "Email verified successfully.", user
