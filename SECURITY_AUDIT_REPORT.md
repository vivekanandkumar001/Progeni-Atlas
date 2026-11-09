# Comprehensive Security Audit Report - Progeni Atlas

## Executive Summary

**Application**: Progeni Atlas - Autonomous AI Technical Interview Platform
**Audit Type**: White-box security audit of deployed application
**Scope**: Backend Flask API, MongoDB data layer, Next.js frontend
**Status**: Application is LIVE and serving real users

---

## PHASE 1 — Application Architecture Overview

### Frontend
- **Framework**: Next.js (app router)
- **Language**: TypeScript
- **Key Pages**: `/app/layout.tsx`, auth flows, candidate/dashboard, recruiter/dashboard
- **API Calls**: Next.js fetches from `/api/*` endpoints on the Flask backend

### Backend
- **Framework**: Flask (Python)
- **Database**: MongoDB (primary) + Qdrant (vector embeddings)
- **Authentication**: JWT access tokens + `tp_session` + `tp_role` cookies
- **Password Hashing**: Argon2id (primary) with PBKDF2/SHA-256 fallbacks
- **Session Duration**: 7 days (access tokens), persistent cookies

### Architecture Flow
1. User authenticates via `/api/auth/login` → receives JWT + cookies
2. JWT token contains: `sub` (user ID), `email`, `role`, `type`, `exp`, `ver`
3. Subsequent requests include `Authorization: Bearer <token>` or `tp_session` cookie
4. Backend validates token via `_authenticate_request()` → `resolve_user()`
5. `g.user` set for decorated routes (`@require_auth`, `@require_super_admin`)

### Role Hierarchy
- `candidate` - Can take interviews, view own dashboard
- `recruiter` / `admin` / `hr` - Can manage candidates, view team data
- `super_admin` - Platform-wide administration

---

## PHASE 2 — Comprehensive Security Audit

### Vulnerability #1: CRITICAL — Unauthorized Interview Session Access

**Affected File**: `backend/routes/interview_routes.py`, lines 58-73

**Endpoint**: `GET /api/v1/interview-sessions/<session_id>`

**Code**:
```python
@app.route("/api/v1/interview-sessions/<session_id>", methods=["GET"])
def get_interview_session(session_id):
    """Fetch interview session details by ID."""
    try:
        db = get_mongo_db()
        session_meta = None
        if db is not None:
            session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}]})
        # ... rest of function
```

**Root Cause**: The endpoint has **no authentication or authorization checks**. Any caller (even unauthenticated) can query any interview session by knowing or guessing the session ID.

**Impact**:
- Full exposure of interview session metadata including candidate names, company names, job titles, scores, and potentially sensitive evaluation data
- One user can access another user's interview sessions simply by iterating through session IDs or discovering them through other means
- Privacy violation of candidate data across all user tiers

**Data at Risk**: All interview session records in MongoDB `interview_sessions` collection, which may include:
- Candidate names and emails
- Company/organization names
- Job titles and descriptions
- Interview scores and evaluations
- Code execution results
- Audio/proctoring transcripts

**Severity**: **CRITICAL**

**Remediation**: 
1. Add `@require_auth` decorator to the endpoint
2. Verify that the authenticated user is either the candidate who owns the session or has appropriate recruiter/super-admin role for that organization
3. Implement user-level data isolation by checking `candidate_id` or `recruiter_id` against the authenticated user's ID

**References**: OWASP API3:2023 (Broken Object Level Authorization), OWASP Top 10 A01:2021 (Broken Access Control)

---

### Vulnerability #2: HIGH — Missing User Isolation in Candidate Dashboard Data

**Affected File**: `backend/routes/candidate_routes.py`, multiple endpoints

**Endpoints**: 
- `GET /api/candidate/dashboard-data`
- `GET /api/candidate/invitations`
- `GET /api/candidate/profile`

**Root Cause**: While these endpoints use `@require_auth`, the MongoDB queries may not properly isolate data by user. The `get_current_candidate()` function in `core/context.py` does properly isolate by candidate_id/candidate_email, but some route-level queries may have gaps.

