# Progeni Atlas — ₹3 / 10-Minute Interview Plan (Human-Quality, ₹3 Total Cost)

**Mandate**: pūra 10-minute interview — human-to-human quality, <900 ms latency, Sarah Chen persona — **total cost ≤ ₹3 per interview**. No quality compromise. Engineering ka best use.

---

## 1. Today's cost anatomy (auto-metered, `/super-admin/cost-insights`)

| Line item | Cost today | % |
|---|---|---|
| OpenAI Whisper STT ($0.006/min × 10 min) | **₹4.98** | 41% |
| LiveKit Cloud agent minutes (~$0.008 × 10) | **₹6.64** | 55% |
| LLM calls (~22 calls, flash-lite tier) | ₹0.20 – ₹2.00 | 2–17% |
| Edge-TTS | ₹0 | 0% |
| Embeddings | ₹0.02 | <1% |
| **Total** | **≈ ₹11.6 – ₹13.6** | |
| Fixed infra amortized (Atlas M10 ₹4,731 + Qdrant ₹2,075 + Vercel ₹1,660 + domain ₹83) | ₹9,556/mo ÷ 39 interviews ≈ **₹245/interview** | dominates at low volume |

Two distinct problems:
1. **Variable cost per interview ₹11.6+** — STT aur LiveKit paisa kharcha kar rahe hain.
2. **Fixed infra ₹9,556/mo** — current volume pe yahi ₹3 cap ko todta hai seedha.

₹3 nail karne ke liye dono ko hatana hai — free-tier / self-hosted / restructured serving ke saath.

---

## 2. Non-negotiable quality floor (wah nahi ghatayenge)

- Interview arc intact (warm open → rapport → resume → technical → behavioral → your-turn → close)
- Turn-taking < 900 ms mouth-to-mouth, streaming STT + streaming LLM + chunked TTS
- Sarah Chen persona consistent, backchannels, rapport memory, silence handling
- Proctoring, accommodations, hiring-fairness rules intact
- Human final decision; AI is screening, not judge
- Measured: "felt human" ≥ 4.2 / 5, rater agreement ICC ≥ 0.75

---

## 3. Where the ₹3 goes (target budget)

| Component | Budget | Engineering lever |
|---|---|---|
| LLM (12 calls × ~700/350 tokens) | **₹0.30** | Combined eval+question per turn; Flash-tier; prompt caching; strict output budgets (max 256 tokens) |
| STT (10 min) | **₹0.00** | Self-hosted `faster-whisper` (open-source) on same VM, int8 `small` model, CPU real-time. Zero API fees. Fallback: browser Web Speech API (free). |
| TTS | **₹0.00** | Edge-TTS neural voices, master-streamed. Keep pacing/style tuning (free). |
| WebRTC / LiveKit | **₹0.00** | Self-hosted **LiveKit** (Apache-2.0) in same Docker Compose on existing VM. Free tier on dev/testing only. |
| Server / compute (marginal) | **₹1.50** | Existing UAT VM (`vivekanand-backend-uat`) already running Docker + gunicorn; add `livekit-server` + `whisper-worker` services. Marginal cost ≈ ₹0 (already paid for). |
| Fixed infra (Atlas M0 free + Qdrant self-hosted + Vercel Hobby / self-host) | **₹0–₹2.00** | Downgrade M10 → **Atlas M0** (free 512MB, still production-grade for this scale); self-host Qdrant in the same VM; replace Vercel Pro with **self-hosted Next.js on the VM** (systemd + nginx) → Vercel line ₹0. |
| **Total (per 10-min interview)** | **≈ ₹1.8 – ₹3.0** | within ₹3 for volumes ≥ ~200 interviews/mo |

---

## 4. Recommended architecture (MVP sovereign stack)

```
Internet
   │ TLS (Caddy/nginx auto-certs)
   ▼
Next.js frontend (self-hosted on VM, systemd, nginx)  →  ₹0
   │  /api/* same-origin proxy (existing Next route)
   ▼
Flask backend (gunicorn, existing)                    →  existing VM
   │
   ├── MongoDB (self-hosted on VM OR Atlas M0 free)   →  ₹0
   ├── Qdrant (self-hosted, docker container)         →  ₹0 (part of VM)
   ├── Redis (self-hosted, docker container)          →  ₹0 (part of VM)
   ├── LiveKit (self-hosted Go binary, docker)        →  ₹0 (part of VM)
   ├── faster-whisper (Python worker, docker)         →  ₹0 (part of VM, CPU)
   └── Edge-TTS streaming (existing)                  →  ₹0

VM sizing: 4 vCPU / 16GB RAM / 100GB SSD  ≈ ₹3,500/mo (Hostinger/Hetzner/Okularis)
                    ÷ 500 interviews/mo   ≈ ₹7.0 / interview   ← still above ₹3 at low volume
```

