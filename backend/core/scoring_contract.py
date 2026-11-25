"""
Progeni Atlas — Shared Scoring Contract
========================================
Server-authoritative scoring models, competency schemas, and recommendation
decision rules shared between Practice Sessions and Recruiter Evaluation Scorecards.
"""

from __future__ import annotations
import enum
import re
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

# ---------------------------------------------------------------------------
# Behavioral anchors (0-4) — rubric used by the LLM judge and recruiter overrides.
# 0 = absent/negative, 4 = exceptional. Scores must align to these, never vibes.
# ---------------------------------------------------------------------------

ANCHOR_SCALES: dict[str, dict[int, str]] = {
    "technicalDepth": {
        0: "Cannot state a working approach at all; fundamental gaps on the asked technology.",
        1: "Names concepts without depth; cannot explain trade-offs or rationale beyond memorized speech.",
        2: "Solid working knowledge; can implement with guidance; explains the 'what', struggles with the 'why'.",
        3: "Deep, precise expertise; frames decisions by trade-off; handles novel follow-ups with minimal scaffolding.",
        4: "Principal-level judgment; anticipates failure modes unprompted; teaches the interviewer something new.",
    },
    "systemArchitecture": {
        0: "Design contradicts core distributed-systems properties (consistency, availability, partition tolerance).",
        1: "Boxes-and-arrows diagram; no capacity model, no failure handling, no scaling story.",
        2: "Functional design; handles the happy path; partial failure modeling.",
        3: "Production-grade design: capacity estimation, failure domains, observability, cost awareness, evolution path.",
        4: "Architecture-of-the-quarter level: anticipates org boundaries, migration risk, and long-term operability.",
    },
    "communication": {
        0: "Incoherent; cannot articulate a requirement in their own words.",
        1: "Answers in jargon; cannot calibrate to the listener; unclear on what they actually chose.",
        2: "Clear, structured explanation listenable on a video call; some hedging, decent clarity.",
        3: "Crisp, structured, listener-aware; states assumptions, decisions, and evidence explicitly.",
        4: "Communicates like the person you'd want in an incident bridge; precise, calm, persuasive with evidence.",
    },
    "problemSolving": {
        0: "No strategy; jumps straight to code/solution without requirements.",
        1: "Follows the template; struggles to adapt when the constraint changes mid-flight.",
        2: "Sensible decomposition; enumerates steps; testable end-to-end with hints.",
        3: "Systematically decomposes ambiguity; proposes falsifiable checks; recovers from dead-ends fast.",
        4: "Beats the interviewer; reframes the problem when the frame itself is wrong; finds the load-bearing invariant.",
    },
}

ANCHOR_RUBRIC_BLOCK = (
    "Behavioral anchors on a 0-100 scale — score against these, never against vibes. "
    "20 = foundational, 40 = partial, 60 = competent, 80 = strong, 100 = exceptional:\n"
    + "\n".join(
        f"- {dim}: " + " | ".join(
            f"{int(k * 25)} = '{v}'" for k, v in sorted(scale.items())
        )
        for dim, scale in ANCHOR_SCALES.items()
    )
)


def second_pass_dimensions(competency_scores: list[dict[str, Any]]) -> list[str]:
    """Pick the two weakest competency dimensions for adversarial re-check."""
    scored = []
    for item in competency_scores or []:
        try:
            name = str(item.get("competency") or "").strip()
            score = float(item.get("score"))
        except (TypeError, ValueError, AttributeError):
            continue
        if name:
            scored.append((name, score))
    scored.sort(key=lambda pair: pair[1])
    return [name for name, _ in scored[:2]]


# ---------------------------------------------------------------------------
# Recommendation contract — ONE threshold source for every surface.
# 0-100 score: >=85 STRONG_HIRE, >=70 HIRE, >=55 LEAN_HIRE, else REJECT.
# AI-generated recommendation text is NEVER trusted: it is re-derived from the
# score. Only an explicit human decision (documented field names below) wins.
# ---------------------------------------------------------------------------