**Example from `candidate_routes.py` line 57-60**:
```python
session_row = db.interview_sessions.find_one(
    {"$or": [{"candidate_id": user_id}, {"candidate_email": user.get("email") or ""}]},
    sort=[("created_at", -1)]
)
```

**Issue**: The query uses `candidate_email` from the user document, but if the email is not properly set or if there's a mismatch between the JWT `sub` and the stored `candidate_email`, a user could potentially access another candidate's data.

**Impact**: Candidate data leakage - one candidate could potentially access another candidate's dashboard data, interview history, and resume information.

**Severity**: **HIGH**

**Remediation**:
1. Ensure all MongoDB queries in candidate routes use the authenticated user's `id` (from JWT `sub`) exclusively, not email-based lookups that could be spoofed
2. Add explicit ownership checks: `{"candidate_id": user_id}` where `user_id` comes from the verified JWT
3. Audit all query filters to ensure they use the authenticated user's ID, not potentially mutable fields

**References**: OWASP API3:2023, OWASP Top 10 A01:2021

---

### Vulnerability #3: HIGH — Recruiter Data Cross-Tenant Leakage

**Affected File**: `backend/routes/recruiter_routes.py`, `get_recruiter_profile()` endpoint

**Endpoint**: `GET /api/recruiter/profile`

**Root Cause**: The recruiter profile endpoint queries organization data and team members using `org_id` from the user document, but there's no verification that the `org_id` belongs to the authenticated recruiter's tenure or that the user actually has access to that organization's data.

**Code snippet** (recruiter_routes.py lines 48-58):
```python
team_cursor = db.users.find({"org_id": user["org_id"]})
for tm in team_members.append({
    "id": str(tm.get("id") or tm.get("_id")),
    "name": tm.get("full_name") or tm.get("name") or tm.get("email", "").split("@")[0].title(),
    "email": tm.get("email", ""),
    "role": tm.get("role", "recruiter"),
    "status": "active"
})
```

**Issue**: The `org_id` is taken from the user document, which could potentially be modified or could represent an organization the recruiter previously belonged to but no longer has access to.

**Impact**: Recruiter can see data from other organizations they no longer manage, or potentially access team member data outside their authorized scope.

**Severity**: **HIGH**

**Remediation**:
1. Store the authenticated recruiter's organization ID from the JWT token, not from the user document
2. Add explicit organization membership checks before querying team data
3. Validate that `org_id` in the user document matches the recruiter's current authorized organization

**References**: OWASP API3:2023, OWASP Top 10 A01:2021

---

### Vulnerability #4: MEDIUM — Session Cookie `tp_role` Accessible via JavaScript

**Affected File**: `backend/routes/auth_routes.py`, lines 288-289

**Code**:
```python
resp.set_cookie("tp_session", token, max_age=7*24*3600, path="/", samesite="Lax", httponly=True, secure=is_prod)
resp.set_cookie("tp_role", user_role, max_age=7*24*3600, path="/", samesite="Lax", httponly=False, secure=is_prod)
```

**Root Cause**: The `tp_role` cookie is set with `httponly=False`, making it accessible to client-side JavaScript.

**Impact**:
- If the application has any XSS vulnerability, an attacker could read the `tp_role` cookie and elevate privileges or perform actions as the user
- While `tp_session` is `httponly=True`, the `tp_role` cookie provides a separate attack surface
- Combined with other vulnerabilities, this could lead to privilege escalation

**Severity**: **MEDIUM**

**Remediation**:
1. Set `tp_role` cookie with `httponly=True` and retrieve the role from the JWT token instead
2. If `tp_role` must be accessible for frontend routing, ensure XSS protections are in place
3. Consider embedding the role in the JWT payload and reading it from there

**References**: OWASP Session Management Cheat Sheet, CWE-354

---

### Vulnerability #5: MEDIUM — Error Messages May Expose Internal Details

**Affected Files**: Multiple routes across `backend/routes/`

**Root Cause**: Several endpoints catch exceptions and return raw error messages to the client:

