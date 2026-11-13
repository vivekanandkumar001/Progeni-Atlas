"""
Progeni Atlas — Aptitude & Cognitive Testing Blueprint
======================================================
Production-grade REST API powering standardized cognitive screening,
computer-adaptive test assembly, anti-cheating telemetry, zero-leak
opaque payload delivery, and server-authoritative scoring.
"""

import os
import uuid
import time
import traceback
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from flask import Blueprint, request, jsonify, g

from core.db import get_mongo_db
from core.security import (
    _authenticate_request, resolve_user, require_auth
)
from core.context import get_current_candidate
from core.aptitude_bank import (
    APTITUDE_QUESTIONS_CATALOG,
    STANDARD_TEST_TEMPLATES,
    get_template_by_id,
    assemble_session_questions,
    paper_hash,
    rendered_hash,
)

aptitude_bp = Blueprint("aptitude_bp", __name__)


def _get_owned_aptitude_session(session_id: str):
    """
    Resolve an aptitude test session strictly for its owner.
    Returns (doc, user, error_response_or_None).
    """
    user, _, _ = get_current_candidate(request)
    if not user:
        return None, None, (jsonify({"success": False, "error": "Authentication required"}), 401)
    db = get_mongo_db()
    if db is None:
        return None, user, (jsonify({"error": "Database unavailable"}), 503)
    doc = db.aptitude_sessions.find_one({"sessionId": session_id})
    if not doc:
        return None, user, (jsonify({"error": "Aptitude session not found"}), 404)
    uid = str(user.get("id") or user.get("_id") or "")
    role = str(user.get("role", "")).lower()
    cand_id = str(doc.get("candidateId") or "")
    if role in ("admin", "super_admin"):
        return doc, user, None
    if cand_id and cand_id == uid:
        return doc, user, None
    return None, user, (jsonify({"error": "You do not have access to this test session"}), 403)


# ------------------------------------------------------------------------------
# 1. TEMPLATES & CATALOG ENDPOINTS
# ------------------------------------------------------------------------------

@aptitude_bp.route("/api/aptitude/templates", methods=["GET"])
def get_aptitude_templates():
    """Retrieve available standardized test templates and difficulty tiers."""
    try:
        return jsonify({
            "templates": STANDARD_TEST_TEMPLATES,
            "totalAvailableQuestions": len(APTITUDE_QUESTIONS_CATALOG),
            "pillars": [
                {"name": "Quantitative", "description": "Arithmetic, Algebra, Probability, Speed-Distance-Time"},
                {"name": "Logical", "description": "Syllogisms, Arrangements, Coded Relations, Deduction"},
                {"name": "Verbal", "description": "Critical Reading, Grammar, Contextual Vocabulary"},
                {"name": "Data Interpretation", "description": "Tabular Telemetry, Chart Ratios, Multi-variable Analysis"},
                {"name": "Abstract", "description": "Matrix Transformations, Pattern Spatial Reasoning"}
            ]
        }), 200
    except Exception:
        return jsonify({"error": "An unexpected error occurred"}), 500


# ------------------------------------------------------------------------------
# 2. SESSION LIFECYCLE & ZERO-LEAK OPAQUE PAYLOAD DELIVERY
# ------------------------------------------------------------------------------