RECOMMENDATION_THRESHOLDS: tuple[tuple[float, str], ...] = (
    (85.0, Recommendation.STRONG_HIRE.value),
    (70.0, Recommendation.HIRE.value),
    (55.0, Recommendation.LEAN_HIRE.value),
)

# Fields that represent a deliberate recruiter/hiring-manager decision. The
# free-form AI field "recommendation"/"final_recommendation" is deliberately
# excluded — it is generated, not human-authored, and must not override score.
HUMAN_RECOMMENDATION_OVERRIDE_FIELDS: tuple[str, ...] = (
    "recommendation_override",
    "manual_recommendation",
    "recruiter_recommendation",
    "recruiter_decision",
    "hiring_manager_decision",
    "human_recommendation",
    "manual_decision",
)

# If one of these flags is set, a stored recommendation/final_recommendation is
# treated as the human decision rather than an AI artifact.
HUMAN_OVERRIDE_FLAG_FIELDS: tuple[str, ...] = (
    "manual_review_override",
    "human_review_override",
    "recruiter_override_applied",
)

_RECOMMENDATION_ALIASES: dict[str, str] = {
    "STRONG HIRE": Recommendation.STRONG_HIRE.value,
    "STRONG_HIRE": Recommendation.STRONG_HIRE.value,
    "HIRE": Recommendation.HIRE.value,
    "LEAN HIRE": Recommendation.LEAN_HIRE.value,
    "LEAN_HIRE": Recommendation.LEAN_HIRE.value,
    "LEAN NO HIRE": Recommendation.REJECT.value,
    "NO HIRE": Recommendation.REJECT.value,
    "NO_HIRE": Recommendation.REJECT.value,
    "REJECT": Recommendation.REJECT.value,
}


def _normalize_recommendation_label(value: Any) -> str | None:
    """Normalise a stored decision label to a Recommendation enum value."""
    if isinstance(value, dict):
        value = value.get("recommendation") or value.get("value") or value.get("decision")
    if value is None or isinstance(value, bool):
        return None
    label = re.sub(r"[\s\-]+", "_", str(value).strip().upper())
    return _RECOMMENDATION_ALIASES.get(label)


def compute_recommendation(overall_score: float) -> str:
    """Map a 0-100 overall score using RECOMMENDATION_THRESHOLDS.

    >=85 STRONG_HIRE, >=70 HIRE, >=55 LEAN_HIRE, otherwise REJECT. There is no
    path from a high score to REJECT. Callers with no scored answers should
    leave the recommendation null / NOT_EVALUATED instead of calling this.
    """
    score = float(overall_score)
    for threshold, label in RECOMMENDATION_THRESHOLDS:
        if score >= threshold:
            return label
    return Recommendation.REJECT.value


def extract_human_recommendation_override(source: Any) -> str | None:
    """Return an explicit human decision stored on a session/scorecard, if any.

    Documented override fields are checked first. A boolean override flag plus
    a stored recommendation also counts. AI-generated recommendations alone do
    not: those are always replaced by the score-derived value.
    """
    if not isinstance(source, dict):
        return None

    for key in HUMAN_RECOMMENDATION_OVERRIDE_FIELDS:
        normalized = _normalize_recommendation_label(source.get(key))
        if normalized:
            return normalized

    has_override_flag = any(bool(source.get(key)) for key in HUMAN_OVERRIDE_FLAG_FIELDS)
    if has_override_flag:
        for key in ("recommendation", "final_recommendation"):
            normalized = _normalize_recommendation_label(source.get(key))
            if normalized:
                return normalized

    nested = source.get("scorecard")
    if isinstance(nested, dict) and nested is not source:
        return extract_human_recommendation_override(nested)
    return None


def resolve_recommendation(
    overall_score: float,
    *,
    source: Any = None,
    human_override: str | None = None,
) -> str:
    """Single decision path: explicit human override wins, otherwise the score.

    ``source`` is a session or scorecard dict inspected for documented human
    override fields. ``human_override`` is an already-extracted override.
    """
    override = _normalize_recommendation_label(human_override) or extract_human_recommendation_override(source)
    if override:
        return override
    return compute_recommendation(overall_score)


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
