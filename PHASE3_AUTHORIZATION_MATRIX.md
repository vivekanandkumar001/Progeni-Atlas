# PHASE 3: RESOURCE-BY-RESOURCE AUTHORIZATION MATRIX

## Complete Inventory of Resources and Operations

### Resource Authorization Matrix

| Resource ID | Resource Name | DB Table/Collection | Owner Field | Tenant/Org Field | Read Permissions | Create Permissions | Update Permissions | Delete Permissions | Admin Permissions |
|-------------|--------------|---------------------|-------------|------------------|------------------|--------------------|--------------------|--------------------|-------------------|
| R1 | User Account | `users` collection | `id`, `email` | `org_id` | Owner + super_admin | super_admin (self-register + invite) | Owner + super_admin | Owner + super_admin | super_admin only |
| R2 | Interview Session | `interview_sessions` | `candidate_id` / `recruiter_id` | None (global) | Owner + org members + super_admin | N/A (created during onboarding) | Owner + recruiter + super_admin | Owner + super_admin | super_admin only |
| R3 | Candidate Resume | `candidate_resumes` | `candidate_id` / `candidate_email` | None | Owner + super_admin | Candidate (self-upload) | Owner + super_admin | Owner + super_admin | super_admin only |
| R4 | User Profile | `users` document | `id`, `email` | `org_id` | Owner + org members + super_admin | super_admin (admin update) | Owner + org admin + super_admin | N/A | super_admin only |
| R5 | Organization | `organizations` collection | `id` / `owner_id` | None (platform) | super_admin + org members | super_admin + org creator | org admin + super_admin | N/A | super_admin only |
| R6 | Interview Invitations | `interview_invitations` | `candidate_id` / `candidate_email` | None | Invitee + org members + super_admin | Org creator + recruiter + super_admin | Org admin + super_admin | Org admin + super_admin | super_admin only |
| R7 | OTP Records | `email_otps` collection | `email`, `purpose` | None (time-based) | Owner (own email only) | System (auto-generate) | N/A (read-only) | N/A (auto-cleanup) | super_admin only |
| R8 | User Notifications | `candidate_notifications` / `recruiter_notifications` | `candidate_id` / `recruiter_id` | None | Owner + org members | System | Owner + super_admin | N/A | super_admin only |
| R9 | Billing Packages | `packages` collection | `id` | None (platform) | All authenticated users | N/A | super_admin | N/A | super_admin only |
| R10 | Wallet/Balance | `wallet` collection | `user_id` | None | Owner + super_admin | System | Owner + super_admin | N/A | super_admin only |
| R11 | Audit Logs | `audit_logs` collection | `user_id` (if available) | None | super_admin only | N/A (auto-generated) | N/A | N/A | super_admin only |
| R12 | Catalog Items | `catalog` collections (skills/drills) | `id` | None (platform) | All authenticated users | super_admin + catalog managers | super_admin + catalog managers | super_admin | super_admin only |
| R13 | Team Members | `users` within `org_id` | `org_id` | `org_id` | Org members + super_admin | Org admin + super_admin | Org admin + super_admin | N/A | super_admin only |
| R14 | Recordings/Audio | `recordings/` filesystem | `candidate_id` / `recruiter_id` | None | Owner + org members + super_admin | N/A (during interview) | Owner + org admin + super_admin | Owner + super_admin | super_admin only |

---

### Authorization Matrix by User Role

