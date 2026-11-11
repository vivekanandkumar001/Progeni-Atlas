"""
Vercel Python serverless entrypoint for the Progeni Atlas Flask API.

Every path (/ /api/* /health ...) is rewritten to this function by vercel.json.
The Flask app's own url_map then handles routing exactly as it does under
gunicorn/Flask locally.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Flask resolves paths relative to this dir; align CWD with the backend root.
os.chdir(ROOT)

from app import app  # noqa: E402,F401
