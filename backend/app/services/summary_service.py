"""
Progeni Atlas - Summary Service Module
Extracted from interview_engine.py for better code organization.

Generates the structured interview summary: strengths, weaknesses, a hiring
recommendation and a confidence score.

The recommendation is bounded by the proctoring evidence. If the number of
proctoring warnings reaches the threshold, the recommendation is capped at
LEAN_HIRE regardless of what the model suggested, so integrity always wins
over a strong-looking transcript.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("talentpulse.summary_service")

__all__ = ["generate_interview_summary"]

# Proctoring warning count at or above which the recommendation is capped.
PROCTORING_WARNING_THRESHOLD = 5

_FALLBACK_SUMMARY = {
    "strengths": "Strong technical knowledge demonstrated during interview",
    "weaknesses": "Areas for improvement in communication or edge case handling",
    "recommendation": "LEAN_HIRE",
    "confidence_score": 55,
}

_VALID_RECOMMENDATIONS = ("STRONG_HIRE", "HIRE", "LEAN_HIRE", "REJECT")


def _summary_meter(session_id, operation: str):
    """Shadow-metering context for summary generation (session id only)."""
    try:
        from core import shadow_metering as sm

        sid = str(session_id) if session_id else None
        return sm.MeterContext(
            service_category=sm.SERVICE_LLM,
            operation=operation,
            correlation_id=sid,
            session_id=sid,
        )
    except Exception:  # pragma: no cover - metering must never break summary
        return None


def _build_prompt(turns: list, warning_count: int, threshold: int) -> str:
    """Build the summary prompt from the last turns of the interview."""
    prompt = f"""
    Interview Summary Generation:

    Total Interview Turns: {len(turns)}
    Proctoring Warnings: {warning_count} (threshold: {threshold})

    Based on the turn evaluations below, provide a concise summary in this exact JSON format:

    {{
        "strengths": "comma-separated key strengths, max 30 words",
        "weaknesses": "comma-separated key weaknesses, max 30 words",
        "recommendation": "STRONG_HIRE or HIRE or LEAN_HIRE or REJECT",
        "confidence_score": number 0-100
    }}

    Turn Evaluations:
    """

    for i, turn in enumerate(turns[-5:], 1):  # Last 5 turns
        if not isinstance(turn, dict):
            continue
        evaluation = turn.get("evaluation") or {}
        if not isinstance(evaluation, dict):
            evaluation = {}
        candidate_answer = str(turn.get("candidate_answer") or "")[:200]
        prompt += f"""
    Turn {i}:
    - Candidate Answer: {candidate_answer}...
    - Overall Evaluation: {evaluation.get("overall", "N/A")}
    - Strengths: {str(evaluation.get("strengths") or "")[:100]}
    - Weaknesses: {str(evaluation.get("weaknesses") or "")[:100]}
    """

    prompt += """

    Provide your response in valid JSON only, no surrounding text. Format:
    {
        "strengths": "key strength 1, key strength 2",
        "weaknesses": "area improvement 1, area improvement 2",
        "recommendation": "LEAN_HIRE",
        "confidence_score": 55
    }
    """
    return prompt


def generate_interview_summary(
    session_id: str,
    turns: list,
    proctoring_data: dict,
) -> dict:
    """Generate a structured interview summary using the LLM.

    Returns a dict with:
    - strengths: str (max 30 words)
    - weaknesses: str (max 30 words)
    - recommendation: STRONG_HIRE / HIRE / LEAN_HIRE / REJECT
    - confidence_score: float (0-100)
    """
    from app.services.llm_service import call_llm

    warning_count = proctoring_data.get("warning_count", 0) if isinstance(proctoring_data, dict) else 0
    threshold = PROCTORING_WARNING_THRESHOLD

    prompt = _build_prompt(turns or [], warning_count, threshold)

    try:
        summary_result = call_llm(prompt, temperature=0.2)
    except Exception:
        logger.exception("LLM summary generation failed")
        return dict(_FALLBACK_SUMMARY)

    try:
        summary_dict: dict[str, Any] = (
            json.loads(summary_result.strip()) if isinstance(summary_result, str) else summary_result
        )
        if not isinstance(summary_dict, dict):
            raise ValueError("LLM summary is not a JSON object")
    except Exception:
        logger.exception("Failed to parse LLM summary")
        return dict(_FALLBACK_SUMMARY)

    summary_dict.setdefault("strengths", _FALLBACK_SUMMARY["strengths"])
    summary_dict.setdefault("weaknesses", _FALLBACK_SUMMARY["weaknesses"])
    if "recommendation" not in summary_dict:
        summary_dict["recommendation"] = "LEAN_HIRE"

    recommendation = str(summary_dict.get("recommendation") or "").strip().upper()
    if recommendation not in _VALID_RECOMMENDATIONS:
        recommendation = "LEAN_HIRE"
    # Integrity caps the recommendation: a session that crossed the proctoring
    # threshold is never auto-hired, no matter what the model suggested.
    if warning_count >= threshold and recommendation in {"STRONG_HIRE", "HIRE"}:
        recommendation = "LEAN_HIRE"
    summary_dict["recommendation"] = recommendation

    try:
        confidence = float(summary_dict.get("confidence_score", 55))
    except (TypeError, ValueError):
        confidence = 55
    summary_dict["confidence_score"] = max(0, min(100, confidence))

    return summary_dict
