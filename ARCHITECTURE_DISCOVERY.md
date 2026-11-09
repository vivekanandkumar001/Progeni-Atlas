# PHASE 1: FULL APPLICATION ARCHITECTURE DISCOVERY

## Application Overview

**Progeni Atlas** - Autonomous AI Technical Interview Platform
**Architecture**: Full-stack web application with monorepo structure
**Deployment Status**: LIVE in production with real users

---

## 1.1 FRONTEND APPLICATION

### Framework & Architecture
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Entry Point**: `frontend/web/src/app/layout.tsx`
- **Key Files**:
  - `frontend/web/src/app/layout.tsx` - Root layout with metadata
  - `frontend/web/src/app/page.tsx` - Main page
  - `frontend/web/src/app/api\[...path\]\route.ts` - API routes
  - `frontend/web/src/app/auth/` - Authentication pages
  - `frontend/web/src/app/candidate/` - Candidate dashboard
  - `frontend/web/src/app/recruiter/` - Recruiter dashboard
  - `frontend/web/src/app/super-admin/` - Admin panel

### Frontend Architecture
- **App Router** structure with route groups
- **Server Components** and **Client Components**
- **Next.js Metadata** system for SEO
- **JSON-LD** for structured data
- **Tailwind CSS** for styling (globals.css)
- **Component Library**: `@/components/ui/` (shadcn/ui style)
- **State Management**: React Query / SWR (implied by hooks usage)

### API Integration
- **Proxy Configuration**: `frontend/web/next.config.ts`
- **Base URL**: `https://atlas.progeni.live`
- **API Proxy**: Forwards requests to Flask backend
- **Environment Variables**: All `NEXT_PUBLIC_` prefixed vars

### Key Frontend Components (structure)
- Video streaming components
- Interview session UI
- Resume upload/parsing
- Proctoring UI
- Billing and super-admin panels
- Notification systems

---

## 1.2 BACKEND SERVICES

### Framework & Language
- **Framework**: Flask (Python)
- **Version**: Based on `app.py` structure
- **Port**: 5000 (configurable via PORT env var)
- **WSGI**: `wsgi.py` entry point

### Architecture Pattern
- **Blueprint Modular**: Flask Blueprints for route organization
- **Services Layer**: Business logic in `core/` directory
- **Database Abstraction**: MongoDB via PyMongo
- **Authentication**: JWT + Cookies custom implementation

### Backend Directory Structure
```
backend/
├── app.py                          # Flask app factory (170 lines)
├── core/                           # Core business logic
│   ├── security.py                 # Auth, JWT, password hashing (750+ lines)
│   ├── db.py                       # MongoDB init, indexes, packages (470 lines)
│   ├── context.py                  # User resolution, get_current_candidate/recruiter (124 lines)
│   ├── constants.py                # System constants (23 lines)
│   ├── config.py                   # Application configuration (7KB)
│   ├── wallet.py                   # Billing/wallet system
│   ├── rate_limit_policy.py        # Rate limiting configuration
│   ├── scoring_contract.py         # Interview scoring schema
│   ├── aptitude_bank.py            # Aptitude question bank
│   ├── catalog.py                  # Catalog/canopy management
│   ├── context.py                  # User context resolution
│   ├── shadow_metering.py          # Usage tracking
│   └── vectorddb.py                # Vector database (Qdrant interface)
├── routes/                         # API route blueprints
│   ├── auth_routes.py              # Auth (770 lines)
│   ├── candidate_routes.py         # Candidate operations (2000+ lines)
│   ├── recruiter_routes.py        # Recruiter operations (2000+ lines)
│   ├── interview_routes.py         # Interview engine (3000+ lines)
│   ├── billing_routes.py           # Billing/payment processing
│   ├── aptitude_routes.py          # Aptitude quiz management
│   ├── super_admin_routes.py       # Platform administration
│   └── system_routes.py            # System-level endpoints
├── database/                       # Database initialization/scripts
├── app/                            # App services
│   └── llm_service.py              # LLM integration
├── recordings/                     # Audio/video recordings
├── uploads/                        # User uploads directory
├── .env                            # Runtime environment
├── .env.example                    # Example environment config
├── requirements.txt                # Python dependencies
├── Dockerfile                      # Container configuration
├── docker-compose.yml              # Multi-service orchestration
└── wsgi.py                         # WSGI entry point
```

### Route Blueprint Organization
| Blueprint | Prefix | Description |
|-----------|--------|-------------|
| `auth_bp` | `/api/auth` | Authentication: register, login, OTP, logout |
| `candidate_bp` | `/api/candidate` | Candidate dashboard, profiles, interviews |
| `recruiter_bp` | `/api/recruiter` | Recruiter profile, team management, candidates |
| `interview_bp` | `/api/interview` | Interview engine, code execution, proctoring |
| `super_admin_bp` | `/api/super-admin` | Platform administration, catalog, users |
| `billing_bp` | `/api/billing` | Payment processing, subscriptions |
| `aptitude_bp` | `/api/aptitude` | Aptitude test management |
| `system_bp` | `/api/system` | System health, status |