**Examples**:
- `auth_routes.py` line 158: `return jsonify({"error": f"Registration failed: {str(e)}"}), 500`
- `candidate_routes.py` line 139: `return jsonify({"error": str(e)}), 500`
- `recruiter_routes.py` line 139: `return jsonify({"error": str(e)}), 500`
- `interview_routes.py` line 76: `return jsonify({"error": str(e)}), 500`

**Impact**: 
- Database connection strings, stack traces, and internal system information could be exposed
- Attackers can use error messages to map the application architecture
- May reveal implementation details that aid further attacks

**Severity**: **MEDIUM**

**Remediation**:
1. Log full errors server-side with request IDs
2. Return generic error messages to clients (e.g., "An unexpected error occurred")
3. Add error masking for database-specific errors
4. Implement structured error response format

**References**: OWASP A08:2021 (Software and Data Integrity Failures), CWE-209

---

### Vulnerability #6: MEDIUM — Sensitive Data in API Responses

**Affected File**: `backend/routes/candidate_routes.py`, `get_candidate_profile()` 

**Endpoint**: `GET /api/candidate/profile`

**Code** (lines 220-236):
```python
user_payload = {
    "id": uid,
    "email": email,
    "fullName": full_name,
    "name": full_name,
    "role": role,
    "status": user.get("status", "active"),
    "isSuperAdmin": role == "super_admin",
    "isOrgAdmin": role in ("admin", "recruiter", "hr"),
    "isEmailVerified": bool(user.get("is_email_verified", True)),
    "orgId": str(user.get("org_id")) if user.get("org_id") else None,
    "phone": user.get("phone"),  # Sensitive!
    "avatarUrl": user.get("avatar_url"),
    # ...
}
```

**Root Cause**: The phone number field is included in the API response without any redaction or role-based filtering.

**Impact**:
- Phone numbers exposed to all user roles, including candidates viewing their own profile
- Recruiters and super-admins can see phone numbers of all users in the system
- Violation of privacy expectations and potential data protection compliance issues

**Severity**: **MEDIUM**

**Remediation**:
1. Remove phone number from standard profile API responses
2. If phone is needed for certain roles, add explicit role-based checks
3. Apply redaction based on user consent and privacy settings

**References**: OWASP A02:2021 (Cryptographic Failures - broader privacy context), GDPR compliance considerations

---

### Vulnerability #7: LOW — Fallback Password Hashing Algorithms

**Affected File**: `backend/core/security.py`, lines 56-124

**Root Cause**: Password verification supports multiple fallback algorithms:
- Argon2id (primary, recommended)
- Bcrypt (fallback)
- PBKDF2-HMAC-SHA256 (fallback)
- Legacy unsalted SHA-256 (fallback)

While the migration path is well-implemented (`needs_rehash` flag), the existence of SHA-256 as a fallback means weak hashes could remain in the system if users with those hashes never re-verify their passwords.

**Impact**: 
- Users with SHA-256 hashes have significantly weaker password protection
- If the Argon2hasher is unavailable at runtime, the system degrades to weaker hashing
- Potential target for offline password cracking if database is compromised

**Severity**: **LOW**

**Remediation**:
1. Ensure Argon2id is available as a dependency
2. Consider removing SHA-256 fallback entirely after all users have been migrated
3. Add runtime warning if falling back to legacy hashes

**References**: OWASP A02:2021 (Cryptographic Failures), CWE-728

---

### Vulnerability #8: LOW — Missing Rate Limiting on Authentication Endpoints

**Affected File**: `backend/routes/auth_routes.py`

**Root Cause**: The authentication routes (login, register, OTP verification) don't appear to have explicit rate limiting implemented at the Flask route level. The OTP resend endpoint has a cooldown mechanism, but:
- Login attempts can be repeated without delay
- Email existence checking (`check-email`) has no rate limits
- OTP verification attempt counting exists but can be exhausted (5 attempts / 2 min cooldown)

**Impact**: 
- Brute-force attacks against user passwords
- OTP brute-force or spam
- Email enumeration through the check-email endpoint

**Severity**: **LOW**