**₹3 total cost including VM amortization needs ≥ ~1,200 interviews/month on this VM.**
Until that volume, two free-side options get us under ₹3 regardless of volume:

**Option A — free-tier stack (volume-independent ₹0 fixed)**
- Atlas **M0** free MongoDB (512MB, backed up via Atlas free tier)
- Vercel **Hobby** (₹0 — non-commercial tier; acceptable while pre-revenue? verify ToS)
- Upstash **Free** Redis (256MB, 10k commands/day — enough for rate-limit/cache)
- Qdrant **Free 1GB** cluster (free tier) or self-host
- Backend on existing UAT VM (already running ₹0 marginal)
- LiveKit, Whisper, Edge-TTS — all self-hosted ⇒ **fixed ₹0, variable ≈ ₹0.3** ⇒ **≈ ₹0.5–₹2 per interview at any volume**
- Trade-off: Hobby/ToS limits, Atlas M0 RAM tight (archive completed sessions to object storage — S3 ₹800/mo or MinIO on VM)

**Option B — dedicated small VM, modest D/C tiers only where free is genuinely risky**
- Backend VM ₹2,000 (existing UAT reused) + Atlas M2 ₹600/mo (paid backup clarity) + Upstash Free + Qdrant Docker on VM
- Fixed ≈ **₹2,600/mo** → at 900 interviews/mo = **₹2.9 / interview** ← hits ₹3 at ~900/mo
- More reliability headroom than pure free tier

**Recommendation**: Ship Option A immediately (₹0–2/interview, zero fixed commitment, validate unit economics). Graduate to B/C only when interview volume justifies Atlas M2 or a second VM.

---

## 5. Engineering changes required (hard costs → ₹0)

### 5a. LLM spend restructure ₹2.0 → ₹0.3
- **One call per turn** instead of two: single "turn manager" returns `{ acknowledgement, scores, next_question, interviewer_line }` in one JSON payload — but candidate-facing ack must not leak scores; eval columns sent to server only. Cuts 22 calls → 12 calls.
- Switch default chain: Gemini 2.0 Flash-Lite (input ~$0.075/1M, out ~$0.30/1M) with OpenRouter free `llama-3.1-8b-instruct:free` as zero-cost fallback for non-critical turns.
- **Prompt caching**: Gemini context cache on the 4 KB system prompt → 75% discount on input tokens.
- Output budget: `max_tokens=200` (was 400+) — again 30-60% output savings.
- **Rate card watchdog**: cost-insights alert if any deploy pushes per-interview LLM > ₹0.5.
- Cached exemplar answers for ambiguous questions: dedupe-friendly questions saved as exemplars → scorecard consistency.

### 5b. STT ₹4.98 → ₹0 (self-hosted)
- Deploy `faster-whisper` (CTranslate2, int8) `small` model in a Docker sidecar on same VM. Real-time factor ≈ 3× on 4 vCPU → wall-clock faster than realtime.
- Stream partials over WebSocket → transcript visible to LLM continuously instead of waiting for end-of-utterance (this also halves perceived latency).
- Fallback: browser Web Speech API for Chrome/Edge users (₹0); server whisper only when browser API unavailable/blocked.
- CPU sizing: 2 cores dedicated; 100% on existing VM is fine at current concurrency.
- No per-minute fee. Audio never leaves the VM ⇒ privacy bonus too.

### 5c. LiveKit Cloud ₹6.64 → ₹0 (self-hosted)
- `livekit-server` Docker container on the same VM. Apache-2.0, production-proven at scale.
- Same `LIVEKIT_URL`/API key pattern — only the endpoint changes.
- Fallback: pure WebSocket + client/server VAD (no LiveKit at all) as a future simplification; ship LiveKit self-hosted first (smaller delta).

### 5d. LLM eval gate stays free
- Eval battery judge = local heuristic rubric (₹0). Periodic human calibration (sample 30 interviews/mo reviewed by humans) → no API cost.

