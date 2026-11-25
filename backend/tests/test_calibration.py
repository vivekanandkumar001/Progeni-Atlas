"""
Phase 5 — calibration engine unit tests.

No DB, no LLM, no network.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import calibration  # noqa: E402


def test_extract_pass_vector_nested_and_flat():
    flat = {"relevance": 8, "depth": 7, "correctness": 9, "overall": 80}
    v = calibration.extract_pass_vector(flat)
    assert v["relevance"] == 8.0
    assert v["depth"] == 7.0
    assert v["correctness"] == 9.0
    # "overall" in 0-10 scale only accepted; 80 rejected
    assert v["overall"] is None


def test_extract_pass_vector_nested_scores():
    nested = {"scores": {"relevance": 9, "depth": 8.5}, "notes": "hi"}
    v = calibration.extract_pass_vector(nested)
    assert v["relevance"] == 9.0
    assert v["depth"] == 8.5
    assert v["correctness"] is None


def test_extract_pass_vector_aliases():
    aliased = {"technical_depth": 8, "system_architecture": 7, "problem_solving": 6}
    v = calibration.extract_pass_vector(aliased)
    assert v["technicalDepth"] == 8.0
    assert v["systemArchitecture"] == 7.0
    assert v["problemSolving"] == 6.0


def test_pearson_perfect_and_noise():
    assert calibration.pearson([1, 2, 3, 4], [1, 2, 3, 4]) == 1.0
    r = calibration.pearson([1, 2, 1, 2], [2, 1, 2, 1])
    assert r is not None and r < 0.0
    assert calibration.pearson([1, 1, 1], [2, 3, 4]) is None
    assert calibration.pearson([], []) is None


def test_icc_2_1_perfect_and_bad():
    good = [[8, 8], [7, 7], [9, 9], [6, 6], [5, 5]]
    bad = [[8, 2], [7, 3], [9, 1], [6, 10], [5, 4]]
    good_icc = calibration.icc_2_1(good)
    bad_icc = calibration.icc_2_1(bad)
    assert good_icc is not None and good_icc > 0.9
    assert bad_icc is not None and bad_icc < good_icc


def test_icc_requires_three_rows_and_two_cols():
    assert calibration.icc_2_1([[1, 1], [2, 2]]) is None
    assert calibration.icc_2_1([[1], [2], [3]]) is None


def test_compute_calibration_insufficient_data():
    report = calibration.compute_calibration([
        {"id": "s1", "rating_pass_a": {"relevance": 8}, "rating_pass_b": {"relevance": 7}},
    ])
    assert report["verdict"] == "INSUFFICIENT_DATA"
    assert report["dual_rated"] == 1
    assert report["ready_for_launch_claim"] is False


def test_compute_calibration_perfect_agreement():
    sessions = [
        {"id": f"s{i}", "rating_pass_a": {"relevance": i, "depth": i, "systemArchitecture": i},
                        "rating_pass_b": {"relevance": i, "depth": i, "systemArchitecture": i}}
        for i in range(1, 7)
    ]
    report = calibration.compute_calibration(sessions)
    assert report["dual_rated"] == 6
    assert report["verdict"] in ("CALIBRATED", "INSUFFICIENT_DATA")
    if report["per_dimension"]["relevance"]["icc_2_1"] is not None:
        assert report["per_dimension"]["relevance"]["icc_2_1"] > 0.5
    else:
        assert report["dual_rated"] >= 4


def test_compute_calibration_noise_drifts():
    sessions = [
        {"id": f"s{i}", "rating_pass_a": {"relevance": i, "depth": i},
                        "rating_pass_b": {"relevance": (i * 7) % 10 + 1, "depth": (i * 5) % 10 + 1}}
        for i in range(1, 9)
    ]
    report = calibration.compute_calibration(sessions)
    assert report["dual_rated"] == 8
    # noisy agreement must not claim CALIBRATED
    assert report["verdict"] in ("INSUFFICIENT_DATA", "CALIBRATION_DRIFT")


def test_compute_calibration_ignores_unusable_sessions():
    report = calibration.compute_calibration([
        {"id": "ok", "rating_pass_a": {"relevance": 8}, "rating_pass_b": {"relevance": 8}},
        {"id": "no-a"},
        {"id": "no-b", "rating_pass_a": {"relevance": 5}},
        {"id": "garbage", "rating_pass_a": "not-a-dict", "rating_pass_b": "nope"},
    ])
    assert report["dual_rated"] == 1


def test_second_pass_dimensions_picks_weakest_two():
    from core.scoring_contract import second_pass_dimensions
    comps = [
        {"competency": "technicalDepth", "score": 82},
        {"competency": "systemArchitecture", "score": 40},
        {"competency": "communication", "score": 66},
        {"competency": "problemSolving", "score": 55},
    ]
    dims = second_pass_dimensions(comps)
    assert dims == ["systemArchitecture", "problemSolving"]


def test_second_pass_scale_guard_normalizes_0_to_4_anchors(monkeypatch):
    import json
    import sys
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.services import llm_service

    monkeypatch.setattr(
        llm_service,
        "_chat",
        lambda *a, **k: (json.dumps({"dimensions": {"technicalDepth": {"score": 3, "rationale": "strong"}}}), "google/gemini-3.5-flash-lite"),
    )
    out, model = llm_service.generate_scorecard_second_pass(
        job_title="Backend Engineer",
        candidate_name="Candidate",
        transcript=[{"question": "q", "answer": "a"}],
        competencies=[{"competency": "technicalDepth", "score": 90}, {"competency": "systemArchitecture", "score": 40}],
    )
    assert out["technicalDepth"]["score"] == 75.0
    assert out["technicalDepth"]["scale_normalized"] == "0_to_4_to_0_to_100_x25"


def test_second_pass_dimensions_empty():
    from core.scoring_contract import second_pass_dimensions
    assert second_pass_dimensions([]) == []
    assert second_pass_dimensions([{"competency": "", "score": "bad"}]) == []
