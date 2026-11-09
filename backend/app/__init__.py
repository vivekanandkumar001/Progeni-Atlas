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

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ensure backend root is at the front of sys.path
if _BASE_DIR not in sys.path:
    sys.path.insert(0, _BASE_DIR)

_app_instance = None

def get_app():
    global _app_instance
    if _app_instance is not None:
        return _app_instance
    import importlib.util
    _app_file = os.path.join(_BASE_DIR, "app.py")
    _spec = importlib.util.spec_from_file_location("progeni_atlas_flask_server", _app_file)
    if _spec and _spec.loader:
        _mod = importlib.util.module_from_spec(_spec)
        sys.modules["progeni_atlas_flask_server"] = _mod
        _spec.loader.exec_module(_mod)
        _app_instance = getattr(_mod, "app", None)
        return _app_instance
    return None

def __getattr__(name: str):
    if name == "app":
        return get_app()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

__all__ = ["app", "get_app"]

