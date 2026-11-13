"""
Progeni Atlas — Cryptographically Secure Context Resolution Helpers
===================================================================
Authoritatively resolves candidate or recruiter user, active resume, and skill profile
ONLY from cryptographically verified JWT claims in request token or secure session cookie.
Zero client-header spoofing, zero unsigned cookie trust, zero cross-tenant fallback leaks.
"""

from __future__ import annotations

import logging
from flask import request, g
from core.db import get_mongo_db
from core.security import _authenticate_request, resolve_user

logger = logging.getLogger("progeni_atlas.context")


def get_current_candidate(req=None) -> tuple[dict | None, dict | None, list[str]]:
    """
    Authoritatively resolve current candidate (user, active resume, and extracted skills).
    Only resolves from verified JWT authentication claims.
    Returns: (user, resume_doc, skills)
    """
    db = get_mongo_db()
    user = None

    # 1. Use flask.g if already verified by @require_auth decorator
    if hasattr(g, "user") and g.user and str(g.user.get("role", "")).lower() == "candidate":
        if str(g.user.get("status", "")).lower() in ("active", "1", "true"):
            user = g.user
        else:
            return None, None, []

    # 2. Resolve from cryptographically verified JWT claims in request
    if not user:
        try:
            claims, _ = _authenticate_request()
            if claims and claims.get("sub"):
                user = resolve_user(claims.get("sub"))
            if not user and claims and claims.get("email") and db is not None:
                user = db.users.find_one({"email": claims.get("email").strip().lower()})
        except Exception as e:
            logger.debug(f"[get_current_candidate] Auth claim resolution: {e}")

    # No unverified fallbacks (headers, unsigned cookies, or query params) are allowed.
    if not user:
        return None, None, []

    if str(user.get("status", "")).lower() not in ("active", "1", "true"):
        return None, None, []

    # 3. Resolve active resume belonging strictly to THIS candidate (NO cross-tenant leaks)
    resume_doc = None
    if db is not None:
        try:
            u_id = str(user.get("id") or user.get("_id") or "").strip()
            u_email = (user.get("email") or "").strip().lower()

            query_conditions = []
            if u_id:
                query_conditions.append({"candidate_id": u_id})
            if u_email:
                query_conditions.append({"candidate_email": u_email})

            if query_conditions:
                # Prefer explicitly active resume first, then latest uploaded
                resume_doc = db.candidate_resumes.find_one(
                    {"$and": [{"$or": query_conditions}, {"is_active": True}]},
                    sort=[("uploaded_at", -1)]
                )
                if not resume_doc:
                    resume_doc = db.candidate_resumes.find_one(
                        {"$or": query_conditions},
                        sort=[("uploaded_at", -1)]
                    )
        except Exception as e:
            logger.warning(f"[get_current_candidate] Resume query warning: {e}")

    # 4. Extract skills belonging strictly to this candidate's profile and resume
    skills: list[str] = []
    if resume_doc and isinstance(resume_doc.get("extracted_skills"), list):
        for s in resume_doc.get("extracted_skills"):
            clean_s = str(s).strip()
            if clean_s and clean_s not in skills:
                skills.append(clean_s)

    if user and isinstance(user.get("skills_summary"), list):
        for s in user.get("skills_summary"):
            clean_s = str(s).strip()
            if clean_s and clean_s not in skills:
                skills.append(clean_s)

    if not skills:
        skills = ["Software Engineering", "System Design", "Problem Solving", "Web Development"]

    return user, resume_doc, skills


def get_current_recruiter(req=None) -> dict | None:
    """
    Authoritatively resolve the currently authenticated recruiter/admin user.
    Only resolves from verified JWT authentication claims.
    """
    db = get_mongo_db()
    user = None

    # 1. Use flask.g if already verified by @require_auth decorator
    if hasattr(g, "user") and g.user:
        role = str(g.user.get("role", "")).lower()
        if role in ("recruiter", "admin", "super_admin", "employer", "hr"):
            if str(g.user.get("status", "")).lower() not in ("active", "1", "true"):
                return None
            return g.user

    # 2. Resolve from cryptographically verified JWT claims in request
    try:
        claims, _ = _authenticate_request()
        if claims and claims.get("sub"):
            user = resolve_user(claims.get("sub"))
        if not user and claims and claims.get("email") and db is not None:
            user = db.users.find_one({"email": claims.get("email").strip().lower()})
    except Exception as e:
        logger.debug(f"[get_current_recruiter] Auth claim resolution: {e}")

    # Verify role permissions and account status
    if user:
        role = str(user.get("role", "")).lower()
        if role not in ("recruiter", "admin", "super_admin", "employer", "hr"):
            return None
        if str(user.get("status", "")).lower() not in ("active", "1", "true"):
            return None

    return user
