# Progeni Atlas — Human-to-Human Quality Interview Plan

**Goal**: Kandidate aisa interview experience kare jaise koi real Staff/Principal Engineer samne baitha ho — warm, emotionally present, adaptive, patient, curious, respectful — instead of "AI robot reading scripted questions".

**Benchmark**: candidates at interview's end should rate "felt like a real interview" ≥ 4.2/5.

---

## 1. What's broken today (code-grounded)

| # | Where | Problem |
|---|-------|---------|
| 1 | `llm_service._chat` chain | Blocking chat call before every turn — 800–2500 ms of silence while the LLM "thinks". Real interviewers talk back within ~250 ms. |
| 2 | `interviewer_policy.py` | Turn is "acknowledge → next question" rhythm, every turn identical cadence. Predictable. No rapport. No pause/variation. |
| 3 | Voice | Edge-TTS (free) — neural but flat, no prosody/energy/pacing. No "hmm", no "go on", no breathing. Candidate hears a terminal, not a person. |
| 4 | Turn mechanics | No barge-in (candidate can't interrupt), no interviewer backchannels, no handling of rambling ("Let's zoom back…"). |
| 5 | Structure | No interview arc: real interviews go intro → rapport → resume walkthrough → technical → behavioral → candidate questions → graceful close. System jumps straight into Q&A. |
| 6 | Warm-up/Onboarding | No small talk phase ("Before we start, how's your day going?"). Cold start = nervous candidates. |
| 7 | Silence handling | Long silence → nothing. Real interviewer says "take your time" / "want to think aloud?" / rephrases. |
| 8 | Score transparency | LLM judges answers strictly; candidate never feels "heard". Real interviewer nods, reflects, paraphrases back. |
| 9 | Behavioral rounds | STAR probing, conflict resolution, failure stories — largely absent; system is DSA-heavy. |
| 10 | Closing | Interview just stops. Real interviewers close warmly, invite questions, set expectations. |
| 11 | Difficulty | No calibration to seniority level; same tone for campus hire and staff engineer. |
| 12 | Feedback/Report | Report tone is robotic; no human framing ("Here's what stood out"). |

---

## 2. Design principles (non-negotiable)

1. **Latency is the #1 product feature.** <900 ms mouth-to-mouth total, <350 ms to first audio byte.
2. **Pacing > correctness** — human rhythm: acknowledge → reflect → one probe → short silence → next question.
3. **Never lecture, never say "correct/wrong"** (already partly in prompt rules — enforce everywhere).
4. **Never break persona.** Sarah Chen (Staff Systems Engineer) stays Sarah — same warmth, same phrases, same humility.
5. **Listening is active**: backchannels ("hmm", "go on", "I see"), reflecting candidate's words before the next question.
6. **Silence is data, not dead time** — monitor, offer thinking-aloud, or gently probe.
7. **Adaptive difficulty**: starts near candidate's claimed level; calibrates every 2 turns.
8. **Dignity and respect always** — accommodations, Hindi/Hinglish, and a candidate who is anxious is treated with warmth, not pressure.
9. **AI is a screen, not a judge** — final decision remains human.
10. **Every interview feels designed for that specific candidate** — resume, JD, target company, seniority all change tone and content.

---

## 3. The interview arc (redesigned)

```
0:00  Warm open (~45s)
      "Hi Sarah, thanks for making time today. How's your day going?"
      → Sets candidate at ease. Verifies tech (mic/camera) conversationally.

0:45  Intro & rapport (~60–90s)
      "I've read your resume — the project on vector search looks interesting.
       Before we begin, tell me in two minutes what you're working on."

2:00  Resume & depth probe (~4 min)
      2–3 questions from resume/JD, depth probes on architecture choices.

6:00  Core technical round (~10 min)
      3–4 problems scoped to level (campus → senior/staff), adaptive.

16:00 Behavioral / collab round (~5 min)
      1–2 STAR stories: conflict, failure, ambiguity.

21:00 Candidate's turn (~2 min)
      "Anything you'd like to ask me about the role or team?"

23:00 Warm close (~30s)
      "Thanks Sarah — that was a really good conversation. The team will
       review and we'll reach out by next week. Have a great rest of your day."
```

---

## 4. Phase 1 — Conversational core (Weeks 1–2)

**Backend — interviewer_policy.py / llm_service.py**

| Change | Details |
|---|---|
| Phase-aware persona | `InterviewPhase` enum: warm_up, intro, resume, technical, behavioral, candidate_questions, close. System prompt gets phase context + phase goal. |
| Rapport memory | Interviewer notes evolve per turn: likes, confusion, strong suits, hesitation. One-line summary persisted in session. |
| Ack variety engine | 20+ rotating acknowledgments keyed on what candidate *actually* said ("That's a neat trade-off between X and Y"), never generic praise. |
| Silence handling | If candidate silent > 8s → gentle probe ("Take your time — want to think aloud?"). If > 20s → offer skip ("No pressure — let's move to the next one"). |
| Follow-up naturalness | Max 1 per question (keep). Question reframes: clarifies, comforts, or challenges with "explain like I'm new". |
| Backchannels | Mid-turn low-latency "hm" / "go on" / "I see" — triggered on transcript suffix matching, < 150 ms TTS. |
| Close phase | Always ends: summary → gratitude → timeline → goodbye. No abrupt stops. |
| Candidate Q&A phase | Answer from a facts bank (role, team, stack, remote, growth). Honest "I don't know" with curiosity. |

**Frontend**
- Lobby copy updated to the 45 s warm open.
- Interview room chrome replaced by "video call feel": light, ambient sound, Sarah's avatar large, candidate small bottom-right.

---

## 5. Phase 2 — Voice pipeline (Weeks 2–4)

Goal: **turn-taking < 900 ms** and barge-in.

| Component | Target | Implementation |
|---|---|---|
| STT streaming | Partial transcripts at 150 ms chunks | Server-side Whisper via WebSocket/chunked, or browser-native Web Speech (fallback: Whisper). |
| LLM first token | < 500 ms on flash tier | Keep Gemini 2.0 Flash tier; add streaming (stream=true). |
| TTS streaming | First byte < 250 ms | Edge-TTS already streams; switch to streaming response to LiveKit/playback immediately; start audio while LLM generates. |
| Barge-in | Candidate can interrupt Sarah mid-sentence | VAD on candidate audio; stop TTS playback, note interruption, resume after answer. |
| Interviewer cut-in | Sarah can gently interrupt rambling (> 2 min answer) | Monitor STT length; inject "Let me jump in there…" at natural pause. |
| Turn metrics | p50/p95 latency tracked | Log: stt_partial_ms, llm_first_token_ms, tts_first_byte_ms, total_turn_ms. |

**Latency budget** (mouth-to-mouth):
```
STT partials      150 ms   → transcript visible to LLM
LLM first token   350 ms   → TTS stays silent until first sentence
TTS first byte    200 ms   → Sarah starts speaking ~700 ms after candidate stops
User perceived    < 1 s     → conversation feels natural
```

---

## 6. Phase 3 — Voice quality & prosody (Weeks 3–5)

Real interviews are *heard*, not read. Voice is half the product.

| Tier | TTS | Latency | Cost/10 min | Quality |
|---|---|---|---|---|
| Current | Edge-TTS (Azure AvaNeural) | 150 ms | ₹0 | Good, flat |
| Upgrade 1 | Azure Neural with **Styles** (cheerful, empathic, calm) | 200 ms | ~₹1–2 | Human-adjacent, emotion-aware |
| Upgrade 2 | OpenAI `tts-1-hd` (or gpt-4o-mini-tts) | 500 ms | ~₹5–10 | Best natural prosody |
| Upgrade 3 | ElevenLabs Turbo/Flash | 250 ms | ~₹8–15 | Premium, near-human |

**Plan**: ship Upgrade 1 immediately (Azure Speech with style presets per phase: warm-neutral for intro, empathic when candidate struggles, bright for close). A/B test Upgrade 2 with candidates.

**Prosody rules**:
- Pauses (300–500 ms) after reflecting candidate's answer before next question.
- Rate: slightly slower than reading (wpm ≈ 165), confident but never rushed.
- Pitch variance, not monotone. Emphasis on the concept being probed.
- "Hmm" / "go on" inserted at natural moments (not every turn — every 2–3 turns).

---

## 7. Phase 4 — Adaptive difficulty & hybrid rounds (Weeks 4–6)

**Difficulty engine**:
- Start at candidate-claimed level (parsed from resume + form: campus/grad/1–3y/4–7y/staff).
- Every 2 turns, recalibrate: 2 strong answers → bump difficulty; 2 weak → de-escalate gently with encouragement.
- Seniors get trade-offs and ambiguity; grads get fundamentals and clarity.

**Round templates**:
- **Coding pair-programming** — Sarah talks through clarifying the problem, not solving it. Candidate thinks aloud. Sarah asks "what if input is empty?", "what if scale is 10×?" — collaborative, not interrogative.
- **System design whiteboard** — Sarah challenges choices with "why not X?", not prescriptive.
- **Behavioral STAR** — "Tell me about a time you disagreed with your lead. What happened?" Follow-ups: situation → task → action → result → reflection.
- **Leadership/trade-offs** — for staff+ roles: "You have two projects, 3 weeks, one engineer — what do you do first and why?"

---

## 8. Phase 5 — Social wrapping & closing (Weeks 5–7)

- **Candidate Q&A phase** — Sarah answers from org facts: role, stack, team size, remote, growth path, compensation philosophy. If unknown, "Good question — I'll find out for you" (never fabricate).
- **Graceful close** — gratitude → what happens next → timeline → well-wishes by name.
- **Post-interview human thank-you** — email from Sarah Chen (warm, specific to the candidate's strong moments).
- **Report human tone** — "Sarah's overall impression: You reason clearly and stay composed. Areas to sharpen: deeper system-trade-offs…" — not just scores.

---

## 9. Phase 6 — Measurement & calibration (Weeks 6–8)

**KPIs**:
| Metric | Target |
|---|---|
| Candidate NPS / "felt human" rating | ≥ 4.2 / 5 |
| Talk-time ratio | 55–70% candidate |
| Avg post-answer pause | < 900 ms p50 |
| Drop-off mid-interview | < 8% |
| Rater agreement (LLM vs human judge) | ICC ≥ 0.75 |
| Acceptance rate after AI round | vs baseline +25% |
| Completion without intervention | ≥ 92% |

**Cadence**: weekly sample (30 interviews) reviewed by 2 human interviewers; iterate prompts; bias audit across cohort; publish "what we changed" internally.

---

## 10. Non-goals & guardrails

- AI never overrides human final decision.
- No voice cloning of real humans without consent; Sarah Chen is synthetic (disclosed).
- No recording without consent; proctoring flags for proctoring-only, not bias.
- Accommodations: extra time, text mode, quiet environment od not penalized.
- Consent for voice storage — clear TOS, opt-out → resume via text screen.

---

## 11. Cost impact (per 10-min interview)

| Component | Cost |
|---|---|
| LLM (22 calls, flash-tier) | ₹0.5–2 |
| Whisper STT (10 min) | ₹5 |
| Edge-TTS / Azure neural | ₹0–2 |
| LiveKit minutes | ₹7 |
| Embeddings | ₹0.02 |
| **Total (warm-voice quality)** | **≈ ₹14–16** |
| Premium voice (OpenAI TTS) | ≈ ₹90–120 (optional) |

Versus ₹8–10 today — marginal cost increase for a fundamentally different product.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Latency regression | Performance budget in CI: < 900 ms p95; degradation alerts |
| Provider cost spike | Flash tier default; Pro tier opt-in; per-interview cost shown in admin |
| Bias claims | Weekly audit; human-in-loop final decision; publish methodology |
| Voice consent lawsuits | Synthetic voice, disclosed; TOS + consent; no real-person clones |
| Candidate gaming | Behavioral + whiteboarding unanswerable by LLM-alone; human review of finalists |
| Over-anthropomorphization | Sarah Chen always identified as AI in lobby + report |

---

## 13. Phased timeline (8 weeks)

```
Week 1    Phases & rapport memory, silence handling, close phase
Week 2    Ack variety, candidate Q&A phase, Sarah persona consistency
Week 3    Streaming STT + LLM first-token, barge-in, backchannels
Week 4    Streaming TTS → <900 ms turn, latency instrumentation
Week 5    Azure Speech with styles (emphatic/warm/calm), pacing engine
Week 6    Adaptive difficulty ladder, behavioral rounds, coding pair-programming feel
Week 7    Graceful close, Sarah thank-you email, human-tone report
Week 8    Calibration, human-vs-LLM agreement, bias audit, ship
```

---

## 14. Immediate next steps (if approved)

1. Add interview-phase scaffolding + rapport memory to `interviewer_policy.py` (Phase 1)
2. Add streaming turn pipeline in `interview_routes.py` + TTS chunked playback (Phase 2)
3. Add latency instrumentation + admin latency dashboard (`/super-admin/latency` or new Cost & Spend tab)
4. Run 10 pilot interviews with current candidates → measure "felt human" score
5. Iterate 3× on prompts before any public release