@aptitude_bp.route("/api/aptitude/sessions/start", methods=["POST"])
def start_aptitude_session():
    """
    Start a new aptitude session with server-authoritative deadline.
    GUARANTEE (Zero-Leak): Response NEVER contains 'correctIndex', 'explanation',
    or 'formula'. Correct answers remain strictly locked on the server.
    """
    try:
        data = request.get_json(silent=True) or {}
        template_id = data.get("templateId", "template-campus-general")

        user, _, _ = get_current_candidate(request)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401
        candidate_id = str(user.get("id") or user.get("_id"))
        candidate_name = user.get("full_name") or user.get("name") or "Candidate"

        template = get_template_by_id(template_id)
        duration_minutes = int(template.get("durationMinutes", 30))
        duration_seconds = duration_minutes * 60

        session_seed = f"{candidate_id}:{uuid.uuid4().hex}"
        session_id = f"apt-{uuid.uuid4().hex[:12]}"

        _db = get_mongo_db()
        # Assemble randomized, exposure-controlled question paper for this candidate.
        raw_questions = assemble_session_questions(
            template_id, candidate_id=candidate_id, db=_db, session_seed=session_seed
        )
        paper = paper_hash(raw_questions)
        try:
            if (
                _db is not None
                and _db.aptitude_sessions.count_documents(
                    {"candidateId": candidate_id, "paperHash": paper}, limit=1
                )
                > 0
            ):
                # astronomically rare with parameterized items — reseed and try again
                session_seed = session_seed + ":retry"
                raw_questions = assemble_session_questions(
                    template_id, candidate_id=candidate_id, db=_db, session_seed=session_seed
                )
                paper = paper_hash(raw_questions)
        except Exception:
            pass

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=duration_seconds + 15)  # 15s grace buffer for latency

        # Sanitize questions for candidate (ZERO LEAKS: strip correctIndex & explanation)
        public_questions = []
        server_secret_answers = {}

        for idx, q in enumerate(raw_questions):
            q_id = q.get("id") or f"q-{idx+1}"
            server_secret_answers[q_id] = {
                "correctIndex": q.get("correctIndex", 0),
                "explanation": q.get("explanation", ""),
                "formula": q.get("formula", ""),
                "section": q.get("section", "General"),
                "topic": q.get("topic", "Aptitude"),
                "difficulty": q.get("difficulty", "medium"),
                "timeRecommendedSeconds": q.get("timeRecommendedSeconds", 60)
            }
            public_questions.append({
                "id": q_id,
                "index": idx + 1,
                "section": q.get("section", "General"),
                "topic": q.get("topic", "Aptitude"),
                "difficulty": q.get("difficulty", "medium"),
                "prompt": q.get("prompt", ""),
                "options": q.get("options", []),
                "timeRecommendedSeconds": q.get("timeRecommendedSeconds", 60)
            })

        session_doc = {
            "sessionId": session_id,
            "candidateId": candidate_id,
            "candidateName": candidate_name,
            "templateId": template_id,
            "templateTitle": template.get("title", "Aptitude Assessment"),
            "status": "in_progress",
            "durationMinutes": duration_minutes,
            "durationSeconds": duration_seconds,
            "startedAt": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "questions": public_questions,
            "paperHash": paper,
            "serverSecretAnswers": server_secret_answers,
            "answers": {},
            "telemetry": {
                "tabSwitchCount": 0,
                "fullscreenExitCount": 0,
                "devtoolsOpenedCount": 0,
                "copyPasteAttempts": 0,
                "unfocusedSeconds": 0,
                "violations": []
            },
            "scorecard": None
        }

        db = get_mongo_db()
        if db is not None:
            try:
                db.aptitude_sessions.insert_one(session_doc)
            except Exception as insert_err:
                print(f"[Aptitude] session insert warning: {insert_err}")
            # Record per-user exposure — item caps and paper uniqueness are
            # enforced at assembly time from this ledger.
            try:
                usage_rows = []
                for slot_idx, q in enumerate(raw_questions):
                    usage_rows.append({
                        "userId": candidate_id,
                        "itemId": q.get("id"),
                        "familyId": q.get("familyId") or f"static:{q.get('id')}",
                        "renderedHash": q.get("renderedHash") or rendered_hash(str(q.get("prompt", ""))),
                        "sessionId": session_id,
                        "templateId": template_id,
                        "slotIndex": slot_idx,
                        "paperHash": paper,
                        "usedAt": now,
                    })
                if usage_rows:
                    db.aptitude_question_usage.insert_many(usage_rows)
            except Exception as usage_err:
                print(f"[Aptitude] usage ledger write warning: {usage_err}")

        return jsonify({
            "sessionId": session_id,
            "template": template,
            "questions": public_questions,
            "durationSeconds": duration_seconds,
            "startedAt": now.isoformat(),
            "expiresAt": expires_at.isoformat()
        }), 201

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@aptitude_bp.route("/api/aptitude/sessions/<session_id>", methods=["GET"])
def get_aptitude_session_state(session_id):
    """Retrieve active test session state with server-authoritative remaining time."""
    try:
        doc, user, err = _get_owned_aptitude_session(session_id)
        if err:
            return err
        db = get_mongo_db()

        now = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(doc["expiresAt"].replace("Z", "+00:00"))
        remaining_seconds = max(0, int((expires_at - now).total_seconds()))

        # If expired and still marked in_progress, trigger auto-submit
        if remaining_seconds <= 0 and doc.get("status") == "in_progress":
            _finalize_aptitude_scoring(doc, db)
            doc = db.aptitude_sessions.find_one({"sessionId": session_id})

        return jsonify({
            "sessionId": session_id,
            "templateId": doc.get("templateId"),
            "templateTitle": doc.get("templateTitle"),
            "status": doc.get("status"),
            "remainingSeconds": remaining_seconds,
            "questions": doc.get("questions", []),
            "answers": doc.get("answers", {}),
            "telemetry": doc.get("telemetry", {}),
            "scorecard": doc.get("scorecard")
        }), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