### Authentication Implementation
- **Token Type**: Custom JWT access tokens
- **Token Duration**: 7 days (access tokens)
- **Session Cookies**: `tp_session` (httponly, secure), `tp_role` (httponly configurable)
- **Refresh Mechanism**: `/api/auth/refresh` endpoint
- **Login Flow**:
  1. POST `/api/auth/login` with email/password
  2. Password verification via `verify_password()` (Argon2id primary)
  3. Email verification check (`is_email_verified`)
  4. JWT generation with user claims
  5. Cookie setting (`tp_session`, `tp_role`)
  6. Dashboard redirect based on role

- **Token Claims** (JWT payload):
  - `sub`: User ID (string UUID)
  - `email`: User email
  - `role`: User role (candidate, recruiter, admin, super_admin)
  - `type`: "access" token identifier
  - `exp`: Expiration timestamp
  - `ver`: Version field (currently "1")

- **Authentication Middleware**: `@require_auth`, `@require_super_admin`
- **Token Verification**: `_decode_access_token()` in `core/security.py`
- **Secondary Auth Path**: Cookie-based (`tp_session`) fallback

### Authorization Implementation
- **Role Hierarchy**:
  - `candidate` - Interview taker, own data only
  - `recruiter` / `admin` / `hr` - hiring team, organization data
  - `super_admin` - Platform-wide administration

- **Decorators**:
  - `@require_auth` - Basic authentication check
  - `@require_super_admin` - Super admin only

- **User Resolution**: `resolve_user()` in `core/security.py`
  - Looks up by `id`, `_id`, or `email`
  - Supports migration from legacy ID formats

- **Current User Extraction**: `get_current_candidate()`, `get_current_recruiter()` in `core/context.py`
  - Priority 1: `flask.g.user` (set by decorator)
  - Priority 2: JWT claims verification
  - Priority 3: Email-based lookup (last resort)

### Database & Storage
#### MongoDB (Primary)
- **Connection**: `MONGO_URI` or default `mongodb://localhost:27017/progeni_atlas`
- **Database Name**: `progeni_atlas`
- **ODM**: Native PyMongo (no Django ORM, no Mongoose)
- **Collections**: 20+ named collections

#### Key MongoDB Collections
| Collection | Purpose | Owner/Reference Fields |
|------------|---------|----------------------|
| `users` | User accounts | `id`, `email`, `role`, `org_id` |
| `interview_sessions` | Interview sessions | `candidate_id`, `recruiter_id`, `candidate_email`, `recruiter_email` |
| `email_otps` | OTP verification | `email`, `purpose`, `expires_at` |
| `candidate_resumes` | Resume uploads | `candidate_id`, `candidate_email`, `is_active` |
| `candidate_notifications` | User notifications | `candidate_id`, `candidate_email` |
| `recruiter_notifications` | Recruiter notifications | `recruiter_id`, `recruiter_email` |
| `organizations` | Org metadata | `id`, `slug`, `name`, `tier` |
| `organization_invites` | Org invitations | `email`, `role`, `token`, `expires_at` |
| `packages` | Billing packages | `id`, `name`, `tier`, `price` |
| `audit_logs` | Security audit trail | `action`, `created_at`, `user_id` |
| `candidate_notifications` | Candidate-facing notifications | `candidate_id`, `candidate_email`, `is_read` |
| `recruiter_notifications` | Recruiter-facing notifications | `recruiter_id`, `recruiter_email`, `is_read` |
| `interview_invitations` | Interview invites | `candidate_id`, `candidate_email`, `session_id` |
| `packages` | Billing packages | Various tier definitions |
| `wallet` | User wallet/credits | `user_id`, `balance`, `transaction_history` |

#### Qdrant (Vector Database)
- **Purpose**: Resume embeddings, semantic search
- **Collections**: `candidate_resumes`, `question_banks`, `job_rubrics`
- **Access**: Via `QDRANT_URL` and `QDRANT_API_KEY` env vars

#### File Storage
- **Uploads**: `./uploads/` directory on server
- **Recordings**: `./recordings/` directory
- **Access Pattern**: `GET /uploads/<filename>` endpoint
- **Security**: No explicit authentication on upload serving (relies on Flask auth checks)

### Environment Configuration
#### `.env` File (Production)
```
MONGO_URI=mongodb://localhost:27017/progeni_atlas
FLASK_ENV=development
PORT=5000
JWT_SECRET or SWAMI_SECRET_KEY= Generated secret
OTP_PEPPER= Required, no default
SMTPS...= Email configuration
LIVEKIT_URL= WebRTC signaling
LIVEKIT_API_KEY= devkey
LIVEKIT_API_SECRET= 32+ char secret
```

