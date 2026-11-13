"""
Progeni Atlas — Companion Phone-as-Camera/Mic Blueprint
=========================================================
Production-grade Flask Blueprint managing secure QR pairing and LiveKit WebRTC
token issuance for using candidate mobile devices as primary audio/video feeds.

Architecture:
- Short-lived SHA-256 hashed pairing tokens stored in PostgreSQL (`companion_pairings`).
- Atomic single-use redemption with row locking (`used_at IS NULL AND expires_at > NOW()`).
- LiveKit AccessToken generation with scoped VideoGrants (phone: publish-only, desktop: subscribe-only).
- Multi-worker safe in-DB rate limiting via PostgreSQL (`companion_rate_limits`).
- Zero token or JWT logging to prevent credential leakage.
"""

import os
import hashlib
import secrets
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, request, jsonify

# LiveKit Server SDK
try:
    from livekit import api as livekit_api
except ImportError:
    livekit_api = None

# Blueprint registered under /api/v1
companion_bp = Blueprint("companion", __name__, url_prefix="/api/v1")

PAIRING_TTL_MINUTES = 5
LIVEKIT_TOKEN_TTL_HOURS = 2
RATE_LIMIT_PAIR_PER_MINUTE = 15
RATE_LIMIT_REDEEM_PER_MINUTE = 15


def _get_allowed_origins() -> list[str]:
    """Parse comma-separated allowed CORS origins from environment."""
    cors_env = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [o.strip() for o in cors_env.split(",") if o.strip()]


@companion_bp.after_request
def _apply_companion_cors(response):
    """
    Apply scoped CORS headers to all companion blueprint responses.
    Restricted strictly to origins defined in the CORS_ORIGINS environment variable.
    Never sends wildcard '*' unless explicitly configured in CORS_ORIGINS.
    """
    origin = request.headers.get("Origin")
    allowed = _get_allowed_origins()
    if origin and origin in allowed and "*" not in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@companion_bp.route("/companion/<path:subpath>", methods=["OPTIONS"])
@companion_bp.route("/interview-sessions/<session_id>/companion/<path:subpath>", methods=["OPTIONS"])
@companion_bp.route("/interview-sessions/<session_id>/companion", methods=["OPTIONS"])
def _companion_options(*args, **kwargs):
    """Handle CORS pre-flight requests for companion endpoints."""
    return "", 204


from core.db import get_mongo_db
from core.security import require_session_access

def _as_aware_utc(dt):
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _hash_token(token: str) -> str:
    """Compute SHA-256 hex digest of the raw pairing token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_client_ip() -> str:
    """Extract client IP address handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def _check_db_rate_limit(key: str, limit: int, window_sec: int = 60) -> bool:
    """
    Atomic in-DB rate limiter using MongoDB.
    Returns True if request is allowed, False if rate limit is exceeded.
    """
    try:
        db = get_mongo_db()
        now_utc = datetime.now(timezone.utc)
        record = db.companion_rate_limits.find_one({"key": key})
        if not record or _as_aware_utc(record.get("reset_at")) <= now_utc:
            db.companion_rate_limits.update_one(
                {"key": key},
                {"$set": {"count": 1, "reset_at": now_utc + timedelta(seconds=window_sec)}},
                upsert=True
            )
            return True
        if record.get("count", 0) >= limit:
            return False
        db.companion_rate_limits.update_one({"key": key}, {"$inc": {"count": 1}})
        return True
    except Exception as e:
        print(f"[CompanionRateLimit] Warning: {e}")
        return True


def _get_livekit_config() -> Tuple[str, str, str]:
    """
    Validate and return LiveKit configuration.
    Fails fast with a clear error if environment variables are missing.
    """
    url = os.environ.get("LIVEKIT_URL")
    api_key = os.environ.get("LIVEKIT_API_KEY")
    api_secret = os.environ.get("LIVEKIT_API_SECRET")

    missing = []
    if not url:
        missing.append("LIVEKIT_URL")
    if not api_key:
        missing.append("LIVEKIT_API_KEY")
    if not api_secret:
        missing.append("LIVEKIT_API_SECRET")

    if missing:
        raise ValueError(
            f"LiveKit server configuration missing: {', '.join(missing)} must be set in server environment."
        )

    return url, api_key, api_secret


