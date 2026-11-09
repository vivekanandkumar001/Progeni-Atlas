"""
Progeni Atlas — Production WSGI Entry Point
============================================
Standard, unambiguous WSGI entry point for the Progeni Atlas Flask backend.

Usage:
    gunicorn wsgi:app
    gunicorn app:app
    python wsgi:app
"""
from __future__ import annotations

import os
import sys
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Load environment configuration (.env)
_base_env = os.path.join(BASE_DIR, ".env")
if os.path.isfile(_base_env):
    load_dotenv(_base_env)
_root_env = os.path.abspath(os.path.join(BASE_DIR, "..", ".env"))
if os.path.isfile(_root_env):
    load_dotenv(_root_env)

# 2. Ensure BASE_DIR is at the front of sys.path
if BASE_DIR in sys.path:
    sys.path.remove(BASE_DIR)
sys.path.insert(0, BASE_DIR)

# 3. Import the canonical Flask application instance
from app import app

# Companion (phone pairing / LiveKit) routes check
try:
    import companion as _companion  # noqa: F401
except Exception as _exc:
    import logging as _logging
    _logging.getLogger("progeni_atlas.wsgi").warning(
        "companion routes unavailable: %s", type(_exc).__name__
    )

if __name__ == "__main__":
    _port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=_port, debug=False)
