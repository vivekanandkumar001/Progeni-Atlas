"""
Progeni Atlas — System & Health Blueprint
==========================================
Root status index, ping/latency diagnostics, and system health checks.
"""

import time
import os
from datetime import datetime, timezone
from flask import Blueprint, jsonify
from core.db import check_mongo_connection, check_qdrant_connection

system_bp = Blueprint("system_bp", __name__)


@system_bp.route("/", methods=["GET"])
def root_index():
    return jsonify({
        "status": "online",
        "service": "Progeni Atlas Enterprise Backend API",
        "version": "1.0.0",
        "frontendUrl": os.environ.get("FRONTEND_URL", "https://atlas.progeni.live"),
        "endpoints": {
            "health": "/health",
            "candidateProfile": "/api/candidate/profile",
            "candidateSkills": "/api/candidate/skills",
            "candidateNotifications": "/api/candidate/notifications"
        }
    }), 200


@system_bp.route("/api/ping", methods=["GET"])
@system_bp.route("/ping", methods=["GET"])
def api_ping():
    """Latency and jitter probe endpoint for pre-flight lobby diagnostics."""
    return jsonify({"status": "ok", "pong": True, "timestamp": time.time()}), 200


@system_bp.route("/health", methods=["GET"])
def healthcheck():
    """System health check route. Returns database connectivity metrics."""
    mongo_status = check_mongo_connection()
    qdrant_status = check_qdrant_connection()

    is_healthy = mongo_status.get("status") in ("connected", "ok", "disabled")
    status_code = 200 if is_healthy else 503

    return jsonify({
        "status": "healthy" if is_healthy else "unhealthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "mongodb": mongo_status,
            "qdrant": qdrant_status,
        }
    }), status_code


@system_bp.route("/ready", methods=["GET"])
@system_bp.route("/api/ready", methods=["GET"])
def ready_check():
    """Readiness probe: 200 only when the database is actually reachable (for deploy smoke tests / load balancers)."""
    mongo_status = check_mongo_connection()
    ready = mongo_status.get("status") in ("connected", "ok")
    return jsonify({
        "ready": ready,
        "services": {"mongodb": mongo_status},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), (200 if ready else 503)


@system_bp.route("/api/health", methods=["GET"])
def health_check():
    mongo_status = check_mongo_connection()
    qdrant_status = check_qdrant_connection()
    all_healthy = mongo_status.get("status") in ("connected", "ok", "disabled")

    return jsonify({
        "status": "healthy" if all_healthy else "degraded",
        "services": {
            "mongodb": mongo_status,
            "qdrant": qdrant_status,
        }
    }), (200 if all_healthy else 503)
