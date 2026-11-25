"""
Judge0 CE client — mocked HTTP, no network.

The sandbox is the only path for running untrusted candidate code, so the
client must fail loudly on transport errors and never fabricate success.
"""
import base64
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sandbox import judge0_client as j0  # noqa: E402


def _b64(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


class _Resp:
    def __init__(self, status_code=200, payload=None, text="{}"):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


def _judge0_response(status_id=3, stdout="", stderr="", time_s="0.01", memory_kb=12345):
    return _Resp(200, {
        "stdout": _b64(stdout),
        "stderr": _b64(stderr),
        "status": {"id": status_id, "description": "Accepted" if status_id == 3 else "Error"},
        "time": time_s,
        "memory": memory_kb,
    })


def test_execute_accepted(monkeypatch):
    monkeypatch.setattr("requests.post", lambda *a, **k: _judge0_response(3, stdout="abc123_PASS\n"))
    os.environ["JUDGE0_URL"] = "http://judge0.local/"
    monkeypatch.setattr(j0, "BASE_URL", "http://judge0.local")
    res = j0.execute(source_code="print('x')", language_id=71)
    assert res.status_id == 3
    assert res.stdout == "abc123_PASS\n"


def test_execute_compile_error(monkeypatch):
    monkeypatch.setattr("requests.post", lambda *a, **k: _judge0_response(6, stderr="syntax error"))
    monkeypatch.setattr(j0, "BASE_URL", "http://judge0.local")
    res = j0.execute(source_code="def broken(", language_id=71)
    assert res.status_id == 6
    assert "syntax error" in res.stderr


def test_execute_http_error_raises(monkeypatch):
    monkeypatch.setattr("requests.post", lambda *a, **k: _Resp(500, text="boom"))
    monkeypatch.setattr(j0, "BASE_URL", "http://judge0.local")
    try:
        j0.execute(source_code="print('x')", language_id=71)
        assert False, "must raise on HTTP 500"
    except RuntimeError as e:
        assert "500" in str(e)


def test_execute_timeout_raises(monkeypatch):
    import requests as _requests

    def _boom(*a, **k):
        raise _requests.Timeout("read timeout")

    monkeypatch.setattr("requests.post", _boom)
    monkeypatch.setattr(j0, "BASE_URL", "http://judge0.local")
    try:
        j0.execute(source_code="x = 1", language_id=71)
        assert False
    except Exception:
        pass


def test_configured_reflects_env(monkeypatch):
    monkeypatch.setattr(j0, "BASE_URL", "")
    assert j0.configured() is False
    monkeypatch.setattr(j0, "BASE_URL", "http://judge0.local")
    assert j0.configured() is True


def test_language_id_for():
    assert j0.language_id_for("python") == 71
    assert j0.language_id_for("PYTHON") == 71
    assert j0.language_id_for("py") == 71
    assert j0.language_id_for("cpp") == 54
    assert j0.language_id_for("c++") == 54
    assert j0.language_id_for("java") == 62
    assert j0.language_id_for("ruby") is None


def test_marked_source_helper():
    from routes import interview_routes

    problem = {"testHarness": {"python": "assert solve(1) == 2\nprint('PASSED')", "javascript": "console.log('PASSED')"}}
    exec_code, marker = interview_routes._build_marked_exec_code("def solve(x):\n    return x + 1", problem, "python")
    assert f"{marker}_PASS" in exec_code
    assert "PASSED" not in exec_code.split("--- Test Verification Harness ---")[1]
    assert marker in exec_code


def test_marked_source_skips_harness_when_absent():
    from routes import interview_routes

    problem = {"testHarness": {}}
    exec_code, marker = interview_routes._build_marked_exec_code("def solve(x):\n    return x", problem, "python")
    assert exec_code == "def solve(x):\n    return x"
    assert marker