# ------------------------------------------------------------------------------
# 3. INTERACTIVE ANSWER SUBMISSION & ANOMALY LOGGING
# ------------------------------------------------------------------------------

@aptitude_bp.route("/api/aptitude/sessions/<session_id>/answer", methods=["POST"])
def submit_aptitude_answer(session_id):
    """
    Save candidate answer for a specific question.
    Validates server deadline to prevent post-expiry tamper.
    """
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503

        doc, user, err = _get_owned_aptitude_session(session_id)
        if err:
            return err

        if doc.get("status") != "in_progress":
            return jsonify({"error": "Test session is already closed", "status": doc.get("status")}), 400

        # Check server deadline
        now = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(doc["expiresAt"].replace("Z", "+00:00"))
        if now > expires_at:
            _finalize_aptitude_scoring(doc, db)
            return jsonify({"error": "Exam time has expired", "status": "completed"}), 403

        payload = request.get_json(silent=True) or {}
        question_id = str(payload.get("questionId", ""))
        selected_index = payload.get("selectedOptionIndex")  # int or None
        marked_review = bool(payload.get("isMarkedForReview", False))
        time_spent = float(payload.get("timeSpentSeconds", 0.0))

        if not question_id:
            return jsonify({"error": "questionId is required"}), 400

        # Update answer state in session
        current_answers = doc.get("answers", {})
        current_answers[question_id] = {
            "selectedOptionIndex": selected_index,
            "isMarkedForReview": marked_review,
            "timeSpentSeconds": round(time_spent, 1),
            "answeredAt": now.isoformat()
        }

        db.aptitude_sessions.update_one(
            {"sessionId": session_id},
            {"$set": {"answers": current_answers, "lastActivityAt": now.isoformat()}}
        )

        return jsonify({
            "success": True,
            "questionId": question_id,
            "isAnswered": selected_index is not None,
            "isMarkedForReview": marked_review
        }), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@aptitude_bp.route("/api/aptitude/sessions/<session_id>/violation", methods=["POST"])
def log_aptitude_violation(session_id):
    """
    Log anti-cheat telemetry: tab switches, fullscreen exit, DevTools, or copy-paste.
    Computes real-time integrity penalties.
    """
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503

        doc, user, err = _get_owned_aptitude_session(session_id)
        if err:
            return err

        payload = request.get_json(silent=True) or {}
        violation_type = str(payload.get("type", "TAB_SWITCH")).upper()
        details = str(payload.get("details", ""))
        now = datetime.now(timezone.utc)

        telemetry = doc.get("telemetry", {
            "tabSwitchCount": 0,
            "fullscreenExitCount": 0,
            "devtoolsOpenedCount": 0,
            "copyPasteAttempts": 0,
            "unfocusedSeconds": 0,
            "violations": []
        })

        if "TAB_SWITCH" in violation_type or "BLUR" in violation_type:
            telemetry["tabSwitchCount"] = telemetry.get("tabSwitchCount", 0) + 1
        elif "FULLSCREEN" in violation_type:
            telemetry["fullscreenExitCount"] = telemetry.get("fullscreenExitCount", 0) + 1
        elif "DEVTOOLS" in violation_type:
            telemetry["devtoolsOpenedCount"] = telemetry.get("devtoolsOpenedCount", 0) + 1
        elif "COPY" in violation_type or "PASTE" in violation_type:
            telemetry["copyPasteAttempts"] = telemetry.get("copyPasteAttempts", 0) + 1

        telemetry["violations"].append({
            "type": violation_type,
            "details": details,
            "timestamp": now.isoformat()
        })

        # Auto-terminate if violations exceed threshold (e.g. 5 tab switches or active devtools)
        terminate = False
        if telemetry.get("tabSwitchCount", 0) >= 5 or telemetry.get("devtoolsOpenedCount", 0) >= 2:
            terminate = True

        update_fields = {"telemetry": telemetry}
        if terminate:
            update_fields["status"] = "terminated"
            update_fields["terminatedReason"] = "Exceeded anti-cheating violation threshold."

        db.aptitude_sessions.update_one(
            {"sessionId": session_id},
            {"$set": update_fields}
        )

        return jsonify({
            "success": True,
            "totalTabSwitches": telemetry.get("tabSwitchCount", 0),
            "isTerminated": terminate
        }), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


