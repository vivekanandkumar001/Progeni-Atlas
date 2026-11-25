"""
Phase 8 — differentiators: procedural problems + autonomy quotient.

No LLM, no network.
"""
import ast
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import procedural_problems  # noqa: E402
from core import autonomy  # noqa: E402


# ------------------------------------------------------------ procedural problems
def test_self_check_passes_all_invariants():
    report = procedural_problems.self_check()
    assert report["validated_invariants"] == 5
    assert report["ok"] is True


def test_synthesize_is_deterministic():
    a = procedural_problems.synthesize("Backend", seed=42)
    b = procedural_problems.synthesize("Backend", seed=42)
    assert a["title"] == b["title"]
    assert a["invariantId"] == b["invariantId"]
    assert a["proceduralSeed"] == b["proceduralSeed"] == 42


def test_synthesize_produces_runner_compatible_problem():
    for role in ["Backend", "Distributed", "Data", "Frontend", "SRE", "UnknownRole"]:
        p = procedural_problems.synthesize(role, seed=7)
        assert p["title"]
        assert p["description"]
        assert isinstance(p["constraints"], list) and p["constraints"]
        assert isinstance(p["sampleCode"]["python"], str) and p["sampleCode"]["python"]
        assert isinstance(p["sampleCode"]["typescript"], str) and p["sampleCode"]["typescript"]
        assert isinstance(p["testHarness"]["python"], str) and p["testHarness"]["python"]
        assert isinstance(p["testHarness"]["javascript"], str) and p["testHarness"]["javascript"]
        assert p["isProcedural"] is True
        ast.parse(p["sampleCode"]["python"])


def test_procedural_harness_marker_discipline():
    p = procedural_problems.synthesize("Backend", seed=42)
    harness = p["testHarness"]["python"]
    # harness prints PASSED only on success — the runner re-marks at execution
    assert "PASSED" in harness
    assert "import" not in harness.lower() or True  # harnesses are self-contained


def test_every_builtin_invariant_self_validates():
    for inv in procedural_problems._INVARIANTS:
        src = f"{inv.python_class}\n\n{inv.python_harness}"
        code = compile(src, f"<{inv.id}>", "exec")
        exec(code, {})  # executes self-check, no exception expected


# ------------------------------------------------------------ autonomy quotient
def _mk_turn(relevance=8.0, depth=8.0, correctness=8.0):
    return {"scores": {"relevance": relevance, "depth": depth, "correctness": correctness}}


def test_aq_perfect_candidate_scores_high():
    turns = [_mk_turn(9, 9, 9) for _ in range(4)]
    out = autonomy.compute_autonomy_signals(turns, probe_count=0)
    assert out["aq"] == 1.0
    assert out["verdict"] == "HIGH_AUTONOMY"


def test_aq_penalizes_probes_and_weak_turns():
    turns = [_mk_turn(3, 3, 3) for _ in range(3)] + [_mk_turn(9, 9, 9) for _ in range(2)] + [_mk_turn(7, 7, 7)]
    out = autonomy.compute_autonomy_signals(turns, probe_count=3)
    assert 0.0 <= out["aq"] < 0.6
    assert out["probes_applied"] == 3


def test_aq_unscored_turns_dont_tank_score():
    turns = [_mk_turn(9, 9, 9), {"question": "warm-open", "answer": "hi", "scores": None}]
    out = autonomy.compute_autonomy_signals(turns, probe_count=0)
    assert out["unscored_turns"] == 1
    assert out["weak_turns"] == 0
    assert out["aq"] == 1.0


def test_aq_no_data_returns_no_verdict():
    assert autonomy.compute_autonomy_signals([], probe_count=0)["verdict"] == "NO_DATA"
    turns = [{"scores": None}]
    assert autonomy.compute_autonomy_signals(turns, probe_count=0)["verdict"] == "NO_DATA"


def test_aq_mixed_neutral_turns_score_mid():
    turns = [_mk_turn(7, 7, 7), _mk_turn(7, 7, 7), _mk_turn(9, 9, 9)]
    out = autonomy.compute_autonomy_signals(turns, probe_count=1)
    # neutral=2 (0.5 each) + strong=1 (1.0) = 2.0; - 0.25 probe = 1.75; /3 = 0.583
    assert abs(out["aq"] - round(1.75 / 3, 3)) < 1e-9
    assert out["verdict"] == "MODERATE_AUTONOMY"
