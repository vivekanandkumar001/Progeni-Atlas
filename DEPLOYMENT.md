# Progeni Atlas — Production Deployment Runbook

Verified 2026-11-11. Use this together with `SECURITY_AND_PERFORMANCE_FIXES_2026-11-11.md`.

## Architecture

```
ice Atlas (MongoDB, cluster: interviewer.jdg7ym0.mongodb.net, db: progeni_atlas)
  ▲            ▲                              ▲
  │            │                              │
browser  →  Vercel: progeni-atlas (frontend/web, Next.js, atlas.progeni.live)
              │  all /api/* traffic is proxied same-origin by
              │  frontend/web/src/app/api/[...path]/route.ts
              ▼
          Vercel: progeni-atlas-api (backend/, Flask, api-atlas.progeni.live)
              OR Docker/VPS (backend/Dockerfile, gunicorn+gthread :8406)
```

Cookie auth (`tp_session` HttpOnly) flows through the same-origin Vercel proxy,
so the browser never needs cross-site cookies. Keep the catch-all proxy — do
NOT call the API directly from the browser unless you switch cookies to
`SameSite=None; Secure`.

## 0. Before deploying (blockers)

1. **Rotate every secret that was ever printed to a terminal/log** — including
   everything in the frontend `.env.local` (Mongo URI credentials, Gemini /
   OpenRouter keys, LIVEKIT_API_SECRET, Upstash Redis, Qdrant API key) and the
   backend `.env` JWT/SMTP/UPI values if they were ever shared.
2. **Atlas Network Access**: Vercel serverless functions have dynamic egress
   IPs — Atlas must allow them. Either whitelist `0.0.0.0/0` (with strong DB
   credentials, SCRAM, and TLS) or use Atlas Private Endpoints / a VPC-peered
   egress (static). Docker/VPS deploys only need the server IP.
3. `.env` files must never reach git or Docker images (`.gitignore` +
   `.dockerignore` already exclude them — verified).

## 1. Backend — option A: Vercel (project `progeni-atlas-api`)

`backend/vercel.json` routes everything to `api/index.py` (Flask WSGI),
`maxDuration: 60`. Deploy from `backend/` as root directory.

**Environment variables (Vercel dashboard → project → Settings → Environment Variables):**

| Key | Notes |
|---|---|
| `APP_ENV` | `production` — the app **refuses to boot** without JWT secret + MONGO_URI in production |
| `SWAMI_SECRET_KEY` | HS256 signing key (`python -c "import secrets;print(secrets.token_urlsafe(48))"`) |
| `JWT_SECRET` | same or another strong secret |
| `OTP_PEPPER` | dedicated OTP pepper (do not reuse JWT) |
| `MONGO_URI` | `mongodb+srv://...` (production Atlas) |
| `MONGODB_DB_NAME` | `progeni_atlas` |
| `CORS_ORIGINS` | `https://atlas.progeni.live` |
| `GEMINI_API_KEY` | primary LLM |
| `OPENROUTER_API_KEY` | LLM fallback |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | OTP + invite emails |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | WebRTC |
| `UPI_GATEWAY_URL` / `UPI_GATEWAY_KEY` / `UPI_GATEWAY_SECRET` | payments (503 when unset) |
| `QDRANT_URL` / `QDRANT_API_KEY` | vector search (mock fallback without it) |
| `ADMIN_DEFAULT_EMAIL` / `SUPER_ADMIN_PASSWORD` | bootstrap super-admin |
| `GREENHOUSE_WEBHOOK_SECRET` / `WORKDAY_WEBHOOK_SECRET` | inbound ATS webhooks |
| `UPLOADS_ALLOW_PUBLIC` | leave unset (`false`) |

**Smoke test after deploy:**

```bash
curl -s https://api-atlas.progeni.live/api/health   # expect 200 + "healthy"
curl -s https://api-atlas.progeni.live/api/ready    # expect 200 + ready:true
curl -s -X POST https://api-atlas.progeni.live/api/interview/none/finish  # expect 401
```

## 2. Backend — option B: Docker / VPS (UAT-style)

```bash
docker build -t progeni-backend-uat backend
docker run -d --name progeni-backend-uat --restart unless-stopped --network host \
  --env-file backend/.env -p 8406:8406 progeni-backend-uat
# behind nginx/traefik: proxy api-atlas.progeni.live -> 127.0.0.1:8406
```

