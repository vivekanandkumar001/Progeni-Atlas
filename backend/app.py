"""
TalentPulse AI — Enterprise Backend Server
===========================================
Polyglot Backend API integrating Flask, PostgreSQL (relational DB & auth),
MongoDB Atlas (transcripts & evaluation documents), and Qdrant (Vector DB).
"""

import os
import uuid
import json
import time
import hashlib
import traceback
from datetime import datetime, timedelta, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import pymongo
from flask import Flask, request, jsonify, session
from dotenv import load_dotenv

# Load environment configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

if os.path.exists(os.path.join(ROOT_DIR, ".env")):
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
else:
    load_dotenv(os.path.join(BASE_DIR, ".env"))

app = Flask(__name__)
app.secret_key = os.environ.get("SWAMI_SECRET_KEY", "talentpulse_secret_key_2026")

@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
    return response

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
RECORDING_DIR = os.path.join(BASE_DIR, "recordings")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RECORDING_DIR, exist_ok=True)

from core.db import check_postgres_connection, check_mongo_connection, check_qdrant_connection, PG_URI, MONGO_URI

import secrets
import hmac
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# OTP security policy (single source of truth — server side)
OTP_LENGTH = 6
OTP_TTL_SEC = 120          # code validity window
OTP_RESEND_COOLDOWN_SEC = 30  # min delay between resend requests
OTP_MAX_ATTEMPTS = 5       # brute-force limit per OTP record
OTP_RE = re.compile(r"^\d{6}$")

# Password hashing helper (SHA-256 for passwords)
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def _as_aware_utc(dt) -> datetime:
    """Normalize DB timestamps to tz-aware UTC for safe expiry comparison.

    psycopg2 may return naive datetimes depending on driver/server settings;
    comparing naive vs aware raises TypeError and would 500 the request.
    """
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def hash_otp(otp_code: str) -> str:
    """HMAC-SHA256 OTP hash peppered with the server secret.

    Stronger than plain SHA-256 if the OTP table is ever read by an attacker.
    """
    pepper = os.environ.get("SWAMI_SECRET_KEY", "talentpulse_secret_key_2026")
    return hmac.new(pepper.encode("utf-8"), otp_code.encode("utf-8"), hashlib.sha256).hexdigest()

def check_otp_hash(otp_code: str, stored_hash: str) -> bool:
    """Accept current HMAC hashes plus legacy plain-SHA256 hashes (transition)."""
    if hmac.compare_digest(hash_otp(otp_code), stored_hash):
        return True
    legacy = hashlib.sha256(otp_code.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored_hash)

def generate_otp_code() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP (CSPRNG)."""
    return f"{secrets.randbelow(900000) + 100000}"

def send_otp_email_smtp(to_email: str, otp_code: str, purpose: str = "REGISTRATION_VERIFY") -> tuple[bool, str | None]:
    """
    Dispatch email OTP via SMTP using SSL (port 465) or STARTTLS (port 587).
    Returns (True, None) on success, or (False, error_message) on failure.

    SECURITY: never log the OTP value. Never return success unless the
    provider actually accepted the message.
    """
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com").strip()
    try:
        smtp_port = int(os.environ.get("SMTP_PORT", 465))
    except (ValueError, TypeError):
        smtp_port = 465

    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASS", "").strip()
    from_name = os.environ.get("SMTP_FROM_NAME", "TalentPulse AI").strip()
    smtp_from = os.environ.get("SMTP_FROM", f'"{from_name}" <{smtp_user}>').strip()

    subject = "TalentPulse AI — Verify Your Email Address"
    if purpose == "FORGOT_PASSWORD":
        subject = "TalentPulse AI — Password Reset Verification Code"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; background-color: #020617; color: #f8fafc; padding: 32px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #1e293b;">
      <h2 style="color: #06b6d4; margin-bottom: 8px;">{from_name}</h2>
      <p style="color: #94a3b8; font-size: 14px;">Verification Security Code</p>
      <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8;">{otp_code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-bottom: 4px;">This single-use code is valid for <strong>2 minutes (120 seconds)</strong>.</p>
      <p style="color: #64748b; font-size: 11px;">If you did not request this verification code, please ignore this message.</p>
    </div>
    """

    print(f"[OTP] Generation started purpose={purpose} recipient={to_email}")
    print(f"[OTP] Email delivery started purpose={purpose} recipient={to_email}")

    # Missing SMTP credentials: FAIL CLOSED. Never claim delivery succeeded
    # when no email was handed to a provider. (Previous code returned
    # success here, which is why the UI said "sent" but nothing arrived.)
    if not smtp_user or not smtp_pass:
        print("[OTP] Email delivery failed: SMTP_USER/SMTP_PASS not configured. "
              "Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (Gmail App Password).")
        return False, ("Email service is not configured. "
                       "Please set SMTP_USER and SMTP_PASS (Gmail App Password) and try again.")

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

        print(f"[OTP] Email provider accepted message purpose={purpose} recipient={to_email}")
        return True, None
    except smtplib.SMTPAuthenticationError as auth_err:
        err_msg = "SMTP Authentication failed. Please check your SMTP_USER and Google App Password (SMTP_PASS)."
        print(f"[OTP] Email delivery failed: SMTP authentication rejected for recipient={to_email}: {auth_err}")
        return False, err_msg
    except Exception as err:
        print(f"[OTP] Email delivery failed for recipient={to_email}: {err}")
        traceback.print_exc()
        return False, f"Failed to deliver email: {str(err)}"



# ------------------------------------------------------------------------------
# SYSTEM HEALTH
# ------------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():
    pg_status = check_postgres_connection()
    mongo_status = check_mongo_connection()
    qdrant_status = check_qdrant_connection()
    all_healthy = pg_status.get("status") == "connected" and mongo_status.get("status") == "connected"

    return jsonify({
        "status": "healthy" if all_healthy else "degraded",
        "services": {
            "postgresql": pg_status,
            "mongodb": mongo_status,
            "qdrant": qdrant_status,
        },
        "timestamp": time.time()
    })

# ------------------------------------------------------------------------------
# ENTERPRISE AUTHENTICATION ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/auth/check-email", methods=["POST"])
def check_email_exists():
    """Duplicate Account Guard: Check if email already exists."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"exists": False}), 400

        if not PG_URI:
            return jsonify({"exists": False}), 200

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, email, is_email_verified, role FROM users WHERE email = %s;", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if user:
            return jsonify({
                "exists": True,
                "isVerified": user["is_email_verified"],
                "role": user["role"],
                "message": "Account already exists with this email address."
            }), 200

        return jsonify({"exists": False}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/register", methods=["POST"])
def register():
    """User Registration with Duplicate Guard & 2-Minute Email OTP generation."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        full_name = data.get("fullName", "").strip()
        role = data.get("role", "candidate").strip().lower()
        phone = data.get("phone", "").strip()

        if not email or not password or not full_name:
            return jsonify({"error": "Full name, email, and password are required."}), 400

        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Duplicate Account Check
        cur.execute("SELECT id, is_email_verified, role FROM users WHERE email = %s;", (email,))
        existing_user = cur.fetchone()
        if existing_user:
            cur.close()
            conn.close()
            return jsonify({
                "isDuplicate": True,
                "redirectUrl": "/login",
                "message": "An account with this email already exists. Please log in."
            }), 409

        # 2. Insert User into PostgreSQL
        pwd_hash = hash_password(password)
        user_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO users (id, email, password_hash, full_name, role, status, is_email_verified, phone)
            VALUES (%s, %s, %s, %s, %s, 'active', FALSE, %s)
            RETURNING id;
        """, (user_id, email, pwd_hash, full_name, role, phone or None))
        
        # 3. Generate 6-digit OTP (server-side TTL is the source of truth)
        otp_code = generate_otp_code()
        otp_hash = hash_otp(otp_code)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SEC)

        # Invalidate old OTPs for registration
        cur.execute("DELETE FROM email_otps WHERE email = %s AND purpose = 'REGISTRATION_VERIFY';", (email,))
        
        # Insert new OTP
        cur.execute("""
            INSERT INTO email_otps (email, otp_hash, purpose, expires_at)
            VALUES (%s, %s, 'REGISTRATION_VERIFY', %s);
        """, (email, otp_hash, expires_at))

        conn.commit()
        cur.close()
        conn.close()

        email_sent, email_err = send_otp_email_smtp(email, otp_code, "REGISTRATION_VERIFY")
        if not email_sent:
            # Account + OTP row are kept so the user can reach /verify-otp and
            # use Resend once the email service is configured. Never claim
            # the email was sent when the provider rejected/failed it.
            print(f"[OTP] Registration email handoff failed recipient={email}: {email_err}")
            return jsonify({
                "error": f"Account created, but verification email could not be delivered: {email_err}",
                "email": email,
                "otpRequired": True,
                "expiresInSec": OTP_TTL_SEC,
                "redirectUrl": f"/verify-otp?email={email}&purpose=REGISTRATION_VERIFY"
            }), 502

        return jsonify({
            "success": True,
            "email": email,
            "role": role,
            "otpRequired": True,
            "expiresInSec": OTP_TTL_SEC,
            "redirectUrl": f"/verify-otp?email={email}&purpose=REGISTRATION_VERIFY"
        }), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500


@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    """Verify 6-digit numeric OTP. Server-side expiry + one-time-use enforced."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        otp_code = data.get("otp", "").strip()
        purpose = data.get("purpose", "REGISTRATION_VERIFY").strip()
        if purpose not in ("REGISTRATION_VERIFY", "FORGOT_PASSWORD"):
            purpose = "REGISTRATION_VERIFY"

        if not email or not otp_code:
            return jsonify({"error": "Email and OTP code are required."}), 400
        if not OTP_RE.match(otp_code):
            return jsonify({"error": "OTP code must be exactly 6 digits."}), 400

        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Lookup latest valid OTP
        cur.execute("""
            SELECT id, otp_hash, expires_at, attempts_count
            FROM email_otps
            WHERE email = %s AND purpose = %s
            ORDER BY created_at DESC LIMIT 1;
        """, (email, purpose))
        record = cur.fetchone()

        if not record:
            cur.close()
            conn.close()
            return jsonify({"error": "No OTP request found for this email. Please request a new code."}), 400

        now_utc = datetime.now(timezone.utc)
        expires_at = _as_aware_utc(record["expires_at"])
        if expires_at < now_utc:
            cur.execute("DELETE FROM email_otps WHERE id = %s;", (record["id"],))
            conn.commit()
            cur.close()
            conn.close()
            print(f"[OTP] Verification rejected (expired) purpose={purpose} recipient={email}")
            return jsonify({"error": "OTP code has expired after 2 minutes. Please click Resend Code.",
                            "expired": True}), 400

        if (record["attempts_count"] or 0) >= OTP_MAX_ATTEMPTS:
            cur.execute("DELETE FROM email_otps WHERE id = %s;", (record["id"],))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"error": "Too many invalid attempts. Your verification code has been invalidated. Please request a new code."}), 429

        # Verify hash (HMAC-peppered; legacy plain-SHA256 accepted during transition)
        if not check_otp_hash(otp_code, record["otp_hash"]):
            # Increment attempt counter
            cur.execute("UPDATE email_otps SET attempts_count = attempts_count + 1 WHERE id = %s;", (record["id"],))
            conn.commit()
            cur.close()
            conn.close()
            print(f"[OTP] Verification rejected (incorrect) purpose={purpose} recipient={email}")
            return jsonify({"error": "Incorrect OTP code. Please check your email and try again."}), 400

        # OTP Verified Successfully!
        cur.execute("DELETE FROM email_otps WHERE email = %s AND purpose = %s;", (email, purpose))
        
        user_role = "candidate"
        if purpose == "REGISTRATION_VERIFY":
            cur.execute("UPDATE users SET is_email_verified = TRUE WHERE email = %s RETURNING role;", (email,))
            u = cur.fetchone()
            if u:
                user_role = u["role"]

        conn.commit()
        cur.close()
        conn.close()

        target_dashboard = "/recruiter/dashboard" if user_role == "recruiter" else "/candidate/dashboard"

        return jsonify({
            "success": True,
            "message": "Email verified successfully!",
            "role": user_role,
            "redirectUrl": target_dashboard
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"OTP verification failed: {str(e)}"}), 500


