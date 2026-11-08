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
    assemble_session_questions
)

aptitude_bp = Blueprint("aptitude_bp", __name__)


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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        candidate_id = str(user.get("id") or user.get("_id")) if user else "cand-anonymous"
        candidate_name = user.get("full_name") or user.get("name") if user else "Candidate"

        template = get_template_by_id(template_id)
        duration_minutes = int(template.get("durationMinutes", 30))
        duration_seconds = duration_minutes * 60

        # Assemble randomized question bank for this session
        raw_questions = assemble_session_questions(template_id)
        session_id = f"apt-{uuid.uuid4().hex[:12]}"

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
            db.aptitude_sessions.insert_one(session_doc)

        return jsonify({
            "sessionId": session_id,
            "template": template,
            "questions": public_questions,
            "durationSeconds": duration_seconds,
            "startedAt": now.isoformat(),
            "expiresAt": expires_at.isoformat()
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@aptitude_bp.route("/api/aptitude/sessions/<session_id>", methods=["GET"])
def get_aptitude_session_state(session_id):
    """Retrieve active test session state with server-authoritative remaining time."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503

        doc = db.aptitude_sessions.find_one({"sessionId": session_id})
        if not doc:
            return jsonify({"error": "Aptitude session not found"}), 404

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
        return jsonify({"error": str(e)}), 500


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

        doc = db.aptitude_sessions.find_one({"sessionId": session_id})
        if not doc:
            return jsonify({"error": "Session not found"}), 404

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
        return jsonify({"error": str(e)}), 500


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

        doc = db.aptitude_sessions.find_one({"sessionId": session_id})
        if not doc:
            return jsonify({"error": "Session not found"}), 404

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
        return jsonify({"error": str(e)}), 500


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

    # Accuracy and Scaled Percentile
    accuracy_pct = round((correct_count / max(1, attempted_count)) * 100, 1) if attempted_count > 0 else 0.0
    overall_score_pct = round((correct_count / max(1, total_questions)) * 100, 1)

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

    # Cognitive Percentile calculation (standard norm distribution approx)
    percentile = min(99.0, max(15.0, round(overall_score_pct * 0.85 + (trust_score * 0.15), 1)))

    scorecard = {
        "overallScore": overall_score_pct,
        "percentile": percentile,
        "totalQuestions": total_questions,
        "attempted": attempted_count,
        "correct": correct_count,
        "incorrect": incorrect_count,
        "unanswered": total_questions - attempted_count,
        "accuracyPercent": accuracy_pct,
        "trustScore": trust_score,
        "speedIndex": speed_index,
        "sectionBreakdown": section_stats,
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

        doc = db.aptitude_sessions.find_one({"sessionId": session_id})
        if not doc:
            return jsonify({"error": "Session not found"}), 404

        scorecard = _finalize_aptitude_scoring(doc, db)
        return jsonify({
            "success": True,
            "status": "completed",
            "scorecard": scorecard
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@aptitude_bp.route("/api/aptitude/sessions/<session_id>/report", methods=["GET"])
def get_aptitude_session_report(session_id):
    """Retrieve completed test report with full question explanations and radar chart metrics."""
    try:
        db = get_mongo_db()
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503

        doc = db.aptitude_sessions.find_one({"sessionId": session_id})
        if not doc:
            return jsonify({"error": "Session not found"}), 404

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
            "scorecard": scorecard
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@aptitude_bp.route("/api/candidate/aptitude/history", methods=["GET"])
def get_candidate_aptitude_history():
    """Retrieve all past aptitude test attempts for the logged-in candidate."""
    try:
        user, _, _ = get_current_candidate(request)
        candidate_id = str(user.get("id") or user.get("_id")) if user else None

        db = get_mongo_db()
        if db is None:
            return jsonify({"attempts": []}), 200

        query = {}
        if candidate_id:
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
                "percentile": sc.get("percentile", 0),
                "trustScore": sc.get("trustScore", 100),
                "speedIndex": sc.get("speedIndex", "Balanced")
            })

        return jsonify({"attempts": attempts}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