# ------------------------------------------------------------------------------
# 4. SUBMISSION, SCORING & COGNITIVE RADAR EVALUATION
# ------------------------------------------------------------------------------

def _finalize_aptitude_scoring(doc: dict, db) -> dict:
    """Internal server-side grading engine executing 5-pillar cognitive analytics."""
    secret_answers = doc.get("serverSecretAnswers", {})
    candidate_answers = doc.get("answers", {})
    telemetry = doc.get("telemetry", {})
    public_questions = {q.get("id"): q for q in doc.get("questions", [])}

    total_questions = len(secret_answers)
    attempted_count = 0
    correct_count = 0
    incorrect_count = 0

    section_stats: Dict[str, Dict[str, Any]] = {}
    question_review_items = []

    # Template context — needed for negative-marking math & benchmark line
    from core.aptitude_bank import get_template_by_id

    template_id = doc.get("templateId")
    template = get_template_by_id(template_id) if template_id else None
    template_title = (template or {}).get("title") or doc.get("templateTitle") or "Aptitude Assessment"
    benchmark_score = float((template or {}).get("benchmarkScore", 60.0))
    negative_marking = bool((template or {}).get("negativeMarking", False))

    for q_id, secret in secret_answers.items():
        sec = secret.get("section", "General")
        pub_q = public_questions.get(q_id, {})
        if sec not in section_stats:
            section_stats[sec] = {"total": 0, "attempted": 0, "correct": 0, "timeSpent": 0.0}

        section_stats[sec]["total"] += 1

        cand_ans = candidate_answers.get(q_id, {})
        sel_idx = cand_ans.get("selectedOptionIndex")
        time_spent = float(cand_ans.get("timeSpentSeconds", 0.0))
        section_stats[sec]["timeSpent"] += time_spent

        is_correct = False
        is_attempted = sel_idx is not None

        if is_attempted:
            attempted_count += 1
            section_stats[sec]["attempted"] += 1
            if int(sel_idx) == int(secret["correctIndex"]):
                correct_count += 1
                section_stats[sec]["correct"] += 1
                is_correct = True
            else:
                incorrect_count += 1

        question_review_items.append({
            "id": q_id,
            "section": sec,
            "topic": secret.get("topic", "General"),
            "prompt": pub_q.get("prompt", ""),
            "options": pub_q.get("options", []),
            "difficulty": secret.get("difficulty", "medium"),
            "selectedOptionIndex": sel_idx,
            "correctIndex": secret["correctIndex"],
            "isCorrect": is_correct,
            "isAttempted": is_attempted,
            "timeSpentSeconds": time_spent,
            "explanation": secret.get("explanation", ""),
            "formula": secret.get("formula", "")
        })

    # Accuracy and Scored Percentage (with negative marking when the template demands it)
    accuracy_pct = round((correct_count / max(1, attempted_count)) * 100, 1) if attempted_count > 0 else 0.0
    effective_raw = correct_count - (0.25 * incorrect_count if negative_marking else 0.0)
    overall_score_pct = round(max(0.0, (effective_raw / max(1, total_questions)) * 100), 1)

    # Trust Score (starts at 100%, drops by 5% per tab switch, 15% per DevTools)
    trust_score = max(0, 100 - (
        telemetry.get("tabSwitchCount", 0) * 6 +
        telemetry.get("fullscreenExitCount", 0) * 8 +
        telemetry.get("devtoolsOpenedCount", 0) * 25 +
        telemetry.get("copyPasteAttempts", 0) * 5
    ))

    # Speed Index: compare average time per question to recommended 60s
    avg_time = (sum(q["timeSpentSeconds"] for q in question_review_items) / max(1, total_questions))
    if avg_time < 35:
        speed_index = "High Velocity"
    elif avg_time < 70:
        speed_index = "Balanced"
    else:
        speed_index = "Deliberate"

    # Accuracy vs Speed quadrant (fast/slow vs accurate/careless)
    fast = avg_time <= 45
    accurate = accuracy_pct >= 75
    if fast and accurate:
        accuracy_vs_speed = "fast_accurate"
    elif fast and not accurate:
        accuracy_vs_speed = "fast_careless"
    elif accurate:
        accuracy_vs_speed = "slow_accurate"
    else:
        accuracy_vs_speed = "slow_careless"

    # Cognitive Percentile — REAL norm comparison vs completed attempts of the
    # SAME track. Never fabricate: until the pool has >=30 completed attempts,
    # the candidate sees raw accuracy + "benchmarking" state instead.
    NORM_POOL_MIN = 30
    percentile = None
    percentile_basis = "insufficient_pool"
    norm_pool_size = 0
    sectional_percentile: dict = {}
    if db is not None and template_id:
        try:
            pool_cursor = db.aptitude_sessions.find(
                {
                    "templateId": template_id,
                    "status": "completed",
                    "sessionId": {"$ne": doc.get("sessionId")},
                    "scorecard.overallScore": {"$exists": True},
                },
                {"scorecard.overallScore": 1, "scorecard.sectionBreakdown": 1, "_id": 0},
            )
            pool = list(pool_cursor)
            norm_pool_size = len(pool)
            if norm_pool_size >= NORM_POOL_MIN:
                lower = sum(1 for p in pool if float(p.get("scorecard", {}).get("overallScore") or 0) < overall_score_pct)
                percentile = round(100.0 * lower / norm_pool_size, 1)
                percentile_basis = "norm_pool"
                # Sectional percentiles — same norm method per pillar
                for sec_name, stats in section_stats.items():
                    mine_acc = (stats["correct"] / max(1, stats["attempted"])) if stats["attempted"] else 0.0
                    sec_pools = []
                    for p in pool:
                        sec_pb = (p.get("scorecard", {}).get("sectionBreakdown") or {}).get(sec_name)
                        if not sec_pb:
                            continue
                        att = sec_pb.get("attempted", 0)
                        if att:
                            sec_pools.append(sec_pb.get("correct", 0) / att)
                    if len(sec_pools) >= NORM_POOL_MIN:
                        sec_lower = sum(1 for a in sec_pools if a < mine_acc)
                        sectional_percentile[sec_name] = round(100.0 * sec_lower / len(sec_pools), 1)
                    else:
                        sectional_percentile[sec_name] = None
        except Exception as pool_err:
            print(f"[Aptitude] Norm pool lookup failed: {pool_err}")

    # Integrity verdict band from trust score
    if trust_score >= 90:
        integrity_verdict = "clean"
    elif trust_score >= 75:
        integrity_verdict = "review"
    else:
        integrity_verdict = "flagged"

    # Delta vs previous completed attempt on the same track
    delta_vs_previous = None
    if db is not None and template_id:
        try:
            prev = db.aptitude_sessions.find_one(
                {
                    "templateId": template_id,
                    "candidateId": str(doc.get("candidateId") or ""),
                    "status": "completed",
                    "sessionId": {"$ne": doc.get("sessionId")},
                    "completedAt": {"$lt": datetime.now(timezone.utc).isoformat()},
                },
                {"scorecard.overallScore": 1, "_id": 0},
                sort=[("completedAt", -1)],
            )
            if prev and prev.get("scorecard") is not None:
                prev_score = float((prev.get("scorecard") or {}).get("overallScore") or 0)
                delta_vs_previous = round(overall_score_pct - prev_score, 1)
        except Exception as delta_err:
            print(f"[Aptitude] Delta lookup failed: {delta_err}")

    # Sectional radar vs benchmark line
    radar = [
        {
            "pillar": sec_name,
            "score": round((stats["correct"] / max(1, stats["attempted"])) * 100, 1) if stats["attempted"] else 0.0,
            "benchmark": benchmark_score,
        }
        for sec_name, stats in section_stats.items()
    ]

    scorecard = {
        "overallScore": overall_score_pct,
        "percentile": percentile,
        "percentileBasis": percentile_basis,
        "normPoolSize": norm_pool_size,
        "totalQuestions": total_questions,
        "attempted": attempted_count,
        "correct": correct_count,
        "incorrect": incorrect_count,
        "unanswered": total_questions - attempted_count,
        "accuracyPercent": accuracy_pct,
        "trustScore": trust_score,
        "integrityVerdict": integrity_verdict,
        "speedIndex": speed_index,
        "avgSecondsPerQuestion": round(avg_time, 1),
        "accuracyVsSpeed": accuracy_vs_speed,
        "sectionBreakdown": section_stats,
        "sectionalPercentile": sectional_percentile,
        "benchmarkScore": benchmark_score,
        "radar": radar,
        "deltaVsPrevious": delta_vs_previous,
        "review": question_review_items,
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }

    db.aptitude_sessions.update_one(
        {"sessionId": doc["sessionId"]},
        {
            "$set": {
                "status": "completed",
                "completedAt": datetime.now(timezone.utc).isoformat(),
                "scorecard": scorecard
            }
        }
    )

    return scorecard


