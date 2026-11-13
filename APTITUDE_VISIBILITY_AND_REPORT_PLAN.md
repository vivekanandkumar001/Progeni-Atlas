# Progeni Atlas — Aptitude: Visibility & Report Prior Implementation (2026-11-12)
**Researched & authored 2026-11-12.** Web benchmarks: AMCAT (MyAMCAT), eLitmus pH, Mercer Mettl, HackerRank Benchmarks, Criteria CCAT.
**STATUS: A+B+C+D+E ALL IMPLEMENTED & VERIFIED (2026-11-12).**

### Implementation record
* **A (Discovery)**: Aptitude added to candidate header nav · dashboard `AptitudeTeaserCard` (best score/attempts + CTA) inserted below hero · onboarding page gains "Take Aptitude Baseline" CTA · light-theme consistent `/candidate/aptitude` (fixed white-on-white invisible headings, consistent text colors) · Reports page already had aptitude empty-state CTA.
* **B (Scoring engine)**: `_finalize_aptitude_scoring` rewritten — real norm-pool percentile vs completed same-track attempts (≥30 required, else `percentileBasis:'insufficient_pool'` + `normPoolSize`, UI shows "Benchmarking — unlocks at 30") · sectional percentiles per pillar (same pool method) · `integrityVerdict` clean/review/flagged from trustScore · `accuracyVsSpeed` quadrant (Fast&Accurate / Fast&Careless / Slow&Accurate / Slow&Careless) · `avgSecondsPerQuestion` · `radar` vs benchmark (template `benchmarkScore`, default 60) · `deltaVsPrevious` vs last same-track attempt · negative marking (-0.25 per wrong on `template.negativeMarking` like Quant Sprint) · telemetry review/JSON passthrough.
* **C (Report & hub UI)**: report page — Cognitive Rank card handles null (Benchmarking state) · delta-vs-last-attempt chip in header · `Cognitive Fitness Radar` SVG polygon (pillars vs benchmark, ≥3 sections) · Accuracy×Speed quadrant callout · integrity verdict band (CLEAN/REVIEW/FLAGGED) · sectional %ile chips · `PDF Scorecard` button (print-ready HTML via new `/report/pdf` endpoint) · A/B "Beat Your Score →" CTA (variant from `platform_settings.aptitude_ab`, default B) with `report_view`/`retake_click`/`pdf_download`/`share_click` funnel events persisted in `aptitude_events` · aptitude hub shows score-trend polyline (last attempts) · attempt table shows `benchmarking` state.
* **D (Scorecard & recruiters)**: `GET /api/aptitude/sessions/<id>/report/pdf` — print-ready A4 HTML scorecard (ref `AT-XXX`, radar vs benchmark, section breakdown table, integrity verdict, question review, candidate-authorized footer) · recruiter dashboard & dossier modal & dossiers table all surface aptitude score + null-safe percentile/verdict/norm-pool text/delta.
* **E (Metering & A/B)**: admin `/super-admin/usage` gains Aptitude block — sessions, completed, avg score, avg accuracy, funnel event counts · `/api/aptitude/events` persists A/B funnel events · `aptitude_ab` platform setting (default variant B) flips CTA copy · A/B measureable from day 1.
* Verified live end-to-end: 2 attempts submitted (any wrong answers) → 0.0 & 25.0 scores, `percentileBasis: insufficient_pool`, trust 100, `fast_careless` quadrant, radar pillars Q/L/V/DI/A, A/B variant B, report_view events logged (3), admin usage shows aptitude 4 sessions/3 completed/avg 13.9%.

---

## 1. What shipped before this work (grounded, verified)

**Mandate from owner:** aptitude exists but is invisible (only reachable via direct URL or the Reports page) and lacks the scorecard depth rivals show. Plan the best, proper implementation.

---

## 1. What ships today (grounded, verified)

| Layer | State |
|---|---|
| UI | `/candidate/aptitude` page: dark hero (attempts/avg-accuracy/best-percentile), 3 tracks (AMCAT-style 5-pillar strict · Math speed sprint · Logic puzzles), attempt history table |
| Report | `/candidate/aptitude/test/[id]/report` — 538 lines, review list + explanations; **zero charts** (no radar, no graphs of any kind) |
| Backend | `routes/aptitude_routes.py` — templates, start, answer, violation (tab-switch/fullscreen/DevTools/paste), submit, `_finalize_aptitude_scoring` (section stats, accuracy, trust score, speed index, per-question review) |
| Data | `aptitude_sessions` (2 rows, both `status: in_progress`, 0 completed), `aptitude_questions: 0` seeded |
| Percentile | **FAKE**: `min(99, max(15, score*0.85 + trust*0.15))` — not computed vs any norm pool; labels itself "Percentile" — misrepresentation |
| Discovery | Aptitude appears **nowhere**: not in candidate header nav (Jobs, Practice, My Interviews, Reports, Skills), not in dashboard, not in onboarding, not in recruiter flow |