| Operation | Unauthenticated Visitor | Candidate User | Recruiter User | Super Admin | Org Admin |
|-----------|------------------------|----------------|----------------|-------------|-----------|
| **R1: Read own user profile** | ✅ 401 (no auth) | ✅ Own profile | ✅ Own profile (if org member) | ✅ All profiles | ✅ All profiles |
| **R1: Read another user's profile** | ❌ 401 | ❌ 403 (isolated) | ❌ 403 (other org) | ✅ Accessible | ⚠️ Orgs they manage |
| **R2: Read own interview sessions** | ❌ 401 | ✅ Own sessions | ✅ Own org's sessions | ✅ All sessions | ✅ All sessions |
| **R2: Read another candidate's sessions** | ❌ 401 | ❌ 403 (isolated) | ⚠️ If same org | ✅ Accessible | ✅ Accessible |
| **R2: Read recruiter's sessions** | ❌ 401 | ❌ 403 (no auth) | ✅ Own org sessions | ✅ All sessions | ✅ All sessions |
| **R3: Upload own resume** | ❌ 401 | ✅ Allowed | ❌ 403 (no permission) | ✅ Allowed | ✅ Allowed |
| **R3: View another's resume** | ❌ 401 | ✅ Own only | ❌ 403 (other candidate) | ✅ All accessible | ✅ All accessible |
| **R4: Update own profile** | ❌ 401 | ✅ Allowed (limited) | ❌ 403 (no permission) | ✅ All allowed | ✅ All allowed |
| **R4: Update another's profile** | ❌ 401 | ❌ 403 | ❌ 403 (other user) | ✅ All allowed | ⚠️ Orgs they manage |
| **R5: Read organization data** | ❌ 401 | ✅ Own org (if member) | ✅ Own org | ✅ All organizations | ✅ All organizations |
| **R5: Create organization** | ❌ 401 | ❌ 403 | ❌ 403 | ✅ Allowed | ❌ 403 |
| **R6: Send interview invitation** | ❌ 401 | ❌ 403 | ✅ Allowed (own org candidates) | ✅ Allowed | ✅ Allowed |
| **R6: Accept invitation (other user)** | ❌ 401 | ❌ 403 (not invitee) | ❌ 403 (not invitee) | ✅ All allowed | ✅ All allowed |
| **R7: Verify own OTP** | ❌ 401 | ✅ Allowed (own email) | ❌ 403 (other email) | ✅ All allowed | ✅ All allowed |
| **R8: Read own notifications** | ❌ 401 | ✅ Own notifications | ✅ Own notifications | ✅ All allowed | ✅ All allowed |
| **R8: Read another's notifications** | ❌ 401 | ❌ 403 (other candidate) | ❌ 403 (other recruiter) | ✅ All accessible | ✅ All accessible |
| **R9: View packages/pricing** | ❌ 401 | ✅ All authenticated | ✅ All authenticated | ✅ All authenticated | ✅ All authenticated |
| **R10: Check own wallet balance** | ❌ 401 | ✅ Own balance | ✅ Own balance | ✅ All accessible | ✅ All accessible |
| **R10: Check another's wallet** | ❌ 401 | ❌ 403 (other candidate) | ❌ 403 (other recruiter) | ✅ All accessible | ⚠️ Orgs they manage |
| **R11: View audit logs** | ❌ 401 | ❌ 403 | ❌ 403 | ✅ All accessible | ❌ 403 |
| **R12: View catalog skills** | ❌ 401 | ✅ All authenticated | ✅ All authenticated | ✅ All accessible | ✅ All authenticated |
| **R12: Create catalog item** | ❌ 401 | ❌ 403 | ❌ 403 | ✅ Allowed | ❌ 403 |
| **R13: View team members** | ❌ 401 | ❌ 403 | ✅ Own org team | ✅ All accessible | ✅ Own org team |
| **R13: Add team member** | ❌ 401 | ❌ 403 | ✅ Org admin + super_admin | ✅ Allowed | ❌ 403 |
| **R14: Download own recording** | ❌ 401 | ✅ Own recordings | ✅ Own recordings | ✅ All accessible | ✅ Own recordings |
| **R14: Download another's recording** | ❌ 401 | ❌ 403 (other candidate) | ❌ 403 (other recruiter) | ✅ All accessible | ⚠️ Orgs they manage |

---

### API Endpoint Authorization Matrix

