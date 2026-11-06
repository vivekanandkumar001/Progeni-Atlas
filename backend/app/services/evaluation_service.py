"""
Progeni Atlas - Evaluation Service Module
Extracted from interview_engine.py for better code organization.

Handles answer evaluation and turns the stored per-turn evidence into a
server-authoritative scorecard result.

The model may suggest competency scores and narrative evidence, but it never
controls the final score, the weights, the competency set or the
recommendation. Those are derived here from the independently stored per-turn
relevance/depth/correctness evaluations.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.services import llm_service
from app.services.llm_service import AnswerEvaluation

logger = logging.getLogger("talentpulse.evaluation_service")

__all__ = [
    "AnswerEvaluation",
    "RubricError",
    "_clamp",
    "build_scorecard_from_evaluations",
    "compute_recommendation",
    "evaluate_answer",
]


class RubricError(Exception):
    """Raised when a rubric cannot produce an authoritative score."""

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


def _clamp(value: Any, lo: float = 0.0, hi: float = 10.0) -> float:
    """Clamp a value between lo and hi."""
    try:
        return max(lo, min(hi, float(value)))
    except (TypeError, ValueError):
        return lo


def _normalize_comp_name(val: Any) -> str:
    """Normalize competency name/label for robust matching across camelCase,
    snake_case, and space-separated strings."""
    return re.sub(r"[\s_\-]+", "", str(val or "").strip().lower())


def compute_recommendation(overall: float) -> str:
    """Map an authoritative overall score onto the hiring recommendation.

    The thresholds are fixed and server-side; no model output can change them.
    """
    if overall >= 85:
        return "STRONG_HIRE"
    if overall >= 75:
        return "HIRE"
    if overall >= 65:
        return "LEAN_HIRE"
    return "REJECT"


def evaluate_answer(
    *,
    question: str,
    expected_concepts: list[str],
    answer: str,
    job_description: str | None,
    turn_index: int,
) -> AnswerEvaluation:
    """Evaluate a single candidate answer with the platform LLM service.

    The prompt construction, provider fallback and JSON parsing live in
    ``llm_service``; this module is the single place the interview engine
    calls into, so the evaluation contract stays in one file.
    """
    return llm_service.evaluate_answer(
        question=question,
        expected_concepts=list(expected_concepts or []),
        answer=answer,
        job_description=job_description,
        turn_index=turn_index,
    )


def build_scorecard_from_evaluations(
    *,
    weights: dict[str, float | int],
    competencies: list[dict[str, Any]],
    llm_competencies: list[dict[str, Any]],
    evaluations: list[dict[str, Any]],
) -> tuple[float, str, list[dict[str, Any]]]:
    """Turn LLM evidence into a server-authoritative weighted result.

    The model may suggest competency scores and narrative evidence, but it never
    controls the final score, weights, competency set, or recommendation.
    Missing competency scores fall back to the mean of the independently stored
    per-turn relevance/depth/correctness evaluations.
    """

    def clamp(value: Any) -> float:
        try:
            return max(0.0, min(100.0, float(value)))
        except (TypeError, ValueError):
            return 0.0

    llm_by_name = {}
    for item in llm_competencies or []:
        if not isinstance(item, dict):
            continue
        key = str(item.get("competency") or item.get("name") or "").strip()
        if key:
            llm_by_name[_normalize_comp_name(key)] = item

    normalized = []
    total_weight = sum(float(v) for v in weights.values())
    if total_weight <= 0:
        raise RubricError("Approved rubric has no usable weights.")

    norm_weights = {_normalize_comp_name(k): float(v) for k, v in weights.items()}

    for comp in competencies or []:
        name = str(comp.get("name") or comp.get("label") or "").strip()
        if not name:
            continue
        label = str(comp.get("label") or name).strip()
        norm_name = _normalize_comp_name(name)
        norm_label = _normalize_comp_name(label)
        item = llm_by_name.get(norm_name) or llm_by_name.get(norm_label)
        # Numeric competency scores are server-derived only. The LLM can provide
        # narrative evidence, but cannot inject an authoritative numeric score.
        targeted = []
        for row in evaluations:
            row_comp = _normalize_comp_name(row.get("competency"))
            if not row_comp or row_comp not in (norm_name, norm_label):
                continue
            values = [row.get("relevance"), row.get("depth"), row.get("correctness")]
            nums = [max(0.0, min(10.0, float(v))) * 10.0 for v in values if v is not None]
            if nums:
                targeted.append(sum(nums) / len(nums))
        # A rubric competency with no direct evaluation is explicitly unassessed.
        # Never manufacture a score from unrelated competencies or missing values.
        score = sum(targeted) / len(targeted) if targeted else None
        raw_weight = (
            weights.get(name)
            if name in weights
            else (
                weights.get(label)
                if label in weights
                else norm_weights.get(norm_name, norm_weights.get(norm_label, comp.get("weight", 0)))
            )
        )
        weight = float(raw_weight or 0.0)
        evidence = (
            str(item.get("evidence") or "")[:2000]
            if item
            else ("Not assessed in this interview." if score is None
                  else "Derived from stored per-turn evaluations.")
        )
        normalized.append({
            "competency": name,
            "score": round(clamp(score), 2) if score is not None else None,
            "weight": round(weight, 2) if score is not None else 0.0,
            "evidence": evidence,
        })

    if not normalized:
        raise RubricError("Approved rubric contains no competencies.")

    # Only rubric-defined weights contribute. Normalize defensively if the DB
    # contains a legacy rubric whose competency weights do not sum to 100.
    assessed = [item for item in normalized if item["score"] is not None and item["weight"] > 0]
    effective_total = sum(item["weight"] for item in assessed)
    if effective_total <= 0:
        raise RubricError("No rubric competency was assessed; refusing to manufacture an overall score.")
    overall = round(sum(item["score"] * item["weight"] for item in assessed) / effective_total, 2)
    return overall, compute_recommendation(overall), normalized