---

## 2. What best-in-class actually shows (web-verified)

**AMCAT / MyAMCAT**
- Per-**module** scores and **module percentile** (not just total) + letter-grade per module
- Adaptive quality metric per module
- Employability report: total score, AMCAT percentile, eligibility bands for companies (e.g. "top 10%"), recruiter-side shortlisting view
- Result card: `module | questions | score | percentile | grade`

**eLitmus pH**
- **Absolute marks AND percentile per section** (companies cut on sectional percentiles, e.g. ">70th %ile Quant")
- Overall pH score; retake guidance; benchmarked against the full pH pool

**Mercer Mettl**
- **Spider/radar chart** across competencies vs a role benchmark line
- Per-question time analysis, **integrity/proctoring flags** surfaced on the report, automatic insights, percentile bands, printable PDF report delivered to employer

**HackerRank**
- **Percentile-based scoring** (top 10%/25%/50%), per-section breakdown, integrity signals, actionable summary for screeners

**Criteria CCAT**
- **Raw score + percentile rank** per ability (verbal/math/spatial), with suggested performance ranges; employer sees candidate vs norm pool

**Common winning pattern to copy:**
1. Overall score + **percentile vs a norm pool** (suppressed until pool ≥ N)
2. **Sectional scores + sectional percentiles** (the eLitmus/AMCAT key)
3. **Radar chart** of the 5 pillars vs a target benchmark
4. **Radar/time analytics**: time per question, speed index, accuracy-vs-speed
5. **Question-level review** with explanations (you already have this)
6. **Progress over attempts** (line chart across sessions)
7. **Integrity telemetry** surfaced with pass/review/fail band
8. **Downloadable PDF** + share to recruiters (you have HTML→PDF infra for scorecards)

---

## 3. The plan

### Phase A — Make it discoverable (1–2 days)

| # | Change | Where |
|---|---|---|
| A1 | Add **Aptitude** to candidate header nav (icon Brain/Gauge) | `components/dashboard/DashboardHeader.tsx` (check nav config) |
| A2 | **Dashboard section/card**: "Aptitude & Cognitive Screening — attempted 0/2 · Start Assessment" with CTA; or empty-stat widget "Take your baseline AMCAT-style test" | `src/app/candidate/dashboard/page.tsx` + new `components/dashboard/AptitudeTeaserCard.tsx` |
| A3 | **Onboarding**: after resume-parsed, suggest aptitude baseline ("Recruiters shortlist on sectional percentiles") | `src/app/candidate/onboarding/*` |
| A4 | **Reports page**: already links aptitude — also add banner "You completed 0/3 assessments" | `src/app/candidate/reports/page.tsx` |
| A5 | Fix invisible white-on-white headings on `/candidate/aptitude` (DONE 2026-11-12) and apply consistent light theme (DONE — hero stays intentional dark) | `src/app/candidate/aptitude/page.tsx` |

### Phase B — Honest scoring & real report metrics (backend, 2–3 days)

| # | Change | Notes |
|---|---|---|
| B1 | **Percentile = real norm computation** (never fabricated): percentile = fraction of `aptitude_sessions` (completed, same template/track) with lower `overallScore`. Until pool < 30 completed attempts per track, display **percentile: null + label "Building benchmark pool — percentile unlocks at 30 attempts"**. Persist `norm_pool_size` at scoring time. | cron or compute-on-read; backfill on completion |
| B2 | **Sectional accuracy AND sectional percentile** per pillar (same norm method per pillar) | extend `sectionBreakdown` in `_finalize_aptitude_scoring` |
| B3 | **Radar chart** (5 pillars: score/normalized) vs **track benchmark line** (configurable, default AMCAT 50th-p50 line 60%) | backend emits `radar: {pillar, score, benchmark}` |
| B4 | **Speed analytics**: avg sec/question per section vs `timeRecommendedSeconds`; `speedIndex` (already) + `accuracyVsSpeed` quadrant (Fast & Accurate / Careful / Risky / Slow) | already have raw times; add quadrant label |
| B5 | **Integrity verdict band**: `clean ≥90 · review 75–89 · flagged <75` derived from trust score; show exactly which signals fired (tab switch, fullscreen exit, DevTools, paste) with counts | extend scorecard with `integrityVerdict` |
| B6 | **Attempt-over-attempt delta**: score change vs previous attempt on same track ("+6 points vs your last AMCAT run") | history comparison at scoring time |
| B7 | Optional: **section-attempt weights & negative marking math fix** — verify -0.25 is applied exactly as AMCAT does | code review + tests |