`backend/Dockerfile` runs `gunicorn --worker-class gthread --threads 8 --workers 2 :8406`.
`backend/Procfile` (Railway/Render-style) runs gthread 8×2 as well.

## 3. Database — MongoDB Atlas

* Indexes: auto-created at boot via `_SCHEMA_VERSION = 4`. To force: `python backend/scripts/migrate_db.py` (safe, idempotent — creates indexes; also dedupes users, so take a backup first).
* One-time data repair (already applied 2026-11-11): none pending.
* Backups: enable Atlas automated backups (Continuous Cloud Backup) before deploy.

## 4. Frontend — Vercel (project `progeni-atlas`, root `frontend/web`)

`framework: nextjs`, `buildCommand: npm run build`.

**Environment variables:**

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api-atlas.progeni.live` (server-side proxy target; without it the proxy falls back to `api.progeni.live`) |
| `SUPER_ADMIN_EMAILS` / `PRIMARY_SUPER_ADMIN_EMAIL` | super-admin allowlist |
| `CORS_ORIGINS` | *(optional)* first-party origin allowlist for the same-origin proxy if you front another domain |
| `ALLOWED_IMAGE_HOSTS` | remote image hosts |

`.env.local` is git-ignored and NOT deployed. Local dev: leave `NEXT_PUBLIC_API_URL`
empty → proxy falls back to `http://127.0.0.1:5000` (local Flask).

**Smoke test after deploy:**

```bash
curl -s https://atlas.progeni.live/                       # expect 200 HTML
curl -s https://atlas.progeni.live/api/health             # expect 200 "healthy" (via same-origin proxy)
curl -s https://atlas.progeni.live/api/candidate/dashboard # expect 401
```

## 5. Post-deploy checklist

- [ ] Atlas backups enabled
- [ ] Vercel env vars set for BOTH projects
- [ ] `SUPER_ADMIN_PASSWORD` rotated (bootstrap is idempotent)
- [ ] UPI webhook URL registered in gateway dashboard → `https://api-atlas.progeni.live/api/billing/wallet/upi-webhook`
- [ ] SMTP test OTP email arrives
- [ ] A full throwaway interview can be started and finished on production
- [ ] `https://atlas.progeni.live` cold load < 3s (watch Vercel Analytics)

## 6. Free Plan / Signup Welcome Credits (admin-controlled)

Industry-style welcome-grant configuration, no hardcoding:

* **Where**: Super Admin → Free Demo Quota Policy page (`/super-admin/free-quota`) → "Signup Welcome Credits — Free Plan" card.
* **Controls**: enable/disable, welcome credits (default **10**), target audience (Everyone / Candidates / Recruiters). Grants per user is fixed at **one-time** (atomic `$inc` on `users.signup_credits_count` with a `< max_grants` predicate — no double-grant, no re-grant on re-register).
* **Storage**: `platform_settings.entitlement_policy` (`signup_free_enabled`, `signup_free_credits`, `signup_free_max_grants`, `signup_free_target_role`).
* **Enforced at**: `POST /api/auth/verify-otp` (REGISTRATION_VERIFY) — the moment an account becomes a real user. Wallet is credited (`promotionalCredits` + ledger `signup_bonus`) atomically in the same breath. Wallets are **not** auto-created with free credits anywhere else (all lazy-init paths create 0-credit wallets).
* **Free package copy**: candidate `pkg-starter` ₹0/10 credits (one-time, on signup); recruiter `pkg-recruiter-trial` ₹0/10 credits (one-time). Prod DB updated in place 2026-11-11.
* **Paid plans**: price & credits are ₹1 = 1 Credit and fully editable per package under **Super Admin → Packages** (publish/archive supported). Changes are live within ~60s (catalog cache TTL).

## 7. Known caveats

* **Qdrant currently unreachable from production** (`Connection reset by peer` → `mock_fallback`). Resume semantic search degrades gracefully but silently — fix the Qdrant cloud cluster/API key.
* Vercel serverless `maxDuration: 60` — LLM scorecard synthesis at session finish may be slow; Docker/VPS has no such cap.
* Ratelimit storage defaults to memory in multi-instance deployments — configure shared Redis if you need cross-instance limits (`RATE_LIMIT_STORAGE_URI`).
* MongoDB indexes: boot auto-creation only fires when `_meta.schema_version != 4`; run `scripts/migrate_db.py` explicitly on any fresh environment.
