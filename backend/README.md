# Progeni Atlas — Backend Documentation

Enterprise Flask API powering the **Progeni Atlas** (Crewbase) technical interview, assessment, and proctoring platform.

---

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Technology Stack](#2-technology-stack)
- [3. Prerequisites](#3-prerequisites)
- [4. Repository Structure & WSGI Architecture](#4-repository-structure--wsgi-architecture)
  - [Directory Tree](#directory-tree)
  - [WSGI Module Resolution (`wsgi.py` vs `app.py`)](#wsgi-module-resolution-wsgipy-vs-apppy)
- [5. Installation and Startup](#5-installation-and-startup)
  - [1. Virtual Environment Setup](#1-virtual-environment-setup)
  - [2. Installing Dependencies](#2-installing-dependencies)
  - [3. Environment Configuration](#3-environment-configuration)
  - [4. Database Migration](#4-database-migration)
  - [5. Running the Application](#5-running-the-application)
  - [6. Health Checks & Diagnostics](#6-health-checks--diagnostics)
  - [7. Test & Verification Workflow](#7-test--verification-workflow)
- [6. Environment Variables Reference](#6-environment-variables-reference)
  - [Server & Security](#server--security)
  - [Polyglot Database Infrastructure](#polyglot-database-infrastructure)
  - [LLM & AI Engine Configuration](#llm--ai-engine-configuration)
  - [Voice & Audio Services (TTS & STT)](#voice--audio-services-tts--stt)
  - [Storage, Email & Integrations](#storage-email--integrations)
  - [Proctoring & Code Execution](#proctoring--code-execution)
- [7. Backend Architecture & Request Flow](#7-backend-architecture--request-flow)
  - [Polyglot Storage Separation](#polyglot-storage-separation)
  - [Authentication, JWT Security & Cookie CSRF](#authentication-jwt-security--cookie-csrf)
  - [Multi-Tenancy & Access Scoping](#multi-tenancy--access-scoping)
  - [Interview Lifecycle State Machine](#interview-lifecycle-state-machine)
- [8. Complete API Documentation](#8-complete-api-documentation)
  - [1. Health & System Diagnostics](#1-health--system-diagnostics)
  - [2. Authentication & Account Management](#2-authentication--account-management)
  - [3. Candidate Profile, Resumes & Skills](#3-candidate-profile-resumes--skills)
  - [4. Candidate Invitations & Dashboard](#4-candidate-invitations--dashboard)
  - [5. Recruiter Jobs, Rubrics & Dossiers](#5-recruiter-jobs-rubrics--dossiers)
  - [6. Super Admin & Platform Oversight](#6-super-admin--platform-oversight)
  - [7. Interview Session Lifecycle & Room Data](#7-interview-session-lifecycle--room-data)
  - [8. Live Turn Flow: Start, Audio & Answers](#8-live-turn-flow-start-audio--answers)
  - [9. Proctoring Event Ingestion](#9-proctoring-event-ingestion)
  - [10. Code Execution Sandbox](#10-code-execution-sandbox)
  - [11. Companion Phone WebRTC Pairing](#11-companion-phone-webrtc-pairing)
  - [12. Practice Drills & Readiness](#12-practice-drills--readiness)
- [9. Database & Alembic Migrations](#9-database--alembic-migrations)
  - [Database Schema & Core Models](#database-schema--core-models)
  - [Alembic Migration Chain](#alembic-migration-chain)
  - [MongoDB Collections](#mongodb-collections)
  - [Qdrant Collections & Vector Cache](#qdrant-collections--vector-cache)
- [10. AI & Interview Pipeline](#10-ai--interview-pipeline)
  - [Execution Flow](#execution-flow)
  - [Zero-Fabrication Integrity Policy](#zero-fabrication-integrity-policy)
  - [Provider Fallbacks & Retries](#provider-fallbacks--retries)
- [11. Security Architecture](#11-security-architecture)
- [12. Operations & Troubleshooting](#12-operations--troubleshooting)
- [13. Production Deployment](#13-production-deployment)
- [14. Cross-Repository References](#14-cross-repository-references)

---

## 1. Project Overview

The Progeni Atlas backend is an enterprise-grade service engineered to conduct automated technical interviews. It provides:

* **Unified Primary Storage**: MongoDB Atlas for authoritative data and practice sessions, Qdrant for vector embeddings, and Cloudinary for media assets.
* **State Machine-Enforced Interview Lifecycle**: Turn-by-turn interview orchestration with atomic row locking and optimistic concurrency tracking (`state_version`).
* **Zero-Fabrication AI Architecture**: AI question generation, speech synthesis, speech-to-text, and answer evaluation operate strictly with real providers (or verified fallback providers). Silent heuristic score fabrication is strictly prohibited.
* **Real-Time Proctoring Ingestion**: Ingests webcam, tab-switch, and multi-face telemetry with server-side deduplication, session rate limiting, and threshold evaluation.
* **Code Execution Sandbox**: Execution of candidate Python, JavaScript, and TypeScript code submissions via Judge0.
* **Companion Phone WebRTC Pairing**: LiveKit WebRTC token generation and ephemeral pairing workflows allowing candidates to stream smartphone camera/mic feeds.

---

## 2. Technology Stack

Verified from `requirements.txt`, lockfiles, and active runtime modules:

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Language** | Python | `>=3.10, 3.12 verified` | Core programming language runtime |
| **Web Framework** | Flask | `>=3.0.0` | HTTP routing, blueprint management, request dispatching |
| **WSGI Server** | Gunicorn | `23.0.0` | Multi-worker WSGI HTTP server |
| **Primary Database** | MongoDB Atlas / PyMongo | `>=4.6.0` | Authoritative application database for all models, users, sessions, scorecards, and audit logs |
| **Document DB** | PyMongo | `>=4.6.0` | Client driver for MongoDB Atlas (hardware diagnostics and practice drills) |
| **Vector DB** | Qdrant Client | `>=1.7.0` | High-dimensional vector storage for resumes, rubrics, and question banks |
| **Authentication** | PyJWT | `2.10.1` | Cryptographic JWT signing and verification (`HS256`) |
| **Password Hashing** | Passlib & Bcrypt | `1.7.4` / `4.2.1` | Secure password hashing with salt generation |
| **Configuration** | Pydantic & Pydantic-Settings | `2.10.4` / `2.7.0` | Type-safe environment validation and fail-fast startup assertions |
| **Rate Limiting** | Flask-Limiter | `>=3.5.0` | IP and User-keyed rate limiting backed by Redis or memory |
| **Redis** | Redis-py | `>=5.0.0` | Key-value storage for distributed rate limiting in production |
| **HTTP Client** | HTTPX | `0.28.1` | Asynchronous/synchronous HTTP client for OpenAI, Gemini, and Judge0 calls |
| **WebRTC SDK** | LiveKit API | `>=1.0.0, <2.0.0` | Access token issuance and WebRTC video room grants |
| **Media Storage** | Cloudinary | `1.46.2` | Persistent cloud asset storage for candidate resumes and media |
| **PDF Generation** | ReportLab | `>=4.2.5, <5.0.0` | Server-side candidate evaluation dossier PDF compilation |
| **Document Parsing** | PyMuPDF (`fitz`) & python-docx | Latest | Text and structure extraction from candidate resume files |
| **Schema Validation Script** | `scripts/check_migrations.py` | Built-in | Automated schema drift and linear revision integrity checker |

---

## 3. Prerequisites

Before installing the backend, ensure the following services and runtimes are available:

1. **Python**: Version `3.10` or higher (`3.12` recommended).
2. **MongoDB Atlas**: MongoDB Atlas cluster with connection URI (`MONGODB_URI`). MongoDB Atlas is the **primary authoritative database** for all models, users, interview sessions, and system state.
4. **Qdrant Vector Database** (Optional / Recommended): Qdrant cluster (`QDRANT_URL` or local Docker on port 6333) for indexing candidate resume embeddings and job rubrics.
5. **Cloudinary** (Required for Resumes): Cloudinary account (`CLOUDINARY_URL`) for persistent resume storage.
6. **OpenAI or Gemini API Keys**: Valid API keys for LLM question generation, STT audio transcription, and TTS speech synthesis.

---

## 4. Repository Structure & WSGI Architecture

### Directory Tree

```
backend/
├── alembic.ini                   # Alembic migration configuration
├── alembic/
│   ├── env.py                    # Alembic runtime environment
│   └── versions/                 # 24 linear migration revision scripts
├── app/                          # Application package
│   ├── __init__.py
│   ├── config.py                 # Pydantic Settings & fail-fast validation
│   ├── database.py               # SQLAlchemy engine & session factory
│   ├── models/                   # SQLAlchemy declarative models
│   │   └── __init__.py           # Users, Orgs, Sessions, Questions, Rubrics
│   └── services/                 # Business logic & external service integrations
│       ├── interview_engine.py   # State machine, turn transitions, scorecards
│       ├── interview_orchestrator.py # High-level interview coordinator
│       ├── llm_service.py        # Question generation & multi-metric evaluation
│       ├── voice_service.py      # OpenAI/Gemini TTS and STT transcription
│       ├── rubric_service.py     # Competency weighting and scorecard calculations
│       ├── resume_parser.py      # PDF/DOCX text parsing and skill extraction
│       ├── vector_service.py     # Qdrant client & in-memory embedding cache
│       ├── otp_service.py        # HMAC-SHA256 OTP generation and verification
│       ├── cloudinary_service.py # Cloudinary upload and asset signing
│       ├── audit.py              # Security audit logging
│       ├── pii.py                # PII sanitization for LLM prompts
│       ├── security.py           # Token parsing & password utilities
│       └── skill_sync.py         # Candidate skill profiling
├── core/                         # Low-level core modules
│   ├── auth.py                   # JWT verification, cookie CSRF, tenant scoping
│   ├── db.py                     # Primary MongoDB Atlas database client
│   └── vectordb.py               # Qdrant connection management
├── database/
│   ├── mongo/
│   │   ├── connection.ts         # MongoDB Atlas connection definition
│   │   └── seed.sql              # Seed data for default configurations
│   └── mongo/                    # MongoDB initialization scripts
├── scripts/
│   └── check_migrations.py      # Automated schema drift and head verification
├── uploads/                      # Temporary local upload cache
├── companion.py                  # LiveKit WebRTC & phone pairing Blueprint
├── app.py                        # Master Flask application entry point
├── wsgi.py                       # WSGI entry point resolving module ambiguity
└── requirements.txt              # Production dependency manifest
```

### WSGI Module Resolution (`wsgi.py` vs `app.py`)

The repository contains both `backend/app.py` (the Flask application) and `backend/app/` (a package containing models, config, and services). When running `gunicorn app:app` from the `backend/` directory, standard Python import resolution captures the directory `backend/app/` instead of `app.py`, raising:

```
AttributeError: module 'app' has no attribute 'app'
```

To resolve this unambiguously:
- **`wsgi.py`** loads `backend/app.py` explicitly by file path under the unique module name `progeni_atlas_backend_app`, ensuring the package name never conflicts.
- **Always run Gunicorn with `wsgi:app`**:
  ```bash
  gunicorn wsgi:app
  ```
- Alternatively, direct execution via `python wsgi.py` or `python app.py` works properly during local development.

---

## 5. Installation and Startup

### 1. Virtual Environment Setup

Create and activate a dedicated virtual environment:

```bash
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

### 2. Installing Dependencies

Install dependencies from `requirements.txt`:

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Copy the template environment file to `.env`:

```bash
cp .env.example .env
```

Ensure critical variables are provided in `backend/.env`:
- `MONGODB_URI`: MongoDB Atlas connection string.
- `JWT_SECRET`: Minimum 32-character secret for signing JWTs (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).
- `OTP_PEPPER`: Secret pepper for HMAC-SHA256 OTP hashing (falls back to `JWT_SECRET`).
- `OPENAI_API_KEY` or `GEMINI_API_KEY`: Required for LLM evaluation and speech processing.
- `CLOUDINARY_URL` (or Cloudinary credentials): Required for persistent resume uploads.

### 4. Database Migration

Run Alembic to apply all migrations up to the latest revision (`0030_performance_indexes`):

```bash
# Schema is verified automatically against MongoDB Atlas
alembic upgrade head

# Verify migration integrity and schema alignment
python scripts/check_migrations.py
```

### 5. Running the Application

#### Development Mode
Run the development server on port `5000`:

```bash
python wsgi.py
# or
python app.py
```

The server binds to `http://0.0.0.0:5000`.

#### Production Mode
Serve the application using Gunicorn:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 --timeout 120 wsgi:app
```

### 6. Health Checks & Diagnostics

Verify server status:

```bash
# 1. Simple liveness probe
curl http://localhost:5000/health

# 2. Comprehensive subsystem status (MongoDB, Qdrant, Secrets)
curl http://localhost:5000/api/health
```

### 7. Test & Verification Workflow

- **Backend Schema & Migration Integrity**:
  The backend includes a dedicated gate script verifying that all migrations form a single linear chain and that the live database matches the ORM model definitions:
  ```bash
  python scripts/check_migrations.py
  ```
- **End-to-End Interview State Machine Tests**:
  The complete automated test suite for the interview state machine, speech preview logic, audio handling, and auto-submit contracts is maintained in the frontend workspace:
  ```bash
  cd ../frontend/web
  npm run test
  ```
  *(See [Frontend README](../frontend/README.md) for details on the 31 passing unit tests).*

---

## 6. Environment Variables Reference

### Server & Security

| Variable Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `5000` | Port to bind the HTTP server. |
| `APP_ENV` | Optional | `development` | Mode (`development`, `staging`, `production`). In production, strict CORS and Redis rate limiting are enforced. |
| `FLASK_DEBUG` | Optional | `false` | Enable Flask debug reloader (keep `false` when running behind Next.js proxy to prevent socket drops). |
| `JWT_SECRET` | **Required** | *None* | Minimum 32-character secret for signing access and refresh JWTs. Startup fails if missing or set to a placeholder. |
| `SWAMI_SECRET_KEY` | Optional | *None* | Secondary alias for `JWT_SECRET` maintained for backwards compatibility. |
| `JWT_ALGORITHM` | Optional | `HS256` | Cryptographic algorithm for JWTs. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | `30` | Access token lifespan. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional | `14` | Refresh token lifespan (tokens are strictly single-use). |
| `OTP_PEPPER` | **Required** | *Falls back to JWT_SECRET* | Secret pepper for HMAC-SHA256 OTP hashing. Never stored in the database. |
| `CORS_ORIGINS` | Optional | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of allowed origins. In production, must be HTTPS. |
| `RATE_LIMIT_STORAGE_URI` | Optional | `memory://` | Storage backend for Flask-Limiter. In production this **must** be a shared store — `redis://`, `rediss://`, `valkey://` or `valkeys://` (e.g. `redis://<host>:<port>/<db>`). `memory://`, a missing value or an unreachable store abort production startup (fail closed) with a secret-free error. Outside production `memory://` remains fine. |
| `RATE_LIMIT_ENABLED` | Optional | `true` | Enables Flask-Limiter. Setting it to `false` in production is rejected at startup; outside production it only disables the limiter and leaves every other security control untouched. |

### Polyglot Database Infrastructure

| Variable Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `MONGODB_URI` | **Required** | *None* | MongoDB Atlas connection string (`mongodb+srv://...`). This is the **canonical** connection key. |
| `DB_POOL_MIN` | Optional | `3` | Minimum persistent database pool connections in `core/db.py`. |
| `DB_POOL_MAX` | Optional | `25` | Maximum database pool connections in `core/db.py`. |
| `SQLALCHEMY_POOL_SIZE` | Optional | `5` | SQLAlchemy engine connection pool size. |
| `SQLALCHEMY_MAX_OVERFLOW` | Optional | `5` | SQLAlchemy engine max overflow connections. |
| `MONGO_URI` | Optional | *None* | **Legacy alias** for `MONGODB_URI`, kept for backward compatibility. `MONGODB_URI` always wins when both are set; no default value is applied. |
| `QDRANT_URL` / `QDRANT_HOST` | Optional | `http://localhost:6333` | Qdrant vector database URL or hostname. |
| `QDRANT_API_KEY` | Optional | *None* | API key for authenticated Qdrant Cloud clusters. |
| `EMBEDDING_MODEL` | Optional | `text-embedding-3-small` | Model name for semantic vector embeddings (1536 dimensions). |

### LLM & AI Engine Configuration

| Variable Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `LLM_PROVIDER` | Optional | `openai` | Primary LLM provider (`openai`). |
| `OPENAI_API_KEY` | **Required** | *None* | OpenAI API Key for question generation and evaluation. |
| `OPENAI_API_BASE` | Optional | `https://api.openai.com/v1` | OpenAI endpoint base URL. |
| `LLM_MODEL_PRIMARY` / `LLM_MODEL` | Optional | `gpt-4o-mini` | Model for interview question generation and answer scoring. |
| `LLM_FALLBACK_PROVIDER` | Optional | `openrouter` | Secondary provider invoked when OpenAI returns 429, 5xx, or network errors. |
| `OPENROUTER_API_KEY` | Optional | *None* | API Key for OpenRouter fallback. |
| `LLM_MODEL_FALLBACK` | Optional | `anthropic/claude-3.5-haiku` | Fallback model via OpenRouter. |
| `INTERVIEW_LLM_TEMPERATURE` | Optional | `0.82` | LLM generation temperature (validated between `0.75` and `0.90`). |
| `MOCK_PROVIDERS` | Optional | `false` | Enable simulated providers for offline development. Refuses to boot if `true` in production. |

### Voice & Audio Services (TTS & STT)

| Variable Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `STT_PROVIDER` | Optional | `auto` | Speech-to-text provider (`auto`, `gemini`, `openai`). In `auto` mode, Gemini is preferred when configured. |
| `GEMINI_API_KEY` / `GEMINI_API` | Optional | *None* | Google Gemini API key used for STT audio transcription. |
| `GEMINI_STT_MODEL` | Optional | `gemini-3.5-transcribe` | Gemini audio transcription model. |
| `TTS_MODEL` | Optional | `tts-1` | OpenAI text-to-speech synthesis model. |
| `TTS_VOICE` | Optional | `nova` | Voice timbre for AI interviewer audio (`nova`, `alloy`, `echo`, `shimmer`). |
| `TTS_FALLBACK_PROVIDER` | Optional | `none` | Fallback provider if primary TTS fails (`none`, `gtts`). |
| `STT_MAX_UPLOAD_BYTES` | Optional | `10485760` (10 MB) | Maximum permitted audio upload file size. |
| `STT_TIMEOUT_SECONDS` | Optional | `90.0` | Timeout for speech-to-text API calls. |
| `TTS_TIMEOUT_SECONDS` | Optional | `15.0` | Timeout for text-to-speech synthesis API calls. |

### Storage, Email & Integrations

| Variable Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `CLOUDINARY_URL` | **Required** | *None* | Full Cloudinary credentials URL (`cloudinary://key:secret@cloud_name`). |
| `CLOUDINARY_CLOUD_NAME` | Optional | *None* | Individual Cloudinary cloud name (if URL is not used). |
| `CLOUDINARY_API_KEY` | Optional | *None* | Individual Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Optional | *None* | Individual Cloudinary API secret. |
| `MAX_UPLOAD_BYTES` | Optional | `20971520` (20 MB) | Maximum permitted resume file size. |
| `ALLOWED_RESUME_MIME` | Optional | `application/pdf` | Comma-separated allowed resume MIME types. |
| `SMTP_HOST` | Optional | *None* | SMTP server hostname for sending email OTP codes (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | Optional | `465` | SMTP SSL port. |
| `SMTP_USER` / `SMTP_PASS` | Optional | *None* | SMTP credentials. |
| `LIVEKIT_URL` | Optional | *None* | LiveKit WebRTC server address (`wss://...`). |
| `LIVEKIT_API_KEY` | Optional | *None* | LiveKit Server API Key. |
| `LIVEKIT_API_SECRET` | Optional | *None* | LiveKit Server API Secret. |

### Proctoring & Code Execution

| Variable Name | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PROCTORING_WARNING_THRESHOLD` | Optional | `5` | Authoritative warning threshold before a session is flagged for recruiter review. |
| `PROCTORING_DEV_MODE` | Optional | `false` | When `true`, suppresses session flag/termination for testing. Cannot be enabled in production. |
| `PROCTORING_TERMINATE_ON_FLAGGED` | Optional | `false` | When `true`, transitions the session to `PROCTORING_VIOLATION` upon exceeding the threshold. |
| `JUDGE0_URL` / `JUDGE0_API_URL` | Optional | *None* | Base URL of the Judge0 code execution API. |
| `JUDGE0_API_KEY` | Optional | *None* | Authentication token for Judge0 instance. |

---

## 7. Backend Architecture & Request Flow

### Polyglot Storage Separation

Progeni Atlas separates persistence across dedicated stores based on access characteristics:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Progeni Atlas Backend                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
│   MongoDB Atlas DB    │ │   MongoDB Atlas   │ │      Qdrant DB        │
│  (Single Relational   │ │ (Document Logs &  │ │   (Vector Search)     │
│    Source of Truth)   │ │  Practice Data)   │ │                       │
├───────────────────────┤ ├───────────────────┤ ├───────────────────────┤
│ • Users & Orgs        │ │ • Hardware logs   │ │ • Resume chunks       │
│ • Interview sessions  │ │ • Lobby checks    │ │ • Job rubrics         │
│ • Questions & answers │ │ • Practice drills │ │ • Question banks      │
│ • Scorecards & events │ │                   │ │                       │
│ • Single-use OTPs     │ │                   │ │                       │
└───────────────────────┘ └───────────────────┘ └───────────────────────┘
```

### Authentication, JWT Security & Cookie CSRF

1. **Token Ingestion**:
   `core/auth.py` checks for credentials in two locations:
   * `Authorization: Bearer <token>` (Mobile apps and API clients).
   * `tp_session` cookie (Web browser clients).
2. **Cookie CSRF Enforcement**:
   To prevent Cross-Site Request Forgery via browser cookies, state-mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) must either present an `Origin` or `Referer` matching `CORS_ORIGINS`, or be explicitly marked by the browser as `Sec-Fetch-Site: same-origin` (for same-origin `/api` proxy requests). Same-site and cross-site requests still require an exact allowlist match. Bearer token requests are exempt from CSRF checks.
3. **Database Identity Resolution**:
   The token subject (`sub`) is resolved against the MongoDB `users` collection on each authenticated request. Suspended accounts receive `403 Forbidden`, while deleted accounts receive `401 Unauthorized`.

### Multi-Tenancy & Access Scoping

Every database entity is linked to an `org_id`:
* Recruiter and admin endpoints enforce `require_org_scope`, ensuring users cannot access jobs, rubrics, or candidates from other organizations.
* Platform administrators (`role = super_admin`) bypass organizational filters.
* Candidate endpoints verify that the requesting user's ID matches `candidate_id` on the interview session (`assert_candidate_session_access`).

### Interview Lifecycle State Machine

The interview workflow is managed by a strict state machine implemented in `app/services/interview_engine.py` and `app/services/interview_orchestrator.py`:

```mermaid
stateDiagram-v2
    [*] --> AUTHENTICATED
    AUTHENTICATED --> INTERVIEW_AUTHORIZED
    INTERVIEW_AUTHORIZED --> LOBBY
    LOBBY --> PROCTORING_PREFLIGHT
    PROCTORING_PREFLIGHT --> MEDIA_READY
    MEDIA_READY --> INTERVIEW_STARTED
    INTERVIEW_STARTED --> AI_GREETING
    AI_GREETING --> QUESTION_GENERATING
    QUESTION_GENERATING --> QUESTION_READY
    QUESTION_READY --> INTERVIEWER_SPEAKING
    INTERVIEWER_SPEAKING --> LISTENING
    LISTENING --> CANDIDATE_RESPONDING
    CANDIDATE_RESPONDING --> TRANSCRIBING
    TRANSCRIBING --> ANSWER_READY
    ANSWER_READY --> EVALUATING
    EVALUATING --> INTERVIEWER_RESPONDING
    INTERVIEWER_RESPONDING --> FOLLOW_UP_OR_NEXT_QUESTION
    FOLLOW_UP_OR_NEXT_QUESTION --> QUESTION_GENERATING: Next Turn
    FOLLOW_UP_OR_NEXT_QUESTION --> INTERVIEW_COMPLETING: Turn Limit Reached
    INTERVIEW_COMPLETING --> FINAL_SCORING
    FINAL_SCORING --> REPORT_GENERATED
    REPORT_GENERATED --> COMPLETED
    COMPLETED --> [*]
```

* **Optimistic Concurrency**: Every state change increments `state_version`. Stale client requests receive `409 Conflict` with the current state.
* **Row Locking**: Transitions lock the session row (`with_for_update()`) to prevent race conditions during concurrent answer submissions.

---

## 8. Complete API Documentation

### 1. Health & System Diagnostics

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | Public | Lightweight liveness probe returning `{ "status": "ok", "app": "progeni-atlas-api" }`. |
| `GET` | `/api/health` | Public | Subsystem readiness probe returning connectivity status for MongoDB, Qdrant, and missing secret configurations. |
| `GET` | `/api/files/local/<path:filepath>` | Authenticated | Streams local file uploads when local disk storage is enabled as fallback. |
| `POST` | `/api/evaluator/dynamic-parameters` | Recruiter / Admin | Adjusts dynamic evaluation parameters (weights, thresholds) for the active tenant. |

### 2. Authentication & Account Management

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/check-email` | Public | Checks if an email is already registered. Body: `{ "email": string }`. |
| `POST` | `/api/auth/register` | Public | Registers a new user and dispatches a 6-digit email OTP. Body: `{ "email": string, "password": string, "full_name": string, "role": "candidate" \| "recruiter" }`. |
| `POST` | `/api/auth/verify-otp` | Public | Verifies OTP code, activates user account, sets HttpOnly `tp_session` cookie, and returns access token. Body: `{ "email": string, "code": string }`. |
| `POST` | `/api/auth/resend-otp` | Public | Generates and sends a new OTP code subject to a 30-second cooldown. Body: `{ "email": string }`. |
| `GET` | `/api/auth/otp-status` | Public | Returns remaining cooldown seconds and OTP TTL. Query param: `?email=...`. |
| `POST` | `/api/auth/login` | Public | Authenticates credentials, sets `tp_session` cookie, and returns `{ "accessToken": string, "user": object }`. Body: `{ "email": string, "password": string }`. |
| `POST` | `/api/auth/refresh` | Cookie / Token | Single-use refresh token exchange. Sets new access token cookie and rotates refresh token. |
| `POST` | `/api/auth/logout` | Optional | Invalidates the active refresh token and clears the `tp_session` cookie. |
| `POST` | `/api/auth/forgot-password` | Public | Sends a password reset OTP code to the requested email. Body: `{ "email": string }`. |
| `POST` | `/api/auth/reset-password` | Public | Resets password after verifying OTP. Body: `{ "email": string, "code": string, "new_password": string }`. |
| `POST` | `/api/auth/team-invite/accept` | Public | Accepts an organization team invitation token. Body: `{ "token": string, "password": string, "full_name": string }`. |

### 3. Candidate Profile, Resumes & Skills

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/candidate/profile` | Candidate | Returns profile details: `full_name`, `email`, `course`, `branch`, `academic_year`, `phone`, `bio`. |
| `PUT` | `/api/candidate/profile` | Candidate | Updates profile fields. Body: `{ "full_name": string, "phone"?: string, "academic_year"?: string, ... }`. |
| `GET` | `/api/candidate/resume` | Candidate | Returns all uploaded candidate resumes with parsing status and download URLs. |
| `POST` | `/api/candidate/resume` | Candidate | Multipart upload (`file`). Uploads resume to Cloudinary, extracts text via PyMuPDF/docx, generates skills, and indexes chunks in Qdrant. |
| `GET` | `/api/candidate/skills` | Candidate | Returns candidate's active verified skills with proficiency and source tags. |
| `POST` | `/api/candidate/skills` | Candidate | Adds a skill to the candidate's profile. Body: `{ "name": string, "proficiency"?: number }`. |
| `DELETE`| `/api/candidate/skills/<skill_id>`| Candidate | Removes a skill from the candidate's profile. |
| `GET` | `/api/candidate/skills/suggestions` | Candidate | Returns recommended skills based on parsed resumes and target jobs. |
| `GET` | `/api/candidate/skill-insights` | Candidate | Returns the candidate's *assessed* skills only, each scored 0-100 from real-interview scorecard competencies and completed practice drills, plus an overall readiness score. Skills with no interview/practice evidence are omitted. |
| `DELETE`| `/api/candidate/account` | Candidate | Permanently deletes candidate account, uploaded resumes, and associated telemetry. |
| `POST` | `/api/candidate/diagnostics` | Candidate | Ingests candidate hardware and network diagnostic logs into MongoDB. |

### 4. Candidate Invitations & Dashboard

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/candidate/dashboard` | Candidate | Returns candidate readiness score, upcoming interviews, resume status, and unread notifications (also aliased at `/dashboard-data`). |
| `GET` | `/api/candidate/interviews` | Candidate | Returns only real interviews scheduled by a recruiter/HR (AI `mode='practice'` sessions are excluded). Each item carries the session's real `roleTitle`/`companyName` and a `reportUrl` only when a score/report exists. |
| `GET` | `/api/candidate/invitations` | Candidate | Returns all job interview invitations sent to the candidate. |
| `POST` | `/api/candidate/invitations/<id>/respond`| Candidate | Accepts or declines an interview invitation. Body: `{ "action": "accept" \| "decline" }`. |
| `GET` | `/api/candidate/notifications` | Candidate | Returns notifications (invites, completed evaluations) for the candidate. |
| `GET` | `/api/candidate/practice/job-roles` | Candidate | Returns role suggestions for the practice setup dropdown, sourced from live job postings plus the candidate's own past target roles (no hardcoded enum). |
| `POST` | `/api/candidate/practice/suggest-jd` | Candidate | Drafts a job description for a typed role. Reuses a matching live job posting when one exists, otherwise generates it on demand via the LLM. Body: `{ "job_role": string }`. Returns `{ job_description, source, job_title, company_name? }`. |
| `POST` | `/api/candidate/practice-interview` | Candidate | Starts a 5-turn mock practice interview with instant turn-by-turn feedback (aliased at `/practice`). Creates an internal `mode='practice'` session that is never listed as a real interview. |

### 5. Recruiter Jobs, Rubrics & Dossiers

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/recruiter/dashboard` | Recruiter | Returns recruiter hiring metrics: active jobs, pending invitations, completed sessions. |
| `GET` | `/api/recruiter/profile` | Recruiter | Returns recruiter user and organization metadata. |
| `PUT` | `/api/recruiter/profile` | Recruiter | Updates recruiter profile information. |
| `POST` | `/api/recruiter/team-invite` | Recruiter | Sends an email invite to join the recruiter's organization. Body: `{ "email": string, "role": string }`. |
| `GET` | `/api/recruiter/jobs` | Recruiter | Returns all jobs belonging to the recruiter's organization. |
| `POST` | `/api/recruiter/jobs` | Recruiter | Creates a new job requisition. Body: `{ "title": string, "description": string, "department": string, ... }`. |
| `POST` | `/api/recruiter/invite-candidate` | Recruiter | Invites a candidate by email to interview for a job. Body: `{ "job_id": string, "candidate_email": string }`. |
| `GET` | `/api/recruiter/rubrics` | Recruiter | Lists evaluation rubrics and competency criteria. |
| `POST` | `/api/recruiter/rubrics` | Recruiter | Creates or updates an evaluation rubric. Body: `{ "job_id": string, "weights": object, "criteria": object }`. |
| `POST` | `/api/recruiter/generate-rubric` | Recruiter | Uses LLM to automatically generate evaluation rubrics from a job description. Body: `{ "job_id": string }`. |
| `GET` | `/api/recruiter/dossiers` | Recruiter | Returns comprehensive candidate evaluation dossiers with overall scores and hiring recommendations. |

### 6. Super Admin & Platform Oversight

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/super-admin/overview` | Super Admin | Returns platform-wide statistics: total users, organizations, active sessions, and database counts. |

### 7. Interview Session Lifecycle & Room Data

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/interview-sessions/<id>/lobby-info` | Candidate / Recruiter | Returns session details, scheduled time, job title, and candidate identity before entering the lobby. |
| `POST` | `/api/v1/interview-sessions/<id>/lobby-check` | Candidate | Records hardware verification (camera, mic, network) before lobby check-in. |
| `POST` | `/api/v1/interview-sessions/<id>/lobby-checkin` | Candidate | Checks in to the interview lobby, transitioning state from `INTERVIEW_AUTHORIZED` to `LOBBY`. |
| `GET` | `/api/v1/interview-sessions/<id>/room-data` | Candidate / Recruiter | Fetches active room state, current question, and duration timer for room hydration. |
| `GET` | `/api/v1/interview-sessions/<id>` | Candidate / Recruiter | Returns top-level session record, duration, and status (aliased at `/api/interview-reports/<id>`). |
| `GET` | `/api/v1/interview-sessions/<id>/questions` | Candidate / Recruiter | Returns questions asked during the session. |
| `GET` | `/api/v1/interview-sessions/<id>/scorecard` | Candidate / Recruiter | Returns the final scorecard: overall score, recommendation, strengths, concerns, and competency scores. |
| `GET` | `/api/v1/interview-sessions/<id>/report` | Candidate / Recruiter | Returns aggregated evaluation dossier including session metadata and scorecards. |
| `GET` | `/api/v1/interview-sessions/<id>/report/pdf` | Candidate / Recruiter | Generates and streams a PDF evaluation dossier via ReportLab. |

### 8. Live Turn Flow: Start, Audio & Answers

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/interview/<id>/preflight` | Candidate | Verifies proctoring and media capability, moving the session to `MEDIA_READY`. Body: `{ "camera": boolean, "microphone": boolean }`. |
| `POST` | `/api/interview/<id>/media-state` | Candidate | Heartbeat endpoint reporting WebRTC and media readiness during the interview. |
| `POST` | `/api/interview/<id>/start` | Candidate | Starts the interview, generates the initial question, and transitions state to `QUESTION_READY`. |
| `POST` | `/api/interview/<id>/speak` | Candidate | Generates synthesized interviewer voice audio. Request text must belong to dialogue from the active session. Returns binary audio. |
| `POST` | `/api/interview/<id>/transcribe` | Candidate | Accepts multipart audio recording (`audio`), transcribes speech via Gemini or Whisper, and returns `{ "transcript": string }`. |
| `POST` | `/api/interview/<id>/answer` | Candidate | Submits candidate answer text. Evaluates depth and correctness with LLM, determines follow-up or next question, and updates state. Body: `{ "answer": string, "question_id": string }`. |
| `GET` | `/api/interview/<id>/state` | Candidate / Recruiter | Authoritative polling endpoint returning current lifecycle state, active question, turn count, and answer history. |
| `POST` | `/api/interview/<id>/retry` | Candidate | Recovers from transient provider errors (`MEDIA_ERROR`, `AI_PROVIDER_ERROR`, `TRANSCRIPTION_ERROR`). Body: `{ "retry_of": string }`. |
| `POST` | `/api/interview/<id>/reset-listening` | Candidate (Dev Only) | Resets session back to `LISTENING` for debugging. Disabled in production. |
| `POST` | `/api/interview/<id>/finish` | Candidate | Finalizes interview, calculates competency weights, produces scorecard, and marks session `COMPLETED`. Idempotent. |

### 9. Proctoring Event Ingestion

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/interview/<id>/proctoring/events` | Candidate | Ingests integrity signals (`no_face`, `multiple_faces`, `face_out_of_frame`, `fullscreen_exit`, `tab_switch`). Enforces 1-second deduplication and 30 events/minute session rate limits. Returns current warning count. |

### 10. Code Execution Sandbox

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/code/run` | Authenticated | Executes standalone code snippets in Judge0. Limited to 10 requests/minute. Body: `{ "code": string, "language": "python" \| "javascript" \| "typescript" }`. |
| `POST` | `/api/v1/interview-sessions/<id>/code-run` | Candidate | Executes code submitted within an interview coding stage, returning `stdout`, `stderr`, and execution time. |

### 11. Companion Phone WebRTC Pairing

Registered under `/api/v1` by `backend/companion.py`:

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/interview-sessions/<id>/companion/pair` | Candidate | Generates a 5-minute single-use pairing token stored as SHA-256 in `companion_pairings`. Returns pairing URL for QR display. |
| `POST` | `/api/v1/companion/redeem` | Public (Rate-Limited) | Redeems pairing token from smartphone, marks pairing used, and returns LiveKit WebRTC AccessToken with publish-only video grants. Body: `{ "token": string }`. |
| `POST` | `/api/v1/interview-sessions/<id>/companion/viewer-token` | Candidate | Issues a subscribe-only LiveKit AccessToken for the desktop client to display the phone's camera feed. |
| `POST` | `/api/v1/interview-sessions/<id>/candidate-media-token` | Candidate | Issues a primary candidate media token for direct desktop WebRTC publishing. |
| `POST` | `/api/v1/interview-sessions/<id>/companion/event` | Companion Token | Ingests telemetry and connectivity status updates from the companion phone. |

### 12. Practice Drills & Readiness

| Method | Endpoint | Auth | Purpose & Details |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/v1/practice/drills` | Candidate | Returns catalog of technical practice drills with user's historical best scores. |
| `POST` | `/api/v1/practice/sessions/evaluate-turn` | Candidate | Scores a practice answer using real LLM and generates next question without persisting an authoritative scorecard. |
| `POST` | `/api/v1/practice/sessions/finalize` | Candidate | Finalizes practice session and recalculates candidate overall readiness score in MongoDB. |

---

## 9. Database & Alembic Migrations

### Database Schema & Core Models

Defined using SQLAlchemy 2.0 declarative models in `app/models/__init__.py`:

* `organizations`: Multi-tenant organization boundaries and tier configurations (`starter`, `growth`, `enterprise`).
* `users`: User identity, password hashes, verified roles (`candidate`, `recruiter`, `admin`, `super_admin`), and profile columns (`course`, `branch`, `academic_year`).
* `jobs`: Hiring requisitions tied to organizations.
* `rubric_versions`: Competency weights and scoring criteria.
* `interview_sessions`: Authoritative interview session state, mode (`real` vs `practice`), duration, total turns, and `state_version` concurrency counter.
* `interview_questions`: Questions presented to candidates with turn indices and competency targets.
* `interview_responses`: Candidate answers, relevance/depth/correctness scores, evaluator notes, and spoken interviewer replies.
* `scorecards`: Final evaluations, overall scores, hire recommendations (`STRONG_HIRE`, `HIRE`, `LEAN_HIRE`, `LEAN_REJECT`, `REJECT`), and executive summaries.
* `competency_scores`: Detailed category scores linked to scorecards.
* `proctoring_events`: Recorded integrity signals with severity ratings (`INFO`, `WARNING`, `CRITICAL`).
* `companion_pairings`: Ephemeral SHA-256 pairing hashes and expiration timestamps.
* `refresh_tokens`: Single-use refresh token hashes.
* `otp_codes`: HMAC-SHA256 hashed 6-digit verification codes.

### Alembic Migration Chain

The migration graph is verified linear across 24 revisions with head at **`0030_performance_indexes`**:

1. `0007_interview_conversation_state`
2. `0008_align_staging_schema`
3. `0009_create_otp_codes`
4. `0010_add_profile_columns`
5. `0011_rubric_versions`
6. `0012_notifications_type`
7. `0013_org_invites_and_profile_fields`
8. `0014_add_interview_session_mode`
9. `0015_relax_legacy_interview_columns`
10. `0016_drop_legacy_session_xor_check`
11. `0017_add_coding_stage_label`
12. `0018_interview_invitations`
13. `0019_interview_response_idempotency`
14. `0020_proctoring_signal_types`
15. `0021_canonical_schema_consistency`
16. `0022_final_hardening`
17. `0023_final_blockers`
18. `0024_schema_convergence`
19. `0025_interviewer_voice`
20. `0026_interview_lifecycle`
21. `0027_lifecycle_authorization_version`
22. `0028_add_transition_metadata_json`
23. `0029_runtime_proctoring_event_types`
24. `0030_performance_indexes`

To apply or verify migrations:
```bash
# Upgrade database to head
alembic upgrade head

# Validate schema drift against models
python scripts/check_migrations.py
```

### MongoDB Collections

Managed via PyMongo for non-relational diagnostic logs:
* `HardwareDiagnostic`: Audio/video hardware test records from pre-interview checks.
* `lobby_checks`: Candidate lobby attendance and connection records.
* `practice_sessions`: Turn history and readiness scores for mock drills.

### Qdrant Collections & Vector Cache

Three collections store 1536-dimensional embeddings:
* `candidate_resumes`: Chunks of candidate resume text indexed for contextual question generation.
* `job_rubrics`: Competency definitions and rubric guidance.
* `question_banks`: Evaluated technical question repositories.

**Vector Cache Optimization**:
`app/services/vector_service.py` maintains an in-memory embedding cache (`_EMBEDDING_CACHE`) keyed by `(provider, model, sha256(text))`. This eliminates redundant embedding HTTP requests across question generation and evaluation turns for identical job criteria.

---

## 10. AI & Interview Pipeline

### Execution Flow

```text
[1. Context Retrieval]
Candidate Resume (Qdrant) + Job Rubric (Qdrant) -> Vector Retrieval Context
                           │
                           ▼
[2. Dynamic Question Generation]
LLM Service (OpenAI gpt-4o-mini with OpenRouter Haiku fallback)
Generates targeted technical question aligned with active competency
                           │
                           ▼
[3. Voice Synthesis (TTS)]
voice_service (configured: OpenAI tts-1, voice: nova; effective provider is
reported by GET health voice status - when OPENAI_API_KEY is missing or a
placeholder, the configured gtts fallback serves the audio instead)
Generates candidate-facing audio streamed to the browser
                           │
                           ▼
[4. Speech Transcription (STT)]
Candidate audio uploaded via POST /transcribe
Transcribed via Google Gemini 3.5 Transcribe (or Whisper fallback)
                           │
                           ▼
[5. Multi-Metric Answer Evaluation]
LLM evaluates:
  • Relevance Score (0-100)
  • Depth Score (0-100)
  • Correctness Score (0-100)
  • Missing Concepts & Evaluator Notes
                           │
                           ▼
[6. State Transition & Follow-Up]
State machine determines whether to ask a follow-up or advance stage
                           │
                           ▼
[7. Final Scorecard Compilation]
Weighted competency score calculation via RubricService -> Final Dossier
```

### Zero-Fabrication Integrity Policy

The backend enforces strict data integrity rules:
1. **No Fake Scores**: If LLM evaluation providers are unavailable, the API returns HTTP `502 Bad Gateway` rather than injecting fallback or heuristic scores.
2. **No Mock Audio**: If speech synthesis fails, an explicit `speech_unavailable` error is returned; silent audio buffers are never returned.
3. **No Fabricated Transcripts**: If STT transcription produces empty results or fails, the API returns a retryable error rather than assuming an answer.

### Provider Fallbacks & Retries

* **LLM Calls**: If the primary provider (OpenAI) fails with HTTP `429 Rate Limit`, `5xx Server Error`, or network timeouts, the service automatically retries using the configured secondary fallback provider (OpenRouter / Claude 3.5 Haiku).
* **Speech-to-Text**: STT defaults to `auto` mode, preferring Google Gemini for fast transcription, falling back to OpenAI Whisper if Gemini credentials are not supplied.

---

## 11. Security Architecture

1. **JWT Secret Enforcement**:
   Startup fails immediately (`assert_jwt_secret_configured()`) if `JWT_SECRET` is absent, shorter than 32 characters, or matches known placeholder strings (`secret`, `changeme`, `your-secret-key`).
2. **HMAC-SHA256 OTP Hashing**:
   Verification OTP codes are hashed with a secret `OTP_PEPPER` before being stored in the database. A database dump does not expose usable codes.
3. **Password Security**:
   Passwords are salted and hashed using bcrypt (`cost = 12`).
4. **Cookie CSRF Protection**:
   Mutating cookie-authenticated requests must present an `Origin` or `Referer` matching `CORS_ORIGINS`, unless the browser marks the request `Sec-Fetch-Site: same-origin`. Same-site and cross-site requests still require an exact allowlist match.
5. **PII Sanitization**:
   `app/services/pii.py` filters social security numbers, phone numbers, and physical addresses from text before submitting prompts to external LLM providers.
6. **Rate Limiting**:
   Flask-Limiter protects sensitive endpoints against abuse (e.g. `POST /api/auth/login` is limited to 10 attempts/minute; code execution is limited to 10 runs/minute).

---

## 12. Operations & Troubleshooting

### 1. Database Connection Failures (`PyMongoError`)
* **Symptom**: `503 Database unavailable` on incoming requests.
* **Checks**: Verify MongoDB connection string in `MONGODB_URI` and ensure the database cluster is reachable:
  ```bash
  python -c "from core.db import check_mongo_connection; print(check_mongo_connection())"
  ```

### 2. Migration Drift Error (`check_migrations.py FAILED`)
* **Symptom**: Startup or CI check reports: `Live DB is at '...' but the code head is '0030_performance_indexes'`.
* **Resolution**: Apply pending Alembic migrations:
  ```bash
  alembic upgrade head
  ```

### 3. JWT Secret Startup Rejection (`SecretConfigurationError`)
* **Symptom**: Application refuses to boot with `JWT signing secret is too short` or `known placeholder value`.
* **Resolution**: Generate a secure 48-character random string:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```
  Set this value in `backend/.env` under `JWT_SECRET`.

### 4. Audio Transcription Failures (`transcription_not_configured`)
* **Symptom**: Candidate speech upload fails with code `transcription_not_configured`.
* **Resolution**: Set `GEMINI_API_KEY` or `OPENAI_API_KEY` in `backend/.env`.

### 5. Production Boot Blockers
* **Symptom**: Application raises `ConfigurationError` (from `app/config.py`) or
  `RateLimitConfigurationError` (from `core/limiter.py`) when `APP_ENV=production`.
  Under Gunicorn every worker exits with code 3 and the master halts with
  `HaltServer: Worker failed to boot.`
* **Most common cause**: `APP_ENV=production` combined with
  `RATE_LIMIT_STORAGE_URI=memory://` (or no value at all). Both fail-closed
  guards abort boot by design — `memory://` counters are per-process, so with
  multiple workers/replicas the limit would not actually be enforced.
* **Fix checklist**:
  1. Set `RATE_LIMIT_STORAGE_URI` in the deployment environment (platform
     secret / `docker run -e` / supervisor env) to a shared store, e.g.
     `redis://<host>:<port>/<db>` — the store must be reachable (startup
     issues a `PING`) and must be the **same** URI for every worker/replica.
  2. Keep `RATE_LIMIT_ENABLED=true` (setting it to `false` in production is
     rejected at startup).
  3. `MOCK_PROVIDERS` must be set to `false`.
  4. `PROCTORING_DEV_MODE` must be set to `false`.
  5. `CORS_ORIGINS` must only contain HTTPS origins.
* **Note**: error messages never echo the configured URI or credentials — do
  not add the raw value to bug reports or logs.

---

## 13. Production Deployment

### Gunicorn Execution

Run Gunicorn using the verified `wsgi.py` entry point:

```bash
gunicorn \
  --workers 4 \
  --threads 2 \
  --bind 0.0.0.0:5000 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  wsgi:app
```

### Shared Rate-Limit Store (required in production)

In production, `APP_ENV=production` requires a **shared** Redis/Valkey store.
This is a deliberate fail-closed control, enforced in two places that share a
single policy implementation (`core/rate_limit_policy.py`):

1. `core/limiter.py` — Gunicorn workers refuse to boot if
   `RATE_LIMIT_STORAGE_URI` is missing, `memory://`, malformed, unreachable
   (startup `PING`), or if `RATE_LIMIT_ENABLED=false`.
2. `app/config.py` — pydantic `Settings` validation rejects the same
   misconfiguration with `ConfigurationError`.

At request time the limiter never silently degrades: storage errors are
**not** swallowed and there is no in-memory fallback, so a store outage makes
affected requests fail (fail closed) instead of passing without a limit.

Provisioning and wiring (single host / UAT example):

```bash
# 1. One shared store per environment (host-local example; use the platform's
#    managed Redis/Valkey when available — do NOT invent hostnames/credentials).
sudo apt-get install -y redis-server
sudo systemctl enable --now redis-server

# 2. Verify reachability (never commit or paste the password).
redis-cli -h 127.0.0.1 ping    # expect PONG

# 3. Set the SAME value in the deployment environment of EVERY worker/replica
#    (docker run -e / compose env / PM2 env / platform secret — not .env files
#    baked into images, which are dockerignored):
#      RATE_LIMIT_STORAGE_URI=redis://127.0.0.1:6379/0
#      RATE_LIMIT_STORAGE_URI=redis://:<PASSWORD>@<host>:6379/0        (ACL)
#      RATE_LIMIT_STORAGE_URI=rediss://:<PASSWORD>@<host>:6380/0       (TLS)
```

Post-deploy verification:

```bash
# Workers booted (no HaltServer / exit code 3):
curl -fsS http://127.0.0.1:5000/api/health

# Shared budget: after N-1 allowed hits from one process, the next request
# from ANY other process must return 429 (single counters in the store):
redis-cli --scan --pattern 'LIMITS:LIMITER*'
```

### Pre-Deployment Verification Checklist

Execute these checks before routing production traffic:

1. **Verify Migrations & Schema Drift**:
   ```bash
   python scripts/check_migrations.py
   ```
2. **Run Frontend Contract Test Suite**:
   ```bash
   cd ../frontend/web && npm run test
   ```
3. **Verify Health Subsystems**:
   ```bash
   curl http://localhost:5000/api/health
   ```
4. **Reverse Proxy Configuration**: Ensure Nginx, Cloudflare, or AWS ALB terminates TLS/HTTPS and forwards standard proxy headers (`X-Forwarded-For`, `X-Forwarded-Proto`).
5. **Shared Rate Limiting**: Confirm `RATE_LIMIT_STORAGE_URI` points at the environment's shared Redis/Valkey, that every worker/replica uses the same value, and that a burst beyond the configured limit returns `429` (see "Shared Rate-Limit Store" above).

---

## 14. Cross-Repository References

- **Frontend Application Guide**: [Frontend README](../frontend/README.md)
- **Root Configuration Template**: [Root .env.example](../.env.example)
- **Backend Models**: [app/models/__init__.py](app/models/__init__.py)
- **Backend WSGI Entry Point**: [wsgi.py](wsgi.py)