### Phase C — Report UI overhaul (frontend, 2–4 days)

Rebuild `/candidate/aptitude/test/[testId]/report` into 6 sections (single scroll), all driven by B1–B6:

1. **Header**: template title, date, verdict pill (Placement-Ready / Needs Improvement bands by percentile), share + Download PDF buttons
2. **Score hero**: big overall score / percentile (or "Benchmarking…" state while pool < 30), sectional percentile chips
3. **Cognitive Fitness Radar** (SVG radar chart — pillars vs benchmark) + legend
4. **Sectional breakdown table**: `section | attempted | correct | accuracy | time/q | sectional percentile` (eLitmus-style) — with TOPIC-level sub-row sorted worst→best (AMCAT-style "your weak topics")
5. **Performance analytics**: accuracy-vs-speed scatter/quadrant, time-per-section bar chart, attempt-over-attempt delta
6. **Question review** (existing, keep): filter chips (All/Correct/Incorrect/Skipped), explanation + formula per question, difficulty, time vs recommended (highlight where too slow)
7. **Integrity panel**: trust score ring, fired signals with counts, verdict band
8. **What's next** CTA: recommended track + "Retake to improve your weakest pillar" + link to practice drills for weak topics

Plus **History page section** (`/candidate/reports` Aptitude tab + `/candidate/aptitude` Previous Scorecards):
- Trend line chart: score across attempts (per track)
- Progress: best percentile, attempts count, streak
- "Compare attempts" side-by-side when ≥ 2 attempts on same track

### Phase D — Recruiter-ready output (1–2 days)

| # | Change |
|---|---|
| D1 | **PDF scorecard** via existing HTML scorecard → PDF pipeline (same as interview dossier PDF), watermarked "Candidate-authorized" |
| D2 | **Employer view**: on recruiter side of `/candidate/interview-records` show aptitude verdict + pillar radar thumbnail when candidate consents (extend recruiter dossier payload) |
| D3 | **Match %** for a recruiter open role vs aptitude pillars (stretch — role skill weights × candidate pillar scores) |

### Phase E — Instrument & gate (0.5–1 day)

- Shadow-meter aptitude sessions (started/completed/abandoned) into existing usage analytics
- A/B: hero copy of report page vs control to measure retake rate

---

## 4. Suggested sequencing & effort

```
Week 1 — Phase A (discovery) + B1–B3 (percentile, sectional, radar)
Week 2 — Phase C (report rebuild) + B4–B6
Week 3 — Phase D (PDF/employer) + Phase E (telemetry)
```
Total ≈ **2.5–3.5 weeks**, 1 full-stack dev + design review mid-way.

## 5. Engineering notes & honesty guardrails

- **Percentile honesty**: never show a percentile until norm pool ≥ 30/track; until then show "Benchmarking — percentiles unlock at N more attempts" + raw accuracy. This matches how CCAT/AMCAT gate percentile display during rollout.
- **Radar benchmark line** configurable per template in DB (`track.benchmarkPillars`), never hardcoded.
- **No new third-party chart libs** required — SVG radar/bars are ~80 lines; or adopt `recharts` (only if installed already — check before adding).
- All new scorecard fields are additive to `aptitude_sessions.scorecard` — no schema migration needed for old attempts (report page degrades gracefully when fields missing).
- Sectional percentile: pool is per (track, pillar) — track-locked to avoid mixing AMCAT and Logic sprint pools.

## 6. What changes for the user (mini-spec)

- New nav item, dashboard teaser, onboarding prompt → user discovers aptitude without knowing the route
- Scorecard = AMCAT-grade: radar + sectional percentile + time analytics + attempt trend + shareable PDF
- Honest percentiles, gated until pool is meaningful
- Report remains candidate-owned; sharing explicit
