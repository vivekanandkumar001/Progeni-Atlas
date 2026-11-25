"""
Progeni Atlas — Human-rater calibration harness
===============================================
Computes inter-rater agreement between two independent human passes
(``rating_pass_a`` / ``rating_pass_b``) stored on completed interview_sessions
by the transcript double-rating pipeline (Phase 0).

Used to answer the only question that matters for scoring integrity:
"Do our scores agree with independent humans, and with each other?"

Statistics:
  * Pearson r per dimension (needs >= 4 pairs, non-zero variance)
  * ICC(2,1) two-way random-effects, single rater, absolute agreement
    (Shrout & Fleiss 1979). Target: ICC >= 0.75 before any hiring-facing
    calibration claim is made.
"""

from __future__ import annotations

import math
from typing import Any, Iterable, Optional

CANONICAL_DIMENSIONS = [
    "relevance",
    "depth",
    "correctness",
    "technicalDepth",
    "systemArchitecture",
    "communication",
    "problemSolving",
    "overall",
]

_DIM_ALIASES = {
    "relevance_score": "relevance",
    "depth_score": "depth",
    "correctness_score": "correctness",
    "technical_depth": "technicalDepth",
    "tech_depth": "technicalDepth",
    "system_architecture": "systemArchitecture",
    "system_arch": "systemArchitecture",
    "problem_solving": "problemSolving",
}


def extract_pass_vector(pass_obj: Any) -> dict[str, Optional[float]]:
    """Normalize one rater pass into canonical dimension -> 0-10 or None."""
    out = {d: None for d in CANONICAL_DIMENSIONS}

    def _assign(key: str, value: Any) -> None:
        try:
            f = float(value)
        except (TypeError, ValueError):
            return
        if math.isnan(f):
            return
        canonical = _DIM_ALIASES.get(key, key)
        if canonical in out and (out[canonical] is None) and 0.0 <= f <= 10.0:
            out[canonical] = f

    def _walk(source: Any) -> None:
        if isinstance(source, dict):
            for k, v in source.items():
                if isinstance(v, dict):
                    _walk(v)
                elif isinstance(v, (list, tuple, int, float, str)):
                    _assign(str(k), v)
        elif isinstance(source, list):
            for item in source:
                _walk(item)

    _walk(pass_obj)
    return out


def pearson(xs: list[float], ys: list[float]) -> Optional[float]:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    var_x = sum((x - mx) ** 2 for x in xs)
    var_y = sum((y - my) ** 2 for y in ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    denom = math.sqrt(var_x * var_y)
    if denom == 0.0:
        return None
    return cov / denom


def icc_2_1(matrix: list[list[float]]) -> Optional[float]:
    """Two-way random-effects ICC, absolute agreement, single rater.

    ``matrix``: rows = targets (sessions), cols = raters (2).
    Requires >= 3 rows and >= 2 cols, non-zero variance.
    """
    n = len(matrix)
    k = min(len(r) for r in matrix) if matrix else 0
    if n < 3 or k < 2:
        return None
    rows = [r[:k] for r in matrix]
    grand = sum(sum(r) for r in rows) / (n * k)
    row_means = [sum(r) / k for r in rows]
    col_means = [sum(col) / n for col in zip(*rows)]

    ss_between = k * sum((rm - grand) ** 2 for rm in row_means)
    ss_within = sum(sum((x - rm) ** 2 for x in r) for r, rm in zip(rows, row_means))
    ss_between_cols = n * sum((cm - grand) ** 2 for cm in col_means)
    ms_between = ss_between / (n - 1)
    ms_cols = ss_between_cols / (k - 1)
    ms_error = (ss_within - ss_between_cols) / ((n - 1) * (k - 1))
    if ms_between == 0:
        return None
    return (ms_between - ms_error) / (ms_between + (ms_cols - ms_error) / k)


def compute_calibration(sessions: Iterable[Any]) -> dict[str, Any]:
    """Aggregate double-rated sessions -> per-dimension r + overall ICC.

    ``sessions``: dicts from interview_sessions (rating_pass_a/b, status completed).
    Returns honest shape — "verdict" stays INSUFFICIENT_DATA until there are
    >= 4 dual-rated sessions with at least one usable dimension.
    """
    sessions = list(sessions)
    vectors: list[tuple[str, dict[str, Optional[float]], dict[str, Optional[float]]]] = []
    for s in sessions:
        if not isinstance(s, dict):
            continue
        a = extract_pass_vector(s.get("rating_pass_a"))
        b = extract_pass_vector(s.get("rating_pass_b"))
        if all(v is None for v in a.values()) or all(v is None for v in b.values()):
            continue
        sid = str(s.get("id") or s.get("session_id") or "")
        vectors.append((sid, a, b))

    per_dimension: dict[str, Any] = {}
    for dim in CANONICAL_DIMENSIONS:
        xs, ys = [], []
        for _sid, a, b in vectors:
            av, bv = a.get(dim), b.get(dim)
            if av is not None and bv is not None:
                xs.append(av)
                ys.append(bv)
        r = pearson(xs, ys)
        # ICC needs the full 2xN matrix for the dimension
        matrix = [[a.get(dim), b.get(dim)] for _sid, a, b in vectors if a.get(dim) is not None and b.get(dim) is not None]
        icc = icc_2_1(matrix)
        per_dimension[dim] = {
            "pairs": len(xs),
            "pearson_r": round(r, 4) if r is not None else None,
            "icc_2_1": round(icc, 4) if icc is not None else None,
        }

    icc_values = [d["icc_2_1"] for d in per_dimension.values() if d["icc_2_1"] is not None]
    overall_icc = round(sum(icc_values) / len(icc_values), 4) if icc_values else None
    r_values = [d["pearson_r"] for d in per_dimension.values() if d["pearson_r"] is not None]
    overall_r = round(sum(r_values) / len(r_values), 4) if r_values else None

    dual_rated = len(vectors)
    target = 30
    if dual_rated < 4:
        verdict = "INSUFFICIENT_DATA"
    elif overall_icc is not None and overall_icc >= 0.75:
        verdict = "CALIBRATED"
    elif overall_icc is not None:
        verdict = "CALIBRATION_DRIFT"
    else:
        verdict = "INSUFFICIENT_DATA"

    return {
        "sessions_seen": len(sessions),
        "dual_rated": dual_rated,
        "target_dual_rated": target,
        "per_dimension": per_dimension,
        "overall_mean_pearson_r": overall_r,
        "overall_mean_icc_2_1": overall_icc,
        "verdict": verdict,
        "ready_for_launch_claim": verdict == "CALIBRATED" and dual_rated >= target,
    }
