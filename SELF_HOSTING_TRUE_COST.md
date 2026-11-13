# Honest Total-Cost Calculation — Self-hosting vs Current Cloud

**Assumption set (to verify yourself):**
- Dedicated VM for the whole stack: 4 vCPU / 8GB RAM / 80GB SSD class
- Providers queried Nov 2026 (table below) — verify before you commit; prices change
- Current volume: 39 interviews total, ~10/day → 300/mo planning number; also show 1,000/mo and 5,000/mo
- Fixed costs include: VM, domain ₹83/mo (pro-rated), TLS (free — Caddy/Let's Encrypt), backups ₹500/mo (Backblaze B2-class or VM snapshots)

---

## A. Current cloud stack (as-is, before any work)

| Component | ₹/mo | Notes |
|---|---|---|
| MongoDB Atlas M10 | ₹4,731 | current production tier |
| Qdrant Cloud | ₹2,075 | ~$25 STARTER |
| Vercel Pro | ₹1,660 | 1 seat |
| Domain | ₹83 | already paid |
| LiveKit Cloud | per-min, see below | $0.008/agent-min |
| Whisper API | ₹4.98 per interview | per-min fee |
| **Fixed subtotal** | **₹9,549** | before any interview runs |
| Interview #40 (typical) | +₹11.6 | → average ≈ **₹250/interview** at current volume |

## B. "Just self-host everything" on a single mid-size VM (₹2,500/mo class)

Stack on one box (4 vCPU / 8GB): Next.js + Flask + Mongo + Qdrant + Redis + LiveKit + faster-whisper + Caddy

| Component | ₹/mo |
|---|---|
| VPS 4 vCPU / 8GB / 80GB (Hetzner CX32-class or Hostinger KVM 4) | ₹900 – ₹1,500 |
| Backups (restic/B2) | ₹500 |
| Domain | ₹83 |
| LLM (Flash-Lite, 12 calls/interview) | ~₹0.2/interview |
| Whisper / LiveKit / Qdrant / Redis / Next / Flask | ₹0 (self-hosted) |
| **Fixed subtotal** | **₹1,500 – ₹2,085** |

| Volume | ₹ fixed / interview | + variable | **Total ₹/interview** |
|---|---|---|---|
| 30/mo | ₹50.0 – 69.5 | ₹0.5 | **₹50.5 – 70.0** ❌ way over |
| 300/mo | ₹5.0 – 7.0 | ₹0.5 | **₹5.5 – 7.5** ❌ over ₹3 |
| 1,000/mo | ₹1.5 – 2.1 | ₹0.5 | **₹2.0 – 2.6** ✅ |
| 5,000/mo | ₹0.3 – 0.4 | ₹0.5 | **₹0.8 – 1.0** ✅✅ |

**Verdict: a ₹1,500–2,000 single-VM self-host only hits ₹3 around ~800 interviews/mo.** Scale-first thinking is mandatory.

## C. "Self-host + free tier where genuinely free" (recommended)

| Component | ₹/mo | Why it's OK at this scale |
|---|---|---|
| Reuse **existing UAT VM** (Docker + host networking, already paid) | ₹0 incremental | Zero new fixed cost today; only add whisper/livekit containers |
| If you need a new box later → **CX22-class 2 vCPU / 4GB** | ₹400 – ₹700 | 4 vCPU only when concurrency grows |
| **Oracle Cloud Always Free** (4 ARM cores / 24GB, forever free) | ₹0 | Genuine zero — but aarch64 builds for faster-whisper required and provider could suspend on abuse detection
| Atlas **M0** free | ₹0 | 512MB; archiver keeps it safe; enough headroom for 10–50k short docs |
| **Qdrant self-hosted** (Docker on same VM) | ₹0 | Part of VM |
| **Redis self-hosted** (Docker on same VM) | ₹0 | Part of VM |
| **LiveKit** (Docker on same VM) | ₹0 | Part of VM |
| **faster-whisper small int8** (CPU) | ₹0 | Part of VM |
| **Vercel Hobby** (if ToS OK — non-commercial use) **or** Next self-hosted on VM | ₹0 | Hobby is free; or systemd+nginx on the same VM |
| **Upstash/Redis Cloud free** | ₹0 | 256MB; enough for rate-limit/cache |
| **Backblaze B2** (backups 10GB) | ₹150 – ₹300 | nightly restic |
| Domain | ₹83 | |
| **Fixed subtotal (Oracle path)** | **₹233 – ₹383** | |
| **Fixed subtotal (CX22 path)** | **₹633 – ₹1,083** | |

| Volume | ₹ fixed / interview | + variable | **Total ₹/interview** |
|---|---|---|---|
| 30/mo (now) | ₹7.8 – 12.8 (Oracle) | ₹0.5 | **₹8.3 – 13.3** ❌ (not at current tiny volume) |
| 300/mo | ₹0.8 – 1.3 (Oracle) / ₹2.1 – 3.6 (CX22) | ₹0.5 | **₹1.3 – 4.1** |
| 1,000/mo | ₹0.2 – 0.4 (Oracle) / ₹0.6 – 1.1 (CX22) | ₹0.5 | **₹0.7 – 1.6** ✅ |
| 5,000/mo | ₹0.05 – 0.08 (Oracle) | ₹0.5 | **₹0.55 – 0.6** ✅✅ |

**The uncomfortable truth**: ₹3/interview is a *scale target*, not a *day-one* target — unless you go 100% free (Oracle / M0 / Hobby / existing VM). At 300 interviews/mo, only the free path reliably stays under ₹3. At 1,000+/mo, even a paid small VM comfortably beats it.

## D. Honest decision table

| Path | Fixed ₹/mo | Variable | ₹ at 300/mo | ₹ at 1,000/mo | Effort | Risk |
|---|---|---|---|---|---|---|
| **Keep current cloud** (Atlas M10 + Qdrant + Vercel Pro + LiveKit Cloud + Whisper API) | ₹9,549 | ₹11.6 | ₹43 | ₹21 | 0 | Budget blow at ₹500K cap |
| **Self-host on new ₹1,500–2,085 VM** | ₹1,500–2,085 | ₹0.5 | ₹5.5–7.5 | ₹2.0–2.6 | 1 week | ₹3 only at ≥800/mo |
| **Self-host on CX22 ₹400–700 + free tiers (M0, Hobby or self-host Next)** | ₹633–1,083 | ₹0.5 | ₹2.6–4.1 | ₹1.1–1.6 | 1.5 weeks | Free tiers ToS / M0 ceiling |
| **Self-host on Oracle Always Free (4-core ARM, 24GB) + M0 + Hobby** | ₹233–383 | ₹0.5 | ₹1.3–1.8 | ₹0.7–0.9 | 2 weeks | ARM builds, provider risk, no SLA |
| **Reuse existing UAT VM (Docker + host net) + M0 + Hobby + self-host everything** | ₹233–383 + ₹0 new | ₹0.5 | ₹1.3–1.8 | ₹0.7–0.9 | 1 week | UAT resilience to production load; no staging left |

---

## Recommendation (frank)

1. **Goal is unit economics, not hero self-hosting.** Start with **Path 3** (existing VM + free tiers). Zero new spend, ₹1.3–1.8/interview at 300/mo, ₹0.7 at scale.
2. **Keep Atlas M0 free** with a nightly archiver (swap provision when storage hits 60% — then M2 ₹600 adds only ₹2/interview at 300/mo).
3. **Do NOT** add a dedicated VM now — it blows the ₹3 cap at current volume. Add Hetzner CX22 the day you cross ~300 interviews/mo consistently.
4. **Drop Atlas M10 → M0 today**; that's the single biggest fixed cost saving.
5. **Drop Vercel Pro → Hobby** only after confirming ToS permits your use; otherwise self-host Next on the same VM.
6. **Drop LiveKit Cloud and Whisper API** regardless of path — both are ₹11.6/interview combined; self-host both, ₹0.

**Bottom line**:
- Fixed ₹0–1,083/mo is realistic with disciplined free tiers.
- ₹3/interview is achievable from ~300/mo volume upward on Path 3; day-one at current 39-interview scale it's ₹12–18 only if you refuse all free tiers.
- Scale is the lever — the app must be architected for 1,000+ interviews/mo so infra amortizes.