@aptitude_bp.route("/api/aptitude/sessions/<session_id>/submit", methods=["POST"])
def submit_aptitude_session(session_id):
    """Candidate submits the test. Generates official scorecard and unlocks explanations."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503

        doc, user, err = _get_owned_aptitude_session(session_id)
        if err:
            return err

        scorecard = _finalize_aptitude_scoring(doc, db)
        return jsonify({
            "success": True,
            "status": "completed",
            "scorecard": scorecard
        }), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@aptitude_bp.route("/api/aptitude/sessions/<session_id>/report", methods=["GET"])
def get_aptitude_session_report(session_id):
    """Retrieve completed test report with full question explanations and radar chart metrics."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503

        doc, user, err = _get_owned_aptitude_session(session_id)
        if err:
            return err

        scorecard = doc.get("scorecard")
        if not scorecard and doc.get("status") == "completed":
            scorecard = _finalize_aptitude_scoring(doc, db)

        return jsonify({
            "sessionId": session_id,
            "candidateName": doc.get("candidateName", "Candidate"),
            "templateTitle": doc.get("templateTitle", "Aptitude Assessment"),
            "startedAt": doc.get("startedAt"),
            "completedAt": doc.get("completedAt"),
            "status": doc.get("status"),
            "telemetry": doc.get("telemetry", {}),
            "scorecard": scorecard,
            "abVariant": _get_ab_variant(),
        }), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500