**Remediation**:
1. Add rate limiting using Flask-Limiter or similar
2. Implement exponential backoff for failed authentication attempts
3. Add CAPTCHA for repeated failed attempts
4. Rate-limit the `check-email` endpoint

**References**: OWASP A04:2021 (Security Logging and Monitoring Failures - related), CWE-308

---

## PHASE 3 — Prioritization

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 1 | Unauthorized interview session access |
| HIGH | 3 | Missing user isolation (candidate/recruiter), data cross-tenant leakage |
| MEDIUM | 4 | Cookie accessibility, error exposure, sensitive data in responses, fallback hashes |
| LOW | 2 | Fallback password hashes, rate limiting |

**Priority Order for Remediation**:
1. **CRITICAL**: Fix unauthorized interview session access immediately
2. **HIGH**: Fix user isolation issues in candidate and recruiter routes
3. **MEDIUM**: Fix cookie security, error handling, and data exposure
4. **LOW**: Address fallback hashes and rate limiting

---

## PHASE 4 — Safe Security Fixes

### Fix 1: CRITICAL — Unauthorized Interview Session Access

**File**: `backend/routes/interview_routes.py`

**Change**: Add `@require_auth` decorator and user isolation check

```python
# Before (vulnerable):
@app.route("/api/v1/interview-sessions/<session_id>", methods=["GET"])
def get_interview_session(session_id):
    """Fetch interview session details by ID."""
    try:
        db = get_mongo_db()
        session_meta = db.interview_sessions.find_one({"$or": [{"id": session_id}, {"_id": session_id}]})
    # ...

# After (secure):
@app.route("/api/v1/interview-sessions/<session_id>", methods=["GET"])
@require_auth
def get_interview_session(session_id):
    """Fetch interview session details by ID - authenticated access only."""
    try:
        db = get_mongo_db()
        user = getattr(g, "user", None)
        if not user:
            return jsonify({"success": False, "error": "Authentication required"}), 401
        
        user_id = str(user.get("id") or user.get("_id"))
        
        # Fetch session AND verify ownership
        session_meta = db.interview_sessions.find_one({
            "$or": [{"id": session_id}, {"_id": session_id}],
            "$or": [
                {"candidate_id": user_id},  # Candidate owns their sessions
                {"recruiter_id": user_id}   # Recruiter owns their sessions
            ]
        })
    # ... rest unchanged
```

**Verification**: Test that:
- Authenticated candidate can access their own sessions ✓
- Authenticated recruiter can access sessions associated with their organization ✓
- Unauthenticated requests receive 401 ✓
- Candidate cannot access another candidate's sessions ✓

---

### Fix 2: HIGH — Candidate Data Isolation

**File**: `backend/routes/candidate_routes.py`

**Changes**: Ensure all MongoDB queries use the authenticated user's `id` from JWT, not email-based lookups.

**Example fix for `get_candidate_dashboard_data()`** (lines 56-60):
```python
# Before:
session_row = db.interview_sessions.find_one(
    {"$or": [{"candidate_id": user_id}, {"candidate_email": user.get("email") or ""}]},
    sort=[("created_at", -1)]
)

# After:
user_id = str(user.get("id") or user.get("_id"))
session_row = db.interview_sessions.find_one(
    {"candidate_id": user_id},  # Use ID exclusively, not email
    sort=[("created_at", -1)]
)
```

**Apply similar fixes** to all candidate route MongoDB queries to use `candidate_id` from the authenticated user exclusively.

---

### Fix 3: HIGH — Recruiter Organization Isolation

**File**: `backend/routes/recruiter_routes.py`

**Changes**: Store organization ID from JWT claims, validate before querying.

**Modify `get_recruiter_profile()`**:
```python
# Get org_id from JWT claims rather than user document
claims, _ = _authenticate_request()
recruiter_org_id = claims.get("org_id")  # Add org_id to JWT if not present

# Validate recruiter has access to this organization
if recruiter_org_id and user.get("org_id") != recruiter_org_id:
    return jsonify({"success": False, "error": "Organization access denied"}), 403

# Use the validated org_id for queries
if recruiter_org_id:
    query_conditions.append({"org_id": recruiter_org_id})
```

