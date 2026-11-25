"""
Progeni Atlas — Autonomy Quotient (AQ) heuristic
=================================================
A single 0..1 signal per interview: how independently the candidate worked.
Purely derived from existing turn telemetry (no new capture, no biometrics):

  AQ = clamp( (sum of per-turn weights) / (total turns), 0..1 )

Per turn:
  +1.0  strong turn (all of relevance/depth/correctness >= 7.5)
  +0.5  neutral turn
   0.0  weak turn (avg < 5.0) or timeout/insufficient placeholder
  -0.25 per applied AI nudge (probe) — capped at one per turn

The result is a *signal for the recruiter*, never a verdict for the candidate,
and never shown to the candidate as a number.
"""

from __future__ import annotations

from typing import Any, Optional


def _turn_scores(turn: dict[str, Any]) -> tuple[Optional[float], Optional[float], Optional[float]]:
    s = turn.get("scores") if isinstance(turn.get("scores"), dict) else {}
    def _f(key):
        v = s.get(key)
        try:
            return max(0.0, min(10.0, float(v)))
        except (TypeError, ValueError):
            return None
    return _f("relevance"), _f("depth"), _f("correctness")


def compute_autonomy_signals(turn_history: list[dict[str, Any]], *, probe_count: int = 0) -> dict[str, Any]:
    """Return AQ + supporting evidence refs. Deterministic, never LLM."""
    total = len(turn_history)
    if total == 0:
        return {
            "aq": None,
            "strong_turns": 0,
            "weak_turns": 0,
            "neutral_turns": 0,
            "unscored_turns": 0,
            "probes_applied": int(probe_count),
            "verdict": "NO_DATA",
        }

    strong = neutral = weak = unscored = 0
    for t in turn_history:
        rel, dep, cor = _turn_scores(t)
        if rel is None and dep is None and cor is None:
            unscored += 1
            continue
        if rel is None or dep is None or cor is None:
            weak += 1
            continue
        avg = (rel + dep + cor) / 3.0
        if rel >= 7.5 and dep >= 7.5 and cor >= 7.5:
            strong += 1
        elif avg < 5.0:
            weak += 1
        else:
            neutral += 1

    scored_total = strong + neutral + weak
    if scored_total == 0:
        return {
            "aq": None,
            "strong_turns": 0,
            "weak_turns": 0,
            "neutral_turns": 0,
            "unscored_turns": unscored,
            "probes_applied": int(probe_count),
            "verdict": "NO_DATA",
        }

    raw = (strong * 1.0 + neutral * 0.5) - (0.25 * min(int(probe_count), scored_total))
    aq = max(0.0, min(1.0, raw / scored_total))

    if aq >= 0.80:
        verdict = "HIGH_AUTONOMY"
    elif aq >= 0.55:
        verdict = "MODERATE_AUTONOMY"
    else:
        verdict = "GUIDED_AUTONOMY"

    return {
        "aq": round(aq, 3),
        "strong_turns": strong,
        "weak_turns": weak,
        "neutral_turns": neutral,
        "unscored_turns": unscored,
        "probes_applied": int(probe_count),
        "verdict": verdict,
    }