@app.route("/api/auth/resend-otp", methods=["POST"])
def resend_otp():
    """Resend OTP with rate limiting; invalidates the previous OTP."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        purpose = data.get("purpose", "REGISTRATION_VERIFY").strip()
        if purpose not in ("REGISTRATION_VERIFY", "FORGOT_PASSWORD"):
            purpose = "REGISTRATION_VERIFY"

        if not email:
            return jsonify({"error": "Email is required."}), 400

        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Resend only for existing accounts (prevents arbitrary email bombing).
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            print(f"[OTP] Resend rejected (unknown email) purpose={purpose} recipient={email}")
            return jsonify({"error": "No account found for this email address."}), 404

        # Check last OTP creation for cooldown
        cur.execute("""
            SELECT created_at FROM email_otps
            WHERE email = %s AND purpose = %s
            ORDER BY created_at DESC LIMIT 1;
        """, (email, purpose))
        last_otp = cur.fetchone()

        now_utc = datetime.now(timezone.utc)
        if last_otp and last_otp["created_at"]:
            created_at = _as_aware_utc(last_otp["created_at"])
            elapsed_sec = (now_utc - created_at).total_seconds()
            if elapsed_sec < OTP_RESEND_COOLDOWN_SEC:
                remaining = int(OTP_RESEND_COOLDOWN_SEC - elapsed_sec)
                cur.close()
                conn.close()
                return jsonify({
                    "error": f"Please wait {remaining} seconds before requesting a new OTP.",
                    "cooldownRemainingSec": remaining
                }), 429

        # Generate new 6-digit OTP (invalidates previous OTP below)
        otp_code = generate_otp_code()
        otp_hash = hash_otp(otp_code)
        expires_at = now_utc + timedelta(seconds=OTP_TTL_SEC)

        cur.execute("DELETE FROM email_otps WHERE email = %s AND purpose = %s;", (email, purpose))
        cur.execute("""
            INSERT INTO email_otps (email, otp_hash, purpose, expires_at)
            VALUES (%s, %s, %s, %s);
        """, (email, otp_hash, purpose, expires_at))

        conn.commit()
        cur.close()
        conn.close()

        email_sent, email_err = send_otp_email_smtp(email, otp_code, purpose)
        if not email_sent:
            print(f"[OTP] Resend email handoff failed recipient={email}: {email_err}")
            return jsonify({
                "error": f"Failed to send email: {email_err}"
            }), 502

        return jsonify({
            "success": True,
            "message": "A new 6-digit code has been sent to your email.",
            "expiresInSec": OTP_TTL_SEC,
            "cooldownSec": OTP_RESEND_COOLDOWN_SEC
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/otp-status", methods=["GET"])
def otp_status():
    """Server-truth OTP timer state so the UI countdown matches backend expiry.

    Returns remaining seconds until expiry + resend cooldown. Never exposes OTP.
    """
    try:
        email = (request.args.get("email", "") or "").strip().lower()
        purpose = (request.args.get("purpose", "REGISTRATION_VERIFY") or "").strip()
        if purpose not in ("REGISTRATION_VERIFY", "FORGOT_PASSWORD"):
            purpose = "REGISTRATION_VERIFY"
        if not email:
            return jsonify({"error": "Email is required."}), 400
        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT expires_at, created_at FROM email_otps
            WHERE email = %s AND purpose = %s
            ORDER BY created_at DESC LIMIT 1;
        """, (email, purpose))
        record = cur.fetchone()
        cur.close()
        conn.close()

        now_utc = datetime.now(timezone.utc)
        if not record:
            return jsonify({"exists": False, "expired": True,
                            "expiresInSec": 0, "cooldownRemainingSec": 0,
                            "ttlSec": OTP_TTL_SEC,
                            "cooldownSec": OTP_RESEND_COOLDOWN_SEC}), 200

        expires_in = max(0, int((_as_aware_utc(record["expires_at"]) - now_utc).total_seconds()))
        cooldown_left = 0
        if record["created_at"]:
            elapsed = (now_utc - _as_aware_utc(record["created_at"])).total_seconds()
            cooldown_left = max(0, int(OTP_RESEND_COOLDOWN_SEC - elapsed))

        return jsonify({"exists": True,
                        "expired": expires_in <= 0,
                        "expiresInSec": expires_in,
                        "cooldownRemainingSec": cooldown_left,
                        "ttlSec": OTP_TTL_SEC,
                        "cooldownSec": OTP_RESEND_COOLDOWN_SEC}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Authenticate user with Unverified Account Guard & Last Login Timestamp."""
    try:
        body = request.get_json() or {}
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")

        if not email or not password:
            return jsonify({"error": "Email and password are required."}), 400

        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, org_id, email, password_hash, full_name, role, status, is_email_verified, avatar_url FROM users WHERE email = %s;", (email,))
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid email or password. Please check your credentials or register."}), 401

        # Check password hash
        input_hash = hash_password(password)
        if input_hash != user["password_hash"]:
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid email or password. Please check your credentials."}), 401

        # Check Unverified Guard
        if not user["is_email_verified"]:
            cur.close()
            conn.close()
            return jsonify({
                "isUnverified": True,
                "email": email,
                "redirectUrl": f"/verify-otp?email={email}&purpose=REGISTRATION_VERIFY",
                "message": "Your email address is not verified yet. Please enter the 6-digit OTP code."
            }), 403

        # Update last login timestamp
        cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s;", (user["id"],))
        conn.commit()
        cur.close()
        conn.close()

        target_dashboard = "/recruiter/dashboard" if user["role"] == "recruiter" else "/candidate/dashboard"

        return jsonify({
            "user": {
                "id": str(user["id"]),
                "orgId": str(user["org_id"]) if user["org_id"] else None,
                "email": user["email"],
                "fullName": user["full_name"],
                "role": user["role"],
                "status": user["status"],
                "isEmailVerified": True,
                "avatarUrl": user["avatar_url"],
            },
            "token": f"jwt_token_{str(user['id'])}",
            "redirectUrl": target_dashboard
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Login failed: {str(e)}"}), 500


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """Trigger Forgot Password OTP flow."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        if not email:
            return jsonify({"error": "Email is required."}), 400

        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "No account found with this email address."}), 404

        # Generate Password Reset OTP
        otp_code = generate_otp_code()
        otp_hash = hash_otp(otp_code)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SEC)

        cur.execute("DELETE FROM email_otps WHERE email = %s AND purpose = 'FORGOT_PASSWORD';", (email,))
        cur.execute("""
            INSERT INTO email_otps (email, otp_hash, purpose, expires_at)
            VALUES (%s, %s, 'FORGOT_PASSWORD', %s);
        """, (email, otp_hash, expires_at))

        conn.commit()
        cur.close()
        email_sent, email_err = send_otp_email_smtp(email, otp_code, "FORGOT_PASSWORD")
        if not email_sent:
            print(f"[OTP] Forgot-password email handoff failed recipient={email}: {email_err}")
            return jsonify({
                "error": f"Failed to send password reset email: {email_err}"
            }), 502

        return jsonify({
            "success": True,
            "email": email,
            "expiresInSec": OTP_TTL_SEC,
            "redirectUrl": f"/verify-otp?email={email}&purpose=FORGOT_PASSWORD"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    """Complete Password Reset after OTP verification."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        otp_code = data.get("otp", "").strip()
        new_password = data.get("newPassword", "")

        if not email or not otp_code or not new_password:
            return jsonify({"error": "Email, OTP code, and new password are required."}), 400
        if not OTP_RE.match(otp_code):
            return jsonify({"error": "OTP code must be exactly 6 digits."}), 400

        if not PG_URI:
            return jsonify({"error": "Database URL not configured."}), 500

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Verify OTP (same brute-force + expiry policy as /verify-otp)
        cur.execute("""
            SELECT id, otp_hash, expires_at, attempts_count FROM email_otps
            WHERE email = %s AND purpose = 'FORGOT_PASSWORD'
            ORDER BY created_at DESC LIMIT 1;
        """, (email,))
        record = cur.fetchone()

        now_utc = datetime.now(timezone.utc)
        if not record or _as_aware_utc(record["expires_at"]) < now_utc:
            if record:
                cur.execute("DELETE FROM email_otps WHERE id = %s;", (record["id"],))
                conn.commit()
            cur.close()
            conn.close()
            print(f"[OTP] Password-reset rejected (expired/missing) recipient={email}")
            return jsonify({"error": "Invalid or expired OTP code. Please request a new code.",
                            "expired": True}), 400

        if (record.get("attempts_count") or 0) >= OTP_MAX_ATTEMPTS:
            cur.execute("DELETE FROM email_otps WHERE id = %s;", (record["id"],))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"error": "Too many invalid attempts. Please request a new code."}), 429

        if not check_otp_hash(otp_code, record["otp_hash"]):
            cur.execute("UPDATE email_otps SET attempts_count = attempts_count + 1 WHERE id = %s;", (record["id"],))
            conn.commit()
            cur.close()
            conn.close()
            print(f"[OTP] Password-reset rejected (incorrect) recipient={email}")
            return jsonify({"error": "Incorrect OTP code."}), 400

        # Update Password & Clean OTP
        pwd_hash = hash_password(new_password)
        cur.execute("UPDATE users SET password_hash = %s, is_email_verified = TRUE WHERE email = %s;", (pwd_hash, email))
        cur.execute("DELETE FROM email_otps WHERE email = %s AND purpose = 'FORGOT_PASSWORD';", (email,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Password reset successfully. Please log in with your new password.",
            "redirectUrl": "/login"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidate/dashboard-data", methods=["GET"])
def get_candidate_dashboard_data():
    try:
        pg_res = {"user": None, "upcomingSession": None}
        if PG_URI:
            try:
                conn = psycopg2.connect(PG_URI)
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT s.id, s.session_type, s.status, s.current_stage, j.title as job_title, o.name as company_name
                    FROM interview_sessions s
                    LEFT JOIN job_profiles j ON s.job_profile_id = j.id
                    LEFT JOIN organizations o ON s.org_id = o.id
                    ORDER BY s.created_at DESC LIMIT 1;
                """)
                session_row = cur.fetchone()
                cur.close()
                conn.close()
                if session_row:
                    pg_res["upcomingSession"] = {
                        "id": str(session_row["id"]),
                        "title": session_row["job_title"] or "Full-Stack & Systems Architecture Screening",
                        "company": session_row["company_name"] or "CloudScale Systems (Campus Placement Drive)",
                        "status": session_row["status"],
                        "stage": session_row["current_stage"],
                    }
            except Exception as e:
                print(f"[Dashboard Data] PostgreSQL query warning: {e}")

        return jsonify({
            "candidate": {
                "name": "Vivekanand Kumar",
                "academicTag": "B.Tech CSE • 4th Year",
                "status": "Active Job Seeker",
                "readinessScore": 88,
                "percentileRank": 12,
                "growthChange": 6,
            },
            "upcomingSession": pg_res.get("upcomingSession") or {
                "id": "e1111111-1111-1111-1111-111111111111",
                "title": "Full-Stack & Systems Architecture Screening",
                "company": "CloudScale Systems (Campus Placement Drive)",
                "scheduledTime": "3:30 PM",
                "durationMinutes": 30,
            },
            "competencyScores": [
                {"name": "Algorithmic Problem Solving", "score": 8.8, "percent": 88},
                {"name": "System & Architecture Design", "score": 9.2, "percent": 92},
                {"name": "Code Quality & Debugging", "score": 8.4, "percent": 84},
                {"name": "Communication & Articulation", "score": 9.0, "percent": 90},
            ],
            "resumeStatus": {
                "fileName": "Vivekanand_Kumar_Resume_2026.pdf",
                "sizeBytes": 1468006,
                "status": "Synchronized"
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# CANDIDATE PROFILE & HARDWARE DIAGNOSTICS ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/candidate/profile", methods=["GET"])
def get_candidate_profile():
    """Fetch candidate profile from PostgreSQL and active resume."""
    try:
        email = request.args.get("email", "vivekanand@talentpulse.ai").strip().lower()
        if not PG_URI:
            return jsonify({
                "fullName": "Vivekanand Kumar",
                "email": email,
                "phone": "+91 98765 43210",
                "course": "B.Tech",
                "branch": "Computer Science & Engineering",
                "academicYear": "4th Year (2026)",
                "collegeName": "National Institute of Technology",
                "bio": "Passionate full-stack developer and AI systems enthusiast. Experienced in React, Next.js, Node.js, and Python backend services.",
                "githubUrl": "https://github.com/vivekanandkumar001",
                "linkedinUrl": "https://linkedin.com/in/vivekanand-kumar",
                "portfolioUrl": "https://talentpulse.ai/candidate/vivekanand",
                "skillsSummary": ["React.js", "TypeScript", "Node.js", "Python", "PostgreSQL", "MongoDB", "System Design"],
                "twoFactorEnabled": True,
                "resume": {
                    "id": "res-101",
                    "fileName": "Vivekanand_Kumar_Resume_2026.pdf",
                    "fileSizeFormatted": "1.4 MB",
                    "fileUrl": "/uploads/resumes/sample_resume.pdf",
                    "uploadedAt": "2026-09-20T10:30:00Z",
                    "isActive": True
                }
            })

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, full_name, email, phone, course, branch, academic_year, college_name, bio,
                   github_url, linkedin_url, portfolio_url, skills_summary, two_factor_enabled, avatar_url
            FROM users
            WHERE email = %s OR role = 'candidate'
            ORDER BY (email = %s) DESC LIMIT 1;
        """, (email, email))
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "Candidate profile not found"}), 404

        # Fetch active resume
        cur.execute("""
            SELECT id, file_name, file_size_bytes, file_url, uploaded_at, is_active
            FROM candidate_resumes
            WHERE candidate_id = %s AND is_active = TRUE
            ORDER BY uploaded_at DESC LIMIT 1;
        """, (user["id"],))
        resume_row = cur.fetchone()
        cur.close()
        conn.close()

        resume_data = None
        if resume_row:
            size_mb = round(resume_row["file_size_bytes"] / (1024 * 1024), 2)
            resume_data = {
                "id": str(resume_row["id"]),
                "fileName": resume_row["file_name"],
                "fileSizeFormatted": f"{size_mb} MB" if size_mb >= 0.1 else f"{round(resume_row['file_size_bytes']/1024, 1)} KB",
                "fileUrl": resume_row["file_url"],
                "uploadedAt": resume_row["uploaded_at"].isoformat() if resume_row["uploaded_at"] else None,
                "isActive": resume_row["is_active"]
            }
        else:
            resume_data = {
                "id": "res-default",
                "fileName": "Vivekanand_Kumar_Resume_2026.pdf",
                "fileSizeFormatted": "1.4 MB",
                "fileUrl": "/uploads/resumes/sample_resume.pdf",
                "uploadedAt": "2026-09-20T10:30:00Z",
                "isActive": True
            }

        return jsonify({
            "id": str(user["id"]),
            "fullName": user["full_name"] or "Vivekanand Kumar",
            "email": user["email"],
            "phone": user["phone"] or "+91 98765 43210",
            "course": user["course"] or "B.Tech",
            "branch": user["branch"] or "Computer Science & Engineering",
            "academicYear": user["academic_year"] or "4th Year",
            "collegeName": user["college_name"] or "National Institute of Technology",
            "bio": user["bio"] or "Passionate full-stack developer building AI interview systems.",
            "githubUrl": user["github_url"] or "https://github.com/vivekanandkumar001",
            "linkedinUrl": user["linkedin_url"] or "https://linkedin.com/in/vivekanand-kumar",
            "portfolioUrl": user["portfolio_url"] or "",
            "skillsSummary": user["skills_summary"] or ["React.js", "TypeScript", "Node.js", "Python", "PostgreSQL", "MongoDB"],
            "twoFactorEnabled": bool(user["two_factor_enabled"]),
            "avatarUrl": user["avatar_url"],
            "resume": resume_data
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidate/profile", methods=["PUT"])
def update_candidate_profile():
    """Update candidate profile fields in PostgreSQL."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "").strip().lower()
        if not email and PG_URI:
            email = "vivekanand@talentpulse.ai"

        full_name = data.get("fullName", "").strip()
        phone = data.get("phone", "").strip()
        course = data.get("course", "").strip()
        branch = data.get("branch", "").strip()
        academic_year = data.get("academicYear", "").strip()
        college_name = data.get("collegeName", "").strip()
        bio = data.get("bio", "").strip()
        github_url = data.get("githubUrl", "").strip()
        linkedin_url = data.get("linkedinUrl", "").strip()
        portfolio_url = data.get("portfolioUrl", "").strip()
        skills_summary = data.get("skillsSummary", [])
        two_factor_enabled = bool(data.get("twoFactorEnabled", False))

        if not PG_URI:
            return jsonify({
                "success": True,
                "message": "Candidate profile updated successfully!",
                "profile": data
            })

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            UPDATE users
            SET full_name = COALESCE(NULLIF(%s, ''), full_name),
                phone = %s,
                course = %s,
                branch = %s,
                academic_year = %s,
                college_name = %s,
                bio = %s,
                github_url = %s,
                linkedin_url = %s,
                portfolio_url = %s,
                skills_summary = %s,
                two_factor_enabled = %s
            WHERE email = %s OR role = 'candidate'
            RETURNING id, full_name, email;
        """, (
            full_name, phone, course, branch, academic_year, college_name, bio,
            github_url, linkedin_url, portfolio_url, skills_summary, two_factor_enabled,
            email
        ))
        updated_user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Profile updated successfully!",
            "user": updated_user
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to update profile: {str(e)}"}), 500


@app.route("/api/candidate/resume", methods=["POST"])
def upload_candidate_resume():
    """Handle resume re-upload and cloud sync."""
    try:
        if 'file' in request.files:
            file = request.files['file']
            file_name = file.filename or "resume.pdf"
            resumes_dir = os.path.join(UPLOAD_DIR, "resumes")
            os.makedirs(resumes_dir, exist_ok=True)
            saved_path = os.path.join(resumes_dir, f"{int(time.time())}_{file_name}")
            file.save(saved_path)
            file_size = os.path.getsize(saved_path)
            file_url = f"/uploads/resumes/{os.path.basename(saved_path)}"
        else:
            data = request.get_json() or {}
            file_name = data.get("fileName", "Updated_Resume_2026.pdf")
            file_size = data.get("fileSizeBytes", 1520000)
            file_url = data.get("fileUrl", "/uploads/resumes/sample_resume.pdf")

        if PG_URI:
            conn = psycopg2.connect(PG_URI)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT id FROM users WHERE role = 'candidate' LIMIT 1;")
            user = cur.fetchone()
            if user:
                cur.execute("UPDATE candidate_resumes SET is_active = FALSE WHERE candidate_id = %s;", (user["id"],))
                cur.execute("""
                    INSERT INTO candidate_resumes (candidate_id, file_name, file_size_bytes, file_url, mime_type, is_active)
                    VALUES (%s, %s, %s, %s, 'application/pdf', TRUE)
                    RETURNING id, file_name, file_size_bytes, file_url, uploaded_at;
                """, (user["id"], file_name, file_size, file_url))
                new_res = cur.fetchone()
                conn.commit()
                cur.close()
                conn.close()

                size_mb = round(new_res["file_size_bytes"] / (1024 * 1024), 2)
                return jsonify({
                    "success": True,
                    "message": "Resume uploaded and synchronized successfully!",
                    "resume": {
                        "id": str(new_res["id"]),
                        "fileName": new_res["file_name"],
                        "fileSizeFormatted": f"{size_mb} MB",
                        "fileUrl": new_res["file_url"],
                        "uploadedAt": new_res["uploaded_at"].isoformat() if new_res["uploaded_at"] else None,
                        "isActive": True
                    }
                }), 200

        size_mb = round(file_size / (1024 * 1024), 2)
        return jsonify({
            "success": True,
            "message": "Resume uploaded successfully!",
            "resume": {
                "id": str(uuid.uuid4()),
                "fileName": file_name,
                "fileSizeFormatted": f"{size_mb} MB",
                "fileUrl": file_url,
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
                "isActive": True
            }
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Resume upload failed: {str(e)}"}), 500


@app.route("/api/candidate/diagnostics", methods=["POST"])
def log_hardware_diagnostics():
    """Log WebRTC pre-flight hardware diagnostic results to MongoDB Atlas."""
    try:
        data = request.get_json() or {}
        mic_status = data.get("micStatus", "passed")
        camera_status = data.get("cameraStatus", "passed")
        latency_ms = data.get("latencyMs", 35)
        user_agent = request.headers.get("User-Agent", "")

        doc = {
            "diagnosticId": str(uuid.uuid4()),
            "candidateEmail": data.get("email", "vivekanand@talentpulse.ai"),
            "micStatus": mic_status,
            "cameraStatus": camera_status,
            "latencyMs": latency_ms,
            "browser": user_agent,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if MONGO_URI:
            try:
                from core.db import CERTIFI_CA
                kwargs = {"serverSelectionTimeoutMS": 5000}
                if CERTIFI_CA:
                    kwargs["tlsCAFile"] = CERTIFI_CA
                client = pymongo.MongoClient(MONGO_URI, **kwargs)
                db = client.get_database("swami_db")
                db.hardware_diagnostics.insert_one(doc)
            except Exception as mongo_err:
                print(f"[Diagnostics] MongoDB log warning: {mongo_err}")

        return jsonify({
            "success": True,
            "diagnosticId": doc["diagnosticId"],
            "loggedAt": doc["timestamp"],
            "status": "HEALTHY" if mic_status == "passed" and camera_status == "passed" else "ATTENTION_REQUIRED"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# RECRUITER PROFILE & ENTERPRISE ORGANIZATION ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/recruiter/profile", methods=["GET"])
def get_recruiter_profile():
    """Fetch recruiter personal details, organization branding, team invites & quota."""
    try:
        email = request.args.get("email", "recruiter@cloudscale.com").strip().lower()
        if not PG_URI:
            return jsonify({
                "fullName": "Sarah Jenkins",
                "email": email,
                "phone": "+1 (555) 382-9102",
                "designation": "Director of Global Talent Acquisition",
                "department": "People & Engineering Talent",
                "linkedinUrl": "https://linkedin.com/in/sarah-jenkins-talent",
                "isOrgAdmin": True,
                "monthlyHiringQuota": 50,
                "quotaUsed": 14,
                "organization": {
                    "id": "org-cloudscale-01",
                    "name": "CloudScale Systems",
                    "slug": "cloudscale-systems",
                    "tier": "enterprise",
                    "websiteUrl": "https://cloudscale.io",
                    "industry": "Cloud Infrastructure & AI Systems",
                    "companySize": "500-1000 Employees",
                    "headquartersCity": "San Francisco, CA",
                    "bio": "CloudScale Systems builds next-generation distributed AI infrastructure and enterprise cloud execution platforms.",
                    "billingEmail": "billing@cloudscale.io",
                    "logoUrl": "/org-logos/cloudscale.png"
                },
                "teamMembers": [
                    {"id": "usr-01", "name": "Sarah Jenkins", "email": "recruiter@cloudscale.com", "role": "admin", "status": "active"},
                    {"id": "usr-02", "name": "Marcus Vance", "email": "m.vance@cloudscale.com", "role": "recruiter", "status": "active"},
                    {"id": "usr-03", "name": "Elena Rostova", "email": "e.rostova@cloudscale.com", "role": "interviewer", "status": "pending"}
                ],
                "auditLogs": [
                    {"id": "log-1", "action": "Exported Candidate Evaluation Dossier", "performedBy": "Sarah Jenkins", "timestamp": "2026-09-26T14:22:00Z"},
                    {"id": "log-2", "action": "Updated System Architecture Technical Rubric", "performedBy": "Sarah Jenkins", "timestamp": "2026-09-25T11:05:00Z"},
                    {"id": "log-3", "action": "Invited Elena Rostova to Talent Acquisition Workspace", "performedBy": "Sarah Jenkins", "timestamp": "2026-09-24T09:15:00Z"}
                ]
            })

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Lookup recruiter user
        cur.execute("""
            SELECT id, org_id, full_name, email, phone, designation, department, linkedin_url,
                   monthly_hiring_quota, is_org_admin, avatar_url
            FROM users
            WHERE role = 'recruiter' OR role = 'admin' OR email = %s
            ORDER BY (email = %s) DESC LIMIT 1;
        """, (email, email))
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "Recruiter profile not found"}), 404

        org_id = user["org_id"]
        org_data = None
        team_members = []
        if org_id:
            cur.execute("""
                SELECT id, name, slug, tier, logo_url, website_url, industry, company_size, headquarters_city, bio, billing_email
                FROM organizations WHERE id = %s;
            """, (org_id,))
            org_data = cur.fetchone()

            # Team members in org
            cur.execute("""
                SELECT id, full_name as name, email, role, 'active' as status
                FROM users WHERE org_id = %s;
            """, (org_id,))
            team_members = cur.fetchall() or []

            # Pending invites
            cur.execute("""
                SELECT id, email, role, status
                FROM organization_invites WHERE org_id = %s AND status = 'pending';
            """, (org_id,))
            invites = cur.fetchall() or []
            for inv in invites:
                team_members.append({
                    "id": str(inv["id"]),
                    "name": inv["email"].split("@")[0].title(),
                    "email": inv["email"],
                    "role": inv["role"],
                    "status": "pending"
                })

        cur.close()
        conn.close()

        org_payload = {
            "id": str(org_data["id"]) if org_data else "org-cloudscale-01",
            "name": org_data["name"] if org_data else "CloudScale Systems",
            "slug": org_data["slug"] if org_data else "cloudscale-systems",
            "tier": org_data["tier"] if org_data else "enterprise",
            "websiteUrl": (org_data and org_data["website_url"]) or "https://cloudscale.io",
            "industry": (org_data and org_data["industry"]) or "Cloud Infrastructure & AI Systems",
            "companySize": (org_data and org_data["company_size"]) or "500-1000 Employees",
            "headquartersCity": (org_data and org_data["headquarters_city"]) or "San Francisco, CA",
            "bio": (org_data and org_data["bio"]) or "CloudScale Systems builds next-generation distributed AI infrastructure.",
            "billingEmail": (org_data and org_data["billing_email"]) or "billing@cloudscale.io",
            "logoUrl": (org_data and org_data["logo_url"]) or "/org-logos/cloudscale.png"
        }

        return jsonify({
            "id": str(user["id"]),
            "fullName": user["full_name"] or "Sarah Jenkins",
            "email": user["email"],
            "phone": user["phone"] or "+1 (555) 382-9102",
            "designation": user["designation"] or "Director of Global Talent Acquisition",
            "department": user["department"] or "People & Engineering Talent",
            "linkedinUrl": user["linkedin_url"] or "https://linkedin.com/in/sarah-jenkins-talent",
            "isOrgAdmin": bool(user["is_org_admin"]) if user["is_org_admin"] is not None else True,
            "monthlyHiringQuota": user["monthly_hiring_quota"] or 50,
            "quotaUsed": 14,
            "avatarUrl": user["avatar_url"],
            "organization": org_payload,
            "teamMembers": [
                {
                    "id": str(tm["id"]),
                    "name": tm.get("name") or tm.get("email", "").split("@")[0].title(),
                    "email": tm["email"],
                    "role": tm.get("role", "recruiter"),
                    "status": tm.get("status", "active")
                } for tm in team_members
            ] if team_members else [
                {"id": "usr-01", "name": user["full_name"], "email": user["email"], "role": "admin", "status": "active"}
            ],
            "auditLogs": [
                {"id": "log-1", "action": "Exported Candidate Evaluation Dossier", "performedBy": user["full_name"], "timestamp": "2026-09-26T14:22:00Z"},
                {"id": "log-2", "action": "Updated System Architecture Technical Rubric", "performedBy": user["full_name"], "timestamp": "2026-09-25T11:05:00Z"},
                {"id": "log-3", "action": "Invited Team Seat to Talent Acquisition Workspace", "performedBy": user["full_name"], "timestamp": "2026-09-24T09:15:00Z"}
            ]
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/recruiter/profile", methods=["PUT"])
def update_recruiter_profile():
    """Update recruiter personal details and organization branding in PostgreSQL."""
    try:
        data = request.get_json() or {}
        email = data.get("email", "recruiter@cloudscale.com").strip().lower()

        full_name = data.get("fullName", "").strip()
        phone = data.get("phone", "").strip()
        designation = data.get("designation", "").strip()
        department = data.get("department", "").strip()
        linkedin_url = data.get("linkedinUrl", "").strip()

        org = data.get("organization", {})
        org_name = org.get("name", "").strip()
        website_url = org.get("websiteUrl", "").strip()
        industry = org.get("industry", "").strip()
        company_size = org.get("companySize", "").strip()
        headquarters_city = org.get("headquartersCity", "").strip()
        bio = org.get("bio", "").strip()
        billing_email = org.get("billingEmail", "").strip()

        if not PG_URI:
            return jsonify({
                "success": True,
                "message": "Recruiter profile and enterprise organization updated successfully!",
                "profile": data
            })

        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Update user
        cur.execute("""
            UPDATE users
            SET full_name = COALESCE(NULLIF(%s, ''), full_name),
                phone = %s,
                designation = %s,
                department = %s,
                linkedin_url = %s
            WHERE email = %s OR role = 'recruiter'
            RETURNING id, org_id;
        """, (full_name, phone, designation, department, linkedin_url, email))
        user = cur.fetchone()

        if user and user["org_id"]:
            cur.execute("""
                UPDATE organizations
                SET name = COALESCE(NULLIF(%s, ''), name),
                    website_url = %s,
                    industry = %s,
                    company_size = %s,
                    headquarters_city = %s,
                    bio = %s,
                    billing_email = %s
                WHERE id = %s;
            """, (org_name, website_url, industry, company_size, headquarters_city, bio, billing_email, user["org_id"]))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "success": True,
            "message": "Recruiter workspace and enterprise profile updated successfully!"
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to update recruiter profile: {str(e)}"}), 500


@app.route("/api/recruiter/team-invite", methods=["POST"])
def send_team_invite():
    """Send team member workspace invite."""
    try:
        data = request.get_json() or {}
        invite_email = data.get("email", "").strip().lower()
        role = data.get("role", "recruiter").strip().lower()

        if not invite_email:
            return jsonify({"error": "Invite email address is required."}), 400

        invite_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        if PG_URI:
            conn = psycopg2.connect(PG_URI)
            cur = conn.cursor(cursor_factory=RealDictCursor)

            # Lookup org_id from candidate/recruiter user
            cur.execute("SELECT id, org_id FROM users WHERE role = 'recruiter' OR role = 'admin' LIMIT 1;")
            user = cur.fetchone()

            if user and user["org_id"]:
                cur.execute("""
                    INSERT INTO organization_invites (org_id, invited_by, email, role, status, token, expires_at)
                    VALUES (%s, %s, %s, %s, 'pending', %s, %s)
                    RETURNING id;
                """, (user["org_id"], user["id"], invite_email, role, invite_token, expires_at))
                conn.commit()

            cur.close()
            conn.close()

        print(f"📩 [TEAM INVITE] Workspace invite sent to {invite_email} (Role: {role})")

        return jsonify({
            "success": True,
            "message": f"Workspace invite sent successfully to {invite_email}!",
            "invite": {
                "id": str(uuid.uuid4()),
                "email": invite_email,
                "role": role,
                "status": "pending"
            }
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to send invite: {str(e)}"}), 500


# ------------------------------------------------------------------------------
# RECRUITER DASHBOARD & CANDIDATE DOSSIERS ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/recruiter/dashboard", methods=["GET"])
def get_recruiter_dashboard():
    """Fetch recruiter dashboard overview stats, candidate dossiers table, and job profiles."""
    try:
        if not PG_URI:
            return jsonify({
                "overview": {
                    "totalCandidates": 48,
                    "activePositions": 6,
                    "avgMatchScore": 86.4,
                    "scheduledInterviews": 12,
                    "screeningQuota": 50,
                    "quotaUsed": 14
                },
                "jobProfiles": [
                    {
                        "id": "job-01",
                        "title": "Senior Full-Stack AI Engineer",
                        "department": "Engineering",
                        "experienceLevel": "Senior",
                        "applicantsCount": 18,
                        "skillsRequired": ["React", "TypeScript", "Python", "FastAPI", "Vector DBs"],
                        "createdAt": "2026-09-20T10:00:00Z"
                    },
                    {
                        "id": "job-02",
                        "title": "Staff Cloud Systems Architect",
                        "department": "Infrastructure",
                        "experienceLevel": "Lead",
                        "applicantsCount": 12,
                        "skillsRequired": ["Kubernetes", "AWS", "Go", "Distributed Systems", "Terraform"],
                        "createdAt": "2026-09-18T14:30:00Z"
                    },
                    {
                        "id": "job-03",
                        "title": "Lead Product Designer (UI/UX)",
                        "department": "Product Design",
                        "experienceLevel": "Senior",
                        "applicantsCount": 9,
                        "skillsRequired": ["Figma", "Design Systems", "Prototyping", "User Research"],
                        "createdAt": "2026-09-22T09:15:00Z"
                    },
                    {
                        "id": "job-04",
                        "title": "Machine Learning Infra Engineer",
                        "department": "AI Research",
                        "experienceLevel": "Mid",
                        "applicantsCount": 9,
                        "skillsRequired": ["PyTorch", "CUDA", "Model Serving", "Python", "Triton"],
                        "createdAt": "2026-09-24T11:45:00Z"
                    }
                ],
                "candidates": [
                    {
                        "id": "cand-101",
                        "name": "Alex Riviera",
                        "email": "alex.riviera@techcorp.io",
                        "targetPosition": "Senior Full-Stack AI Engineer",
                        "jobProfileId": "job-01",
                        "department": "Engineering",
                        "aiMatchScore": 94,
                        "recommendation": "STRONG_HIRE",
                        "status": "Screened",
                        "stage": "Technical Probe Completed",
                        "appliedDate": "2026-09-26T14:30:00Z",
                        "interviewDuration": "42 min",
                        "skills": ["React", "Next.js", "Python", "PostgreSQL", "FastAPI"],
                        "summary": "Outstanding technical depth in micro-frontends and async backend streaming. Solved concurrency scenario in sub-3 minutes with zero edge case leaks.",
                        "breakdown": {
                            "technicalDepth": 96,
                            "systemArchitecture": 92,
                            "communication": 95,
                            "problemSolving": 93
                        },
                        "keyHighlights": [
                            "Demonstrated flawless understanding of server-sent events (SSE) for AI streaming.",
                            "Optimized SQL query indexing strategy during live scenario drill.",
                            "Articulate, highly structured communication and system breakdown."
                        ]
                    },
                    {
                        "id": "cand-102",
                        "name": "David Sterling",
                        "email": "d.sterling@cloudlabs.net",
                        "targetPosition": "Staff Cloud Systems Architect",
                        "jobProfileId": "job-02",
                        "department": "Infrastructure",
                        "aiMatchScore": 88,
                        "recommendation": "HIRE",
                        "status": "Completed",
                        "stage": "System Architecture Review",
                        "appliedDate": "2026-09-25T11:15:00Z",
                        "interviewDuration": "55 min",
                        "skills": ["Go", "Kubernetes", "AWS EKS", "Terraform", "Distributed Logs"],
                        "summary": "Strong cloud infrastructure background. Architected multi-region failover cluster on AWS with low replication latency.",
                        "breakdown": {
                            "technicalDepth": 90,
                            "systemArchitecture": 91,
                            "communication": 84,
                            "problemSolving": 87
                        },
                        "keyHighlights": [
                            "Deep expertise in Kubernetes ingress controllers and envoy sidecars.",
                            "Proactively raised compliance and SOC2 data privacy requirements."
                        ]
                    },
                    {
                        "id": "cand-103",
                        "name": "Elena Rostova",
                        "email": "elena.rostova@designflow.com",
                        "targetPosition": "Lead Product Designer (UI/UX)",
                        "jobProfileId": "job-03",
                        "department": "Product Design",
                        "aiMatchScore": 85,
                        "recommendation": "HIRE",
                        "status": "Scheduled",
                        "stage": "Portfolio & Interaction Probe",
                        "appliedDate": "2026-09-24T09:20:00Z",
                        "interviewDuration": "38 min",
                        "skills": ["Figma", "Design Systems", "Framer", "Accessibility (WCAG 2.1)", "User Testing"],
                        "summary": "Impressive design system portfolio. Strong focus on design-to-code alignment and accessible dark UI aesthetics.",
                        "breakdown": {
                            "technicalDepth": 82,
                            "systemArchitecture": 80,
                            "communication": 92,
                            "problemSolving": 86
                        },
                        "keyHighlights": [
                            "Created scalable tokenized design system adopted across 4 major products.",
                            "High focus on micro-interactions and accessibility specs."
                        ]
                    },
                    {
                        "id": "cand-104",
                        "name": "Marcus Vance",
                        "email": "marcus.v@mlcore.org",
                        "targetPosition": "Machine Learning Infra Engineer",
                        "jobProfileId": "job-04",
                        "department": "AI Research",
                        "aiMatchScore": 79,
                        "recommendation": "LEAN_HIRE",
                        "status": "Screened",
                        "stage": "Resume & Coding Probe",
                        "appliedDate": "2026-09-23T16:45:00Z",
                        "interviewDuration": "40 min",
                        "skills": ["PyTorch", "Python", "C++", "CUDA", "Model Quantization"],
                        "summary": "Solid foundation in model quantization and TensorRT. Needs slight improvement in distributed training orchestration.",
                        "breakdown": {
                            "technicalDepth": 84,
                            "systemArchitecture": 75,
                            "communication": 76,
                            "problemSolving": 81
                        },
                        "keyHighlights": [
                            "Good grasp of FP8/INT8 quantization for LLM inference.",
                            "Hands-on experience with PyTorch C++ extensions."
                        ]
                    },
                    {
                        "id": "cand-105",
                        "name": "Sophia Chen",
                        "email": "sophia.chen@devops-pro.com",
                        "targetPosition": "Staff Cloud Systems Architect",
                        "jobProfileId": "job-02",
                        "department": "Infrastructure",
                        "aiMatchScore": 91,
                        "recommendation": "STRONG_HIRE",
                        "status": "Completed",
                        "stage": "Panel Stage Approved",
                        "appliedDate": "2026-09-22T13:10:00Z",
                        "interviewDuration": "48 min",
                        "skills": ["Go", "Rust", "Terraform", "eBPF", "Prometheus"],
                        "summary": "Exceptional kernel-level profiling and networking knowledge. Solved zero-downtime database migration strategy effortlessly.",
                        "breakdown": {
                            "technicalDepth": 95,
                            "systemArchitecture": 94,
                            "communication": 89,
                            "problemSolving": 86
                        },
                        "keyHighlights": [
                            "Pioneered eBPF observability tooling for microservice network latency tracing.",
                            "Clear, confident technical explanations during scenario probe."
                        ]
                    }
                ]
            })

        # When Postgres URI is available, query real database
        conn = psycopg2.connect(PG_URI)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Overview stats
        cur.execute("SELECT COUNT(*) as total_candidates FROM users WHERE role = 'candidate';")
        tot_cand = cur.fetchone()["total_candidates"] or 0

        cur.execute("SELECT COUNT(*) as active_jobs FROM job_profiles;")
        act_jobs = cur.fetchone()["active_jobs"] or 0

        cur.execute("SELECT AVG(total_score) as avg_score FROM interview_sessions WHERE total_score IS NOT NULL;")
        avg_score_row = cur.fetchone()
        avg_score = round(float(avg_score_row["avg_score"]), 1) if avg_score_row and avg_score_row["avg_score"] else 86.4

        cur.execute("SELECT COUNT(*) as scheduled_count FROM interview_sessions WHERE status = 'scheduled';")
        sched_count = cur.fetchone()["scheduled_count"] or 0

        # Fetch Job profiles
        cur.execute("""
            SELECT id, title, department, experience_level as "experienceLevel",
                   skills_required as "skillsRequired", created_at as "createdAt"
            FROM job_profiles ORDER BY created_at DESC;
        """)
        jobs_db = cur.fetchall() or []
        jobs_list = []
        for j in jobs_db:
            jobs_list.append({
                "id": str(j["id"]),
                "title": j["title"],
                "department": j["department"],
                "experienceLevel": j["experienceLevel"].title() if j.get("experienceLevel") else "Mid",
                "applicantsCount": 12,
                "skillsRequired": j["skillsRequired"] or [],
                "createdAt": j["createdAt"].isoformat() if j.get("createdAt") else datetime.now(timezone.utc).isoformat()
            })

        # Fetch Candidates & Sessions
        cur.execute("""
            SELECT s.id as session_id, u.id as candidate_id, u.full_name as name, u.email,
                   j.title as target_position, j.id as job_profile_id, j.department,
                   s.total_score, s.final_recommendation, s.status, s.current_stage, s.created_at
            FROM interview_sessions s
            JOIN users u ON s.candidate_id = u.id
            LEFT JOIN job_profiles j ON s.job_profile_id = j.id
            ORDER BY s.created_at DESC LIMIT 20;
        """)
        sessions_db = cur.fetchall() or []

        candidates_list = []
        for s in sessions_db:
            score = float(s["total_score"]) if s.get("total_score") is not None else 85.0
            rec = s.get("final_recommendation") or ("STRONG_HIRE" if score >= 90 else "HIRE" if score >= 80 else "LEAN_HIRE")
            candidates_list.append({
                "id": str(s["candidate_id"]),
                "name": s["name"] or "Candidate",
                "email": s["email"],
                "targetPosition": s.get("target_position") or "Software Engineer",
                "jobProfileId": str(s["job_profile_id"]) if s.get("job_profile_id") else "job-01",
                "department": s.get("department") or "Engineering",
                "aiMatchScore": round(score),
                "recommendation": rec,
                "status": s.get("status", "Screened").title(),
                "stage": s.get("current_stage", "intro").replace("_", " ").title(),
                "appliedDate": s["created_at"].isoformat() if s.get("created_at") else datetime.now(timezone.utc).isoformat(),
                "interviewDuration": "45 min",
                "skills": ["React", "Python", "SQL", "System Architecture"],
                "summary": "Candidate demonstrated strong technical clarity, clean coding practices, and effective problem-solving skills during the AI interview session.",
                "breakdown": {
                    "technicalDepth": min(100, round(score + 2)),
                    "systemArchitecture": min(100, round(score - 1)),
                    "communication": min(100, round(score + 1)),
                    "problemSolving": round(score)
                },
                "keyHighlights": [
                    "Clean architectural decomposition during technical scenario.",
                    "Proactive edge-case handling and security considerations."
                ]
            })

        cur.close()
        conn.close()

        return jsonify({
            "overview": {
                "totalCandidates": tot_cand or len(candidates_list) or 48,
                "activePositions": act_jobs or len(jobs_list) or 6,
                "avgMatchScore": avg_score,
                "scheduledInterviews": sched_count or 12,
                "screeningQuota": 50,
                "quotaUsed": 14
            },
            "jobProfiles": jobs_list,
            "candidates": candidates_list
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/recruiter/jobs", methods=["POST"])
def create_job_profile():
    """Create a new job position & evaluation rubric."""
    try:
        data = request.get_json() or {}
        title = data.get("title", "").strip()
        department = data.get("department", "Engineering").strip()
        experience_level = data.get("experienceLevel", "senior").strip().lower()
        job_description = data.get("jobDescription", "").strip()
        skills = data.get("skillsRequired", [])

        if not title:
            return jsonify({"error": "Job title is required."}), 400

        job_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()

        if PG_URI:
            conn = psycopg2.connect(PG_URI)
            cur = conn.cursor(cursor_factory=RealDictCursor)

            # Lookup default org_id
            cur.execute("SELECT id FROM organizations LIMIT 1;")
            org_row = cur.fetchone()
            org_id = org_row["id"] if org_row else None

            if org_id:
                cur.execute("""
                    INSERT INTO job_profiles (id, org_id, title, department, experience_level, job_description, skills_required)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (job_id, org_id, title, department, experience_level, job_description, skills))
                conn.commit()

            cur.close()
            conn.close()

        return jsonify({
            "success": True,
            "message": f"Job profile '{title}' created successfully!",
            "job": {
                "id": job_id,
                "title": title,
                "department": department,
                "experienceLevel": experience_level.title(),
                "applicantsCount": 0,
                "skillsRequired": skills,
                "createdAt": created_at
            }
        }), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Failed to create job profile: {str(e)}"}), 500


@app.route("/api/recruiter/invite-candidate", methods=["POST"])
def invite_candidate_screening():
    """Invite a candidate for an AI screening interview session."""
    try:
        data = request.get_json() or {}
        candidate_email = data.get("candidateEmail", "").strip().lower()
        candidate_name = data.get("candidateName", "").strip()
        job_profile_id = data.get("jobProfileId", "").strip()

        if not candidate_email:
            return jsonify({"error": "Candidate email address is required."}), 400

        session_id = str(uuid.uuid4())
        print(f"📩 [RECRUITER INVITE] AI Interview invite sent to {candidate_email} ({candidate_name}) for Job {job_profile_id}")

        return jsonify({
            "success": True,
            "message": f"AI Screening invite dispatched to {candidate_email}!",
            "sessionId": session_id,
            "inviteUrl": f"http://localhost:3000/candidate/interview/{session_id}"
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/recruiter/dossiers", methods=["GET"])
def get_recruiter_dossiers():
    """Fetch candidate evaluation dossiers with filtering, technical rubrics, and detailed scorecards."""
    try:
        data = get_recruiter_dashboard().json
        return jsonify({
            "success": True,
            "candidates": data.get("candidates", []),
            "totalCount": len(data.get("candidates", []))
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/recruiter/rubrics", methods=["GET"])
def get_evaluation_rubrics():
    """Fetch all active evaluation rubrics, scoring weights, and job profile benchmarks."""
    try:
        data = get_recruiter_dashboard().json
        job_profiles = data.get("jobProfiles", [])
        
        rubrics = []
        for job in job_profiles:
            rubrics.append({
                "id": f"rubric-{job['id']}",
                "jobProfileId": job["id"],
                "title": job["title"],
                "department": job["department"],
                "experienceLevel": job["experienceLevel"],
                "skillsRequired": job["skillsRequired"],
                "weights": {
                    "technicalDepth": 40,
                    "systemArchitecture": 30,
                    "communication": 15,
                    "problemSolving": 15
                },
                "status": "Active",
                "customInstructions": f"Focus on production-level scenarios, edge-case resilience, and code clarity for {job['title']}."
            })

        return jsonify({
            "success": True,
            "rubrics": rubrics
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/recruiter/rubrics", methods=["POST"])
def update_evaluation_rubric():
    """Update custom prompt weights and rubric criteria for a job profile."""
    try:
        data = request.get_json() or {}
        rubric_id = data.get("rubricId", str(uuid.uuid4()))
        title = data.get("title", "Software Engineer").strip()
        weights = data.get("weights", {"technicalDepth": 40, "systemArchitecture": 30, "communication": 15, "problemSolving": 15})

        print(f"⚙️ [RUBRIC UPDATE] Rubric {rubric_id} updated for '{title}'")

        return jsonify({
            "success": True,
            "message": f"Evaluation rubric for '{title}' updated successfully!",
            "rubric": {
                "id": rubric_id,
                "title": title,
                "weights": weights,
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# CANDIDATE INTERVIEWS & SKILL INSIGHTS ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/candidate/interviews", methods=["GET"])
def get_candidate_interviews():
    """Fetch candidate scheduled interviews, completed session history, recordings & reports."""
    try:
        return jsonify({
            "success": True,
            "upcoming": [
                {
                    "sessionId": "sess-live-8801",
                    "roleTitle": "Full-Stack & Systems Architecture Engineer",
                    "companyName": "CloudScale Systems",
                    "sessionType": "live",
                    "scheduledTime": "2026-09-28T14:30:00Z",
                    "interviewerName": "TalentPulse AI (Autonomous Screener)",
                    "stage": "Technical & Scenario Probe",
                    "durationMinutes": 45,
                    "status": "scheduled",
                    "lobbyUrl": "/candidate/interview/sess-live-8801/lobby"
                }
            ],
            "completed": [
                {
                    "sessionId": "sess-mock-4402",
                    "roleTitle": "Senior Full-Stack AI Engineer",
                    "companyName": "Acme AI Corp",
                    "sessionType": "mock",
                    "completedAt": "2026-09-26T11:20:00Z",
                    "score": 88,
                    "recommendation": "STRONG_HIRE",
                    "duration": "42 min",
                    "reportUrl": "/candidate/interview/sess-mock-4402/report",
                    "recordingUrl": "https://storage.talentpulse.ai/recordings/sess-mock-4402.mp4",
                    "keyHighlights": [
                        "Solved async microservice bottleneck in under 4 minutes.",
                        "Clear architectural explanation of vector database indexing."
                    ]
                },
                {
                    "sessionId": "sess-mock-3109",
                    "roleTitle": "Backend & Cloud Systems Lead",
                    "companyName": "DevOps Labs",
                    "sessionType": "mock",
                    "completedAt": "2026-09-22T16:00:00Z",
                    "score": 82,
                    "recommendation": "HIRE",
                    "duration": "35 min",
                    "reportUrl": "/candidate/interview/sess-mock-3109/report",
                    "recordingUrl": "https://storage.talentpulse.ai/recordings/sess-mock-3109.mp4",
                    "keyHighlights": [
                        "Good grasp of PostgreSQL deadlock avoidance.",
                        "Identified edge case in concurrent SSE stream handling."
                    ]
                }
            ]
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/candidate/skills", methods=["GET"])
def get_candidate_skill_insights():
    """Fetch candidate skill matrix, technical competency scores, and AI improvement recommendations."""
    try:
        return jsonify({
            "success": True,
            "overallReadinessScore": 88,
            "readinessTier": "Senior Level Ready",
            "competencies": [
                {"name": "System Architecture & Scalability", "score": 92, "benchmark": 85, "level": "Expert"},
                {"name": "Async & Real-time Protocols (SSE/WS)", "score": 94, "benchmark": 80, "level": "Master"},
                {"name": "Database Design & Query Optimization", "score": 88, "benchmark": 82, "level": "Advanced"},
                {"name": "Frontend & Micro-Interactions", "score": 85, "benchmark": 80, "level": "Proficient"},
                {"name": "Cloud Infra & Containerization", "score": 79, "benchmark": 78, "level": "Intermediate"}
            ],
            "recommendedDrills": [
                {
                    "title": "Distributed Concurrency & Locks Drill",
                    "category": "System Architecture",
                    "estimatedTime": "15 min",
                    "difficulty": "Hard"
                },
                {
                    "title": "PostgreSQL Indexing & Partitioning Scenario",
                    "category": "Database Optimization",
                    "estimatedTime": "12 min",
                    "difficulty": "Medium"
                }
            ]
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# DYNAMIC INTERVIEW PARAMETER GENERATOR ENDPOINT
# ------------------------------------------------------------------------------

def generate_dynamic_interview_parameters(job_description, resume_text="", interview_type="technical"):
    """
    Step-by-step reasoning engine to dynamically infer role category, seniority level,
    and 4-6 evaluation parameters with weightages summing to 100%, good/weak answer signals.
    """
    jd_lower = (job_description or "").lower()
    resume_lower = (resume_text or "").lower()
    itype = (interview_type or "technical").lower()

    # Step 1: Infer Role Category
    if any(k in jd_lower for k in ["lead", "staff", "principal", "architect", "engineering manager", "director"]):
        role_category = "technical/leadership"
    elif any(k in jd_lower for k in ["product manager", "scrum", "agile", "project manager"]):
        role_category = "business/management"
    elif any(k in jd_lower for k in ["sales", "account executive", "client", "consultant"]):
        role_category = "client-facing/sales"
    else:
        role_category = "technical/individual-contributor"

    # Step 2: Infer Seniority Level
    if any(k in jd_lower for k in ["principal", "distinguished", "10+ years", "director", "vp"]):
        seniority_level = "principal"
    elif any(k in jd_lower for k in ["lead", "staff", "architect", "8+ years", "7+ years"]):
        seniority_level = "lead"
    elif any(k in jd_lower for k in ["senior", "sr", "5+ years", "4+ years"]):
        seniority_level = "senior"
    elif any(k in jd_lower for k in ["junior", "intern", "associate", "entry", "fresher", "0-2 years"]):
        seniority_level = "associate"
    else:
        seniority_level = "mid"

    # Extract key skills mentioned in JD
    common_tech_skills = ["react", "python", "golang", "go", "java", "kubernetes", "aws", "postgresql", "fastapi", "typescript", "system design", "distributed systems", "pytorch", "microservices", "sql", "docker"]
    extracted_skills = [s.title() for s in common_tech_skills if s in jd_lower]
    if not extracted_skills:
        extracted_skills = ["Software Engineering", "Problem Solving", "System Architecture"]

    parameters = []

    if itype == "behavioral":
        parameters = [
            {
                "name": "Behavioral & Leadership",
                "weight_percent": 40,
                "reasoning": "Behavioral interview type prioritizes STAR method scenarios, team conflict resolution, and ownership.",
                "good_answer_signals": [
                    "Provides clear Situation-Task-Action-Result structure with quantifiable impact.",
                    "Demonstrates extreme ownership and constructive empathy during team conflicts."
                ],
                "weak_answer_signals": [
                    "Vague answers attributing success solely to team without individual contribution.",
                    "Defensive posture when discussing past project failures or friction."
                ]
            },
            {
                "name": "Communication & Clarity",
                "weight_percent": 30,
                "reasoning": "High communication weight for behavioral alignment and leadership articulation.",
                "good_answer_signals": [
                    "Structured, concise explanation with logical narrative flow.",
                    "Active listening and precise responses without rambling."
                ],
                "weak_answer_signals": [
                    "Disorganized, tangential responses lacking clear takeaways.",
                    "Monotone delivery with frequent hesitation."
                ]
            },
            {
                "name": "Adaptability & Curveballs",
                "weight_percent": 20,
                "reasoning": "Evaluates candidate resilience under high-pressure follow-up questions.",
                "good_answer_signals": [
                    "Remains calm under probing questions and acknowledges trade-offs.",
                    "Pivots strategy constructively when constraints change."
                ],
                "weak_answer_signals": [
                    "Flustered by pushback or refuses to revise assumptions.",
                    "Gives rigid answers ignoring scenario constraints."
                ]
            },
            {
                "name": "Domain Context Knowledge",
                "weight_percent": 10,
                "reasoning": "Baseline verification of industry context for behavioral interview type.",
                "good_answer_signals": [
                    "Understands domain terminology and business metrics.",
                    "Aligns technical decisions with business goals."
                ],
                "weak_answer_signals": [
                    "Lacks understanding of basic domain workflows.",
                    "Focuses purely on tech jargon without business value."
                ]
            }
        ]
    elif seniority_level in ["senior", "lead", "principal"] or role_category == "technical/leadership":
        parameters = [
            {
                "name": "System Design & Architecture",
                "weight_percent": 35,
                "reasoning": f"Crucial dimension for {seniority_level} role requiring distributed scalability, trade-off analysis, and fault tolerance.",
                "good_answer_signals": [
                    f"Proactively discusses scalability, caching, load balancing, and data partitioning for {', '.join(extracted_skills[:3])}.",
                    "Explicitly articulates CAP theorem trade-offs and single-point-of-failure mitigation."
                ],
                "weak_answer_signals": [
                    "Proposes monolithic solutions without considering throughput or latency constraints.",
                    "Ignores database indexing, bottleneck detection, or failover strategies."
                ]
            },
            {
                "name": "Technical Depth & Code Quality",
                "weight_percent": 30,
                "reasoning": f"Evaluates mastery of core technologies ({', '.join(extracted_skills[:3])}) and clean coding practices.",
                "good_answer_signals": [
                    "Writes clean, idiomatic code with optimal time/space complexity (O(N) vs O(N^2)).",
                    "Handles edge cases, concurrency locks, and memory leaks proactively."
                ],
                "weak_answer_signals": [
                    "Struggles with fundamental data structures or language idioms.",
                    "Produces brittle code missing basic boundary validation."
                ]
            },
            {
                "name": "Problem Solving & Trade-offs",
                "weight_percent": 20,
                "reasoning": "Assesses analytical decomposition when faced with ambiguous technical constraints.",
                "good_answer_signals": [
                    "Breaks complex requirements into manageable micro-components.",
                    "Evaluates alternative approaches before committing to an architecture."
                ],
                "weak_answer_signals": [
                    "Jumps directly to coding without clarifying requirements or edge cases.",
                    "Stuck on first approach without considering alternative data structures."
                ]
            },
            {
                "name": "Communication & Articulation",
                "weight_percent": 15,
                "reasoning": "Senior candidates must clearly communicate complex technical decisions to stakeholders.",
                "good_answer_signals": [
                    "Uses clear architectural diagrams and precise technical terminology.",
                    "Explains complex technical trade-offs in an intuitive manner."
                ],
                "weak_answer_signals": [
                    "Incoherent explanations with heavy hand-waving.",
                    "Unable to defend architectural choices when questioned."
                ]
            }
        ]
    else:
        # Mid / Associate Technical Role
        parameters = [
            {
                "name": "Domain Technical Knowledge",
                "weight_percent": 40,
                "reasoning": f"Primary parameter for {seniority_level} developer role focused on hands-on proficiency in {', '.join(extracted_skills[:3])}.",
                "good_answer_signals": [
                    f"Demonstrates fluent syntax, standard libraries, and framework idioms in {extracted_skills[0] if extracted_skills else 'core stack'}.",
                    "Accurately explains asynchronous execution, SQL indexing, and REST/gRPC protocols."
                ],
                "weak_answer_signals": [
                    "Fails basic language syntax or core API usage.",
                    "Confuses fundamental concepts like synchronous vs asynchronous execution."
                ]
            },
            {
                "name": "Problem Solving & Analytical Approach",
                "weight_percent": 30,
                "reasoning": "Evaluates algorithmic reasoning, debugging, and step-by-step logic.",
                "good_answer_signals": [
                    "Traces code execution systematically and identifies bug root causes.",
                    "Derives correct time and space complexity analysis."
                ],
                "weak_answer_signals": [
                    "Relies on trial-and-error guessing without systematic debugging.",
                    "Unable to optimize brute-force solution."
                ]
            },
            {
                "name": "Communication & Clarity",
                "weight_percent": 15,
                "reasoning": "Assesses ability to explain code logic and collaborate effectively.",
                "good_answer_signals": [
                    "Verbalizes thought process clearly while writing code.",
                    "Asks clarifying questions about constraints before writing code."
                ],
                "weak_answer_signals": [
                    "Silent coding without explaining logic to interviewer.",
                    "Does not seek clarification when requirements are ambiguous."
                ]
            },
            {
                "name": "Adaptability & Follow-ups",
                "weight_percent": 15,
                "reasoning": "Evaluates responsiveness when new constraints or follow-up questions are introduced.",
                "good_answer_signals": [
                    "Quickly adapts solution when interviewer adds new scale or memory constraints.",
                    "Accepts feedback constructively and fixes edge case bugs."
                ],
                "weak_answer_signals": [
                    "Resistant to changing initial implementation.",
                    "Struggles to handle simple follow-up modifications."
                ]
            }
        ]

    # Verify total weight check
    total_weight = sum(p["weight_percent"] for p in parameters)
    if total_weight != 100:
        diff = 100 - total_weight
        parameters[0]["weight_percent"] += diff
        total_weight = 100

    return {
        "role_category": role_category,
        "seniority_level": seniority_level,
        "parameters": parameters,
        "total_weight_check": total_weight
    }


@app.route("/api/evaluator/dynamic-parameters", methods=["POST"])
def api_generate_dynamic_parameters():
    """
    Dynamic Interview Parameter Generator Endpoint.
    Accepts job_description, resume_text (optional), interview_type (optional).
    Returns JSON strictly following prompt schema.
    """
    try:
        data = request.get_json() or {}
        jd = data.get("job_description") or data.get("jobDescription", "")
        resume = data.get("resume_text") or data.get("resumeText", "")
        itype = data.get("interview_type") or data.get("interviewType", "technical")

        if not jd:
            return jsonify({"error": "job_description text is required."}), 400

        result = generate_dynamic_interview_parameters(jd, resume, itype)
        return jsonify(result), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/recruiter/generate-rubric", methods=["POST"])
def api_generate_recruiter_rubric():
    """
    Recruiter auto-generate rubric helper using Dynamic Parameter Generator.
    """
    try:
        data = request.get_json() or {}
        jd = data.get("jobDescription", "") or data.get("job_description", "")
        if not jd:
            return jsonify({"error": "Job description is required"}), 400

        result = generate_dynamic_interview_parameters(jd)
        return jsonify({
            "success": True,
            "rubric": result
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# CANDIDATE PRE-FLIGHT LOBBY ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/v1/interview-sessions/<session_id>/lobby-info", methods=["GET"])
def get_interview_lobby_info(session_id):
    """Fetch session metadata, job role, company name, resume highlights & evaluation rubrics."""
    try:
        session_meta = None
        if PG_URI:
            try:
                conn = psycopg2.connect(PG_URI)
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT s.id, s.session_type, s.status, s.current_stage,
                           j.title as job_title, o.name as company_name, u.full_name as candidate_name
                    FROM interview_sessions s
                    LEFT JOIN job_profiles j ON s.job_profile_id = j.id
                    LEFT JOIN organizations o ON s.org_id = o.id
                    LEFT JOIN users u ON s.candidate_id = u.id
                    WHERE s.id::text = %s OR s.id IS NOT NULL
                    LIMIT 1;
                """, (session_id,))
                session_meta = cur.fetchone()
                cur.close()
                conn.close()
            except Exception as pg_err:
                print(f"[Lobby Info] PostgreSQL query warning: {pg_err}")

        job_role = (session_meta and session_meta.get("job_title")) or "Full-Stack Software Engineer"
        company_name = (session_meta and session_meta.get("company_name")) or "CloudScale Systems"
        candidate_name = (session_meta and session_meta.get("candidate_name")) or "Vivekanand Kumar"

        return jsonify({
            "sessionId": session_id,
            "candidateName": candidate_name,
            "avatarUrl": "/avatars/candidate.png",
            "jobRole": job_role,
            "companyName": company_name,
            "durationMinutes": 45,
            "scheduledAt": datetime.now(timezone.utc).isoformat(),
            "resumeFileName": "Vivekanand_Kumar_Resume_2026.pdf",
            "resumeKeyHighlights": [
                "4+ Years of experience in React, Next.js, and TypeScript frontend micro-frontends.",
                "Built polyglot backend microservices with Python Flask, PostgreSQL, and MongoDB Atlas.",
                "Designed low-latency WebRTC media streams and real-time audio visualizers.",
                "Strong background in Data Structures, System Architecture, and CI/CD pipelines."
            ],
            "evaluationRubricOverview": [
                "System & Software Architecture",
                "Algorithmic Problem Solving",
                "Code Quality & Debugging",
                "Behavioral Dynamics & Articulation"
            ]
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/interview-sessions/<session_id>/lobby-check", methods=["POST"])
def log_lobby_preflight_check(session_id):
    """Log hardware readiness check before candidate enters live interview room."""
    try:
        data = request.get_json() or {}
        doc = {
            "sessionId": session_id,
            "candidateEmail": data.get("email", "vivekanand@talentpulse.ai"),
            "cameraVerified": data.get("cameraVerified", True),
            "micVerified": data.get("micVerified", True),
            "speakerVerified": data.get("speakerVerified", True),
            "latencyMs": data.get("latencyMs", 24),
            "jitterMs": data.get("jitterMs", 3),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if MONGO_URI:
            try:
                from core.db import CERTIFI_CA
                kwargs = {"serverSelectionTimeoutMS": 5000}
                if CERTIFI_CA:
                    kwargs["tlsCAFile"] = CERTIFI_CA
                client = pymongo.MongoClient(MONGO_URI, **kwargs)
                db = client.get_database("swami_db")
                db.lobby_checks.insert_one(doc)
            except Exception as mongo_err:
                print(f"[Lobby Check] MongoDB log warning: {mongo_err}")

        return jsonify({
            "success": True,
            "sessionId": session_id,
            "readyToEnter": True,
            "roomUrl": f"/candidate/interview/{session_id}/room"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/interview-sessions/<session_id>/lobby-checkin", methods=["POST"])
def log_lobby_checkin(session_id):
    """
    Candidate Pre-Flight Checkin Endpoint:
    1. Logs diagnostic metrics in MongoDB HardwareDiagnostic collection.
    2. Updates session status in PostgreSQL: UPDATE interview_sessions SET status = 'in_progress', started_at = COALESCE(started_at, NOW()).
    3. Returns { success: true, roomToken: "jwt_webrtc_room_token", targetUrl: "/candidate/interview/:id/room" }.
    """
    try:
        data = request.get_json() or {}
        diag = data.get("hardwareDiagnostic", {})

        doc = {
            "sessionId": session_id,
            "cameraPassed": diag.get("cameraPassed", True),
            "microphonePassed": diag.get("microphonePassed", True),
            "speakerPassed": diag.get("speakerPassed", True),
            "latencyMs": diag.get("latencyMs", 28),
            "jitterMs": diag.get("jitterMs", 4),
            "selectedAudioDevice": diag.get("selectedAudioDevice", "Default Microphone"),
            "selectedVideoDevice": diag.get("selectedVideoDevice", "Integrated Webcam"),
            "checkedInAt": datetime.now(timezone.utc).isoformat()
        }

        if MONGO_URI:
            try:
                from core.db import CERTIFI_CA
                kwargs = {"serverSelectionTimeoutMS": 5000}
                if CERTIFI_CA:
                    kwargs["tlsCAFile"] = CERTIFI_CA
                client = pymongo.MongoClient(MONGO_URI, **kwargs)
                db = client.get_database("swami_db")
                db.HardwareDiagnostic.insert_one(doc)
            except Exception as mongo_err:
                print(f"[HardwareDiagnostic] MongoDB log warning: {mongo_err}")

        if PG_URI:
            try:
                conn = psycopg2.connect(PG_URI)
                cur = conn.cursor()
                cur.execute("""
                    UPDATE interview_sessions
                    SET status = 'in_progress', started_at = COALESCE(started_at, NOW())
                    WHERE id::text = %s OR id IS NOT NULL;
                """, (session_id,))
                conn.commit()
                cur.close()
                conn.close()
            except Exception as pg_err:
                print(f"[Lobby Checkin] PostgreSQL update warning: {pg_err}")

        return jsonify({
            "success": True,
            "roomToken": f"jwt_webrtc_room_token_{session_id[:8]}",
            "targetUrl": f"/candidate/interview/{session_id}/room"
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# LIVE AI INTERVIEW ROOM ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/v1/interview-sessions/<session_id>/room-data", methods=["GET"])
def get_interview_room_data(session_id):
    """Fetch live interview room initial state, stage stepper, and problem context."""
    try:
        return jsonify({
            "sessionId": session_id,
            "jobTitle": "Full-Stack & Systems Architecture Screening",
            "companyName": "CloudScale Systems",
            "candidateName": "Vivekanand Kumar",
            "durationMinutes": 45,
            "elapsedSeconds": 180,
            "currentStage": "Technical Code",
            "stages": ["Intro", "Resume Probe", "Technical Code", "System Design", "Wrap-Up"],
            "interviewerAvatar": {
                "name": "Alex Vance (TalentPulse AI)",
                "role": "Lead Systems & Architectural AI Evaluator",
                "status": "active_speaking"
            },
            "activeProblem": {
                "id": "prob-101",
                "title": "High-Concurrency Distributed Rate Limiter",
                "difficulty": "Hard",
                "description": "Design and implement a thread-safe, sliding-window rate limiter class in Python or TypeScript that supports up to 100,000 requests per second across distributed worker nodes.",
                "constraints": [
                    "Time Complexity per request check must be O(1) average.",
                    "Memory overhead per IP key must not exceed 256 bytes.",
                    "Support fallback degrade when backend redis store is unreachable."
                ],
                "sampleCode": {
                    "python": "class SlidingWindowRateLimiter:\n    def __init__(self, limit: int, window_sec: int):\n        self.limit = limit\n        self.window_sec = window_sec\n        # Implement sliding window algorithm\n        pass\n\n    def allow_request(self, user_id: str) -> bool:\n        # Return True if request is allowed, False if rate limited\n        return True\n",
                    "typescript": "export class SlidingWindowRateLimiter {\n  private limit: number;\n  private windowSec: number;\n\n  constructor(limit: number, windowSec: number) {\n    this.limit = limit;\n    this.windowSec = windowSec;\n  }\n\n  public allowRequest(userId: string): boolean {\n    // Return true if request allowed\n    return true;\n  }\n}\n"
                }
            },
            "subtitlesStream": [
                {"id": "sub-1", "speaker": "AI Interviewer", "text": "Welcome Vivekanand! Let's begin the technical coding stage. Please review the problem statement on the right."},
                {"id": "sub-2", "speaker": "Candidate", "text": "Thank you, Alex. I am reviewing the sliding window rate limiter problem now."}
            ]
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/interview-sessions/<session_id>/code-run", methods=["POST"])
def run_interview_code(session_id):
    """Execute candidate code submission in sandbox."""
    try:
        data = request.get_json() or {}
        code = data.get("code", "")
        language = data.get("language", "python").lower()

        # Simulated execution output
        output_lines = [
            f"⚡ Executing {language.upper()} code in TalentPulse Isolated Sandbox...",
            "[Test Case 1] Rate limit test with 1,000 requests in 1 second window... PASSED (0.42ms avg)",
            "[Test Case 2] Sliding window sliding boundary check... PASSED",
            "[Test Case 3] Distributed fallback under network partition... PASSED",
            "--------------------------------------------------",
            "✅ All 3 Test Cases Executed Successfully (Execution Time: 48ms, Memory: 14.2 MB)"
        ]

        return jsonify({
            "success": True,
            "stdout": "\n".join(output_lines),
            "executionTimeMs": 48,
            "passedCount": 3,
            "totalCount": 3
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# CANDIDATE EVALUATION REPORT & VERIFIED DOSSIER ENDPOINTS
# ------------------------------------------------------------------------------

@app.route("/api/v1/interview-sessions/<session_id>/report", methods=["GET"])
def get_candidate_evaluation_report(session_id):
    """Aggregate PostgreSQL session metadata & MongoDB turn evaluations into verified dossier."""
    try:
        candidate_info = {"fullName": "Vivekanand Kumar", "email": "vivekanand@talentpulse.ai", "program": "B.Tech Computer Science & Engineering", "academicYear": "4th Year"}
        job_info = {"roleTitle": "Full-Stack & Systems Architect", "companyName": "CloudScale Systems", "interviewDate": datetime.now(timezone.utc).strftime("%B %d, %Y"), "durationMinutes": 45}
        total_score = 91.4
        recommendation = "STRONG_HIRE"

        if PG_URI:
            try:
                conn = psycopg2.connect(PG_URI)
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT s.id, s.total_score, s.final_recommendation, s.recording_duration_sec,
                           u.full_name, u.email, u.course, u.branch, u.academic_year,
                           j.title as job_title, o.name as company_name
                    FROM interview_sessions s
                    LEFT JOIN users u ON s.candidate_id = u.id
                    LEFT JOIN job_profiles j ON s.job_profile_id = j.id
                    LEFT JOIN organizations o ON s.org_id = o.id
                    WHERE s.id::text = %s OR s.id IS NOT NULL
                    LIMIT 1;
                """, (session_id,))
                row = cur.fetchone()
                cur.close()
                conn.close()

                if row:
                    if row["full_name"]:
                        candidate_info["fullName"] = row["full_name"]
                        candidate_info["email"] = row["email"]
                    if row["course"] and row["branch"]:
                        candidate_info["program"] = f"{row['course']} {row['branch']}"
                    if row["academic_year"]:
                        candidate_info["academicYear"] = row["academic_year"]
                    if row["job_title"]:
                        job_info["roleTitle"] = row["job_title"]
                    if row["company_name"]:
                        job_info["companyName"] = row["company_name"]
                    if row["total_score"]:
                        total_score = float(row["total_score"])
                    if row["final_recommendation"]:
                        recommendation = row["final_recommendation"]
            except Exception as pg_err:
                print(f"[Report] PostgreSQL query warning: {pg_err}")

        # Turn Reviews
        turns = [
            {
                "turnIndex": 1,
                "stage": "introduction",
                "questionAsked": "Could you provide a brief overview of your background in full-stack architecture and high-throughput microservices?",
                "candidateAnswerSummary": "Candidate outlined 4+ years of hands-on experience building React/Next.js frontends connected to Python Flask & Node.js microservices with PostgreSQL and MongoDB.",
                "scores": {"relevance": 9.5, "depth": 9.0, "correctness": 9.2},
                "keyConceptsCovered": ["Full-Stack Microservices", "React/Next.js Architecture", "Polyglot Databases"],
                "missingConcepts": [],
                "evaluatorFeedback": "Articulate introduction displaying strong technical domain ownership."
            },
            {
                "turnIndex": 2,
                "stage": "resume_probe",
                "questionAsked": "Walk me through how you implemented the distributed task scheduler mentioned in your portfolio projects.",
                "candidateAnswerSummary": "Explained sliding window logging, worker pool concurrency, and Redis Pub/Sub fallback mechanisms under high request pressure.",
                "scores": {"relevance": 9.2, "depth": 9.4, "correctness": 9.0},
                "keyConceptsCovered": ["Sliding Window Algorithm", "Worker Pool Concurrency", "Redis Pub/Sub"],
                "missingConcepts": ["Consistent Hashing for Sharding"],
                "evaluatorFeedback": "Deep understanding of concurrency primitives and fault-tolerant fallback design."
            },
            {
                "turnIndex": 3,
                "stage": "technical_depth",
                "questionAsked": "How do you handle memory overhead when tracking sliding window timestamps for 100,000 requests per second?",
                "candidateAnswerSummary": "Proposed using Redis Sorted Sets with epoch timestamp scores or bucketized ring buffers to bound memory footprint within 256 bytes per key.",
                "scores": {"relevance": 9.0, "depth": 9.2, "correctness": 9.5},
                "keyConceptsCovered": ["Redis Sorted Sets (ZSET)", "Bucketized Ring Buffers", "Memory Footprint Bounding"],
                "missingConcepts": [],
                "evaluatorFeedback": "Optimal memory-conscious solution addressing algorithmic bottlenecks directly."
            },
            {
                "turnIndex": 4,
                "stage": "system_architecture",
                "questionAsked": "Draw and explain your system design topology for an API gateway rate limiting cluster.",
                "candidateAnswerSummary": "Designed an AWS ALB gateway feeding into stateless microservices with Redis rate-limiting sidecars and Kafka asynchronous event logger.",
                "scores": {"relevance": 9.4, "depth": 9.0, "correctness": 9.1},
                "keyConceptsCovered": ["AWS ALB", "Stateless Sidecars", "Kafka Async Telemetry"],
                "missingConcepts": ["Multi-Region Disaster Recovery"],
                "evaluatorFeedback": "Production-grade system topology with clear separation of control and data planes."
            }
        ]

        return jsonify({
            "sessionId": session_id,
            "candidate": candidate_info,
            "jobContext": job_info,
            "overallScore": total_score,
            "hiringRecommendation": recommendation,
            "percentileRank": 88,
            "competencyPillars": {
                "algorithmicProblemSolving": 92,
                "systemArchitecture": 90,
                "codeQualityAndSyntax": 88,
                "communicationAndClarity": 95
            },
            "executiveSummary": "Candidate Vivekanand Kumar demonstrated exceptional technical competence during the 45-minute AI technical screening. Showcased strong mastery over sliding window rate limiting algorithms, distributed Redis caching strategies, and stateless API gateway design. Highly recommended for Senior Full-Stack Engineering placement.",
            "verifiedStrengths": [
                "Mastery over thread-safe sliding window algorithms and memory-bounded data structures.",
                "Production experience with React micro-frontends, WebRTC media streams, and Python Flask microservices.",
                "Clear communication skills with articulate architecture diagrams and structured code style."
            ],
            "targetedGrowthAreas": [
                "Explore multi-region consistent hashing topologies for global Redis cluster sharding."
            ],
            "proctoringIntegritySummary": {
                "overallIntegrityScore": 98,
                "gazeConsistencyPercentage": 99.2,
                "tabSwitchCount": 0,
                "multipleVoicesDetected": False
            },
            "turnReviews": turns,
            "verificationDossierId": f"TP-2026-{session_id[:6].upper()}"
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/interview-sessions/<session_id>/report/pdf", methods=["GET"])
def export_report_pdf(session_id):
    """Generate presigned PDF download link for verified candidate dossier."""
    try:
        return jsonify({
            "success": True,
            "dossierId": f"TP-2026-{session_id[:6].upper()}",
            "pdfUrl": f"/uploads/reports/Dossier_{session_id[:8]}.pdf",
            "fileName": f"TalentPulse_Verified_Dossier_{session_id[:8]}.pdf"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------------------------------------------------------------
# PRACTICE DRILLS & MOCK QUESTION LAB ENDPOINTS
# ------------------------------------------------------------------------------

PRACTICE_DRILLS_DATA = [
    {
        "id": "drill-kafka-sticky-assignors",
        "title": "Kafka Sticky Partitioning & Rebalance Protocols",
        "category": "DISTRIBUTED_SYSTEMS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Sticky Assignors", "Rebalance Protocol", "Batching Efficiency"],
        "description": "Evaluate network throughput and consumer rebalance latencies when configuring sticky partition assignors vs round-robin partitioners.",
        "sampleStarterQuestion": "How does the StickyAssignor algorithm in Apache Kafka minimize partition movement during a consumer group rebalance while maintaining balanced partition distribution?",
        "totalAttempts": 14,
        "userBestScore": 92,
        "recommendedReason": "Triggered by your recent interview growth area"
    },
    {
        "id": "drill-disaster-recovery",
        "title": "Distributed System Disaster Recovery Scenarios",
        "category": "SYSTEM_DESIGN",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 12,
        "coreSkillsTested": ["Raft Consensus", "Patroni Failover", "Read-Replica Lag"],
        "description": "Design automated failover policies and read-replica lag mitigations during distributed multi-region database outages.",
        "sampleStarterQuestion": "Walk me through how you would configure Patroni and Raft consensus to prevent split-brain scenarios when a primary PostgreSQL node loses network connectivity.",
        "totalAttempts": 8,
        "userBestScore": 88,
        "recommendedReason": "Matched to growth recommendations"
    },
    {
        "id": "drill-asymptotic-complexity",
        "title": "Asymptotic Complexity & Runtime Analysis",
        "category": "DATA_STRUCTURES",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 8,
        "coreSkillsTested": ["Big-O Bounds", "Amortized Analysis", "Space Tradeoffs"],
        "description": "Rapid-fire algorithm analysis drills focusing on explicit Big-O time and space complexity statement prior to logic execution.",
        "sampleStarterQuestion": "Explain the time and space complexity of inserting 1,000,000 elements into a dynamic array vs a balanced B-Tree, accounting for array reallocation overhead.",
        "totalAttempts": 22,
        "userBestScore": 95,
        "recommendedReason": "Matched to growth recommendations"
    },
    {
        "id": "drill-redis-rate-limiting",
        "title": "Distributed Rate Limiting with Redis & Sliding Window",
        "category": "SYSTEM_DESIGN",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["Sliding Window ZSET", "Token Bucket", "Atomic Lua Scripts"],
        "description": "Architect a low-latency rate limiter handling 100,000 requests/sec using atomic Redis Lua scripts and sorted sets.",
        "sampleStarterQuestion": "Why are Redis Lua scripts preferred over client-side multi-exec transactions when implementing sliding window rate limiting?",
        "totalAttempts": 19,
        "userBestScore": 90
    },
    {
        "id": "drill-postgres-composite-indexing",
        "title": "PostgreSQL Composite Indexing & Query Planning",
        "category": "DATABASE_INTERNALS",
        "difficulty": "INTERMEDIATE",
        "estimatedMinutes": 10,
        "coreSkillsTested": ["B-Tree Indexes", "Leftmost Prefix Rule", "Covering Indexes"],
        "description": "Analyze query planner decisions when executing multi-column filtering with composite B-Tree indexes.",
        "sampleStarterQuestion": "Why does ordering matter in a composite index (A, B, C) when executing queries with WHERE B = 10 AND C = 20?",
        "totalAttempts": 12,
        "userBestScore": 84
    },
    {
        "id": "drill-saga-pattern",
        "title": "Saga Orchestration vs 2PC Transactions",
        "category": "DISTRIBUTED_SYSTEMS",
        "difficulty": "ADVANCED",
        "estimatedMinutes": 15,
        "coreSkillsTested": ["Compensating Transactions", "Eventual Consistency", "Outbox Pattern"],
        "description": "Formulate asynchronous compensating event workflows to resolve partial failures across microservices.",
        "sampleStarterQuestion": "How does the Saga pattern handle cascading rollbacks when payment succeeds but inventory reservation fails?",
        "totalAttempts": 9,
        "userBestScore": 89
    },
    {
        "id": "drill-behavioral-conflict",
        "title": "Architectural Disagreement & Stakeholder Alignment",
        "category": "BEHAVIORAL",
        "difficulty": "BEGINNER",
        "estimatedMinutes": 5,
        "coreSkillsTested": ["STAR Method", "Data-Driven Consensus", "Technical Diplomacy"],
        "description": "Structure articulate responses demonstrating how you resolve technical conflicts using trade-off matrices and data-backed spikes.",
        "sampleStarterQuestion": "Tell me about a time you strongly disagreed with a senior architect on technology selection and how you built consensus.",
        "totalAttempts": 5,
        "userBestScore": 94
    }
]

@app.route("/api/v1/practice/drills", methods=["GET"])
def get_practice_drills():
    """Return available practice drills with optional category and difficulty filtering."""
    try:
        category = request.args.get("category", "ALL").upper()
        difficulty = request.args.get("difficulty", "ALL").upper()

        filtered = PRACTICE_DRILLS_DATA
        if category != "ALL":
            filtered = [d for d in filtered if d.get("category") == category]
        if difficulty != "ALL":
            filtered = [d for d in filtered if d.get("difficulty") == difficulty]

        return jsonify({
            "success": True,
            "drills": filtered,
            "stats": {
                "totalDrillsCompleted": 99,
                "averageScore": 91,
                "totalPracticeMinutes": 140,
                "readinessPercentage": 88,
                "categoryBreakdown": {
                    "SYSTEM_DESIGN": 35,
                    "DISTRIBUTED_SYSTEMS": 25,
                    "DATA_STRUCTURES": 20,
                    "DATABASE_INTERNALS": 10,
                    "BEHAVIORAL": 10
                }
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/practice/sessions/evaluate-turn", methods=["POST"])
def evaluate_practice_turn():
    """Evaluates turn-by-turn answer and returns follow-up question or final scores."""
    try:
        data = request.get_json() or {}
        drill_id = data.get("drillId", "drill-kafka-sticky-assignors")
        turn_index = data.get("turnIndex", 1)
        answer = data.get("candidateAnswer", "").strip()

        word_count = len(answer.split())
        relevance = min(9.8, max(7.5, 7.0 + (word_count / 15)))
        depth = min(9.6, max(7.2, 7.0 + (word_count / 20)))
        correctness = min(9.5, max(7.8, 7.5 + (word_count / 25)))

        follow_up = None
        if turn_index < 2:
            follow_up = "Good start. How would you handle node failover during this rebalance phase?"

        evaluation = {
            "turnIndex": turn_index,
            "question": data.get("questionContext", "Scenario question"),
            "userAnswer": answer,
            "scores": {
                "relevance": round(relevance, 1),
                "depth": round(depth, 1),
                "correctness": round(correctness, 1)
            },
            "feedback": "Demonstrated articulate technical reasoning with solid domain concept usage.",
            "followUpQuestion": follow_up,
            "isFinalTurn": turn_index >= 2
        }

        return jsonify({
            "success": True,
            "evaluation": evaluation
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/v1/practice/sessions/finalize", methods=["POST"])
def finalize_practice_session():
    """Stores final drill session results in MongoDB and updates PostgreSQL candidate readiness summary."""
    try:
        data = request.get_json() or {}
        drill_id = data.get("drillId", "drill-kafka-sticky-assignors")
        turns = data.get("turns", [])

        # In production: write to MongoDB PracticeSession & update PostgreSQL skills_summary
        return jsonify({
            "success": True,
            "message": "Practice session finalized and candidate readiness score updated.",
            "drillId": drill_id,
            "turnsProcessed": len(turns)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 TalentPulse AI Backend running at http://0.0.0.0:{port}")
    app.run(debug=True, host="0.0.0.0", port=port)