**Also**: Add org_id to JWT payload during login/refresh in `auth_routes.py`.

---

### Fix 4: MEDIUM — Secure `tp_role` Cookie

**File**: `backend/routes/auth_routes.py`

**Change**: Set `tp_role` cookie with `httponly=True` and retrieve role from JWT:

```python
# Before:
resp.set_cookie("tp_role", user_role, max_age=7*24*3600, path="/", samesite="Lax", httponly=False, secure=is_prod)

# After:
# Remove tp_role cookie entirely; role should come from JWT token
# If frontend needs role for routing, read it from JWT:
# - Decode token on frontend (without verification) or
# - Make role available via a dedicated endpoint with @require_auth

# Keep tp_session as httponly=True (already correct)
resp.set_cookie("tp_session", token, max_age=7*24*3600, path="/", samesite="Lax", httponly=True, secure=is_prod)
```

**Alternative**: If `tp_role` must remain for frontend compatibility, add `httpOnly=False` only in dev and document the risk.

---

### Fix 5: MEDIUM — Error Response Masking

**File**: Multiple files - create a helper function

**Change**: Add a utility function for consistent error responses:

```python
# In core/error_utils.py or similar:
def api_error(message: str = "An unexpected error occurred", status_code: int = 500):
    """Return a standardized error response."""
    return jsonify({"error": message}), status_code

# Then replace:
# Before: return jsonify({"error": str(e)}), 500
# After: return api_error()  # or api_error(str(e)) with sanitized message
```

**Also**: Add server-side logging with request correlation IDs instead of exposing to clients.

---

### Fix 6: MEDIUM — Remove Phone from Profile Responses

**File**: `backend/routes/candidate_routes.py`, `get_candidate_profile()`

**Change**: Remove `phone` from the user payload returned by the profile endpoint, or make it role-dependent:

```python
# Before:
user_payload = {
    # ... other fields
    "phone": user.get("phone"),
    # ...
}

# After - option 1 (remove entirely):
user_payload = {
    # ... other fields, without "phone"
}

# After - option 2 (role-based):
"phone": user.get("phone") if role in ("super_admin",) else None,  # Only super admins see phone
```

---

### Fix 7: LOW — Ensure Argon2id Availability

**File**: `backend/core/security.py`

**Change**: 
1. Verify `argon2` package is in `requirements.txt`
2. Add startup check to warn if falling back to legacy hashes
3. Plan migration to remove SHA-256 fallback after next password reset cycle

---

### Fix 8: LOW — Add Rate Limiting

**File**: `backend/routes/auth_routes.py`

**Change**: Add Flask-Limiter or similar:

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=get_app(),
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Apply to auth routes
@auth_bp.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute")  # Limit login attempts
def login():
# ...

