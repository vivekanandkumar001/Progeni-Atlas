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

from flask import Flask, request, jsonify, make_response
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
from core.context import get_current_candidate, get_current_recruiter
from core.wallet import get_user_wallet_balance
from core.constants import UPLOAD_DIR, RECORDING_DIR

# 1. Initialize Flask Application
app = Flask(__name__)
app.secret_key = SWAMI_SECRET_KEY or "progeni_atlas_enterprise_jwt_secret_key"
app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_CONTENT_LENGTH", 25 * 1024 * 1024))

# 2. Configure ProxyFix for reverse proxy header integrity
from werkzeug.middleware.proxy_fix import ProxyFix
if os.environ.get("TRUST_PROXY_HEADERS", "false").lower() in ("true", "1", "t"):
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# 3. Dynamic CORS Configuration & Enterprise Security Headers
def _get_allowed_cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,https://atlas.progeni.live,https://api-atlas.progeni.live,https://atlas.progeni.live"
    )
    origins = [o.strip() for o in raw.split(",") if o.strip() and o.strip() != "*"]
    for required in ("https://atlas.progeni.live", "https://api-atlas.progeni.live", "https://atlas.progeni.live"):
        if required not in origins:
            origins.append(required)
    return origins

_ALLOWED_CORS_ORIGINS = _get_allowed_cors_origins()

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        origin = request.headers.get("Origin")
        res = make_response("", 204)
        if origin and (origin in _ALLOWED_CORS_ORIGINS or origin.endswith(".progeni.live")):
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
    if origin and (origin in _ALLOWED_CORS_ORIGINS or origin.endswith(".progeni.live")):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers.add("Vary", "Origin")
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Requested-With,X-Support-Reason,X-Client-Platform"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,PATCH,DELETE,OPTIONS"

    # Enterprise Hardened HTTP Security Headers
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

app.register_blueprint(system_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(candidate_bp)
app.register_blueprint(recruiter_bp)
app.register_blueprint(billing_bp)
app.register_blueprint(interview_bp)
app.register_blueprint(super_admin_bp)

# 6. Register Companion Audio/Video Pairing Blueprint
try:
    from companion import init_companion_blueprint
except ImportError:
    from backend.companion import init_companion_blueprint

init_companion_blueprint(app)

# 7. Global Application Error Handlers
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