### 5e. Fixed infra ₹9,556 → ₹0–₹2,600
- **Atlas M10 → M0** (free, 512MB): archive completed sessions > 30 days to object storage weekly (one-liner cron) to stay under 512MB comfortably at 10k interviews/mo.
- **Qdrant → self-hosted Docker** on same VM (it's Go; ₹0 marginal) or Qdrant Free 1GB cluster (often enough for 5k resumes + questions; each vector ~4KB × 50k = 200MB — comfortable).
- **Upstash → self-hosted Redis** (256MB, Docker).
- **Vercel Pro → Hobby / self-hosted**: dedicated Next on same VM with Caddy TLS or Vercel Hobby (verify ToS if org is a business — if strict, self-host Next on VM; effort: 1 day).
- **SMTP**: already Gmail (free). Move to **AWS SES free tier** (62k credits/mo, ₹0) for production scale.
- Domain ₹83 stays.

---

## 6. Rollout (3 gates, all measurable on admin dashboard)

| Gate | Work | Metric | Pass bar |
|---|---|---|---|
| **G1 — LLM restructure** | Turn-merge, flash-lite default, prompt caching, output caps | LLM cost/interview | ≤ ₹0.5 |
| **G2 — Voice self-host** | faster-whisper + self-hosted LiveKit on VM (Docker Compose) | STT cost, WebRTC cost | ₹0.00 |
| **G3 — Infra free-tier** | Atlas M0 migration + session archiver, Qdrant/Redis self-hosted, Vercel→Hobby/self-host | Fixed cost | ≤ ₹200/mo → ₹0.7/interview at 500/mo |
| **G4 — ₹3 audit** | Real 20 interview pilot on ₹3/interview cost | Total cost/interview | **≤ ₹3.00 verified** |

Each gate gated on the same `/super-admin/cost-insights` page — no estimates, actual metered data.

---

## 7. Timeline & effort (single engineer + 1 DevOps, ~2.5 weeks)

```
Week 1   G1 — LLM restructure (2–3 days) + meter validation
         G2 — Whisper + LiveKit self-host (Docker Compose on UAT) (3 days)
Week 2   G3 — Atlas M0 migration + archiver; Qdrant/Redis self-host (3 days);
             Vercel decision & cutover (1–2 days)
Week 3   G4 — 20-interview pilot, cost report vs ₹3 target, iterate
```

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Atlas M0 512MB ceiling** | Nightly archiver of completed sessions >30 days → object storage; monitor storage % alert |
| **free-tier ToS violation** (Vercel Hobby commercial restriction) | Confirm ToS; if restricted, self-host Next on VM (1 day effort) before go-live |
| **Whisper quality worse than Whisper API** | int8-small on CPU is production-grade for English; enrollment phrase validation in lobby |
| **Voice quality unchanged** | Edge-TTS stays; pacing/styles tuning from Plan 1 keeps quality bar |
| **Single-VM SPOF** | Nightly restic backup of VM → object storage; swap VM provider if attack/outage (30 min restore) |
| **Latency regression from CPU whisper** | Whisper small int8; interviewer pre-warms; streaming partials |
| **Vendor price changes** | All components self-hosted ex-date-sensitive; rate card already admin-editable |

---

## 9. What this means for the business model

- ₹3 cost per interview → every ₹49-99 paid pack = **94% gross margin**
- You can sustain free tier (10 credits, one-time signup) indefinitely without subsidy
- Sales pitch: "AI interview at <1/50th the cost of a human screener (₹3 vs ₹150+)"
- Premium ₹499-999/mo plan with unlimited interviews → ₹3×40 interviews = ₹120 cost, ₹379-879 margin

---

## 10. Decision needed from owner

1. **Timeline OK?** (G1 this week, G3 by Week 2, ₹3 verified by Week 3)
2. **Path**: A (free-tier, zero fixed spend) or B (small VM + only M2 paid tier) — recommend **A** to start
3. **Vercel ToS** – confirm if Hobby tier is acceptable for this product's use, else self-host Next (adds ~1 day)
4. **Whisper size** – `small` (best ₹0/quality) or `medium` (slower but better)?
5. **Volume commitment** – if you can commit to ~1,000 interviews/mo, we can keep modest Atlas M10 + Qdrant free + self-host rest — ₹3 still works
