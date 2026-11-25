"""Regression coverage for the four production QA backend defects.

No database, network, LLM or Cloudinary calls are made here.
"""
import importlib.util
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, g  # noqa: E402

from core import wallet as wallet_core  # noqa: E402
from core.aptitude_bank import APTITUDE_QUESTIONS_CATALOG  # noqa: E402
from core.aptitude_generator import validate_question_item  # noqa: E402
from core.aptitude_families import FAMILIES, render_family_item  # noqa: E402
from routes import aptitude_routes, billing_routes, candidate_routes  # noqa: E402


# ---------------------------------------------------------------------------
# Aptitude item quality
# ---------------------------------------------------------------------------

def _question(**overrides):
    item = {
        "id": "qa-item",
        "section": "quantitative",
        "topic": "QA regression",
        "difficulty": "medium",
        "prompt": "A reported production question with enough context to validate it.",
        "options": ["8 days", "10 days", "12 days", "14 days"],
        "correctIndex": 0,
        "explanation": "The answer is 8 days.",
    }
    item.update(overrides)
    return item


def test_reported_duplicate_rupee_options_are_rejected():
    ok, errors = validate_question_item(_question(
        options=["₹512", "₹480", "₹ 512", "₹600"],
        explanation="₹512 is the correct amount.",
    ))
    assert not ok
    assert "duplicate_options" in errors


def test_reported_duplicate_ratio_options_are_rejected():
    ok, errors = validate_question_item(_question(
        options=["1 : 1", "2 : 3", "200 : 200", "3 : 5"],
        explanation="The ratio is 1 : 1.",
    ))
    assert not ok
    assert "duplicate_options" in errors


def test_derivation_must_resolve_to_keyed_days():
    bad = _question(explanation=(
        "A works at 1/10 and B at 1/15 per day. Together they work 3 days, "
        "leaving 1 - 3(1/10 + 1/15) = 0.5. B finishes in 0.5 / (1/15) = 8.50 days."
    ))
    ok, errors = validate_question_item(bad)
    assert not ok
    assert "derivation_final_answer_mismatch" in errors

    good = _question(explanation=(
        "A works at 1/10 and B at 1/15 per day. Together they work 3 days, "
        "leaving 1 - 3(1/10 + 1/15) = 0.5. B finishes in 0.5 / (1/15) = 8 days."
    ))
    assert validate_question_item(good)[0] is True


def test_derivation_must_resolve_to_keyed_percentage():
    bad = _question(
        options=["27.50%", "30.00%", "25.00%", "32.00%"],
        explanation=(
            "Factor = 1.10 x 0.85 = 0.935. Net change = (0.935 - 1) x 100 "
            "= -6.50%. Successive effect is 30.00%."
        ),
    )
    ok, errors = validate_question_item(bad)
    assert not ok
    assert "derivation_final_answer_mismatch" in errors


def test_reported_nonsense_syllogism_options_are_rejected():
    item = _question(
        id="fam-syllogism#qa",
        section="logical",
        topic="Syllogism & Deduction",
        familyId="fam-syllogism",
        prompt=(
            "Statements: All managers are engineers. Some programmers are managers. "
            "Conclusions: which conclusion follows?"
        ),
        options=[
            "All programmers are trucks.",
            "Some engineers are teslas.",
            "No engineer is an artist matches.",
            "Some programmers may not be managers.",
        ],
        correctIndex=3,
        explanation="Only managers are engineers, so programmers need not be managers.",
    )
    ok, errors = validate_question_item(item)
    assert not ok
    assert "implausible_nonsense_option" in errors
    assert "option_term_not_in_prompt" in errors


def test_static_bank_and_all_parameterized_families_render_valid_items():
    assert all(validate_question_item(item)[0] for item in APTITUDE_QUESTIONS_CATALOG)
    for family in FAMILIES:
        for seed in range(60):
            item = render_family_item(family, f"regression-{family['id']}-{seed}")
            assert validate_question_item(item)[0], (family["id"], seed)


def test_assemble_helper_never_returns_invalid_items(monkeypatch):
    invalid = _question(options=["A", "A", "C", "D"])
    valid = _question()
    monkeypatch.setattr(
        aptitude_routes, "assemble_session_questions",
        lambda *a, **k: [invalid, valid],
    )
    paper = aptitude_routes._assemble_validated_paper(
        "template-campus-general", "cand-1", None, "seed", 2
    )
    assert paper == [valid]
    assert all(validate_question_item(item)[0] for item in paper)