@aptitude_bp.route("/api/aptitude/sessions/<session_id>/report/pdf", methods=["GET"])
def get_aptitude_report_pdf(session_id):
    """Print-ready (browser print → Save as PDF) aptitude scorecard."""
    try:
        db = get_mongo_db()
        doc, user, err = _get_owned_aptitude_session(session_id)
        if err:
            return err

        scorecard = doc.get("scorecard")
        if not scorecard and doc.get("status") == "completed":
            scorecard = _finalize_aptitude_scoring(doc, db)
        if not scorecard:
            return jsonify({"error": "This session is not completed yet. Complete the assessment to unlock the scorecard."}), 409

        import html as html_lib

        sc = scorecard
        safe_title = html_lib.escape(str(doc.get("templateTitle", "Aptitude Assessment")))
        cand_name = html_lib.escape(str(doc.get("candidateName", "Candidate")))
        cand_email = html_lib.escape(str(doc.get("candidateEmail", "")))
        percentile = sc.get("percentile")
        percentile_txt = f"{percentile}th" if percentile is not None else "Benchmarking (pool < 30)"
        overall = sc.get("overallScore", 0)
        trust = sc.get("trustScore", 100)
        verdict = sc.get("integrityVerdict", "clean").upper()
        now_str = datetime.now(timezone.utc).strftime("%b %d, %Y")

        radar_rows = "".join(
            f"<tr><td>{html_lib.escape(str(r.get('pillar')))}</td>"
            f"<td>{r.get('score', 0):.1f}%</td>"
            f"<td>{r.get('benchmark', 60):.0f}%</td></tr>"
            for r in (sc.get("radar") or [])
        )

        section_rows = "".join(
            f"<tr><td>{html_lib.escape(str(name))}</td>"
            f"<td>{s.get('attempted', 0)}/{s.get('total', 0)}</td>"
            f"<td>{s.get('correct', 0)}</td>"
            f"<td>{round((s.get('correct', 0) / max(1, s.get('attempted', 0))) * 100, 1) if s.get('attempted') else 0}%</td>"
            f"<td>{round(s.get('timeSpent', 0), 1)}s</td></tr>"
            for name, s in (sc.get("sectionBreakdown") or {}).items()
        )

        review_rows = "".join(
            f"<tr><td>{'✓' if q.get('isCorrect') else ('✗' if q.get('isAttempted') else '—')}</td>"
            f"<td>{html_lib.escape(str(q.get('section')))}</td>"
            f"<td>{html_lib.escape(str(q.get('topic')))[:80]}</td>"
            f"<td>{q.get('timeSpentSeconds', 0):.0f}s</td></tr>"
            for q in (sc.get("review") or [])
        )

        return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Progeni Atlas Aptitude Scorecard — {safe_title}</title>
