"""
Progeni Atlas — Interview Arc
=============================
Structured, human-style arc for the AI interview.

A real Staff Engineer's 1-on-1 has a shape: warm open → rapport → deep
technical core → human/behavioral signal → the candidate's own questions →
a warm close. The arc makes that shape a first-class part of the product
instead of four hard-wired "system design" turns.

Each phase carries a goal, a time budget, and the evidence it is meant to
collect. The live interview uses these phases to:
  * label the current stage in the UI ("Round 3 of 6 — Technical Core"),
  * calibrate the LLM assessment against the candidate's level,
  * decide which turns are scored vs conversational (warm open, candidate
    questions, close are never scored),
  * steer question generation.

The arc is intentionally role-agnostic at the phase level and role/level
specific at the question level.
"""

from __future__ import annotations

# --------------------------------------------------------------------------- #
# Phase definitions
# --------------------------------------------------------------------------- #

WARM_OPEN = "warm_open"
RAPPORT = "rapport"
TECHNICAL_CORE = "technical_core"
BEHAVIORAL = "behavioral"
CANDIDATE_QUESTIONS = "candidate_questions"
CLOSE = "close"

PHASE_DEFS: dict[str, dict] = {
    WARM_OPEN: {
        "id": WARM_OPEN,
        "label": "Warm Open",
        "goal": "Put the candidate at ease, verify audio/video conversationally, and set the tone.",
        "minutes": 0.75,
        "scored": False,
    },
    RAPPORT: {
        "id": RAPPORT,
        "label": "Context & Background",
        "goal": "Hear the candidate's own narrative — which projects, what they owned, what they're proud of.",
        "minutes": 2.0,
        "scored": True,  # light: relevance/depth observed, not correctness-weighted
    },
    TECHNICAL_CORE: {
        "id": TECHNICAL_CORE,
        "label": "Technical Core",
        "goal": "Role-anchored depth: data structures, systems thinking, trade-offs — calibrated to level.",
        "minutes": 10.0,
        "scored": True,
    },
    BEHAVIORAL: {
        "id": BEHAVIORAL,
        "label": "How You Work",
        "goal": "One STAR story: conflict, failure, ambiguity or disagreement — ownership and maturity.",
        "minutes": 4.0,
        "scored": True,
    },
    CANDIDATE_QUESTIONS: {
        "id": CANDIDATE_QUESTIONS,
        "label": "Your Turn",
        "goal": "Answer the candidate's questions from the role facts — honestly, including 'I'll find out'.",
        "minutes": 2.5,
        "scored": False,
    },
    CLOSE: {
        "id": CLOSE,
        "label": "Wrap Up",
        "goal": "Warm close: gratitude, what happens next, timeline.",
        "minutes": 0.75,
        "scored": False,
    },
}

ARC_ORDER = (WARM_OPEN, RAPPORT, TECHNICAL_CORE, TECHNICAL_CORE, BEHAVIORAL, CANDIDATE_QUESTIONS)

PHASE_STAGE_LABELS = {
    WARM_OPEN: "Warm Open",
    RAPPORT: "Introduction & Background",
    TECHNICAL_CORE: "Technical Deep-Dive",
    BEHAVIORAL: "How You Work",
    CANDIDATE_QUESTIONS: "Your Questions",
    CLOSE: "Wrap Up",
}


def phase_def(phase_id: str) -> dict:
    return PHASE_DEFS.get(phase_id, PHASE_DEFS[TECHNICAL_CORE])


def phase_is_scored(phase_id: str) -> bool:
    return bool(phase_def(phase_id).get("scored", True))


# --------------------------------------------------------------------------- #
# Adaptive difficulty — 1 (campus/junior) .. 5 (staff/principal)
# --------------------------------------------------------------------------- #

LEVEL_LABELS = {
    1: "junior",
    2: "mid",
    3: "mid-to-senior",
    4: "senior",
    5: "staff/principal",
}


def starting_level(seniority: str | None) -> int:
    s = (seniority or "").lower()
    if any(k in s for k in ("staff", "principal", "lead", "architect")):
        return 5
    if any(k in s for k in ("senior", "sr.", "sr ")):
        return 4
    if any(k in s for k in ("junior", "graduate", "campus", "entry", "intern")):
        return 1
    return 2  # mid default


def adjust_difficulty(current: int, turn_scores: dict | None) -> int:
    """Nudge the interview level one step toward the evidence.

    Evidence-based calibration: >= 8.0 average across the three dimensions
    means the bar should rise; <= 4.0 means it is punishing a candidate who
    is trying — drop a level and let them show what they know.
    """
    try:
        level = int(current or 2)
    except (TypeError, ValueError):
        level = 2
    scores = turn_scores or {}
    vals = [scores.get(k) for k in ("relevance", "depth", "correctness") if scores.get(k) is not None]
    if not vals:
        return max(1, min(5, level))
    avg = sum(float(v) for v in vals) / len(vals)
    if avg >= 8.0:
        level += 1
    elif avg <= 4.0:
        level -= 1
    return max(1, min(5, level))


def difficulty_label(level: int) -> str:
    return LEVEL_LABELS.get(int(max(1, min(5, level or 2))), "mid")