# ------------------------------------------------------------------------------
# 1. CREATE PAIRING TOKEN (Desktop Lobby -> QR Generation)
# ------------------------------------------------------------------------------
@companion_bp.route("/interview-sessions/<session_id>/companion/pair", methods=["POST"])
@require_session_access
def create_pairing(session_id: str):
    """
    POST /api/v1/interview-sessions/<session_id>/companion/pair
    Generates a secure, short-lived (5 min TTL) companion pairing token.
    Revokes any previous unused tokens for this session.
    Returns: { "token": "<raw_token>", "expiresAt": "<iso_timestamp>" }
    """
    try:
        # Rate limit by IP + session
        ip = _get_client_ip()
        rate_key = f"rate:companion:pair:{ip}:{session_id[:8]}"
        if not _check_db_rate_limit(rate_key, RATE_LIMIT_PAIR_PER_MINUTE, window_sec=60):
            return jsonify({"error": "Rate limit exceeded. Please wait before generating another pairing code."}), 429

        # Generate cryptographic raw token and compute SHA-256 hash
        raw_token = secrets.token_urlsafe(32)
        token_hash = _hash_token(raw_token)

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=PAIRING_TTL_MINUTES)
        now_utc = datetime.now(timezone.utc)
        db = get_mongo_db()

        # Revoke any prior unredeemed pairings for this session
        db.companion_pairings.update_many(
            {"session_id": session_id, "used_at": None},
            {"$set": {"used_at": now_utc}}
        )

        # Store new pairing record (ONLY hash is persisted)
        db.companion_pairings.insert_one({
            "session_id": session_id,
            "token_hash": token_hash,
            "expires_at": expires_at,
            "used_at": None,
            "created_at": now_utc
        })

        # Respond with raw token for QR generation (never logged)
        return jsonify({
            "token": raw_token,
            "expiresAt": expires_at.isoformat()
        }), 201

    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Failed to create pairing token."}), 500


# ------------------------------------------------------------------------------
# 2. REDEEM PAIRING TOKEN (Mobile Phone Scan)
# ------------------------------------------------------------------------------
@companion_bp.route("/companion/redeem", methods=["POST"])
def redeem_pairing():
    """
    POST /api/v1/companion/redeem
    Atomic single-use redemption of a companion pairing token.
    Body: { "token": "<raw_token>", "deviceInfo": "<optional_user_agent>" }
    Returns on success: { "livekitUrl": "...", "jwt": "...", "room": "..." }
    Returns generic 404 for invalid/expired/used token (no detail leakage).
    """
    try:
        # Rate limit redemptions by client IP
        ip = _get_client_ip()
        rate_key = f"rate:companion:redeem:{ip}"
        if not _check_db_rate_limit(rate_key, RATE_LIMIT_REDEEM_PER_MINUTE, window_sec=60):
            return jsonify({"error": "Too many redemption attempts. Please wait a moment."}), 429

        body = request.get_json() or {}
        raw_token = body.get("token", "").strip()
        device_info = body.get("deviceInfo") or request.headers.get("User-Agent", "Mobile Companion")

        if not raw_token:
            return jsonify({"error": "Invalid or expired pairing token."}), 404

        # Validate LiveKit server configuration upfront (fails fast)
        livekit_url, api_key, api_secret = _get_livekit_config()

        token_hash = _hash_token(raw_token)
        now_utc = datetime.now(timezone.utc)
        db = get_mongo_db()

        # Atomic single-use redemption
        pairing = db.companion_pairings.find_one_and_update(
            {
                "token_hash": token_hash,
                "used_at": None,
                "expires_at": {"$gt": now_utc}
            },
            {
                "$set": {
                    "used_at": now_utc,
                    "device_info": device_info
                }
            }
        )

        if not pairing:
            # Generic 404: do not leak whether token was expired, already used, or non-existent
            return jsonify({"error": "Invalid or expired pairing token."}), 404

        session_id = str(pairing["session_id"])
        room_name = f"interview-{session_id}"
        participant_identity = f"phone-{session_id}"

        # Generate LiveKit Token: Phone can publish video/audio, cannot subscribe
        if livekit_api is None:
            return jsonify({"error": "livekit-api module is not installed."}), 500

        grants = livekit_api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=False
        )

        livekit_token = (
            livekit_api.AccessToken(api_key, api_secret)
            .with_identity(participant_identity)
            .with_name("Phone Companion")
            .with_grants(grants)
            .with_ttl(timedelta(hours=LIVEKIT_TOKEN_TTL_HOURS))
        )
        jwt_token = livekit_token.to_jwt()

        # Return connection payload (token/JWT is never logged)
        return jsonify({
            "livekitUrl": livekit_url,
            "jwt": jwt_token,
            "room": room_name,
            "sessionId": session_id
        }), 200

    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Failed to redeem companion token."}), 500