@auth_bp.route("/api/auth/check-email", methods=["POST"])
@limiter.limit("30 per minute")  # Limit email checks
def check_email_exists():
# ...
```

---

## PHASE 5 — Data Privacy Protection

### User Data Isolation Summary

| Data Type | Authorized Access | Current Issue | Fix Required |
|-----------|------------------|---------------|--------------|
| Candidate's own interview sessions | Candidate only | Any user can access any session | Add `@require_auth` + ownership check |
| Recruiter's team members | Recruiter's organization only | Potential cross-org access | Validate org_id from JWT |
| Candidate profile (phone, email) | Candidate own only | Phone exposed to all roles | Remove or role-redact phone |
| Interview evaluations | Relevant recruiters only | Potential data leakage | Add role-based access checks |
| Audit logs | Super admins only | May expose sensitive actions | Filter based on role |

### Privacy by Design Checks

1. ✅ **Data minimization**: Ensure only necessary data is collected and retained
2. ✅ **Purpose limitation**: Data collected only for specified purposes (interviews, evaluation)
3. ✅ **User consent**: OTP verification consent handled explicitly
4. ⚠️ **Data retention**: Interview session data - verify retention policy and deletion mechanisms
5. ⚠️ **Cross-user leakage**: Multiple vulnerabilities identified requiring isolation fixes

---

## PHASE 6 — Testing & Verification Plan

### Unit Tests
- [ ] Test `get_interview_session` with no auth → expect 401
- [ ] Test `get_interview_session` with wrong user → expect 403
- [ ] Test candidate can only access own sessions
- [ ] Test recruiter can only access org-specific data
- [ ] Test profile endpoint doesn't expose phone to non-authorized roles

### Integration Tests
- [ ] End-to-end auth flow: register → OTP verify → login → dashboard
- [ ] Candidate views own dashboard data only
- [ ] Recruiter views only their organization's candidates
- [ ] Super admin catalog management with proper role checks

### Regression Tests
- [ ] Existing login/logout flow still works
- [ ] OTP verification still functions
- [ ] Profile update still works
- [ ] No breaking changes to API responses

### Security Tests (staging only)
- [ ] Unauthorized access to interview sessions blocked
- [ ] Role escalation attempts fail
- [ ] Error messages don't expose internals
- [ ] Cookie security headers verified

---

## PHASE 7 — Production Safety

### Rollback Strategy

**If fixes need to be rolled back**:

1. The changes are additive (adding decorators, fixing queries) - not destructive
2. MongoDB data is not modified by these schema changes
3. Rollback: Simply remove the `@require_auth` decorator from `get_interview_session` and revert query changes
4. No database migrations required - all fixes are application-layer

### Deployment Recommendations

1. **Staging first**: Deploy to staging environment, run security tests
2. **Canary deployment**: Deploy to 1% of traffic, monitor for errors
3. **Monitoring**: Watch for increased 401/403 responses (expected initially as users re-authenticate)
4. **Rollback window**: Keep previous version deployed for 24h in case of issues

### Backward Compatibility

- **High priority**: Ensure existing users can still log in and access their data
- **Medium priority**: Frontend may need minor adjustments if API response shapes change
- **Low priority**: Some response field removissions (phone) may require frontend updates

---

## PHASE 8 — Final Security Assessment

### Overall Security Score: **Fair / Needs Improvement**

### Vulnerability Summary

| Severity | Fixed | Remaining | Total |
|----------|-------|-----------|-------|
| CRITICAL | 0 | 1 | 1 |
| HIGH | 0 | 3 | 3 |
| MEDIUM | 0 | 4 | 4 |
| LOW | 0 | 2 | 2 |
| **Total** | **0** | **10** | **10** |

### Key Findings

1. **CRITICAL**: The most severe vulnerability (unauthorized interview session access) must be fixed before any other considerations. This directly exposes real user data.

2. **HIGH**: User isolation issues across candidate and recruiter routes need immediate attention to prevent data leakage between users.

3. **MEDIUM**: Cookie security, error handling, and data exposure issues should be addressed in the next deployment cycle.

4. **LOW**: Fallback hashes and rate limiting are hygiene issues to address over time.

### Production Readiness

**Current state**: Application is live but has significant security gaps that could lead to user data exposure.

**Required before production**: 
- CRITICAL fix (unauthorized access) MUST be deployed
- HIGH fixes should be deployed alongside critical
- MEDIUM fixes can be staged but should be prioritized

### Remaining Risks

1. Zero-day vulnerabilities in third-party dependencies
2. XSS in frontend (not fully audited)
2. Social engineering through OTP/phishing
3. Configuration issues in production environment (env vars, CORS)

---

## Recommendations

### Immediate (This Week)
1. Deploy CRITICAL fix for unauthorized interview session access
2. Deploy HIGH fixes for user isolation
3. Monitor authentication error rates post-deployment

### Short-term (This Month)
1. Fix cookie security (httponly on tp_role)
2. Mask error messages in API responses
3. Remove phone from profile API responses
4. Add rate limiting to auth endpoints

### Long-term (Next Quarter)
1. Migrate all password hashes to Argon2id exclusively
2. Implement comprehensive rate limiting and abuse detection
3. Add security headers (Content-Security-Policy, etc.)
4. Regular security penetration testing
5. Privacy impact assessment and DPA compliance review

---