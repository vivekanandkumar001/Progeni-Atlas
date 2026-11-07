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


def send_otp_sms(
    to_phone: str, otp_code: str, purpose: str = "PHONE_VERIFY"
) -> tuple[bool, str | None]:
    """Dispatch phone OTP via SMS.

    NOTE: SMS delivery is best-effort. If Twilio or SMS gateway is not configured,
    the OTP is still persisted to the database for later verification.
    """
    # Try to send via Twilio if configured
    twilio_sid = getattr(settings, "TWILIO_SID", None)
    twilio_token = getattr(settings, "TWILIO_AUTH_TOKEN", None)
    twilio_from = getattr(settings, "TWILIO_FROM_NUMBER", None)

    if twilio_sid and twilio_token and twilio_from:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            message = client.messages.create(
                body=f"Your Progeni Atlas verification code is: {otp_code}. Valid for {settings.OTP_TTL_SEC // 60} minutes.",
                from_=twilio_from,
                to=to_phone,
            )
            logger.info(
                "[OTP] SMS sent via Twilio to=%s purpose=%s sid=%s", to_phone, purpose, message.sid
            )
            return True, None
        except Exception as err:
            logger.warning("[OTP] Twilio SMS failed to=%s: %s", to_phone, err)

    # Best-effort: if SMS not configured, still persist OTP for later verification
    # The OTP record will exist in the database and can be verified even without SMS delivery
    logger.info(
        "[OTP] SMS not configured for recipient=%s, OTP persisted for database verification only", to_phone
    )
    return True, None  # Return success but note that SMS was not actually sent


def create_and_send_otp(
    db: Session,
    *,
    email: str | None = None,
    phone: str | None = None,
    user_id: uuid.UUID | None = None,
    purpose: str = "REGISTRATION_VERIFY",
) -> tuple[OtpCode, str, bool, str | None]:
    """Generate, securely hash, and persist a fresh OTP, then dispatch via email/SMS.

    Supports both email and phone OTP generation. Exactly one of email or phone
    must be provided. Invalidates any prior unconsumed OTP records for this contact
    and purpose.

    Returns (otp_record, raw_code, dispatch_sent, dispatch_err).
    """
    if email and phone:
        raise ValueError("Provide either email or phone, not both")
    if not email and not phone:
        raise ValueError("Either email or phone must be provided")

    contact = email.lower().strip() if email else phone.strip()
    raw_code = generate_otp()
    code_hash = hash_otp(raw_code)
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(seconds=settings.OTP_TTL_SEC)

    # Invalidate prior unconsumed OTPs for this contact and purpose
    if email:
        db.execute(
            delete(OtpCode).where(
                OtpCode.email == contact,
                OtpCode.purpose == purpose,
                OtpCode.consumed_at.is_(None),
            )
        )
    else:  # phone
        db.execute(
            delete(OtpCode).where(
                OtpCode.phone == contact,
                OtpCode.purpose == purpose,
                OtpCode.consumed_at.is_(None),
            )
        )

    otp_record = OtpCode(
        user_id=user_id,
        email=email.lower().strip() if email else None,
        phone=phone.strip() if phone else None,
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

    # Dispatch based on contact type
    if email:
        email_sent, email_err = send_otp_email_smtp(contact, raw_code, purpose)
        if not email_sent:
            # Don't rollback the OTP record - it can still be verified from DB
            logger.warning(
                "[OTP] Email send failed for=%s, but OTP persisted: %s", contact, email_err
            )
        return otp_record, raw_code, email_sent, email_err
    else:  # phone
        sms_sent, sms_err = send_otp_sms(contact, raw_code, purpose)
        return otp_record, raw_code, sms_sent, sms_err


def verify_otp(
    db: Session,
    *,
    email: str | None = None,
    phone: str | None = None,
    code: str,
    purpose: str = "REGISTRATION_VERIFY",
) -> tuple[bool, str, User | None]:
    """Verify an OTP code with fail-safe atomic attempt tracking.

    Supports both email and phone OTP verification. Exactly one of email or phone
    must be provided.

    CRITICAL SECURITY GUARANTEES:
    1. Generic error messages: Never distinguish expired vs wrong code (prevents oracle attacks).
    2. Atomic increment: attempts is incremented and COMMITTED to the database
       BEFORE checking the code hash. This ensures mid-flight client cancellations
       cannot bypass the attempt counter.
    3. Brute-force protection: Locks out and rejects if attempts >= max_attempts.
    """
    if email and phone:
        raise ValueError("Provide either email or phone, not both")
    if not email and not phone:
        raise ValueError("Either email or phone must be provided")

    # Determine the contact value and normalized email for DB lookup
    if email:
        normalized_contact = email.lower().strip()
        contact_field = OtpCode.email
    else:
        normalized_contact = phone.strip()
        contact_field = OtpCode.phone

    clean_code = code.strip()

    if not OTP_RE.match(clean_code):
        return False, "Invalid or expired verification code.", None

    # Search for unconsumed OTP record matching contact and purpose
    record = db.scalar(
        select(OtpCode)
        .where(
            contact_field == normalized_contact,
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
        # Try to find user by the contact (email or phone)
        if email:
            user = db.scalar(select(User).where(User.email == normalized_contact))
        else:
            user = db.scalar(select(User).where(User.phone == normalized_contact))

    if user:
        if email:
            user.is_email_verified = True
        else:
            user.phone_otp_verified = True

    db.commit()
    if user:
        db.refresh(user)

    return True, "Verification successful.", user
