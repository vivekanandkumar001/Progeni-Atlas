"""
Progeni Atlas — Unified Application Package
============================================
Authoritative Flask Application Exporter.

Exposes the primary Flask application instance (`app`) so that standard WSGI/ASGI
runners (e.g. `gunicorn app:app`), smoke tests, and internal tools can import
`from app import app` unambiguously, resolving the dual-backend package collision.
"""
from __future__ import annotations

import os
import sys
import importlib.util

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_APP_FILE = os.path.join(_BASE_DIR, "app.py")

# Ensure backend root is at the front of sys.path
if _BASE_DIR not in sys.path:
    sys.path.insert(0, _BASE_DIR)

# Load the Flask application instance from backend/app.py
_spec = importlib.util.spec_from_file_location("progeni_atlas_flask_server", _APP_FILE)
if _spec and _spec.loader:
    _mod = importlib.util.module_from_spec(_spec)
    sys.modules["progeni_atlas_flask_server"] = _mod
    _spec.loader.exec_module(_mod)
    app = getattr(_mod, "app", None)
else:
    app = None

__all__ = ["app"]

