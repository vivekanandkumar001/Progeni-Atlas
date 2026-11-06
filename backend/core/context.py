"""
Progeni Atlas — Context Resolution Helpers
===========================================
Dynamically resolves candidate or recruiter user, active resume, and skill profile
from request token/cookie/headers/MongoDB.
"""

from flask import request
from core.db import get_mongo_db
from core.security import _authenticate_request, resolve_user


def get_current_candidate(req=None):
    """
    Dynamically resolve current candidate (user, active resume, and extracted skills).
    Reads authenticated user from token/claims/cookie, headers, then request context.
    """
    db = get_mongo_db()
    r = req or request
    user = None

    # 1. Resolve from authenticated claims or token in request
    try:
        claims, _ = _authenticate_request()
        if claims and claims.get("sub"):
            user = resolve_user(claims.get("sub"))
        if not user and claims and claims.get("email") and db is not None:
            user = db.users.find_one({"email": claims.get("email").strip().lower()})
    except Exception:
        pass

    # 2. Check custom candidate identity headers
    if not user and r and db is not None:
        try:
            h_email = (r.headers.get("X-Candidate-Email") or r.headers.get("X-User-Email") or "").strip().lower()
            h_id = (r.headers.get("X-Candidate-Id") or r.headers.get("X-User-Id") or "").strip()
            if h_email:
                user = db.users.find_one({"email": h_email})
            if not user and h_id:
                user = resolve_user(h_id)
        except Exception:
            pass

    # 3. Check cookies
    if not user and r and db is not None:
        try:
            c_email = (r.cookies.get("tp_email") or r.cookies.get("tp_user_email") or "").strip().lower()
            if c_email:
                user = db.users.find_one({"email": c_email})
        except Exception:
            pass

    # 4. Fallback: check email or candidate_id parameter
    if not user and r and db is not None:
        email = (r.args.get("email") if hasattr(r, "args") else None) or ""
        cid = (r.args.get("candidate_id") if hasattr(r, "args") else None) or (r.args.get("userId") if hasattr(r, "args") else None) or ""
        if not email and hasattr(r, "get_json"):
            try:
                data = r.get_json(silent=True) or {}
                email = data.get("email") or ""
                cid = cid or data.get("candidate_id") or data.get("userId") or ""
            except Exception:
                email = ""
        if email:
            user = db.users.find_one({"email": email.strip().lower()})
        if not user and cid:
            user = resolve_user(cid)

    # 5. Smart fallback: if single-candidate/development environment
    if not user and db is not None:
        try:
            latest_resume = db.candidate_resumes.find_one({}, sort=[("uploaded_at", -1)])
            if latest_resume:
                r_cand_id = latest_resume.get("candidate_id")
                r_cand_email = latest_resume.get("candidate_email")
                if r_cand_id:
                    user = resolve_user(r_cand_id)
                if not user and r_cand_email:
                    user = db.users.find_one({"email": r_cand_email.strip().lower()})
            if not user:
                user = db.users.find_one(
                    {"role": {"$in": ["candidate", "CANDIDATE"]}},
                    sort=[("created_at", -1)]
                )
            if not user:
                user = db.users.find_one(
                    {"email": {"$ne": "talentpulseadmin@gmail.com"}},
                    sort=[("created_at", -1)]
                )
        except Exception:
            pass

    resume_doc = None
    if db is not None:
        query_conditions = []
        if user:
            u_id = str(user.get("id") or "")
            u_oid = str(user.get("_id") or "")
            u_email = user.get("email")
            if u_id:
                query_conditions.append({"candidate_id": u_id})
            if u_oid and u_oid != u_id:
                query_conditions.append({"candidate_id": u_oid})
            if u_email:
                query_conditions.append({"candidate_email": u_email.strip().lower()})
                query_conditions.append({"candidate_id": u_email.strip().lower()})

        if query_conditions:
            resume_doc = db.candidate_resumes.find_one(
                {"$or": query_conditions},
                sort=[("uploaded_at", -1)]
            )
        if not resume_doc:
            resume_doc = db.candidate_resumes.find_one(
                {"is_active": True},
                sort=[("uploaded_at", -1)]
            )
        if not resume_doc:
            resume_doc = db.candidate_resumes.find_one({}, sort=[("uploaded_at", -1)])

    skills = []
    if resume_doc and resume_doc.get("extracted_skills"):
        for s in resume_doc.get("extracted_skills"):
            if s and s not in skills:
                skills.append(s)
    if user and user.get("skills_summary"):
        for s in user.get("skills_summary"):
            if s and s not in skills:
                skills.append(s)

    if not skills:
        skills = ["Software Engineering", "System Design", "Problem Solving", "Web Development"]

    return user, resume_doc, skills


def get_current_recruiter(req=None):
    """
    Dynamically resolve the currently authenticated recruiter/admin user.
    Reads authenticated claims from token/claims/cookie, headers, then request context.
    """
    db = get_mongo_db()
    r = req or request
    user = None

    try:
        claims, _ = _authenticate_request()
        if claims and claims.get("sub"):
            user = resolve_user(claims.get("sub"))
        if not user and claims and claims.get("email") and db is not None:
            user = db.users.find_one({"email": claims.get("email").strip().lower()})
    except Exception:
        pass

    if not user and r and db is not None:
        try:
            h_email = (r.headers.get("X-Recruiter-Email") or r.headers.get("X-User-Email") or "").strip().lower()
            h_id = (r.headers.get("X-Recruiter-Id") or r.headers.get("X-User-Id") or "").strip()
            if h_email:
                user = db.users.find_one({"email": h_email})
            if not user and h_id:
                user = resolve_user(h_id)
        except Exception:
            pass

    if not user and r and db is not None:
        try:
            c_email = (r.cookies.get("tp_email") or r.cookies.get("tp_user_email") or "").strip().lower()
            if c_email:
                user = db.users.find_one({"email": c_email})
        except Exception:
            pass

    if not user and r and db is not None:
        email = (r.args.get("email") if hasattr(r, "args") else None) or (r.args.get("recruiter_email") if hasattr(r, "args") else None) or ""
        rid = (r.args.get("recruiter_id") if hasattr(r, "args") else None) or (r.args.get("userId") if hasattr(r, "args") else None) or ""
        if not email and hasattr(r, "get_json"):
            try:
                data = r.get_json(silent=True) or {}
                email = data.get("email") or data.get("recruiter_email") or ""
                rid = rid or data.get("recruiter_id") or data.get("userId") or ""
            except Exception:
                email = ""
        if email:
            user = db.users.find_one({"email": email.strip().lower()})
        if not user and rid:
            user = resolve_user(rid)

    return user