<style>
  @page {{ size: A4; margin: 14mm; }}
  body {{ font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background:#fff; margin:0; padding:24px; }}
  .h {{ display:flex; justify-content:space-between; border-bottom:2px solid #6366f1; padding-bottom:10px; }}
  .logo {{ font-weight:800; font-size:18px; letter-spacing:-0.5px }}
  .sub {{ font-size:9px; color:#64748b; text-transform:uppercase; font-family:monospace }}
  .card {{ background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin:16px 0; }}
  .big {{ font-size:40px; font-weight:800; color:#334155 }}
  table {{ width:100%; border-collapse:collapse; font-size:11px }}
  th,td {{ text-align:left; padding:6px 8px; border-bottom:1px solid #e2e8f0 }}
  th {{ background:#f1f5f9; text-transform:uppercase; font-size:9px; color:#64748b }}
  .pill {{ display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; background:#eef2ff; color:#3730a3 }}
  .foot {{ border-top:1px solid #e2e8f0; margin-top:24px; padding-top:10px; font-size:9px; color:#94a3b8; display:flex; justify-content:space-between }}
  @media print {{ .noprint {{ display:none }} }}
</style></head><body>
<div class="noprint" style="text-align:right; margin-bottom:10px">
  <button onclick="window.print()" style="padding:8px 14px; background:#4f46e5; color:#fff; border:0; border-radius:6px; font-weight:700; cursor:pointer">Print / Save as PDF</button>
</div>
<div class="h">
  <div><div class="logo">PROGENI ATLAS</div><div class="sub">Candidate-authorized aptitude scorecard</div></div>
  <div style="text-align:right; font-family:monospace; font-size:10px; color:#64748b"><div>REF: AT-{session_id[:8].upper()}</div><div>Issued: {now_str}</div></div>
</div>

<div class="card">
  <h1 style="margin:0; font-size:20px">{safe_title}</h1>
  <p style="margin:4px 0; color:#64748b; font-size:12px">{cand_name} · {cand_email}</p>
  <div style="display:flex; gap:32px; margin-top:12px">
    <div><div class="big">{overall:.1f}%</div><div class="sub">Overall Score</div></div>
    <div><div class="big" style="font-size:24px; padding-top:10px">{percentile_txt}</div><div class="sub">Percentile</div></div>
    <div><div class="big" style="font-size:24px; padding-top:10px">{trust}%</div><div class="sub">Integrity ({verdict})</div></div>
  </div>
</div>

<h3 style="font-size:12px; text-transform:uppercase; color:#64748b; margin:18px 0 6px">Section Breakdown</h3>
<table><thead><tr><th>Section</th><th>Attempted</th><th>Correct</th><th>Accuracy</th><th>Time</th></tr></thead><tbody>{section_rows or '<tr><td colspan="5">—</td></tr>'}</tbody></table>

<h3 style="font-size:12px; text-transform:uppercase; color:#64748b; margin:18px 0 6px">Cognitive Radar vs Benchmark ({html_lib.escape(str(int(sc.get('benchmarkScore', 60))))}%)</h3>
<table><thead><tr><th>Pillar</th><th>Score</th><th>Benchmark</th></tr></thead><tbody>{radar_rows or '<tr><td colspan="3">—</td></tr>'}</tbody></table>

<h3 style="font-size:12px; text-transform:uppercase; color:#64748b; margin:18px 0 6px">Question Review</h3>
<table><thead><tr><th>Result</th><th>Section</th><th>Topic</th><th>Time</th></tr></thead><tbody>{review_rows or '<tr><td colspan="4">—</td></tr>'}</tbody></table>

<div class="foot"><span>Progeni Atlas · Verified Screening Dossier</span><span>Candidate-authorized copy · Tamper-evident ledger</span></div>
</body></html>""", 200, {"Content-Type": "text/html; charset=utf-8"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred"}), 500


def _get_ab_variant() -> str:
    """Report hero A/B variant from platform_settings (default 'B' = new copy)."""
    try:
        db = get_mongo_db()
        if db is not None:
            doc = db.platform_settings.find_one({"key": "aptitude_ab"})
            variant = str((doc or {}).get("variant") or "B").upper()
            return variant if variant in ("A", "B") else "B"
    except Exception:
        pass
    return os.environ.get("APTITUDE_AB_VARIANT", "B").upper()


@aptitude_bp.route("/api/aptitude/events", methods=["POST"])
def log_aptitude_event():
    """Lightweight report-page funnel event (view / retake_click) for A/B measurement."""
    try:
        user, _, _ = get_current_candidate(request)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401
        db = get_mongo_db()
        if db is None:
            return jsonify({"success": True, "persisted": False}), 200
        data = request.get_json(silent=True) or {}
        event_name = str(data.get("name") or "").strip().lower()
        if event_name not in ("report_view", "retake_click", "share_click", "pdf_download"):
            return jsonify({"success": False, "error": "Unknown event"}), 400
        candidate_id = str(user.get("id") or user.get("_id") or "")
        db.aptitude_events.insert_one({
            "id": str(uuid.uuid4()),
            "candidateId": candidate_id,
            "sessionId": str(data.get("sessionId") or ""),
            "name": event_name,
            "variant": _get_ab_variant(),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })
        return jsonify({"success": True, "persisted": True}), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": "An unexpected error occurred"}), 500


@aptitude_bp.route("/api/candidate/aptitude/history", methods=["GET"])
def get_candidate_aptitude_history():
    """Retrieve all past aptitude test attempts for the logged-in candidate."""
    try:
        user, _, _ = get_current_candidate(request)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401
        candidate_id = str(user.get("id") or user.get("_id"))

        db = get_mongo_db()
        if db is None:
            return jsonify({"attempts": []}), 200

        # Always scoped to the caller — never leak other candidates' test history.
        query = {"$or": [{"candidateId": candidate_id}, {"candidateId": str(candidate_id)}]}

        cursor = db.aptitude_sessions.find(query).sort("startedAt", -1).limit(20)
        attempts = []
        for doc in cursor:
            sc = doc.get("scorecard") or {}
            attempts.append({
                "sessionId": doc.get("sessionId"),
                "templateTitle": doc.get("templateTitle"),
                "startedAt": doc.get("startedAt"),
                "status": doc.get("status"),
                "score": sc.get("overallScore", 0),
                "accuracy": sc.get("accuracyPercent", 0),
                "percentile": sc.get("percentile"),
                "percentileBasis": sc.get("percentileBasis", "insufficient_pool"),
                "normPoolSize": sc.get("normPoolSize", 0),
                "trustScore": sc.get("trustScore", 100),
                "integrityVerdict": sc.get("integrityVerdict", "clean"),
                "speedIndex": sc.get("speedIndex", "Balanced"),
                "deltaVsPrevious": sc.get("deltaVsPrevious")
            })

        return jsonify({"attempts": attempts}), 200

    except Exception as e:
        return jsonify({"error": "An unexpected error occurred"}), 500

