"""
Progeni Atlas — Enterprise Backend Server
===========================================
Primary Backend API integrating Flask, MongoDB, and Qdrant.
Modular architecture powered by Flask Blueprints (< 160 lines).
"""

import os
import sys

# Ensure UTF-8 output encoding across Windows PowerShell consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from flask import Flask, request, jsonify, make_response, send_from_directory
from dotenv import load_dotenv

# Load environment configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))

if os.path.exists(os.path.join(ROOT_DIR, ".env")):
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
else:
    load_dotenv(os.path.join(BASE_DIR, ".env"))

from core.db import init_mongo_db, get_mongo_db, check_mongo_connection, check_qdrant_connection
from core.security import (
    SWAMI_SECRET_KEY, JWT_ALGORITHM, require_auth, require_super_admin,
    resolve_user, _decode_access_token, _authenticate_request
)

# Production hard-stop: never boot a production deployment with the ephemeral
# fallback secret (all sessions would die on restart and keys are unverifiable).
_APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
if _APP_ENV == "production" and not any(os.environ.get(k) for k in ("SWAMI_SECRET_KEY", "JWT_SECRET", "SECRET_KEY", "FLASK_SECRET_KEY")):
    raise RuntimeError(
        "FATAL: APP_ENV=production but no JWT secret is set "
        "(SWAMI_SECRET_KEY / JWT_SECRET / SECRET_KEY / FLASK_SECRET_KEY). "
        "Refusing to boot. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
if _APP_ENV == "production" and not (os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")):
    raise RuntimeError(
        "FATAL: APP_ENV=production but MONGO_URI/MONGODB_URI is not set. "
        "The API cannot serve data without the database. Refusing to boot."
    )

from core.context import get_current_candidate, get_current_recruiter
from core.wallet import get_user_wallet_balance
from core.constants import UPLOAD_DIR, RECORDING_DIR

# 1. Initialize Flask Application
app = Flask(__name__)
app.secret_key = SWAMI_SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_CONTENT_LENGTH", 25 * 1024 * 1024))

# 2. Configure ProxyFix for reverse proxy header integrity
from werkzeug.middleware.proxy_fix import ProxyFix
if os.environ.get("TRUST_PROXY_HEADERS", "false").lower() in ("true", "1", "t"):
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# 3. Dynamic CORS Configuration & Enterprise Security Headers
from urllib.parse import urlparse

def _get_allowed_cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,https://atlas.progeni.live,https://api.progeni.live"
    )
    origins = [o.strip() for o in raw.split(",") if o.strip() and o.strip() != "*"]
    for required in ("https://atlas.progeni.live", "https://api.progeni.live"):
        if required not in origins:
            origins.append(required)
    return origins

_ALLOWED_CORS_ORIGINS = _get_allowed_cors_origins()

def _is_origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    if origin in _ALLOWED_CORS_ORIGINS:
        return True
    try:
        parsed = urlparse(origin)
        host = (parsed.hostname or "").lower()
        if parsed.scheme == "https" and (host == "progeni.live" or host.endswith(".progeni.live")):
            return True
    except Exception:
        pass
    return False

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        origin = request.headers.get("Origin")
        res = make_response("", 204)
        if _is_origin_allowed(origin):
            res.headers["Access-Control-Allow-Origin"] = origin
            res.headers["Access-Control-Allow-Credentials"] = "true"
            res.headers.add("Vary", "Origin")
        res.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Requested-With,X-Support-Reason,X-Client-Platform"
        res.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,PATCH,DELETE,OPTIONS"
        res.headers["Access-Control-Max-Age"] = "86400"
        return res

@app.after_request
def after_request(response):
    origin = request.headers.get("Origin")
    if _is_origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers.add("Vary", "Origin")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Requested-With,X-Support-Reason,X-Client-Platform"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,PATCH,DELETE,OPTIONS"

    # Enterprise Hardened HTTP Security Headers
    # API responses must never be cached by browsers/proxies — they carry user-specific data.
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=()"
    if request.is_secure or request.headers.get("X-Forwarded-Proto", "").lower() == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# 4. Initialize Database Indexes
init_mongo_db()

# 5. Register Domain Blueprints
from routes.system_routes import system_bp
from routes.auth_routes import auth_bp
from routes.candidate_routes import candidate_bp
from routes.recruiter_routes import recruiter_bp
from routes.billing_routes import billing_bp
from routes.interview_routes import interview_bp
from routes.super_admin_routes import super_admin_bp
from routes.aptitude_routes import aptitude_bp
from routes.cost_routes import cost_bp

app.register_blueprint(system_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(candidate_bp)
app.register_blueprint(recruiter_bp)
app.register_blueprint(billing_bp)
app.register_blueprint(interview_bp)
app.register_blueprint(super_admin_bp)
app.register_blueprint(aptitude_bp)
app.register_blueprint(cost_bp)

# 6. Register Companion Audio/Video Pairing Blueprint
try:
    from companion import init_companion_blueprint
except ImportError:
    from backend.companion import init_companion_blueprint

init_companion_blueprint(app)

# 6.5 Aptitude daily question-bank generator (5:00 AM IST). Daemon thread with an
# atomic MongoDB claim so the two gunicorn workers cannot double-generate. If the
# admin already generated today, the auto-run skips; when the bank is at the
# 2000-item target, generation stays paused.
def _start_aptitude_daily_gen():
    import threading
    import time as _time

    _enabled = os.environ.get("APTITUDE_DAILY_GEN_ENABLED", "true").strip().lower()
    if _enabled in ("false", "0", "off", "disable", "no"):
        return

    def _loop():
        _time.sleep(60)  # defer out of the import/deploy critical path
        while True:
            try:
                from core.aptitude_generator import run_daily_if_needed
                _db = get_mongo_db()
                if _db is not None:
                    _result = run_daily_if_needed(_db)
                    _status = _result.get("status")
                    if _status in ("ok", "paused", "error", "skipped"):
                        print(f"[APTITUDE DAILY] {_result}")
            except Exception as _err:
                print(f"[APTITUDE DAILY] error: {type(_err).__name__}: {_err}")
            _time.sleep(900)  # every 15 minutes; atomic claim inside run_daily_if_needed prevents duplicates

    _thread = threading.Thread(target=_loop, name="aptitude-daily-gen", daemon=True)
    _thread.start()

_start_aptitude_daily_gen()

UPLOADS_AUTH = os.environ.get("UPLOADS_ALLOW_PUBLIC", "false").lower() in ("1", "true", "yes")

@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_uploads(filename):
    # Uploaded files are PII (resumes) or interview artifacts (recordings) — never public by default.
    if not UPLOADS_AUTH:
        user_id = None
        claims, _ = _authenticate_request()
        if claims:
            user_id = claims.get("sub")
        if filename.startswith("recordings/"):
            if not user_id:
                return jsonify({"error": "Authentication required"}), 401
            session_id = os.path.splitext(os.path.basename(filename))[0]
            db = get_mongo_db()
            if db is not None:
                sess = db.interview_sessions.find_one(
                    {"$or": [{"id": session_id}, {"_id": session_id}, {"session_id": session_id}]},
                    {"candidate_id": 1, "recruiter_id": 1, "candidate_email": 1, "recruiter_email": 1, "org_id": 1},
                )
                if sess:
                    sess_user = resolve_user(user_id) if user_id else None
                    if sess_user:
                        u_id = str(sess_user.get("id") or sess_user.get("_id") or "")
                        u_email = str(sess_user.get("email") or "").strip().lower()
                        u_role = str(sess_user.get("role", "")).lower()
                        u_org = str(sess_user.get("org_id") or "").strip()
                        allowed = (
                            u_role == "super_admin"
                            or str(sess.get("candidate_id") or "") == u_id
                            or str(sess.get("recruiter_id") or "") == u_id
                            or (str(sess.get("candidate_email") or "").strip().lower() == u_email and u_email)
                            or (str(sess.get("recruiter_email") or "").strip().lower() == u_email and u_email)
                            or (u_org and str(sess.get("org_id") or "").strip() == u_org and u_role in ("recruiter", "admin", "hr", "employer"))
                        )
                        if allowed:
                            return send_from_directory(UPLOAD_DIR, filename)
            return jsonify({"error": "Recording not found or not accessible"}), 404
        # Resume files are PII — caller must own the resume record (or be super_admin)
        if filename.startswith("resumes/"):
            if not user_id:
                return jsonify({"error": "Authentication required"}), 401
            sess_user = resolve_user(user_id)
            u_id = str(sess_user.get("id") or sess_user.get("_id") or "") if sess_user else ""
            u_email = str(sess_user.get("email") or "").strip().lower() if sess_user else ""
            u_role = str(sess_user.get("role", "")).lower() if sess_user else ""
            basename = os.path.basename(filename)
            db = get_mongo_db()
            owned = False
            if sess_user and db is not None:
                if u_role == "super_admin":
                    owned = True
                else:
                    res_doc = db.candidate_resumes.find_one(
                        {"file_url": {"$regex": basename + "$"}},
                        {"candidate_id": 1, "candidate_email": 1},
                    )
                    if res_doc:
                        owned = (
                            str(res_doc.get("candidate_id") or "") == u_id
                            or (u_email and str(res_doc.get("candidate_email") or "").strip().lower() == u_email)
                        )
            if not owned:
                return jsonify({"error": "Not found or not accessible"}), 404
            return send_from_directory(UPLOAD_DIR, filename)
        # Other uploads require an authenticated session
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
    return send_from_directory(UPLOAD_DIR, filename)

# 8. Global Application Error Handlers
@app.errorhandler(404)
def handle_not_found(e):
    return jsonify({"error": "Resource not found", "status": 404}), 404

@app.errorhandler(500)
def handle_internal_error(e):
    return jsonify({"error": "Internal server error", "status": 500}), 500

# 8. Server Entrypoint
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_flag = os.environ.get("FLASK_DEBUG", "false").lower() in ("true", "1", "t")
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if debug_flag and app_env in {"production", "prod"}:
        print("[Progeni Atlas] ERROR: FLASK_DEBUG is ignored when APP_ENV=production")
        debug_flag = False
    if debug_flag:
        print("[Progeni Atlas] WARNING: Debug mode with reloader can cause socket hang up errors with Next.js proxy. Consider FLASK_DEBUG=0")
    print(f"[Progeni Atlas] Modular backend running at http://0.0.0.0:{port}")
    app.run(debug=debug_flag, host="0.0.0.0", port=port)