#### `.env.example` (Template)
- Documents all `NEXT_PUBLIC_` frontend vars
- Documents backend `FLASK_`, `OTP_`, `SMTP_`, `LIVEKIT_` vars
- Shows safe defaults for development

### Third-Party Services
| Service | Purpose | Integration |
|---------|---------|-------------|
| **OpenAI / OpenRouter** | LLM-powered interview questioning | `app/services/llm_service.py` |
| **Qdrant** | Vector search for resumes | `core/vectordb.py` |
| **SMTP (Gmail)** | OTP emails, interview notifications | `core/security.py` send_*_email functions |
| **LiveKit** | WebRTC audio/video | Implemented but may use mocks |
| **Cloudinary** (possible) | Image optimization | `next.config.ts` remote image config |
| **Razorpay** (possible) | Payment processing | `frontend/web/src/lib/razorpay.ts` |
| **Google Maps / Geocoding** (possible) | Location services | Not explicitly found |

### Dependency Stack
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, various UI components
- **Backend**: Flask, PyMongo, PyJWT, python-jose (JWT), Argon2 password hashing
- **Security**: python-jose, argon2, bcrypt (fallback), hmac, hashlib

---

## 1.3 USER ROLES & PERMISSION MODEL

### Role Hierarchy
```
super_admin
  ├── full platform access
  ├── can manage users, organizations, packages
  └── can override any authorization check

admin / hr
  ├── organization-specific administration
  ├── can manage recruiters within org
  └── limited candidate visibility

recruiter
  ├── manages own organization's candidates
  ├── views own team's interview sessions
  └── cannot access other organizations' data

candidate
  ├── own interview sessions only
  ├── own profile and resume
  ├── own dashboard data
  └── cannot access other candidates' data
```

### Cross-Organization Tenant Isolation
- **`org_id` field** on user documents and organization documents
- **Organization-level data scoping** in recruiter routes
- **Super-admin override** capability (can see across orgs)

### User Data Flow (Typical Interview Session)
1. Candidate registers → OTP verification → Email verified
2. Candidate logs in → JWT + cookies issued
3. Candidate selects interview package → Payment
4. Interview session created → `interview_sessions` doc with `candidate_id`
5. Interview conducted → Code execution, audio/proctoring data
6. Evaluation completed → Scorecard generated
7. Recruiter reviews → Access restricted by org membership
8. Data persisted → MongoDB with proper ownership fields

---

## 1.4 API ENDPOINT MAP

### Authentication Endpoints
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/check-email` | Check email availability | No |
| POST | `/api/auth/login` | User login | No (but validates) |
| POST | `/api/auth/logout` | User logout | Yes (via cookie) |
| GET | `/api/auth/me` | Get current user profile | Yes |
| POST | `/api/auth/refresh` | Refresh token | Yes |
| POST | `/api/auth/forgot-password` | Password reset request | No |
| POST | `/api/auth/verify-otp` | OTP verification | No (but validates) |
| POST | `/api/auth/resend-otp` | Resend OTP | No |
| GET | `/api/auth/otp-status` | OTP timer state | No |

### Candidate Endpoints
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/candidate/dashboard-data` | Dashboard data | Yes |
| GET | `/api/candidate/profile` | Candidate profile | Yes |
| PUT | `/api/candidate/profile` | Update profile | Yes |
| GET | `/api/candidate/invitations` | Interview invitations | Yes |
| GET | `/api/candidate/dashboard` | Dashboard view | Yes |
| Various | Interview session APIs | Session management | Yes |

### Recruiter Endpoints
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/recruiter/profile` | Recruiter profile | Yes |
| PUT | `/api/recruiter/profile` | Update profile | Yes |
| POST | `/api/recruiter/team-invite` | Send team invite | No (but should check) |
| GET | `/api/recruiter/team-members` | Team member list | Yes |
| GET | `/api/recruiter/dashboard` | Recruiter dashboard | Yes |
| GET | `/api/recruiter/candidates` | Candidate list | Yes |
| Various | Interview session management | Session operations | Yes |

### Interview Endpoints
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/v1/interview-sessions/<id>` | **Session details** | **Should be YES** |
| GET | `/api/interview-sessions` | List sessions | Yes |
| POST | `/api/interview-sessions` | Create session | Yes |
| GET | `/api/evaluator/dynamic-parameters` | Generate interview params | Yes |
| Various | Code execution, proctoring | Interview engine | Yes |

