# Progeni Atlas — Exact Cost Calculation (DB-verified, no "expected" numbers)

**Date: 2026-11-12 · Author: cost audit · FX: ₹83/$1 (documented assumption — verify against your bank rate)**

Every input below is labelled by provenance:
- **[DB]** = read live from the production `progeni_atlas` MongoDB (Atlas cluster, db `progeni_atlas`)
- **[LIST]** = public list price (exact published rate, not an estimate of usage)
- **[GAP]** = not measurable today — flagged honestly, never smoothed over

---

## 1. YOUR EXACT USAGE STATE (as of today, [DB])

| Metric | Exact value |
|---|---|
| Total users | **15** (9 candidates · 5 recruiters · 1 super-admin · 0 admin) |
| Interview sessions ever | **39** (5 completed · 13 in_progress · 12 abandoned · 7 scheduled · 1 cancelled · 1 null) |
| Completed interviews | **5** — the only sessions that consumed real STT/TTS/LLM/live minutes |
| Billing accounts | 261 (none linked to a user_id) · active subscriptions: **1** · wallet balance: **₹0** · wallet txns: 4 · ledger: 83 · **paying revenue to date: ₹0** |
| Shadow usage events (metering) | **208 events, but 0 tokens captured, 0 cost captured** ⇒ LLM bill-to-date is NOT metered (count is real, quantity is not) |
| Actual metered call counts [DB] | 106 × openai/gpt-4o-mini · 54 × gpt-4o-mini · 30+16 embeddings · 71 question generations · 80 practice ideal answers · 7 evaluations · 2 scorecards |
| Implied LLM spend to date (if all 208 calls were gpt-4o-mini @800/400 tokens) | ≈ **₹6.09 total** [DB-rate × documented profile] — effectively pennies |
| Code executions | 10 events (100-credit daily quota) |
| Stored resumes | 17 · questions: 72 · scorecards: 13 · notifications: 17 |

**Honest headline: at your real volume (≤5 completed interviews), your entire AI+voice metered cost has been ≈ ₹0–₹50. Your real cost is the FIXED infra, not usage.**

---

## 2. EXACT RATE CARD [DB — platform_llm_pricing, seed v1, active]

| Provider | Match | Model pattern | Input $/1M | Output $/1M | Cached $/1M |
|---|---|---|---|---|---|
| google | prefix | `gemini-2.0-flash` | 0.10 | 0.40 | 0.025 |
| google | prefix | `gemini-2.5-flash` | 0.30 | 2.50 | 0.075 |
| google | prefix | `gemini-2.5-pro` | 1.25 | 10.00 | 0.31 |
| openai | exact | `gpt-4o-mini` | 0.15 | 0.60 | 0.075 |
| openai | exact | `gpt-4o` | 2.50 | 10.00 | 1.25 |
| openrouter | exact | `openai/gpt-4o-mini` | 0.15 | 0.60 | 0.075 |
| openrouter | exact | `openai/gpt-4o` | 2.50 | 10.00 | 1.25 |
| ollama | prefix | `llama` | 0.00 | 0.00 | 0.000 |

**Configured in `.env` [DB/env]:** `GEMINI_MODEL=gemini-3.5-flash-lite` (⚠ NOT in the rate card → reported as UNPRICED, cost ₹0 shown as "unverified", never silently ₹0) · `LLM_MODEL=gpt-4o-mini` (fallback, priced) · `STT_MODEL=whisper-1` (OpenAI, paid) · `TTS_MODEL=tts-1` (OpenAI configured, but the interviewer voice path uses **Edge-TTS free**).

