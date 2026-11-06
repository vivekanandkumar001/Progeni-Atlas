"""
Progeni Atlas — Shared Scoring Contract
========================================
Server-authoritative scoring models, competency schemas, and recommendation
decision rules shared between Practice Sessions and Recruiter Evaluation Scorecards.
"""

from __future__ import annotations
import enum
from typing import Any, Dict, List, Optional, Tuple


class Recommendation(str, enum.Enum):
    STRONG_HIRE = "STRONG_HIRE"
    HIRE = "HIRE"
    LEAN_HIRE = "LEAN_HIRE"
    REJECT = "REJECT"


# Standard competency definitions across Progeni Atlas
STANDARD_COMPETENCIES: list[dict[str, Any]] = [
    {
        "name": "technicalDepth",
        "label": "Technical Depth",
        "weight": 40.0,
        "description": "Proficiency in algorithms, code efficiency, and core platform concepts.",
    },
    {
        "name": "systemArchitecture",
        "label": "System Architecture",
        "weight": 30.0,
        "description": "Designing scalable, fault-tolerant distributed systems and modular architectures.",
    },
    {
        "name": "communication",
        "label": "Communication",
        "weight": 15.0,
        "description": "Clarity of technical explanations and collaborative problem-solving style.",
    },
    {
        "name": "problemSolving",
        "label": "Problem Solving",
        "weight": 15.0,
        "description": "Ability to break down ambiguous challenges into structured, testable components.",
    },
]

DEFAULT_WEIGHTS: dict[str, float] = {
    c["name"]: c["weight"] for c in STANDARD_COMPETENCIES
}


def compute_recommendation(overall_score: float) -> str:
    """Map a 0-100 overall score to a standardized Recommendation enum string."""
    score = float(overall_score)
    if score >= 85.0:
        return Recommendation.STRONG_HIRE.value
    elif score >= 75.0:
        return Recommendation.HIRE.value
    elif score >= 65.0:
        return Recommendation.LEAN_HIRE.value
    else:
        return Recommendation.REJECT.value


def extract_turn_scores(turn: dict[str, Any]) -> tuple[float, float, float]:
    """Extract (relevance, depth, correctness) from a turn object, ensuring 0-10 bounds."""
    scores_obj = turn.get("scores") if isinstance(turn.get("scores"), dict) else turn
    
    def _parse(val: Any) -> float:
        try:
            return max(0.0, min(10.0, float(val)))
        except (TypeError, ValueError):
            return 0.0

    rel = _parse(scores_obj.get("relevance", scores_obj.get("relevance_score", 0.0)))
    depth = _parse(scores_obj.get("depth", scores_obj.get("depth_score", 0.0)))
    corr = _parse(scores_obj.get("correctness", scores_obj.get("correctness_score", 0.0)))
    return rel, depth, corr


