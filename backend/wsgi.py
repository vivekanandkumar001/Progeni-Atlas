"""Progeni Atlas — Unambiguous WSGI entry point for the Progeni Atlas Flask backend.

Why this file exists
--------------------
The repository contains BOTH ``backend/app.py`` (the Flask monolith that is the
real application) and ``backend/app/`` (a package holding config/models/services).
A regular package always wins over a same-named module during import, so
``gunicorn app:app`` from ``backend/`` resolved to the empty package
``backend/app/__init__.py`` and failed with:

    AttributeError: module 'app' has no attribute 'app'

This module removes the ambiguity without deleting or renaming any working code:

1. ``backend/`` is placed at the FRONT of ``sys.path`` so the application can
   still resolve its own absolute imports (``from core.db import ...``,
   ``from app.services.llm_service import ...``) exactly as before.
2. ``backend/app.py`` is loaded by explicit FILE PATH under a private module
   name (``progeni_atlas_backend_app``), so the ``app`` name can never be captured
   by the package again.
3. The resulting Flask instance is re-exported as ``app``.

Usage
-----
    gunicorn wsgi:app
    python wsgi.py            # boots on $PORT (default 5000) for smoke testing

Because ``backend/app.py`` is loaded by path, ``__file__``-derived paths
(``UPLOAD_DIR``, ``RECORDING_DIR``) still resolve inside ``backend/``.
"""

from __future__ import annotations

import importlib.util
import os
import sys
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_FILE = os.path.join(BASE_DIR, "app.py")

# Ensure environment variables from .env are loaded into the process before
# any application packages/modules are imported or evaluated.
_base_env = os.path.join(BASE_DIR, ".env")
if os.path.isfile(_base_env):
    load_dotenv(_base_env)
_root_env = os.path.abspath(os.path.join(BASE_DIR, "..", ".env"))
if os.path.isfile(_root_env):
    load_dotenv(_root_env)

# The application module imports sibling packages by absolute name
# (``core.db``, ``app.config``, ``app.models``, ``app.services.*``). Those live
# under BASE_DIR, so BASE_DIR must precede any other entry on sys.path.
if BASE_DIR in sys.path:
    sys.path.remove(BASE_DIR)
sys.path.insert(0, BASE_DIR)

# Load ``app.py`` by path under a name that cannot collide with the ``app``
# package. Re-importing this module (e.g. gunicorn reload) reuses the cached
# module object rather than re-executing the whole application.
_MODULE_NAME = "progeni_atlas_backend_app"
_module = sys.modules.get(_MODULE_NAME)
if _module is None or getattr(_module, "__file__", None) != APP_FILE:
    if not os.path.isfile(APP_FILE):
        raise RuntimeError(f"Flask application module not found at {APP_FILE}")
    _spec = importlib.util.spec_from_file_location(_MODULE_NAME, APP_FILE)
    if _spec is None or _spec.loader is None:  # pragma: no cover - defensive
        raise RuntimeError(f"Unable to build an import spec for {APP_FILE}")
    _module = importlib.util.module_from_spec(_spec)
    # Register before exec so intra-module self-imports resolve to this instance.
    sys.modules[_MODULE_NAME] = _module
    _spec.loader.exec_module(_module)

#: The Flask application object. This is what gunicorn/WSGI servers must serve.
app = _module.app

# Companion (phone pairing / LiveKit) blueprint-style routes are registered on
# the same Flask instance by backend/companion.py at import time.
try:  # pragma: no cover - companion routes are optional at boot
    import companion as _companion  # noqa: F401
except Exception as _exc:  # pragma: no cover
    import logging as _logging

    _logging.getLogger("progeni_atlas.wsgi").warning(
        "companion routes unavailable: %s", type(_exc).__name__
    )


if __name__ == "__main__":  # pragma: no cover - local smoke test only
    _port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=_port, debug=False)