def test_legacy_session_state_drops_invalid_public_questions():
    bad = _question(id="bad", options=["A", "A", "C", "D"])
    good = _question(id="good")
    secret = {
        "correctIndex": 0,
        "explanation": "The answer is 8 days.",
        "section": "quantitative",
        "topic": "QA regression",
    }
    doc = {
        "questions": [bad, good],
        "serverSecretAnswers": {"bad": secret, "good": secret},
    }
    assert aptitude_routes._servable_public_questions(doc) == [good]


# ---------------------------------------------------------------------------
# Opt-in Mongo cleanup script
# ---------------------------------------------------------------------------

def _load_cleanup_module():
    path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "scripts", "clean_invalid_aptitude_questions.py",
    )
    spec = importlib.util.spec_from_file_location("clean_invalid_aptitude_questions", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_cleanup_script_uses_shared_validator_and_requires_explicit_apply():
    module = _load_cleanup_module()
    valid = _question(id="good")
    invalid = _question(id="bad", options=["₹512", "₹480", "₹ 512", "₹600"])
    db = MagicMock()
    db[module.SOURCE_COLLECTION].find.return_value = [valid, invalid]
    db[module.SOURCE_COLLECTION].count_documents.return_value = 2
    db[module.SOURCE_COLLECTION].delete_one.return_value.deleted_count = 1

    invalid_rows = module.find_invalid_questions(db)
    assert [row["doc"]["id"] for row in invalid_rows] == ["bad"]
    assert "duplicate_options" in invalid_rows[0]["errors"]

    quarantined, removed = module.quarantine_and_remove(db, invalid_rows)
    assert (quarantined, removed) == (1, 1)
    assert db[module.QUARANTINE_COLLECTION].update_one.call_count == 1
    assert db[module.SOURCE_COLLECTION].delete_one.call_count == 1


# ---------------------------------------------------------------------------
# Resume proxy (owner-only, same-origin)
# ---------------------------------------------------------------------------

def test_resume_url_is_same_origin_and_owner_only():
    doc = {"id": "res-1", "candidate_id": "cand-1", "candidate_email": "c@example.com",
           "file_url": "https://res.cloudinary.com/acme/raw/authenticated/v123/resumes/resume.pdf"}
    assert candidate_routes.resume_proxy_url(doc) == "/api/candidate/resume/res-1/file"
    assert candidate_routes._user_owns_resume(doc, {"id": "cand-1"}) is True
    assert candidate_routes._user_owns_resume(doc, {"email": "C@EXAMPLE.COM"}) is True
    assert candidate_routes._user_owns_resume(doc, {"id": "someone-else"}) is False
    assert candidate_routes._user_owns_resume(doc, {"id": "admin", "role": "super_admin"}) is True


def test_cloudinary_public_id_parsing():
    # Raw assets keep the filename in the public ID; Cloudinary's signed
    # download API must not be given a stripped stem plus a format.
    assert candidate_routes._cloudinary_public_id(
        "https://res.cloudinary.com/acme/raw/authenticated/v123/resumes/cv_abcd.pdf"
    ) == ("resumes/cv_abcd.pdf", "")
    assert candidate_routes._cloudinary_public_id(
        "https://res.cloudinary.com/acme/raw/authenticated/s--WvMDvMAp--/v1/resumes/owner/cv_abcd.pdf"
    ) == ("resumes/owner/cv_abcd.pdf", "")
    assert candidate_routes._cloudinary_public_id(
        "https://res.cloudinary.com/acme/image/authenticated/v123/avatars/profile.jpg"
    ) == ("avatars/profile", "jpg")
    assert candidate_routes._cloudinary_public_id(
        "https://example.com/private.pdf"
    ) is None


def test_signed_resume_url_reads_cloudinary_url_env(monkeypatch):
    import types

    fake_cloudinary = types.ModuleType("cloudinary")
    fake_utils = types.ModuleType("cloudinary.utils")
    configured = {}
    signed_call = {}
    fake_cloudinary.config = lambda **kwargs: configured.update(kwargs)
    fake_cloudinary.utils = fake_utils

    def _private_download_url(*args, **kwargs):
        signed_call["args"] = args
        signed_call["kwargs"] = kwargs
        return "https://signed.example/resume"

    fake_utils.private_download_url = _private_download_url
    monkeypatch.setitem(sys.modules, "cloudinary", fake_cloudinary)
    monkeypatch.setitem(sys.modules, "cloudinary.utils", fake_utils)

    for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("CLOUDINARY_URL", "cloudinary://qa-key:qa-secret@qa-cloud")

    assert candidate_routes._signed_cloudinary_url(
        "https://res.cloudinary.com/qa-cloud/raw/authenticated/v1/resumes/cv.pdf"
    ) == "https://signed.example/resume"
    assert configured == {"cloud_name": "qa-cloud", "api_key": "qa-key", "api_secret": "qa-secret", "secure": True}
    assert signed_call["args"] == ("resumes/cv.pdf", "")
    assert signed_call["kwargs"]["resource_type"] == "raw"
    assert signed_call["kwargs"]["type"] == "authenticated"


def test_resume_download_refuses_non_owner(monkeypatch):
    app = Flask(__name__)
    db = MagicMock()
    db.candidate_resumes.find_one.return_value = {
        "id": "res-1", "candidate_id": "owner", "file_url": "/uploads/resumes/res-1.pdf",
    }
    monkeypatch.setattr(candidate_routes, "get_mongo_db", lambda: db)
    with app.test_request_context("/api/candidate/resume/res-1/file"):
        g.user = {"id": "intruder", "role": "candidate"}
        response, code = candidate_routes.download_candidate_resume_file.__wrapped__("res-1")
    assert code == 404
    assert "not accessible" in response.get_json()["error"]


# ---------------------------------------------------------------------------
# Wallet quota / canonical rate
# ---------------------------------------------------------------------------

def _wallet_db(completed_demos=2):
    db = MagicMock()
    db.platform_settings.find_one.return_value = {
        "is_free_quotas_enabled": True,
        "default_free_demo_count": 2,
        "max_demo_duration_seconds": 900,
    }
    db.organizations.find_one.return_value = None
    db.interview_sessions.count_documents.return_value = completed_demos
    return db


def test_demo_quota_is_derived_from_user_sessions_and_policy():
    quota = wallet_core.get_demo_quota(
        {"id": "cand-1", "email": "c@example.com"}, _wallet_db(2)
    )
    assert quota["totalAllowed"] == 2
    assert quota["completed"] == 2
    assert quota["remaining"] == 0
    assert quota["maxDurationSeconds"] == 900
    assert quota["free_demos_remaining"] == 0


def test_canonical_rate_and_floor_rounding():
    rate = wallet_core.get_wallet_rate()
    assert rate["creditsPerRupee"] == 1.0
    assert rate["creditsPerMinute"] == 0.5
    assert rate["minutesPerCredit"] == 2.0
    assert wallet_core.credits_from_inr(2.5) == 2.5
    assert wallet_core.display_whole_credits(2.5) == 2
    assert wallet_core.display_whole_credits(127.5) == 127


def test_billing_wallet_exposes_canonical_rate_and_same_quota(monkeypatch):
    app = Flask(__name__)
    db = _wallet_db(2)
    db.wallets.find_one.return_value = {
        "availableCredits": 2.5,
        "lowBalanceThresholdCredits": 5.0,
        "accountType": "CANDIDATE",
    }
    monkeypatch.setattr(billing_routes, "get_mongo_db", lambda: db)
    with app.test_request_context("/api/billing/wallet"):
        g.user = {"id": "cand-1", "email": "c@example.com", "role": "candidate"}
        response, code = billing_routes.get_billing_wallet.__wrapped__()
    assert code == 200
    payload = response.get_json()["wallet"]
    assert payload["demoQuota"]["remaining"] == 0
    assert payload["rate"]["creditsPerMinute"] == 0.5
    assert payload["ratePerMinuteCredits"] == 0.5
    assert payload["availableCredits"] == 2.5
    assert payload["availableCreditsWhole"] == 2


def test_dashboard_uses_the_same_demo_quota_helper(monkeypatch):
    quota = {
        "totalAllowed": 2, "completed": 2, "remaining": 0,
        "maxDurationSeconds": 900, "free_demos_total": 2,
        "free_demos_used": 2, "free_demos_remaining": 0,
        "demo_duration_limit_minutes": 15,
    }
    monkeypatch.setattr(candidate_routes, "get_demo_quota", lambda user, db: quota)
    monkeypatch.setattr(candidate_routes, "_load_practice_sessions", lambda uid: [])
    monkeypatch.setattr(candidate_routes, "get_current_candidate", lambda req: (None, None, []))
    app = Flask(__name__)
    db = MagicMock()
    db.interview_sessions.find_one.return_value = None
    db.candidate_notifications.count_documents.return_value = 0
    monkeypatch.setattr(candidate_routes, "get_mongo_db", lambda: db)
    with app.test_request_context("/api/candidate/dashboard"):
        g.user = {"id": "cand-1", "email": "c@example.com", "role": "candidate"}
        response = candidate_routes.get_candidate_dashboard_data.__wrapped__()
    payload = response.get_json()
    assert payload["free_demos_remaining"] == 0
    assert payload["free_demos_used"] == 2
    assert payload["demoQuota"]["remaining"] == 0
