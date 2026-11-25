"""Judge0 CE client — isolated sandboxed code execution.

Production path for the interview code runner. Judge0 runs each submission in
an isolated, cgroup-limited, networkless sandboxed container — solving the two
failure modes the in-process subprocess runner cannot:

  * candidate code executes with the web service's privileges and filesystem
    (no seccomp/namespaces/cgroups on the Flask host)
  * fake pass/fail from unvalidated ``[PASSED]`` stdout substrings (fixed here
      by the same per-run random marker logic as the dev runner)

The subprocess runner is kept as an honest *dev-only fallback*.
"""

from __future__ import annotations

import base64
import os
import time

import logging

logger = logging.getLogger("progeni_atlas.sandbox.judge0")

BASE_URL = os.environ.get("JUDGE0_URL", "").rstrip("/")
API_KEY = os.environ.get("JUDGE0_API_KEY", "")
TIMEOUT = float(os.environ.get("JUDGE0_TIMEOUT_SECONDS", "30"))

_PLACEHOLDER_MARKERS = (
    "your-judge0.example",
    "your-judge0-example",
    "example.com",
    "CHANGE-ME",
    "placeholder",
)


def _url_is_real(url: str) -> bool:
    """Reject empty and obvious placeholder values (they silently break the
    subprocess fallback for every code-run in dev/test)."""
    if not url:
        return False
    low = url.lower()
    if not (low.startswith("http://") or low.startswith("https://")):
        return False
    if any(marker.lower() in low for marker in _PLACEHOLDER_MARKERS):
        return False
    return True

# Judge0 CE language ids
LANGUAGE_IDS: dict[str, int] = {
    "python": 71,
    "py": 71,
    "python3": 71,
    "javascript": 63,
    "js": 63,
    "node": 63,
    "typescript": 74,
    "ts": 74,
    "cpp": 54,
    "c++": 54,
    "c": 50,
    "java": 62,
    "go": 60,
    "rust": 73,
    "sql": 82,
}

# Judge0 CE status ids we care about
STATUS_ACCEPTED = 3
STATUS_WRONG_ANSWER = 4
STATUS_TIME_LIMIT = 5
STATUS_COMPILATION_ERROR = 6
STATUS_RUNTIME_ERROR_SIGSEGV = 11
STATUS_RUNTIME_ERROR_NZEC = 12
STATUS_RUNTIME_ERROR_OTHER = 13

_RUNTIME_STATUS = {
    STATUS_RUNTIME_ERROR_SIGSEGV,
    STATUS_RUNTIME_ERROR_NZEC,
    STATUS_RUNTIME_ERROR_OTHER,
}


def configured() -> bool:
    """True only when a real (non-placeholder) Judge0 base URL is configured."""
    return _url_is_real(BASE_URL)


def language_id_for(language: str) -> int | None:
    return LANGUAGE_IDS.get(str(language or "").strip().lower())


class Judge0Result:
    def __init__(self, *, stdout: str, stderr: str, status_id: int | None, time_s: str | None, memory_kb: int | None, raw: dict):
        self.stdout = stdout
        self.stderr = stderr
        self.status_id = status_id
        self.time_s = time_s
        self.memory_kb = memory_kb
        self.raw = raw


def _b64(value: str) -> str:
    return base64.b64encode((value or "").encode("utf-8")).decode("ascii")


def _b64decode_text(value) -> str:
    if not value:
        return ""
    try:
        return base64.b64decode(str(value)).decode("utf-8", errors="replace")
    except Exception:
        return str(value)


def execute(
    *,
    source_code: str,
    language_id: int,
    stdin: str = "",
    cpu_time_limit_s: int = 5,
    memory_limit_kb: int = 262144,
    wall_time_limit_s: int = 10,
) -> Judge0Result:
    """Submit to Judge0 and wait for the verdict.

    Raises RuntimeError on transport/config failure — the caller decides the
    fallback (never a silent fake Accepted).
    """
    if not configured():
        raise RuntimeError("JUDGE0_URL is not configured")

    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-Auth-Token"] = API_KEY

    payload = {
        "source_code": _b64(source_code),
        "language_id": language_id,
        "stdin": _b64(stdin),
        "cpu_time_limit": cpu_time_limit_s,
        "memory_limit": memory_limit_kb,
        "wall_time_limit": wall_time_limit_s,
        "enable_per_process_and_thread_time_limit": True,
    }

    import requests

    t0 = time.perf_counter()
    resp = requests.post(
        f"{BASE_URL}/submissions?base64_encoded=true&wait=true",
        json=payload,
        headers=headers,
        timeout=TIMEOUT,
    )
    duration_ms = int((time.perf_counter() - t0) * 1000)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Judge0 HTTP {resp.status_code}: {resp.text[:300]}")

    try:
        res = resp.json() or {}
    except Exception as exc:
        raise RuntimeError(f"Judge0 returned non-JSON response: {exc}")

    status = res.get("status") or {}
    status_id = status.get("id") if isinstance(status, dict) else None
    logger.info("[Judge0] status=%s lang=%s %dms", status_id, language_id, duration_ms)
    return Judge0Result(
        stdout=_b64decode_text(res.get("stdout")),
        stderr=_b64decode_text(res.get("stderr")),
        status_id=status_id,
        time_s=res.get("time"),
        memory_kb=res.get("memory"),
        raw=res,
    )