def derive_scoring_breakdown(
    turns: list[dict[str, Any]],
    category: Optional[str] = None,
    custom_weights: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """Derive standard competency scores, breakdown, overall score, and recommendation

    from a sequence of turns containing relevance, depth, and correctness metrics.
    Works identically for practice sessions and recruiter interviews.
    """
    if not turns:
        return {
            "overallScore": 0.0,
            "recommendation": Recommendation.REJECT.value,
            "breakdown": {
                "technicalDepth": 0.0,
                "systemArchitecture": 0.0,
                "communication": 0.0,
                "problemSolving": 0.0,
            },
            "competencyScores": [],
            "parameterScores": [],
        }

    rel_scores: list[float] = []
    depth_scores: list[float] = []
    corr_scores: list[float] = []

    for t in turns:
        r, d, c = extract_turn_scores(t)
        rel_scores.append(r)
        depth_scores.append(d)
        corr_scores.append(c)

    avg_rel = sum(rel_scores) / len(rel_scores)
    avg_depth = sum(depth_scores) / len(depth_scores)
    avg_corr = sum(corr_scores) / len(corr_scores)

    # Scale 0-10 LLM metrics to 0-100 percentage competencies
    # Technical Depth = avg_depth * 10
    tech_depth = round(avg_depth * 10.0, 1)
    
    # Problem Solving = avg_corr * 10
    prob_solving = round(avg_corr * 10.0, 1)
    
    # Communication = avg_rel * 10
    comm = round(avg_rel * 10.0, 1)

    # System Architecture = category-weighted blend of depth and correctness
    cat_upper = str(category or "").upper()
    if "SYSTEM" in cat_upper or "ARCHITECTURE" in cat_upper:
        sys_arch = round((avg_depth * 0.6 + avg_corr * 0.4) * 10.0, 1)
    elif "BACKEND" in cat_upper or "DISTRIBUTED" in cat_upper:
        sys_arch = round((avg_depth * 0.5 + avg_corr * 0.5) * 10.0, 1)
    else:
        sys_arch = round((avg_depth * 0.4 + avg_corr * 0.3 + avg_rel * 0.3) * 10.0, 1)

    weights = dict(DEFAULT_WEIGHTS)
    if custom_weights:
        for k, v in custom_weights.items():
            if k in weights and isinstance(v, (int, float)):
                weights[k] = float(v)

    total_weight = sum(weights.values()) or 100.0

    weighted_sum = (
        (tech_depth * weights.get("technicalDepth", 40.0))
        + (sys_arch * weights.get("systemArchitecture", 30.0))
        + (comm * weights.get("communication", 15.0))
        + (prob_solving * weights.get("problemSolving", 15.0))
    )
    overall_score = round(weighted_sum / total_weight, 1)
    recommendation = compute_recommendation(overall_score)

    breakdown = {
        "technicalDepth": tech_depth,
        "systemArchitecture": sys_arch,
        "communication": comm,
        "problemSolving": prob_solving,
    }

    competency_scores = [
        {
            "competency": "technicalDepth",
            "label": "Technical Depth",
            "score": tech_depth,
            "weight": weights.get("technicalDepth", 40.0),
            "evidence": f"Demonstrated {tech_depth}% technical depth across {len(turns)} response turn(s).",
        },
        {
            "competency": "systemArchitecture",
            "label": "System Architecture",
            "score": sys_arch,
            "weight": weights.get("systemArchitecture", 30.0),
            "evidence": f"Evaluated architectural and structural engineering reasoning at {sys_arch}%.",
        },
        {
            "competency": "communication",
            "label": "Communication",
            "score": comm,
            "weight": weights.get("communication", 15.0),
            "evidence": f"Maintained {comm}% topic relevance and communicative clarity.",
        },
        {
            "competency": "problemSolving",
            "label": "Problem Solving",
            "score": prob_solving,
            "weight": weights.get("problemSolving", 15.0),
            "evidence": f"Factual precision and problem resolution accuracy scored at {prob_solving}%.",
        },
    ]

    parameter_scores = [
        {
            "name": "Relevance",
            "score": round(avg_rel, 1),
            "max_score": 10,
            "percentage": round(avg_rel * 10.0, 1),
            "description": "Average candidate alignment with question intents across all turns.",
        },
        {
            "name": "Technical Depth",
            "score": round(avg_depth, 1),
            "max_score": 10,
            "percentage": round(avg_depth * 10.0, 1),
            "description": "Average architectural and engineering rigor demonstrated across all turns.",
        },
        {
            "name": "Correctness & Accuracy",
            "score": round(avg_corr, 1),
            "max_score": 10,
            "percentage": round(avg_corr * 10.0, 1),
            "description": "Average technical precision and factual correctness across all turns.",
        },
    ]

    return {
        "overallScore": overall_score,
        "recommendation": recommendation,
        "breakdown": breakdown,
        "competencyScores": competency_scores,
        "parameterScores": parameter_scores,
    }