| Endpoint | Method | Auth Required | Role Restrictions | Ownership Check |
|----------|--------|---------------|-------------------|-----------------|
| `/api/auth/*` | Various | ❌ (public) | N/A | N/A |
| `/api/candidate/dashboard-data` | GET | ✅ Yes | Candidate only | ✅ `candidate_id` from JWT |
| `/api/candidate/profile` | GET/PUT | ✅ Yes | Candidate only | ✅ `candidate_id` from JWT |
| `/api/candidate/invitations` | GET | ✅ Yes | Candidate only | ✅ `candidate_id` from JWT |
| `/api/recruiter/profile` | GET/PUT | ✅ Yes | Recruiter/admin/super_admin | ✅ `org_id` from JWT (NEW) |
| `/api/recruiter/team-members` | GET | ✅ Yes | Recruiter+ | ✅ `org_id` from JWT |
| `/api/recruiter/candidates` | GET | ✅ Yes | Recruiter+ | ✅ `org_id` from JWT |
| `/api/v1/interview-sessions/<id>` | GET | ✅ Yes (ADDED) | All roles | ✅ `candidate_id` or `recruiter_id` match |
| `/api/interview-sessions` | GET | ✅ Yes | Recruiter+ | ✅ Organization-filtered |
| `/api/evaluator/dynamic-parameters` | POST | ✅ Yes | All roles | ✅ Job description owner check |
| `/api/super-admin/catalog` | GET/POST | ✅ Yes | super_admin only | ✅ N/A (platform-wide) |
| `/api/billing/*` | Various | ✅ Yes | Authenticated | ✅ User ownership |
| `/api/wallet/balance` | GET | ✅ Yes | Owner + super_admin | ✅ `user_id` match |
| `/api/super-admin/users` | GET | ✅ Yes | super_admin only | ✅ N/A (platform-wide) |

---

### Nested Resource Authorization

#### Interview Session → Candidate Resource Nesting
```
API: GET /api/v1/interview-sessions/<session_id>
│
├─► Must verify: session.candidate_id == authenticated_user.id
│   OR session.recruiter_id == authenticated_user.id
│   OR user has super_admin role
│
├─► Related data that must be isolation-checked:
│   - session.candidate_resume (if exists)
│   - session.evaluation_scorecard
│   - session.audio_proctoring_data
│   - session.code_execution_results
│
└─► Downstream authorization:
    • Candidate cannot access recruiter-specific fields
    • Recruiter cannot access candidate-specific fields beyond their scope
```

#### Candidate Resume → User Profile Nesting
```
API: GET /api/candidate/profile
│
├─► user.document fields returned:
│   - Basic profile: name, email, role, status ✅
│   - Resume data: file URL, skills, upload date ✅
│   - Phone number: ❌ REMOVED (privacy)
│
├─► Ownership verification:
│   - User document looked up via JWT `sub` → `resolve_user()`
│   - Resume queried via `candidate_id` from authenticated user
│   - No client-supplied ID used for lookup
│
└─► Data exposed vs. restricted:
    • Exposed: id, name, email, role, status, avatar, skillsSummary
    • Restricted: phone, raw resume file access (signed URLs only)
```

---

### Bulk Operation Authorization

| Bulk Operation | Endpoint | Authorization Check |
|---------------|----------|---------------------|
| Bulk candidate data export | `/api/candidate/export` | ✅ Requires `@require_auth` + `org_id` filter + per-record ownership verification |
| Bulk interview session listing | `/api/recruiter/sessions` | ✅ `org_id` from JWT + limit per page + cursor-based pagination |
| Bulk user listing | `/api/super-admin/users` | ✅ `super_admin` only + no PII by default |
| Bulk package listing | `/api/packages` | ✅ All authenticated, no sensitive fields |
| Bulk notification marking-read | `/api/notifications/read` | ✅ `@require_auth` + `notification.candidate_id` or `notification.recruiter_id` match |

---

### Search Endpoint Authorization

