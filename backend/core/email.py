"""
Progeni Atlas — Transactional Email (industry standard)
======================================================
Uses a first-class transactional email provider (Resend recommended).
Falls back to SMTP (legacy Gmail) only when Resend is not configured.

Why not Gmail SMTP in production:
  * Gmail SMTP blocks logins from cloud/serverless IP ranges (Vercel, Lambda).
  * Daily send limit (~500/day), no delivery webhooks, no bounce handling.
  * App passwords are tied to an interactive Google account — not a system credential.

Setup (one-time, ~5 minutes):
  1. Sign up at https://resend.com (free 3,000 emails/month)
  2. Verify a sending domain (recommended) or use the onboarding sandbox off their dev domain
  3. Create an API key and put it in .env:  RESEND_API_KEY=re_xxxxxxxxxxxx
  4. Set the sender:  RESEND_FROM="Progeni Atlas <support@progeni.live>"
  5. Restart the backend

If RESEND_API_KEY is missing the module degrades to legacy SMTP (not recommended
for production — it only exists so existing deploys keep working until Resend is set).
If neither is configured, sends are refused with a clear error and the caller
gets a boolean/result dict — nothing is silently swallowed.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

logger = logging.getLogger("progeni_atlas.email")


def _resend_key() -> str:
    return os.environ.get("RESEND_API_KEY", "").strip()


def _resend_from() -> str:
    return os.environ.get("RESEND_FROM", "").strip() or "Progeni Atlas <onboarding@resend.dev>"


def _smtp_config() -> dict[str, Any]:
    try:
        port = int(os.environ.get("SMTP_PORT", "465") or "465")
    except (TypeError, ValueError):
        port = 465
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com").strip(),
        "port": port,
        "user": os.environ.get("SMTP_USER", "").strip(),
        "password": os.environ.get("SMTP_PASS", "").strip(),
        "from": os.environ.get("SMTP_FROM", "").strip(),
        "from_name": os.environ.get("SMTP_FROM_NAME", "Progeni Atlas").strip(),
    }


def email_provider_status() -> dict[str, Any]:
    """Report which email path is active (never returns secrets)."""
    if _resend_key():
        return {"provider": "resend", "configured": True, "from": _resend_from()}
    cfg = _smtp_config()
    if cfg["user"] and cfg["password"]:
        return {"provider": "smtp", "configured": True, "host": cfg["host"], "from": cfg["from"] or f'"{cfg["from_name"]}" <{cfg["user"]}>'}
    return {"provider": None, "configured": False}


def send_transactional_email(
    *,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    from_email: str | None = None,
    attachments: list[dict[str, Any]] | None = None,
    reply_to: str | None = None,
) -> tuple[bool, str | None]:
    """Send a transactional email. Returns (ok, error_message).

    attachments: list of {"filename": str, "content": bytes, "content_type": str}.
    reply_to: replies go to the inviting recruiter, not the platform inbox.
    """
    addr = (to_email or "").strip()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", addr):
        return False, "Invalid recipient email address."

    attach = []
    for att in attachments or []:
        try:
            content = att.get("content")
            if isinstance(content, str):
                content_bytes = content.encode("utf-8")
            else:
                content_bytes = bytes(content or b"")
            if not content_bytes:
                continue
            attach.append({
                "filename": str(att.get("filename") or "attachment.bin"),
                "content": content_bytes,
                "content_type": str(att.get("content_type") or "application/octet-stream"),
            })
        except Exception:
            logger.warning("[Email] Skipping malformed attachment %s", att.get("filename"))

    # Prefer Resend (industry standard HTTP API)
    resend_key = _resend_key()
    if resend_key:
        try:
            import httpx

            import base64

            sender = (from_email or _resend_from()).strip()
            payload = {
                "from": sender,
                "to": [addr],
                "subject": subject,
                "html": html_body,
            }
            if reply_to:
                payload["reply_to"] = reply_to.strip()
            if text_body:
                payload["text"] = text_body
            if attach:
                payload["attachments"] = [
                    {
                        "filename": a["filename"],
                        "content": base64.b64encode(a["content"]).decode("ascii"),
                        "content_type": a["content_type"],
                    }
                    for a in attach
                ]

            response = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=15.0,
            )
            if response.status_code >= 400:
                body = response.text[:300]
                logger.error("[Email] Resend rejected message to %s: %s %s", addr, response.status_code, body)
                return False, f"Resend rejected the email ({response.status_code}). Verify your domain and sender address."
            email_id = None
            try:
                email_id = response.json().get("id")
            except Exception:
                pass
            logger.info("[Email] Resend accepted message id=%s to=%s", email_id, addr)
            return True, None
        except Exception as exc:
            logger.exception("[Email] Resend send failed for %s", addr)
            return False, f"Resend send failed: {exc}"

    # Legacy SMTP fallback (Gmail) — kept for backwards compatibility only
    cfg = _smtp_config()
    if not cfg["user"] or not cfg["password"]:
        logger.error("[Email] No email provider configured (need RESEND_API_KEY or SMTP_USER/PASS)")
        return False, "Email service is not configured. Set RESEND_API_KEY (recommended) or SMTP_USER/SMTP_PASS."

    try:
        import smtplib
        from email.mime.application import MIMEApplication
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        sender = (from_email or cfg["from"] or f'"{cfg["from_name"]}" <{cfg["user"]}>').strip()
        msg["From"] = sender
        msg["To"] = addr
        if reply_to:
            msg["Reply-To"] = reply_to.strip()

        alternative = MIMEMultipart("alternative")
        if text_body:
            alternative.attach(MIMEText(text_body, "plain"))
        alternative.attach(MIMEText(html_body, "html"))
        msg.attach(alternative)
        for a in attach:
            part = MIMEApplication(a["content"], _subtype=a["content_type"].split("/", 1)[-1] if "/" in a["content_type"] else "octet-stream")
            part.add_header("Content-Disposition", "attachment", filename=a["filename"])
            part.add_header("Content-Type", a["content_type"], name=a["filename"])
            msg.attach(part)

        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15) as server:
                server.login(cfg["user"], cfg["password"])
                server.sendmail(sender, [addr], msg.as_string())
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
                server.starttls()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(sender, [addr], msg.as_string())

        logger.info("[Email] SMTP accepted message to=%s", addr)
        return True, None
    except Exception as exc:
        logger.error("[Email] SMTP failed for %s: %s", addr, exc)
        return False, f"Failed to deliver email: {exc}. Tip: Gmail app passwords require 2FA and are rejected from cloud IPs — set RESEND_API_KEY instead."