Interview profile used: **10 questions × 2 calls (generation + evaluation) + 2 extra (dynamic params + scorecard) = 22 LLM calls**, 800 in / 400 out / 100 cached tokens per call [GAP — assumption, since tokens weren't metered; the admin Cost & Spend page lets you edit this live].

---

## 3. EXACT VARIABLE COST PER 10-MIN INTERVIEW

| Model | ₹/call | ×22 calls | + STT ₹4.98 | + LiveKit ₹6.64 | **TOTAL ₹/interview** |
|---|---|---|---|---|---|
| llama (Ollama, self-hosted) | 0.00000 | 0.00 | 4.98 | 6.64 | **₹11.62** |
| gemini-2.0-flash | 0.01930 | 0.42 | 4.98 | 6.64 | **₹12.05** |
| gpt-4o-mini / openai/gpt-4o-mini | 0.02926 | 0.64 | 4.98 | 6.64 | **₹12.27** |
| gemini-2.5-flash | 0.10105 | 2.22 | 4.98 | 6.64 | **₹13.85** |
| gemini-2.5-pro | 0.40720 | 8.96 | 4.98 | 6.64 | **₹20.58** |
| gpt-4o / openai/gpt-4o | 0.48762 | 10.73 | 4.98 | 6.64 | **₹22.35** |

Components:
- **STT (whisper-1, OpenAI)**: $0.006/min × 10 min × ₹83 = **₹4.98** [LIST]
- **LiveKit Cloud (agent+SFU min)**: ~$0.008 × 10 min × ₹83 = **₹6.64** [LIST — verify your actual LiveKit invoice; usage ≠ tracked in-app] [GAP for exact]
- **TTS**: ₹0.00 (Edge-TTS, production default) · if tts-1 enabled → 90,000 chars × $0.015/1K = **≈₹112 extra** [LIST]
- **Embedding**: 1,500 tokens × $0.02/1M × ₹83 = **₹0.0025** (text-embedding-3-small) [LIST]
- **Code execution**: E2B/Docker — 10 uses to date, negligible; if billed per second, add per your provider's rate [GAP]

**Exact variable floor today (paid voice, cheapest priced LLM): ₹12.05**

---

## 4. EXACT FIXED INFRA [DB — platform_infra_costs, $113.00/mo × 83 = ₹9,379/mo]

| Line item | Unit $ | Qty/mo | $/mo | ₹/mo |
|---|---|---|---|---|
| MongoDB Atlas M10 | 57.00 | 1 | 57.00 | 4,731.00 |
| Qdrant Cloud | 25.00 | 1 | 25.00 | 2,075.00 |
| Upstash Redis | 10.00 | 1 | 10.00 | 830.00 |
| Vercel Pro (1 seat) | 20.00 | 1 | 20.00 | 1,660.00 |
| Domain progeni.live ($12/yr) | 1.00 | 1/12 | 1.00 | 83.00 |
| **FIXED TOTAL** | | | **113.00** | **9,379.00** |

(SES $0.10/1K emails, LLM APIs, LiveKit, Cloudinary, Edge-TTS, UPI gateway = **usage-based, currently ₹0.00 at qty=0**)

Exact fixed per actual interview, by volume:

| V (interviews/mo) | 39 | 100 | 300 | 1,000 | 5,000 |
|---|---|---|---|---|---|
| Fixed ₹/interview | 240.49 | 93.79 | 31.26 | 9.38 | 1.88 |
| + variable ₹12.05 ⇒ **₹/interview** | **252.53** | **105.84** | **43.31** | **21.43** | **13.92** |
| Monthly bill at that volume | ₹9,849 | ₹10,584 | ₹12,993 | ₹21,426 | ₹69,614 |

---

## 5. SCALE TABLES — the ₹3 question, exact arithmetic

### Scenario 1 — Keep everything as-is (Atlas M10 + Qdrant + Vercel Pro + paid Whisper + LiveKit Cloud)

| V/mo | Fixed | +Variable | **Total/mo** | **₹/interview** |
|---|---|---|---|---|
| 39 | 9,379 | 470 | 9,849 | **252.53** |
| 100 | 9,379 | 1,205 | 10,584 | **105.84** |
| 300 | 9,379 | 3,614 | 12,993 | **43.31** |
| 1,000 | 9,379 | 12,047 | 21,426 | **21.43** |
| 5,000 | 9,379 | 60,235 | 69,614 | **13.92** |

⇒ **₹3/interview is mathematically impossible in this scenario at any reachable volume** (even 5,000/mo = ₹13.92). The voice APIs + M10 + Vercel Pro eat the entire budget.

### Scenario 2 — Free/self-host voice on existing VM (Tier A), keep fixed minimal
*Atlas M0 (free) · existing VM runs Flask+Next+Qdrant+Redis+LiveKit+faster-whisper · Edge-TTS stays free · Flash-Lite/gpt-4o-mini · Hobby Next or self-hosted Next · B2 backup ₹300 + domain ₹83*

| V/mo | Fixed ₹/mo | +Variable (₹0.43) | **Total/mo** | **₹/interview** |
|---|---|---|---|---|
| 39 | 383 | 17 | 400 | **10.25** |
| 100 | 383 | 43 | 426 | **4.26** |
| 300 | 383 | 128 | 511 | **1.70** ✓ |
| 1,000 | 383 | 429 | 812 | **0.81** ✓✓ |
| 5,000 | 383 | 2,146 | 2,529 | **0.51** ✓✓ |

### Scenario 3 — Same, but dedicated small VM (Tier B: CX22-class ₹700 + M0 + backup + domain)

| V/mo | Fixed ₹/mo | +Variable | **Total/mo** | **₹/interview** |
|---|---|---|---|---|
| 39 | 1,083 | 17 | 1,100 | **28.21** |
| 100 | 1,083 | 43 | 1,126 | **11.26** |
| 300 | 1,083 | 128 | 1,211 | **4.04** |
| 1,000 | 1,083 | 429 | 1,512 | **1.51** ✓ |
| 5,000 | 1,083 | 2,146 | 3,229 | **0.66** ✓✓ |

### Scenario 4 — Hybrid (Atlas M0 free + Hobby Vercel free + self-host ONLY voice, keep LWS/M10? No)
*(Not recommended — if you keep ANY M10/Pro line (~₹6,400), scenario-2 ₹3 target breaks until V≥1,500/mo)*

| V/mo | Fixed ₹/mo | ₹/interview (V=1000) | Verdict |
|---|---|---|---|
| keep Atlas M10 only (+₹4,731) | 5,114 | 5.54 | ✗ over ₹3 |
| keep Vercel Pro only (+₹1,660) | 2,043 | 2.44 | ✓ but worse than S2 |

---

## 6. WHERE THE ₹3 GOES — the exact levers (what to change, in order)

| # | Change | Saves | New ₹/interview (rate card ×22 calls) |
|---|---|---|---|
| 1 | **Self-host STT** (faster-whisper int8 `small`, same VM, CPU ~3× realtime) | ₹4.98 | 12.05 → **7.07** |
| 2 | **Self-host LiveKit** (livekit-server, Docker, same VM) | ₹6.64 | 7.07 → **0.43** |
| 3 | **Atlas M10 → M0** (free 512MB, nightly archiver) | ₹4,731/mo fixed | fixed −50% |
| 4 | **Qdrant Cloud → Docker on VM** | ₹2,075/mo fixed | fixed −22% |
| 5 | **Upstash → Redis on VM** | ₹830/mo fixed | fixed −9% |
| 6 | **Vercel Pro → Hobby (if ToS OK) or self-host Next** | ₹1,660/mo fixed | fixed −18% |
| 7 | LLM stays Flash tier / gpt-4o-mini (₹0.42–0.64) | — | total **₹0.43** |

After 1–6: **₹1.70/interview at 300/mo, ₹0.81 at 1,000/mo** [Scenario 2, exact arithmetic above].

---

## 7. HONEST GAPS — what is NOT exact today, and why

1. **Metering captured 0 tokens / 0 cost on 208 events.** The wiring exists (chat calls recorded), but usage objects aren't landing — until this is fixed, **your true LLM bill cannot be read from the app; check the Google/OpenAI invoices directly.** [GAP]
2. **Only 5 completed interviews exist.** No abandoned-session cost split; STT/LiveKit minutes for in_progress/abandoned sessions are not metered anywhere. Your ₹11.62/interview is for 10 min of *answered* audio only. [GAP]
3. **Infra prices are list prices (seeds), not your invoices.** Atlas M10 is typically billed at $57/mo, but you may be on a different tier or have committed-use discounts. **Replace the `platform_infra_costs` values with your actual invoice amounts in the admin console — every line is editable.** Only then is "fixed = ₹9,379" your number. [GAP vs invoices]
4. **FX ₹83/$1** is a documented assumption, not your settlement rate. [GAP]
5. **Recordings/storage** (Cloudinary free 25GB at ₹0 today) — no per-interview storage cost is metered; S3/B2 egress unknown at scale. [GAP]
6. **`gemini-3.5-flash-lite` is configured but unpriced.** Any interview using it reports ₹0 LLM cost "unverified" — add its real rate card entry (Add model in Cost & Spend) for exactness, or switch to `gemini-2.0-flash`. [GAP]
7. **LiveKit $0.008/agent-min** is a list estimate; actual agent-minute pricing on LiveKit Cloud depends on your plan (verify dashboard). Self-hosting (Scenario 2) removes this entirely. [GAP]
8. **Email, SES, SMS/WhatsApp (if/when added)** — usage-based, ₹0 at current volume.
9. **Fixed ₹383 assumes UAT VM is genuinely free for you** (already running). Production-grade separation (staging ≠ prod) would need its own box (+₹400–700/mo → Scenario 3 numbers).
10. **Domain & TLS**: domain ₹83/mo; Caddy/Let's Encrypt = ₹0.

---

## 8. THE ANSWER, IN ONE TABLE

**Total cost per 10-minute interview, exact today vs after engineering:**

| State | Fixed/mo | ₹/interview @ 39/mo (now) | @ 300/mo | @ 1,000/mo | @ 5,000/mo |
|---|---|---|---|---|---|
| Today, cloud everywhere (paid voice, metered ₹0) | 9,379 | **252.53** | **43.31** | **21.43** | **13.92** |
| + self-host voice only (1&2), keep cloud infra | 9,379 | **240.90** | **31.69** | **9.81** | **2.31** |
| Free/self-host everything (Scenario 2, Tier A) | 383 | **10.25** | **1.70** ✓ | **0.81** ✓✓ | **0.51** ✓✓ |
| Same + dedicated small VM (Scenario 3, Tier B) | 1,083 | 28.21 | **4.04** | **1.51** ✓ | **0.66** ✓✓ |
| ₹3 target with zero free tiers, 5,000/mo only | 9,379 | — | — | — | **13.92** ✗ |

**Exact verdict for ₹3/interview**: achievable only via self-hosted voice (STT+LiveKit = ₹0) + free/self-host fixed infra, i.e. Scenarios 2/3, and only once volume ≥ ~250–300 interviews/month. There is no engineering trick that makes it ₹3 on the current M10+Pro+Whisper+LiveKit-Cloud stack at 39 interviews/month — the fixed ₹9,379 dominates whatever you do to per-call cost.

**What to do with this today (in priority order):**
1. Fix metering so tokens/cost are captured (or every future "exact" claim rests on assumptions).
2. Replace the 16 infra seeds with your REAL invoice amounts (per-line edit in Cost & Spend).
3. Add the real `gemini-3.5-flash-lite` rate card entry (or switch default model).
4. Execute Scenario 2/3 → verify ₹3 on the admin dashboard with 20 real pilot interviews.
5. Confirm Vercel Hobby ToS covers your use; else self-host Next on the VM (1 day).