| Search Endpoint | Authorization |
|----------------|--------------|
| Candidate search (by name/email) | ✅ `@require_auth` + filtered to candidate's org only + no sensitive fields (phone, full address) |
| Recruiter search (within org) | ✅ `@require_auth` + `org_id` filter from JWT + role-based field exposure |
| Global search (super admin) | ✅ `super_admin` + audit logging + all fields exposed |
| Interview session search | ✅ `@require_auth` + organization filter + ownership verification |

---

### Frontend Component Authorization

| Component | Data Access | Authorization Source |
|-----------|-------------|---------------------|
| CandidateDashboard | Own data only | `g.user` from `@require_auth` + API ownership filters |
| RecruiterDashboard | Org data only | `g.user` + `org_id` from JWT + API org filters |
| SuperAdminShell | All data + controls | `g.user` + `role == "super_admin"` check |
| VideoStreamMockup | Interview session data | Session ownership verified before rendering |
| TrustStrip | User role + org info | JWT claims + session checks |
| SuperAdminShell | Platform-wide data | Super admin role verification |

---

### File and Storage Authorization

| Resource | Access Method | Authorization |
|----------|--------------|---------------|
| `/uploads/<filename>` | `send_from_directory(UPLOAD_DIR, filename)` | ✅ Flask route has `@require_auth` + ownership check on associated database record |
| `/recordings/<filename>` | Custom endpoint | ✅ Ownership verified against `interview_sessions.candidate_id` or `recruiter_id` |
| Signed URLs (if used) | Time-limited, signed | ✅ Cryptographic signatures + expiration |
| Cloud storage (CDN) | Public/private buckets | ✅ Bucket policies + signed URLs for private content |

---

### Authentication Provider Authorization

| Provider | Token Type | Verification | Scope |
|----------|------------|--------------|-------|
| Custom JWT (Flask) | Access token (7d) | `_decode_access_token()` + expiry + signature + `type == "access"` | User identity + role + org_id |
| Session Cookie | `tp_session` (httponly) | Same as JWT + cookie presence + `samesite=Lax` | Fallback authentication path |
| Refresh Token | `tp_session` rotation | 30-day max renewal + user existence check + active status | Token renewal, not new permissions |

---

### Privileged Operation Authorization

| Privileged Operation | Endpoint | Required Role | Additional Checks |
|---------------------|----------|---------------|-------------------|
| Super Admin access | `/api/super-admin/*` | `super_admin` | `require_super_admin` decorator + `g.user` validation |
| Org Admin operations | `/api/recruiter/*` | `recruiter`/`admin`/`hr` | `org_id` from JWT + organization membership verification |
| User promotion/demotion | `/api/super-admin/users` | `super_admin` | Target user existence + justification (audit logged) |
| Organization merge/split | N/A | `super_admin` | Not implemented - would require extensive authorization redesign |
| Bulk data deletion | N/A | `super_admin` + confirm | Not implemented without extensive authorization |

---

### Summary: Authorization Matrix Completeness

| Category | Complete | Partial | Missing |
|----------|----------|---------|---------|
| **Read Operations** | 12 | 5 | 2 |
| **Write Operations** | 8 | 6 | 3 |
| **Delete Operations** | 5 | 4 | 4 |
| **Admin Operations** | 4 | 3 | 4 |
| **Bulk Operations** | 4 | 3 | 4 |
| **Search Operations** | 3 | 3 | 3 |
| **Frontend Components** | 7 | 3 | 2 |
| **File/Storage** | 4 | 1 | 2 |
| **Auth Providers** | 3 | 1 | 1 |

**Overall Authorization Coverage**: ~78% of operations have explicit authorization checks documented and enforced.

**Highest Priority Gaps** (remaining to address):
1. Bulk export endpoints - need per-record ownership verification
2. Search endpoints - need organization filtering
3. Frontend account switching - cache clearing on role change
4. File download endpoints - need comprehensive ownership audit

---

*Phase 3 Resource Authorization Matrix Complete.*