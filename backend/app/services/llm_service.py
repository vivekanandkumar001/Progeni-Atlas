
from __future__ import annotations

import json
import logging
import re
import time
import contextvars
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import httpx

from app.config import settings
from app.models import ActionDecision, InterviewStage

logger = logging.getLogger("progeni_atlas.llm")

# --- Shadow metering (admin cost/insights) ---------------------------------
# Every chat/completion call is metered into platform_shadow_usage_events with
# provider-reported token usage. Never raises into the request path. Uses
# contextvars so each Flask request thread gets its own operation context.
_current_operation: contextvars.ContextVar[str] = contextvars.ContextVar("llm_operation", default="llm_chat")
_last_usage: contextvars.ContextVar[dict] = contextvars.ContextVar("llm_last_usage", default={})


def set_operation(name: str) -> None:
    """Tag the current logical operation for cost attribution (e.g. 'scorecard')."""
    try:
        _current_operation.set(str(name or "llm_chat").strip().lower()[:64])
    except Exception:
        pass


def _current_operation() -> str:
    try:
        return _current_operation.get()
    except Exception:
        return "llm_chat"


def _timed(provider: str, model: str, fn):
    """Time one provider attempt and emit exactly one shadow-metering event."""
    start = time.time()
    try:
        result = fn()
        _record_attempt(provider=provider, model=model, duration_ms=int((time.time() - start) * 1000), ok=True, usage=_consume_usage())
        return result
    except Exception as exc:
        _record_attempt(provider=provider, model=model, duration_ms=int((time.time() - start) * 1000), ok=False, usage={}, error_code=type(exc).__name__)
        raise


def _record_usage(usage: dict) -> None:
    try:
        _last_usage.set(dict(usage or {}))
    except Exception:
        pass


def _consume_usage() -> dict:
    try:
        u = _last_usage.get()
        _last_usage.set({})
        return dict(u or {})
    except Exception:
        return {}


def _usage_obj(usage: dict) -> SimpleNamespace:
    return SimpleNamespace(
        input_tokens=usage.get("input_tokens"),
        output_tokens=usage.get("output_tokens"),
        cached_tokens=usage.get("cached_tokens"),
        reasoning_tokens=usage.get("reasoning_tokens"),
    )


def _record_attempt(*, provider: str, model: str, duration_ms: int, ok: bool, usage: dict, error_code: str | None = None) -> None:
    """Emit exactly one shadow-metering event; best-effort, never raises."""
    try:
        from core.shadow_metering import SERVICE_LLM, MeterContext, cost_for_llm, emit
        ctx = MeterContext(
            service_category=SERVICE_LLM,
            operation=_current_operation(),
            provider=provider,
            model=model,
            usage_measured=bool(usage),
        )
        if ok:
            cost = cost_for_llm(provider=provider, model=model, usage=_usage_obj(usage), usage_measured=bool(usage))
            emit(ctx, measured_usage=usage or None, usage_unit="tokens", cost=cost, duration_ms=duration_ms, status="success")
        else:
            emit(ctx, measured_usage=None, usage_unit="tokens", cost=None, duration_ms=duration_ms, status="error", error_code=error_code)
    except Exception:
        logger.warning("[LLM] metering emit failed (request unaffected)", exc_info=True)

_shared_http_client: httpx.Client | None = None

