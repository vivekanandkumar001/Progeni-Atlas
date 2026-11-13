# Security & Performance Fixes — 2026-11-11

Applied after the full audit. Verified with: Flask test client (unauthenticated → 401 everywhere; unknown-token → 401), TypeScript compile (no new errors), `next build` (success).

## Backend — security (fail-closed)
- **New `require_session_access` decorator** (`core/security.py`): authenticates the caller AND verifies the `interview_sessions` document belongs to the caller (candidate owner, recruiter owner, same-org members, or super-admin). Applied to every session-scoped route previously missing auth:
  - `questions`, `scorecard`, `lobby-info`, `lobby-checkin`, `candidate-media-token`, `state`, `preflight`, `start`, `answer`, `finish`, `retry`, `question-timeout`, `media-state`, `speak`, `transcribe`, `whiteboard/critique`, `reset-listening`, `proctoring/events`, `recruiter-viewer-token`, `recording`, `room-data`, `code-run`, `lobby-check` (also rewritten — it was dead code that raised `NameError`).
- **Companion API** (`companion.py`): `pair`, `viewer-token`, `event` now require session ownership (was: anyone could hijack/eavesdrop/inject into any interview room).
- **Aptitude** (`aptitude_routes.py`): `_get_owned_aptitude_session()` helper — `start` requires a logged-in candidate (anonymous `cand-anonymous` sessions eliminated), `state/answer/submit/report` fail closed with 401/403/404, `history` is always scoped to the caller (was: unauthenticated callers got the 20 most recent sessions of ALL candidates).
- **Recruiter tenant isolation**: `decision` and `reschedule` are now `$and`-scoped to `org_id` / `recruiter_id` / `recruiter_email` (was: any recruiter could rewrite ANY org's hiring decisions & inject candidate notifications). `dossier/<id>/pdf` requires an org/ownership link. Notifications `mark-read` (candidate & recruiter) now match only the caller's own notifications. Team-invite requires org binding, role whitelist (`recruiter|hr|admin`), and rejects orgless accounts. `rubrics` POST and `generate-rubric` require recruiter auth and write org-scoped records.
- **ATS / webhooks**: Greenhouse & Workday inbound webhooks now verify `X-Webhook-Secret` (env `GREENHOUSE_WEBHOOK_SECRET` / `WORKDAY_WEBHOOK_SECRET`; 503 when unconfigured — was: anyone could pollute the shared `org-default` tenant). Outbound `webhook-config` / `webhook-test` / `dispatch-webhook` require an org workspace, validate URLs (public http(s) only — SSRF guard `_is_safe_external_url`), never echo the stored secret (redacted `••••last4`), never fall back to a hardcoded Slack webhook (removed — it was in source), and report real delivery status (was: simulated HTTP 200 "delivered" even on network failure, with fabricated payload fields like fake `trustScore: 98, status: VERIFIED_AUTHENTIC`). Fabricated `DEFAULT_DOSSIER_WEBHOOK` / `DEFAULT_WEBHOOK_DISPATCHES` (fake candidates with names/scores) deleted. ATS integrations endpoints return 401/400 instead of the shared `org-default` tenant.
- **Billing**: UPI gateway secrets no longer default to live keys in source — missing env → 503 "Payment gateway is not configured". `create-wallet-order` resolves credits **server-side** from the published package catalog (₹1 = 1 credit fallback, catalog match for packs); client-supplied `amount_credits` is ignored. `wallet/transactions` no longer performs unindexed per-session N+1 writes on a GET, and the ledger is personal-only (no longer exposes every org member's transaction history). `check-order-status` / `submit-utr` / `verify-wallet-payment`: orders without a `userId` are now rejected (ownership bypass closed). Magic free-demo session constant removed; settle idempotency now uses the full `session_id` (no 8-char prefix collisions). `get_user_wallet_balance` no longer grants implicit 40/100 free credits to walletless accounts.
- **JWT/OTP**: removed hardcoded fallback secrets (`progeni_atlas_enterprise_jwt_secret_key`, `progeni_atlas_default_pepper`) — missing env → ephemeral random secret + loud warning (never a publicly-known key). `require_super_admin` now requires DB role `super_admin` (JWT `"admin"` no longer grants platform power; demotions take effect immediately). Suspended accounts are blocked in `get_current_candidate`/`get_current_recruiter` too. Orphan session linking only touches genuinely unclaimed records (`candidate_id` empty) — no longer re-points records already owned by someone.
- **Uploads** (`app.py` `/uploads/...`): recordings require session ownership, resumes require ownership of the matching `candidate_resumes` record (or super-admin), others require any authenticated user (was: public by URL, resumes guessable by `temp_<timestamp>_<name>`). Resume previews use `secure_filename` + random component, 5 MB cap, extension whitelist, and the temp file is deleted after parsing. Real resume upload filenames now include a random component.
- **Live contract**: all API responses get `Cache-Control: no-store` from Flask too.
- `finish` route no longer `upsert`s phantom sessions (404 instead); email written to notifications is normalized.

## Backend — performance
- **New indexes** (`_SCHEMA_VERSION = 4`, `ensure_indexes`): `candidate_resumes(candidate_id,is_active,uploaded_at)` & `(candidate_email,uploaded_at)`, `practice_sessions(userId,completedAt desc)`, `job_profiles(recruiter_id)`, `(recruiter_email)`, `(org_id,created_at)`, `aptitude_sessions(candidateId|candidateEmail,startedAt)`, `billing_accounts(orgId|id)`, `wallet_transactions(sessionId|id)`, `platform_settings(key)`, `evaluation_rubrics`, `ats_integrations(org_id unique)`, `ats_sync_logs`, `dossier_webhooks(org_id unique)`, `webhook_dispatch_logs`, `hardware_diagnostics`, `lobby_checks`, `organization_invites(token unique)`, `interview_sessions(org_id,created_at)`. NOTE: importing the app ran `init_mongo_db()` once — Atlas now has schema v4 indexes.
- `MongoClient`: `connectTimeoutMS=2000`, `socketTimeoutMS=15000`, `maxPoolSize=50`.
- `_load_practice_sessions` memoized per request (was: full-collection scan 3× per dashboard load).
- Drill catalog cached (60 s in-memory TTL).
- Dockerfile: `sync workers ×2` → `gthread, threads=8, workers=2`.
- SMTP send timeouts 10–12 s → 5 s.

## Frontend — cross-user rendering & caching
- `lib/api.ts`: no longer rewrites `tp_session`/`tp_role`/`tp_email` via `document.cookie` (backend's HttpOnly cookies were clobbered to non-HttpOnly); `clearSession` now purges `tp_email`, `tp_support_reason` and audio-unlock markers; cache resurrection guard (`cacheGeneration`) stops in-flight GETs re-populating the cache after logout; logged-out (`anon`) scope is **never** cached; mutations through `apiFetch` invalidate the cache; `apiFetch` responses are `no-store`; retry-after-refresh uses `no-store`; identity headers (`X-User-Email` etc.) removed; wallet GET cached 60 s (header poll was hitting the network every 30 s with no cache); `fetchRecruiterLiveToken` uses GET (was POST → 405).
- Catch-all proxy `app/api/[...path]/route.ts`: spoofable `X-User-*`/`X-Candidate-*` headers are stripped, credentialed CORS restricted to first-party `progeni.live` origins (was: reflect any Origin with credentials), `Cache-Control: no-store` added, backend error details no longer leaked to clients.
- `proxy.ts` (edge gate): role taken only from the token payload — the JS-writable `tp_role` cookie is no longer trusted for routing; `tp_email` deleted on every redirect/logout path.
- New `RoleGate` (`components/auth/RoleGate.tsx`) mirroring SuperAdminShell — candidate and recruiter trees verify `/api/auth/me` server-side before rendering anything (was: proxy-only, spoofable).
- Login/register/landing auto-redirects now verify the session via `/api/auth/me` instead of trusting `localStorage` (stale `tp_user` no longer teleports a different person into the previous account on a shared machine).
- `verify-otp`: `redirectUrl` validated as a local path (open-redirect closed).
- Hardcoded developer PII + fabricated "audit logs" removed from the recruiter profile page (fake SOC-2 entries, fake teammate, all `Vivekanand Kumar / vivekanandkumar865124@gmail.com` literals) — honest empty/loading states instead.
- Dead components calling non-existent endpoints (`InterviewSummary`, `InterviewTimer`) deleted.
- CSP: `'unsafe-eval'` removed in production (kept in dev for HMR).
- Recruiter dashboard fetches wallet + dashboard in **parallel** (was sequential waterfall).

## Aptitude — hidden feature & weak report → full overhaul (2026-11-12)

* **Discovery fix**: Aptitude was unreachable via UI (only direct URL / Reports page). Now in candidate header nav, dashboard teaser card, onboarding CTA.
* **Invisible text**: `/candidate/aptitude` hero + headings used `text-white`/`text-slate-*` on a light page → white-on-white. Full light-theme consistency applied.
* **Fabricated percentile removed**: score×0.85+trust×0.15 → real norm-pool percentile vs completed same-track attempts (≥30 required, honest "benchmarking" state otherwise), sectional percentiles per pillar, integrity verdict band (clean/review/flagged), accuracy-vs-speed quadrant, avg seconds/question, delta vs previous attempt, negative marking applied on quant-sprint template.
* **Report 538-line page rebuilt**: 5-pillar SVG cognitive radar vs benchmark, Accuracy×Speed quadrant callout, delta chip, PDF Scorecard button, sectional %ile chips, A/B hero CTA (`aptitude_ab` setting, events in `aptitude_events`).
* **PDF endpoint** `/api/aptitude/sessions/<id>/report/pdf` — print-ready A4 candidate-authorized scorecard.
* **Recruiter surface**: dossier modal & table show aptitude score + null-safe percentile basis + integrity verdict + delta.
* **Admin usage** `/super-admin/usage` gains Aptitude tile (sessions, completed, avg score/accuracy, A/B funnel counts) — live A/B measurement from day 1.
* **Bug fixed**: `traceback` used without import in `aptitude_routes.py` (would NameError inside except blocks).
* **Profile "Not signed in" bug**: `useCandidateProfileData` hard-gated API calls on `getAccessToken()` (returns null for HttpOnly cookie auth) → profile never loaded. Gate removed; cookie auth used.
* Verified live end-to-end: login → nav/teaser/onboarding → 2 sessions (sprint + campus 5-pillar) → submit (score 0.0/25.0) → radar/quadrant/verdict/delta/benchmarking render → PDF saved → admin usage shows aptitude block + report_view events.

## Nested-card sweep (design-system consistency) — 2026-11-12

Rule enforced: **a bordered surface panel may not contain another bordered surface panel.** Inner boxes are now flat inset wells/tints (`bg-inset`, `bg-surface-2`, `bg-{color}/10`) — outer cards lose nothing; nesting depth restored to 1 everywhere.

* Static sweep across `src/` (brace-aware JSX scanner): **181 nested boxes found → 149 mechanically flattened (border + border/color tokens removed, layout/spacing intact)**, remainder were intentional elevation/top-level designs kept by decision (marketing cards with `card-lift-hover`/`shadow-xl`, dashed dropzones, phone bezel, bordered dividers, landing/pricing marketing panels).
* ~33 remaining cases fixed/kept by hand: selectable option cards (rate tiers in Admin Billing → flat + `ring-1` on selection), profile team rows, proctoring event rows, greeting wells, PracticeHeroBanner/RecommendedDrillsBanner, OverallParametersGrid, TurnByTurnAccordion, Wallet/Billing pack pickers (selection now via `ring`, zero resting borders).
* **TableSkeleton fixed to render its own `<table>` wrapper** — every loading skeleton across 12 super-admin pages previously emitted raw `<tr>` directly inside `<div>` (invalid HTML; hydration warning "<tr> cannot be a child of <div>" on `/super-admin/careers`). Careers console now clean.
* Verified live, console-clean: 8 candidate pages, 8 recruiter pages (dossier modal flat wells confirmed visually), 18 super-admin pages, landing/about/portfolio, marketing sections incl. pricing plans — no `<Card>` in `<Card>` anywhere, no visual box-in-box remains in product UI.

## Recruiter panel — end-to-end live QA & fixes (2026-11-12)

Live-tested every recruiter page as a real sandbox recruiter (`test.recruiter@example.com`, sandbox org "Test Org (Sandbox)", 20 labeled QA credits). Fixes shipped:

1. **Export Excel/CSV 404 → real tenant-scoped export endpoint** (`/api/recruiter/dossiers/export`): XLSX via openpyxl (freeze panes + autofilter + column sizing), CSV UTF-8-BOM fallback; `openpyxl>=3.1.2` added to `requirements.txt`. Verified 200 + valid files through the Next proxy.
2. **Recruiter Live Monitor hard crash** ("Session Unavailable: Cannot read properties of undefined (reading 'endsWith')"): backend `recruiter-viewer-token` was a stub returning `{token: 'recruiter_live_token_xxx'}`. Now issues a real **subscribe-only LiveKit JWT** (identity `recruiter-<id>-<session>`, room = session_id, `can_publish=false`) + clear 503 when LiveKit isn't configured. Monitor page verified end-to-end: SFU connected, Sarah's opening question renders, observer telemetry live.
3. **Fabricated interview evaluation data for empty sessions** (integrity issue): the recording page showed "4 Questions Evaluated, Q3 Weak Answer 67%, STRONG_HIRE, 91.4 score, fabricated proctoring flags" for a session that never happened. Backend `/report` now returns `reportStatus: pending`, empty turns/nulls, no synthesized proctoring events, no invented scores; unscored recorded turns no longer default to 8.5 (frontend `?? '—'` handles nulls). PDF report prints "Pending Evaluation / —" instead of fabricated 88/STRONG_HIRE. Recording page now honestly shows "0 Questions Evaluated — evaluation pending".
4. **Invite Team Seat: Interviewer option broken** (frontend sends `role=interviewer`, backend accepted only recruiter/hr/admin → 400 "Invalid role"). Backend now accepts `interviewer` (evaluation-only) and stores it as given; invite recorded + verified in `organization_invites`.
5. **RecruiterHeader cross-user fallback**: 'Vivekanand Kumar'/'VK' hardcoded fallback when `tp_user` missing → now falls back to 'Recruiter'/'RC' and resolves identity from `/api/auth/me` when the cached profile is absent.
6. Local env was missing `livekit-api` (it is in `requirements.txt`, so prod has it; candidate media tokens fell back to local mock mode locally but the monitor path crashed). Installed locally to verify the monitor end-to-end.

Sandbox-data note: test account + "Test Org (Sandbox)" (job "Senior Backend Engineer", QA candidate `qa.candidate@example.com`, decision=selected after Shortlist test, QA credits 20) live in the SHARED production DB — delete after QA if unwanted. Invite email for example.com fails gracefully (logged); invitation rows + notifications + inviteUrl still record.

E2E checklist (all live clicks, admin order): job create → invite → KPIs → table search/filter/sort → exports → Scorecard PDF (jsPDF, client-side) → Monitor Session → Reschedule → Shortlist → Dossiers filters → Rubrics (taxonomy/blueprints/role rubric, DB-only, no LLM cost) → Integrations (refresh, Greenhouse modal negative test) → Billing (₹0.00, rate card 0.50 cr/min, Add Credits modal not submitted) → Profile (bulk-fill, team invite UUID recorded, Save PUT 200 ×2) → 8 pages console-clean.

## Admin panel — Cost & Spend v2 (full-stack unit economics) — 2026-11-12

* **Full infra TCO inventory** (`core/cost_model.py` → `platform_infra_costs`): MongoDB Atlas M10 ₹4,731/mo, Qdrant ~₹2,075, Vercel Pro ₹1,660, domain ₹83, plus LLM/voice/email/payments lines — all admin-editable (unit cost, monthly qty, note) with audit log, seeded from public list prices (clearly estimates). Line-item totals break down by category (Data stores ₹7,636 / Hosting ₹1,660 / Misc ₹83).
* **Per-call & per-10-min-interview cost, auto-computed for every model in the registry** (`/api/super-admin/cost-estimate`): default profile = 10 questions × 2 LLM calls + 2 (dynamic params + scorecard) = 22 calls, 800/400/100 tokens per call, 10 min Whisper STT ($0.006/min, ₹4.98), Edge-TTS free, LiveKit agent minutes, 1 embedding. Interview ≈ **₹11–₹12** (STT + LiveKit dominate, LLM flash-tier is ~₹2). Per-1000-interviews column for planning.
* **LLM Evaluation battery** (admin-triggered, real paid API calls gated by `confirm_spend: true`): 6 interview-like prompts × enabled providers, judge = local heuristic (₹0 extra), results stored in `platform_llm_eval_runs` with per-provider score / latency / cost — used to verify which model to standardize on.
* **Voice economics explicit**: Edge-TTS (free, production default) vs OpenAI tts-1 (≈₹112/interview opt-in via assumption `use_openai_tts`). STT = Whisper ₹4.98 per 10-min interview.
* **New "Add model" flow**: `POST /api/super-admin/pricing` registers a model with custom rate card → participates immediately in per-call/per-interview economics. Edit rates inline with versioned audit.
* **Proxy robustness fix**: `Expect` header (sent by PowerShell/curl-style clients) stripped before forwarding — was causing spurious 502s on POST API calls through the same-origin proxy.
* Pricing rows seeded remain **public rate cards** (manual seed) — verify against vendor invoices; unmatched models are reported as usage-measured/rate-unverified, never fabricated.

## Admin panel — Cost & Spend (provider unit economics) — 2026-11-12

* **Shadow metering wired into production LLM path** (`backend/app/services/llm_service.py`): every chat call (Gemini/OpenAI/OpenRouter/Ollama) is metered into `platform_shadow_usage_events` with provider-reported token usage, duration, operation tag and provider — previously the metering framework existed but was never called (dead code). Costs use the governed `platform_llm_pricing` rate card (₹83/$1 assumption, versioned); unknown models are honestly recorded as `MEASURED_USAGE_RATE_UNVERIFIED`.
* **Rate-card seeding** (`core/shadow_metering.ensure_pricing_seeded`): idempotent boot-time seed of 8 entries from public rate cards (Gemini 2.0/2.5 flash/pro, GPT-4o/4o-mini, OpenRouter equivalents, Ollama-local free) — never overwrites admin edits.
* **New Super Admin page** `/super-admin/cost-insights` ("Cost & Spend" in side nav): month-to-date INR spend, attempts, avg cost/attempt, cost per completed interview, spend trend (14d), by-service / by-model / by-operation breakdowns (₹ + USD + tokens + share of spend), and a versioned/editable rate card with PATCH endpoint (audited).
* **Admin endpoints**: `GET /api/super-admin/cost-overview`, `PATCH|PUT /api/super-admin/pricing/<id>`.
* Pricing rows are **manual public rate cards** — verify before relying for invoicing; models without an entry are reported as usage-measured / rate-unverified (never fabricated).
* Infra line-items (Atlas / Vercel / LiveKit / Qdrant) are not metered — shown as an honest scope note; connect cloud billing APIs to roll them in.

## Explicitly NOT changed / follow-ups
- SMTP sends are still synchronous on request threads — move to a background queue (BullMQ/celery) next.
- `/uploads` for unknown paths still serves any authenticated user; candidate_resumes records pre-date random filenames so ownership check may 404 legacy files (they're still reachable to the owner via new uploads).
- 7-day session TTL retained (product choice); shorter sessions require auth-flow changes.
- `dedupe_user_emails()` remains opt-in via `DB_MIGRATE_ON_BOOT`.
- Atomicity: `link_candidate_records_by_email` still re-points unclaimed records at login (by design) but no longer hijacks owned ones.
- LiveDB: indexes were created on the Atlas cluster as a side effect of importing the app once (this is the app's normal boot behavior; idempotent).