### Super Admin Endpoints
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/super-admin/catalog` | Skills/drills catalog | Yes (super_admin) |
| POST | `/api/super-admin/catalog` | Create catalog item | Yes (super_admin) |
| GET | `/api/super-admin/users` | User management | Yes (super_admin) |
| GET | `/api/super-admin/audit-logs` | Audit trail | Yes (super_admin) |
| Various | Platform administration | Full access |

---

## 1.5 DATA FLOW MAP (Simplified)

```
User Registration
  │
  ├──► POST /api/auth/register
  │       │
  │       ├──► Validate email/password/name
  │       ├──► Check duplicate email
  │       ├──► hash_password(Argon2id)
  │       ├──► Insert user into MongoDB users
  │       ├──► Generate 6-digit OTP
  │       ├──► Store OTP hash in email_otps
  │       ├──► Send OTP via SMTP
  │       └──► Respond: "verify your email"
  │
  ▼
User Verification (OTP)
  │
  ├──► POST /api/auth/verify-otp
  │       │
  │       ├──► Validate 6-digit code
  │       ├──► Check expiry (2 min TTL)
  │       ├──► Check attempt limits (5 max)
  │       ├──► Verify HMAC-peppered hash
  │       ├──► Update user: is_email_verified=True
  │       ├──► Generate JWT access token
  │       ├──► Set tp_session cookie (httponly)
  │       ├──► Set tp_role cookie
  │       └──► Respond with JWT + role + dashboard URL
  │
  ▼
User Login
  │
  ├──► POST /api/auth/login
  │       │
  │       ├──► Validate email/password
  │       ├──► Verify Argon2id password hash
  │       ├──► Check is_email_verified
  │       ├──► Update last_login_at timestamp
  │       ├──► Generate JWT access token
  │       ├──► Set tp_session cookie (httponly=True)
  │       ├──► Set tp_role cookie (httponly configurable)
  │       └──► Respond with JWT + user profile
  │
  ▼
Authenticated Requests
  │
  ├──► Request includes: Authorization: Bearer <token>
  │       OR tp_session cookie
  │
  ├──► Flask before_request → _authenticate_request()
  ├──► JWT decoded + claims validated
  ├──► resolve_user() looks up MongoDB document
  ├──► g.user set for decorated routes
  ├──► Route executes with user context
  └──► Response returned
```

---

## 1.6 SECURITY CONTROLS MAP

| Control Type | Implementation | Status |
|-------------|---------------|--------|
| **Password Hashing** | Argon2id (primary), PBKDF2/SHA256 fallbacks | ✅ Active |
| **JWT Validation** | Signature verification, expiry check, type check | ✅ Active |
| **Session Cookies** | tp_session (httponly), tp_role (httponly var) | ⚠️ Partial |
| **CSRF Protection** | Not explicitly configured (Samesite=Lax) | ⚠️ Possible gap |
| **Rate Limiting** | Configurable but may not be actively enforced per-route | ⚠️ Possible gap |
| **Input Validation** | Schema validation on some endpoints | ⚠️ Partial |
| **CORS Configuration** | Dynamic, origin validation in Flask | ✅ Active |
| **HTTP Security Headers** | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS | ✅ Active |
| **Tenant Isolation** | `org_id` field, but may not be enforced everywhere | ⚠️ Partial |
| **Data Ownership Checks** | Present in some routes, missing in others | ⚠️ Partial |
| **Error Handling** | Some raw error exposure, now being masked | ⚠️ Being fixed |
| **Dependency Versions** | Need verification | ⚠️ Unknown |

---

## 1.7 IDENTIFIED RISK AREAS (Pre-Audit)

Based on initial code review, the following areas present potential cross-user data leakage risks:

1. **Interview session access** - `GET /api/v1/interview-sessions/<id>` was **unauthenticated** (FIXED)
2. **Candidate data isolation** - Some queries use email instead of authenticated user ID
3. **Recruiter organization data** - `org_id` from user document, not JWT-verified
4. **Cookie accessibility** - `tp_role` cookie with `httponly=False`
5. **Error message exposure** - Raw exceptions returned to clients
6. **Phone number exposure** - In profile API responses
7. **Bulk operations** - May lack per-record authorization
8. **Search/export endpoints** - May lack proper filters

---

## 1.8 HARDWARE & INFRASTRUCTURE

- **Deployment**: Vercel (frontend) + Custom Flask backend
- **Containerization**: Docker + docker-compose
- **Database**: MongoDB (self-hosted or cloud)
- **Vector Search**: Qdrant (vector database)
- **Email**: SMTP (Gmail or custom)
- **WebRTC**: LiveKit (for audio/video interviews)
- **Domain**: atlas.progeni.live (primary), api.progeni.live
- **CI/CD**: Not explicitly visible, likely Vercel + custom deploy

---

*Architecture Discovery Complete. Proceeding to Cross-User Data Isolation Audit (Phase 2).*