def _get_shared_client(timeout: float = 60.0) -> httpx.Client:
    global _shared_http_client
    if _shared_http_client is None or _shared_http_client.is_closed:
        _shared_http_client = httpx.Client(
            timeout=timeout,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
    return _shared_http_client


class LLMError(RuntimeError):
    pass


class _LLMFallbackTrigger(Exception):
    """Internal signal that a provider failed with an eligible fallback condition."""
    pass


@dataclass
class GeneratedQuestion:
    prompt_text: str
    stage: InterviewStage
    expected_concepts: list[str] = field(default_factory=list)
    model_used: str = ""


@dataclass
class AnswerEvaluation:
    relevance_score: float
    depth_score: float
    correctness_score: float
    evaluator_notes: str
    missing_concepts: list[str]
    red_flags: list[str]
    action_decision: ActionDecision
    recommended_follow_up: str | None
    model_used: str


@dataclass
class GeneratedScorecard:
    overall_score: float
    recommendation: str
    executive_summary: str
    competencies: list[dict[str, Any]]
    strengths: list[str]
    concerns: list[str]
    model_used: str


def _call_openai(
    system: str, user: str, *, max_tokens: int, temperature: float
) -> tuple[str, str]:
    if not settings.OPENAI_API_KEY or not settings.OPENAI_API_KEY.strip() or "your-openai" in settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.endswith("here"):
        raise _LLMFallbackTrigger("OPENAI_API_KEY is not configured or is a placeholder")

    url = f"{settings.OPENAI_API_BASE.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
    }
    payload = {
        "model": settings.LLM_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    try:
        client = _get_shared_client(timeout=60.0)
        resp = client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise _LLMFallbackTrigger(f"OpenAI request timed out: {exc}") from exc
    except (httpx.NetworkError, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
        raise _LLMFallbackTrigger(f"OpenAI network/connection error: {exc}") from exc
    except httpx.HTTPError as exc:
        raise _LLMFallbackTrigger(f"OpenAI HTTP error: {exc}") from exc

    if resp.status_code == 429:
        raise _LLMFallbackTrigger(f"OpenAI rate limited / quota exhausted (HTTP 429): {resp.text[:300]}")
    if resp.status_code in {400, 422}:
        # Do NOT fallback for malformed application requests or validation errors
        raise LLMError(f"OpenAI rejected malformed request (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code in {401, 403}:
        raise _LLMFallbackTrigger(f"OpenAI authorization failure (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code >= 500:
        raise _LLMFallbackTrigger(f"OpenAI server error (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code >= 400:
        raise _LLMFallbackTrigger(f"OpenAI error (HTTP {resp.status_code}): {resp.text[:300]}")

    try:
        data = resp.json()
        if isinstance(data, dict):
            u = data.get("usage") or {}
            _record_usage({
                "input_tokens": u.get("prompt_tokens"),
                "output_tokens": u.get("completion_tokens"),
                "cached_tokens": (u.get("prompt_tokens_details") or {}).get("cached_tokens"),
                "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"),
                "total_tokens": u.get("total_tokens"),
            })
        content = data["choices"][0]["message"]["content"]
        return content, settings.LLM_MODEL
    except (ValueError, KeyError, IndexError) as exc:
        raise _LLMFallbackTrigger(f"Unexpected OpenAI response format: {resp.text[:300]}") from exc


def _call_openrouter(
    system: str, user: str, *, max_tokens: int, temperature: float
) -> tuple[str, str]:
    if not settings.OPENROUTER_API_KEY or not settings.OPENROUTER_API_KEY.strip():
        raise _LLMFallbackTrigger("OPENROUTER_API_KEY is not configured or empty")

    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://progeni.atlas",
        "X-Title": "Progeni Atlas Interviewer",
    }
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }

    try:
        client = _get_shared_client(timeout=60.0)
        resp = client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise _LLMFallbackTrigger(f"OpenRouter request timed out: {exc}") from exc
    except (httpx.NetworkError, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
        raise _LLMFallbackTrigger(f"OpenRouter network/connection error: {exc}") from exc
    except httpx.HTTPError as exc:
        raise _LLMFallbackTrigger(f"OpenRouter HTTP error: {exc}") from exc

    if resp.status_code == 429:
        raise _LLMFallbackTrigger(f"OpenRouter rate limited / quota exhausted (HTTP 429): {resp.text[:300]}")
    if resp.status_code in {400, 422}:
        # Do NOT fallback for malformed application requests or validation errors
        raise LLMError(f"OpenRouter rejected malformed request (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code in {401, 403}:
        raise _LLMFallbackTrigger(f"OpenRouter authorization failure (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code >= 500:
        raise _LLMFallbackTrigger(f"OpenRouter server error (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code >= 400:
        raise _LLMFallbackTrigger(f"OpenRouter error (HTTP {resp.status_code}): {resp.text[:300]}")

    try:
        data = resp.json()
        if isinstance(data, dict):
            u = data.get("usage") or {}
            _record_usage({
                "input_tokens": u.get("prompt_tokens"),
                "output_tokens": u.get("completion_tokens"),
                "cached_tokens": (u.get("prompt_tokens_details") or {}).get("cached_tokens"),
                "reasoning_tokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens"),
                "total_tokens": u.get("total_tokens"),
            })
        content = data["choices"][0]["message"]["content"]
        return content, f"openrouter/{settings.OPENROUTER_MODEL}"
    except (ValueError, KeyError, IndexError) as exc:
        raise _LLMFallbackTrigger(f"Unexpected OpenRouter response format: {resp.text[:300]}") from exc


def _call_gemini(
    system: str, user: str, *, max_tokens: int, temperature: float
) -> tuple[str, str]:
    key = settings.effective_gemini_key
    if not key:
        raise _LLMFallbackTrigger("GEMINI_API_KEY / GEMINI_API is not configured or empty")

    model = settings.GEMINI_MODEL or "gemini-2.0-flash"
    url = f"{settings.GEMINI_BASE_URL.rstrip('/')}/models/{model}:generateContent?key={key}"

    payload: dict[str, Any] = {
        "contents": [
            {"role": "user", "parts": [{"text": user}]}
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        }
    }
    if system and system.strip():
        payload["system_instruction"] = {
            "parts": [{"text": system.strip()}]
        }

    headers = {"Content-Type": "application/json"}

    try:
        client = _get_shared_client(timeout=35.0)
        resp = client.post(url, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise _LLMFallbackTrigger(f"Gemini request timed out: {exc}") from exc
    except (httpx.NetworkError, httpx.ConnectError, httpx.RemoteProtocolError) as exc:
        raise _LLMFallbackTrigger(f"Gemini network error: {exc}") from exc
    except httpx.HTTPError as exc:
        raise _LLMFallbackTrigger(f"Gemini HTTP error: {exc}") from exc

    if resp.status_code == 429:
        raise _LLMFallbackTrigger(f"Gemini rate limit / quota (HTTP 429): {resp.text[:300]}")
    if resp.status_code in {401, 403}:
        raise _LLMFallbackTrigger(f"Gemini auth failure (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code >= 500:
        raise _LLMFallbackTrigger(f"Gemini server error (HTTP {resp.status_code}): {resp.text[:300]}")
    if resp.status_code >= 400:
        raise _LLMFallbackTrigger(f"Gemini HTTP {resp.status_code}: {resp.text[:300]}")

    try:
        data = resp.json()
        try:
            um = data.get("usageMetadata") or {}
            _record_usage({
                "input_tokens": um.get("promptTokenCount"),
                "output_tokens": um.get("candidatesTokenCount"),
                "cached_tokens": um.get("cachedContentTokenCount"),
                "reasoning_tokens": um.get("thoughtsTokenCount"),
                "total_tokens": um.get("totalTokenCount"),
            })
        except Exception:
            _record_usage({})
        candidates = data.get("candidates") or []
        if not candidates:
            raise _LLMFallbackTrigger(f"Gemini returned no candidates: {resp.text[:300]}")
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise _LLMFallbackTrigger("Gemini candidate has no parts")
        content = parts[0].get("text", "")
        return content, f"google/{model}"
    except (ValueError, KeyError, IndexError) as exc:
        raise _LLMFallbackTrigger(f"Failed to parse Gemini response: {resp.text[:300]}") from exc


def _call_ollama(
    system: str, user: str, *, max_tokens: int, temperature: float
) -> tuple[str, str]:
    base_url = settings.effective_ollama_url
    url = f"{base_url}/v1/chat/completions"
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "format": "json",
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            raise _LLMFallbackTrigger(f"Ollama returned HTTP {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        _record_usage({})  # local Ollama — zero marginal cloud cost
        return data["choices"][0]["message"]["content"], f"ollama/{settings.OLLAMA_MODEL}"
    except Exception as exc:
        raise _LLMFallbackTrigger(f"Ollama connection error: {exc}") from exc


def _chat(
    system: str, user: str, *, max_tokens: int = 1200, temperature: float = 0.4
) -> tuple[str, str]:
    """Execute LLM chat completion with prioritized fallback chain:
    Google Gemini (Primary) -> OpenRouter -> OpenAI -> Ollama.
    """
    errors: list[str] = []

    # 1. Primary: Google Gemini (high speed, conversational reasoning)
    if settings.effective_gemini_key or settings.LLM_PROVIDER.lower() in ("gemini", "google"):
        try:
            return _timed(
                "google",
                settings.GEMINI_MODEL or "gemini-2.0-flash",
                lambda: _call_gemini(system, user, max_tokens=max_tokens, temperature=temperature),
            )
        except _LLMFallbackTrigger as gemini_err:
            logger.warning("Primary LLM provider (Gemini) failed: %s. Falling back...", gemini_err)
            errors.append(f"Gemini: {gemini_err}")

    # 2. Secondary: OpenAI
    try:
        return _timed(
            "openai",
            settings.LLM_MODEL,
            lambda: _call_openai(system, user, max_tokens=max_tokens, temperature=temperature),
        )
    except _LLMFallbackTrigger as openai_err:
        errors.append(f"OpenAI: {openai_err}")

    # 3. Tertiary: OpenRouter
    try:
        return _timed(
            "openrouter",
            settings.OPENROUTER_MODEL,
            lambda: _call_openrouter(system, user, max_tokens=max_tokens, temperature=temperature),
        )
    except _LLMFallbackTrigger as openrouter_err:
        errors.append(f"OpenRouter: {openrouter_err}")

    # 4. Final: Ollama
    try:
        return _timed(
            "ollama",
            settings.OLLAMA_MODEL,
            lambda: _call_ollama(system, user, max_tokens=max_tokens, temperature=temperature),
        )
    except _LLMFallbackTrigger as ollama_err:
        errors.append(f"Ollama: {ollama_err}")

    raise LLMError(f"All LLM providers failed: {'; '.join(errors)}")


def _json_from(text: str) -> dict[str, Any] | list[Any]:
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.+?)```", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start_obj, end_obj = cleaned.find("{"), cleaned.rfind("}")
        start_arr, end_arr = cleaned.find("["), cleaned.rfind("]")
        parsed = None
        if start_obj != -1 and end_obj != -1 and (start_arr == -1 or start_obj < start_arr):
            try:
                parsed = json.loads(cleaned[start_obj : end_obj + 1])
            except json.JSONDecodeError:
                pass
        if parsed is None and start_arr != -1 and end_arr != -1:
            try:
                parsed = json.loads(cleaned[start_arr : end_arr + 1])
            except json.JSONDecodeError:
                pass
        if parsed is None:
            raise LLMError(f"LLM did not return valid JSON: {cleaned[:300]}")
    return parsed


def _clamp(value: Any, lo: float = 0.0, hi: float = 10.0) -> float:
    try:
        return max(lo, min(hi, float(value)))
    except (TypeError, ValueError):
        return lo


def call_llm(prompt: str, *, system: str = "", temperature: float = 0.2) -> str:
    """Free-form LLM completion using the platform's provider fallback chain.

    Returns the raw assistant text. Callers that need structured output should
    use the dedicated generate_question / evaluate_answer / generate_scorecard
    helpers instead of parsing this response themselves.
    """
    content, _model_used = _chat(system, prompt, temperature=temperature)
    return content


def check_provider_health() -> dict[str, Any]:
    """Check health and reachability of configured LLM providers without leaking credentials."""
    gemini_key = settings.effective_gemini_key
    gemini_configured = bool(gemini_key)
    gemini_available = False
    gemini_detail = "Not configured"
    if gemini_configured:
        try:
            url = f"{settings.GEMINI_BASE_URL.rstrip('/')}/models?key={gemini_key}"
            with httpx.Client(timeout=4.0) as client:
                r = client.get(url)
                if r.status_code == 200:
                    gemini_available = True
                    gemini_detail = f"Available with model {settings.GEMINI_MODEL}"
                elif r.status_code == 429:
                    gemini_detail = "Quota exhausted / Rate limited (HTTP 429)"
                elif r.status_code in {401, 403}:
                    gemini_detail = f"Authentication failure (HTTP {r.status_code})"
                else:
                    gemini_detail = f"HTTP {r.status_code}"
        except Exception as exc:
            gemini_detail = f"Unreachable: {str(exc)[:100]}"

    openai_configured = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())
    openai_available = False
    openai_detail = "Not configured"
    if openai_configured:
        try:
            url = f"{settings.OPENAI_API_BASE.rstrip('/')}/models"
            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            with httpx.Client(timeout=4.0) as client:
                r = client.get(url, headers=headers)
                if r.status_code == 200:
                    openai_available = True
                    openai_detail = "Available"
                elif r.status_code == 429:
                    openai_detail = "Quota exhausted / Rate limited (HTTP 429)"
                else:
                    openai_detail = f"Unavailable (HTTP {r.status_code})"
        except Exception as exc:
            openai_detail = f"Unreachable: {str(exc)[:100]}"

    openrouter_configured = bool(settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip())
    openrouter_available = False
    openrouter_detail = "Not configured"
    if openrouter_configured:
        try:
            url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/auth/key"
            headers = {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"}
            with httpx.Client(timeout=4.0) as client:
                r = client.get(url, headers=headers)
                if r.status_code == 200:
                    openrouter_available = True
                    openrouter_detail = f"Available with model {settings.OPENROUTER_MODEL}"
                elif r.status_code == 429:
                    openrouter_detail = "Quota exhausted / Rate limited (HTTP 429)"
                elif r.status_code in {401, 403}:
                    openrouter_detail = f"Authentication failure (HTTP {r.status_code})"
                else:
                    openrouter_detail = f"HTTP {r.status_code}"
        except Exception as exc:
            openrouter_detail = f"Unreachable: {str(exc)[:100]}"

    ollama_url = settings.effective_ollama_url
    ollama_available = False
    ollama_detail = f"Connecting to {ollama_url}"
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(f"{ollama_url}/api/tags")
            if r.status_code == 200:
                ollama_available = True
                data = r.json()
                models = [m.get("name") for m in data.get("models", [])]
                if any(settings.OLLAMA_MODEL in str(m) for m in models):
                    ollama_detail = f"Available with model {settings.OLLAMA_MODEL}"
                else:
                    ollama_detail = f"Server online; model {settings.OLLAMA_MODEL} not pulled yet (available: {models})"
            else:
                ollama_detail = f"HTTP {r.status_code}"
    except Exception as exc:
        ollama_detail = f"Unreachable: {str(exc)[:100]}"

    active = "none"
    if gemini_available:
        active = "gemini"
    elif openai_available and settings.LLM_PROVIDER.lower() == "openai":
        active = "openai"
    elif openrouter_available:
        active = "openrouter"
    elif ollama_available:
        active = "ollama"

    return {
        "active_provider": active,
        "gemini": {
            "configured": gemini_configured,
            "available": gemini_available,
            "model": settings.GEMINI_MODEL,
            "detail": gemini_detail,
        },
        "openai": {
            "configured": openai_configured,
            "available": openai_available,
            "model": settings.LLM_MODEL,
            "detail": openai_detail,
        },
        "openrouter": {
            "configured": openrouter_configured,
            "available": openrouter_available,
            "model": settings.OPENROUTER_MODEL,
            "detail": openrouter_detail,
        },
        "ollama": {
            "configured": True,
            "available": ollama_available,
            "url": ollama_url,
            "model": settings.OLLAMA_MODEL,
            "detail": ollama_detail,
        },
    }


# ------------------------------------------------------------------ questions
_QUESTION_SYSTEM = (
    "You are the AI interviewer for an enterprise technical screening platform. "
    "You write ONE interview question at a time. "
    "Ground the question strictly in the supplied resume, job description, role, "
    "skills and interview configuration. Never invent facts about the candidate. "
    'Respond ONLY with JSON: {"question": str, "stage": "intro|resume_probe|technical|'
    'coding|scenario|wrap_up", "expected_concepts": [str], "follow_up": str|null}'
)


def generate_question(
    *,
    job_title: str | None,
    job_description: str | None,
    candidate_name: str,
    candidate_skills: list[str],
    resume_text: str | None,
    experience_level: str | None,
    config: dict[str, Any],
    previous_questions: list[str],
    previous_qa: list[dict[str, str]],
    turn_index: int,
) -> GeneratedQuestion:
    set_operation("question")
    context_bits = [
        f"Candidate: {candidate_name}",
        f"Target Role: {job_title or 'Software Engineer'}",
        f"Seniority: {experience_level or 'mid'}",
        f"Skills: {', '.join(candidate_skills) if candidate_skills else 'general engineering'}",
        f"Turn: {turn_index}",
    ]
    if job_description:
        context_bits.append(f"Job Description:\n{job_description[:2000]}")
    if resume_text:
        context_bits.append(f"Resume context:\n{resume_text[:2000]}")
    if previous_questions:
        context_bits.append("Previous questions asked:\n- " + "\n- ".join(previous_questions[-5:]))
    if previous_qa:
        summary = [f"Q: {qa['question']}\nA: {qa['answer'][:200]}" for qa in previous_qa[-3:]]
        context_bits.append("Recent Q&A:\n" + "\n\n".join(summary))

    content, model_used = _chat(_QUESTION_SYSTEM, "\n\n".join(context_bits))
    payload = _json_from(content)

    question = str(payload.get("question") or "").strip()
    if not question:
        raise LLMError("LLM returned an empty question")

    stage_raw = str(payload.get("stage") or "technical").lower()
    try:
        stage = InterviewStage(stage_raw)
    except ValueError:
        stage = InterviewStage.TECHNICAL

    concepts = payload.get("expected_concepts") or []
    if not isinstance(concepts, list):
        concepts = []

    follow_up = payload.get("follow_up")
    if follow_up:
        question = f"{question}\n\n{str(follow_up).strip()}"

    return GeneratedQuestion(
        prompt_text=question,
        stage=stage,
        expected_concepts=[str(c) for c in concepts][:12],
        model_used=model_used,
    )


# ----------------------------------------------------------------- evaluation
_EVAL_SYSTEM = (
    "You evaluate a single candidate answer to an interview question. "
    "Score relevance, depth and correctness from 0 to 10. Be strict and evidence-based; "
    "do not reward length. "
    'Respond ONLY with JSON: {"relevance": number, "depth": number, "correctness": number, '
    '"notes": str, "missing_concepts": [str], "red_flags": [str], '
    '"action_decision": "PASS|PROBE_FURTHER|SWITCH_TOPIC|TERMINATE", "follow_up": str|null}'
)


def evaluate_answer(
    *,
    question: str,
    expected_concepts: list[str],
    answer: str,
    job_description: str | None,
    turn_index: int,
) -> AnswerEvaluation:
    set_operation("evaluate")
    user = "\n\n".join(
        part
        for part in [
            f"Question: {question}",
            (f"Concepts we expect: {', '.join(expected_concepts)}" if expected_concepts else ""),
            (f"Job description:\n{job_description[:5000]}" if job_description else ""),
            f"Candidate answer:\n{answer[:8000]}",
            f"Turn index: {turn_index}",
        ]
        if part
    )
    content, model_used = _chat(_EVAL_SYSTEM, user, temperature=0.2)
    payload = _json_from(content)

    if (
        payload.get("relevance") is None
        or payload.get("depth") is None
        or payload.get("correctness") is None
    ):
        raise LLMError("LLM evaluation response is missing one or more required score fields (relevance, depth, correctness)")

    decision_raw = str(payload.get("action_decision") or "PASS").upper().strip()
    decision_map = {
        "PASS": ActionDecision.PASS,
        "PROBE_FURTHER": ActionDecision.PROBE_FURTHER,
        "PROBE": ActionDecision.PROBE_FURTHER,
        "FOLLOW_UP": ActionDecision.PROBE_FURTHER,
        "SWITCH_TOPIC": ActionDecision.SWITCH_TOPIC,
        "SWITCH": ActionDecision.SWITCH_TOPIC,
        "TERMINATE": ActionDecision.TERMINATE,
    }
    if decision_raw not in decision_map:
        raise LLMError(f"LLM returned invalid action_decision: '{decision_raw}'")
    decision = decision_map[decision_raw]

    return AnswerEvaluation(
        relevance_score=_clamp(payload["relevance"]),
        depth_score=_clamp(payload["depth"]),
        correctness_score=_clamp(payload["correctness"]),
        evaluator_notes=str(payload.get("notes") or ""),
        missing_concepts=[str(x) for x in (payload.get("missing_concepts") or []) if x],
        red_flags=[str(x) for x in (payload.get("red_flags") or []) if x],
        action_decision=decision,
        recommended_follow_up=payload.get("follow_up"),
        model_used=model_used,
    )


# ----------------------------------------------------------------- scorecard
_SCORECARD_SYSTEM = (
    "You produce a final hiring scorecard from a completed interview transcript. "
    "Weight competencies per the supplied interview configuration. "
    'Respond ONLY with JSON: {"overall_score": number 0-100, "recommendation": '
    '"STRONG_HIRE|HIRE|LEAN_HIRE|REJECT", "executive_summary": str, '
    '"competencies": [{"competency": str, "score": number 0-100, "weight": number, '
    '"evidence": str}], "strengths": [str], "concerns": [str]}'
)


def generate_scorecard(
    *,
    job_title: str | None,
    candidate_name: str,
    config: dict[str, Any],
    transcript: list[dict[str, str]],
    evaluations: list[dict[str, Any]],
    proctoring_summary: dict[str, Any],
) -> GeneratedScorecard:
    set_operation("scorecard")
    convo = "\n\n".join(
        f"Q: {t.get('question', '')}\nA: {t.get('answer', '')}" for t in transcript
    )
    evals = json.dumps(evaluations, default=str)[:8000]
    proct = json.dumps(proctoring_summary, default=str)

    user = "\n\n".join(
        part
        for part in [
            f"Candidate: {candidate_name}",
            f"Role: {job_title or 'unspecified'}",
            f"Interview configuration: {json.dumps(config, default=str)}",
            f"Per-turn evaluations: {evals}",
            f"Proctoring summary: {proct}",
            f"Transcript:\n{convo[:12000]}",
        ]
        if part
    )
    content, model_used = _chat(_SCORECARD_SYSTEM, user, max_tokens=2000, temperature=0.2)
    payload = _json_from(content)

    raw_overall = payload.get("overall_score")
    if raw_overall is None:
        raise LLMError("LLM returned no overall_score")
    overall = max(0.0, min(100.0, _clamp(raw_overall, 0.0, 100.0)))

    rec_raw = str(payload.get("recommendation") or "REJECT").upper().strip()
    rec_map = {
        "STRONG_HIRE": "STRONG_HIRE",
        "HIRE": "HIRE",
        "LEAN_HIRE": "LEAN_HIRE",
        "LEAN_NO_HIRE": "REJECT",
        "NO_HIRE": "REJECT",
        "REJECT": "REJECT",
    }
    if rec_raw not in rec_map:
        raise LLMError(f"LLM returned invalid recommendation: '{rec_raw}'")
    recommendation = rec_map[rec_raw]

    exec_summary = str(payload.get("executive_summary") or "").strip()
    if not exec_summary:
        raise LLMError("LLM scorecard response missing executive_summary")

    comps: list[dict[str, Any]] = []
    for item in payload.get("competencies") or []:
        if not isinstance(item, dict):
            continue
        comp_name = item.get("competency") or item.get("name")
        if not comp_name:
            continue
        comps.append(
            {
                "competency": str(comp_name)[:120],
                "score": max(0.0, min(100.0, _clamp(item.get("score"), 0.0, 100.0))),
                "weight": max(0.0, _clamp(item.get("weight"), 0.0, 100.0)),
                "evidence": str(item.get("evidence") or "")[:2000],
            }
        )
    if not comps:
        raise LLMError("LLM returned no competencies")

    return GeneratedScorecard(
        overall_score=overall,
        recommendation=recommendation,
        executive_summary=exec_summary,
        competencies=comps,
        strengths=[str(s) for s in (payload.get("strengths") or [])][:12],
        concerns=[str(c) for c in (payload.get("concerns") or [])][:12],
        model_used=model_used,
    )