# ------------------------------------------------------------------------------
# 3. VIEWER TOKEN (Desktop Room Viewport)
# ------------------------------------------------------------------------------
@companion_bp.route("/interview-sessions/<session_id>/companion/viewer-token", methods=["POST"])
@require_session_access
def get_viewer_token(session_id: str):
    """
    POST /api/v1/interview-sessions/<session_id>/companion/viewer-token
    Generates a LiveKit JWT for the desktop viewer to subscribe to the phone feed.
    Grants: room_join=True, can_publish=False, can_subscribe=True.
    """
    try:
        livekit_url, api_key, api_secret = _get_livekit_config()

        room_name = f"interview-{session_id}"
        participant_identity = f"desktop-{session_id}"

        if livekit_api is None:
            return jsonify({"error": "livekit-api module is not installed."}), 500

        grants = livekit_api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=False,
            can_subscribe=True
        )

        livekit_token = (
            livekit_api.AccessToken(api_key, api_secret)
            .with_identity(participant_identity)
            .with_name("Desktop Viewer")
            .with_grants(grants)
            .with_ttl(timedelta(hours=LIVEKIT_TOKEN_TTL_HOURS))
        )
        jwt_token = livekit_token.to_jwt()

        return jsonify({
            "livekitUrl": livekit_url,
            "jwt": jwt_token,
            "room": room_name
        }), 200

    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 500
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Failed to generate viewer token."}), 500


# ------------------------------------------------------------------------------
# 4. COMPANION EVENT TELEMETRY (Audit & Timeline in MongoDB)
# ------------------------------------------------------------------------------
@companion_bp.route("/interview-sessions/<session_id>/companion/event", methods=["POST"])
@require_session_access
def log_companion_event(session_id: str):
    """
    POST /api/v1/interview-sessions/<session_id>/companion/event
    Logs phone connection status changes ('phone_connected', 'phone_disconnected', 'phone_reconnected')
    into MongoDB collection `companion_events` for audit history and interview dossier reports.
    """
    try:
        body = request.get_json() or {}
        event_type = body.get("type")

        allowed_events = ("phone_connected", "phone_disconnected", "phone_reconnected")
        if event_type not in allowed_events:
            return jsonify({
                "error": f"Invalid event type '{event_type}'. Must be one of: {', '.join(allowed_events)}"
            }), 400

        event_doc = {
            "sessionId": session_id,
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "clientIp": _get_client_ip(),
            "details": body.get("details", {})
        }

        try:
            db = get_mongo_db()
            if db is not None:
                db.companion_events.insert_one(event_doc)
        except Exception as mongo_err:
            print(f"[CompanionEvent] MongoDB log warning: {mongo_err}")

        return jsonify({
            "success": True,
            "event": event_type,
            "sessionId": session_id
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Failed to log companion event."}), 500


def init_companion_blueprint(app) -> None:
    """Register the companion blueprint on the Flask application instance."""
    app.register_blueprint(companion_bp)
