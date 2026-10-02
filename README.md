# Swami AI — Standalone Interviewer Agent

Resume/JD-driven, LLM-powered AI interview agent with webcam + voice recording,
automatic transcription, per-answer scoring, and a final structured feedback report.
Extracted and re-packaged from Progeni Atlas's "Swami" interview module as a
standalone deliverable.

## Flow (matches Progeni's Swami)

```
Resume (PDF) + JD text
        │
        ▼
 [LLM] generate_questions()  ──►  8 personalized questions
        │                          (40% technical, 30% JD-fit, 30% behavioral)
        ▼
 Interview starts → webcam + mic go live, full-session video recording begins
        │
        ▼
 ┌─────────────── per question loop ───────────────┐
 │ 1. Question shown to candidate                   │
 │ 2. Candidate records voice answer (MediaRecorder)│
 │ 3. Backend: Whisper transcribes audio → text     │
 │ 4. [LLM] evaluate_answer() → score /10 + comment │
 │ 5. If answer is shallow → LLM injects a natural  │
 │    follow-up question right after this one       │
 │ 6. Advance to next question                      │
 └───────────────────────────────────────────────────┘
        │
        ▼
 [LLM] generate_feedback() → structured JSON:
   - overall_score /100, verdict (Strong Hire → No Hire)
   - category scores: technical_depth, communication, jd_fit, confidence
   - strengths[], improvements[]
   - per-question transcript + score breakdown
        │
        ▼
 Feedback report rendered to candidate/recruiter
 Full video + all answer audio saved under /recordings/<session_id>/
```

## Setup

```bash
cd swami-interviewer
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# LLM + transcription — pick ONE:

# Option A: OpenAI (default)
export OPENAI_API_KEY="sk-..."
export LLM_MODEL="gpt-4o-mini"

# Option B: your own stack (Ollama + LLaMA 3.3) for question-gen/scoring —
# transcription still needs an OpenAI key unless you swap in local Whisper/faster-whisper
export LLM_PROVIDER="ollama"
export OLLAMA_HOST="http://localhost:11434"
export OLLAMA_MODEL="llama3.3"

python app.py
```

Open `http://localhost:5000`.

## Client handoff notes

- **Browser permissions**: the app requests camera + mic access on session start —
  must be served over HTTPS (or localhost) in production, browsers block getUserMedia on plain HTTP.
- **Swap LLM provider** in `app.py` → `call_llm()` / `transcribe_audio()` — one function each,
  everything else (routes, scoring logic, question flow) is provider-agnostic.
- **Storage**: currently in-memory session store (`SESSIONS` dict in `app.py`) + local disk
  for recordings — for real client traffic beyond a demo, move `SESSIONS` to Redis/Postgres
  and recordings to S3/Cloud Storage (this mirrors the SQLite→PostgreSQL migration path
  already planned for Progeni Atlas).
- **Cost control**: each interview = 8 LLM calls (question-gen + 8x scoring + 1x feedback) +
  8 Whisper transcriptions. With `gpt-4o-mini` + `whisper-1` this stays well under ₹1-2/interview.
- **Video analysis** (facial engagement / eye-contact scoring via MediaPipe) is *not* included
  in this build — full video is captured and stored for manual review; wire in
  MediaPipe/DeepFace as a background job on `/recordings/<sid>/video_*.webm` if the client
  wants automated engagement scoring later.

## Three deliverables, one backend

All three share the same `app.py` Flask API — build/update logic once, every surface stays in sync.

| Deliverable | What it is | Where |
|---|---|---|
| **Website** | Full browser experience (desktop + mobile-responsive) | `templates/`, `static/` |
| **PWA (installable mobile web app)** | Same website, installable to home screen, offline app-shell caching | `static/manifest.json`, `static/service-worker.js` |
| **Native mobile app** | Real Android/iOS app (Expo/React Native), same 3-screen flow, same API | `mobile-app/` |

- **Website / PWA**: just run `python app.py` and open it on a phone browser — "Add to Home Screen" installs it like an app (manifest + service worker already wired in).
- **Native app**: see `mobile-app/README.md` — separate Expo project, talks to the same backend over HTTP, no code shared/duplicated on the server side.

## Files

```
swami-interviewer/
├── app.py                    # Flask backend — all routes + LLM/Whisper adapters (shared by all 3 surfaces)
├── templates/index.html      # 3-screen UI: setup → interview → report
├── static/
│   ├── js/interview.js       # webcam/mic capture, MediaRecorder, API calls, SW registration
│   ├── css/style.css         # desktop + mobile-responsive
│   ├── manifest.json         # PWA manifest
│   ├── service-worker.js     # PWA offline app-shell caching
│   └── icons/                # PWA icons (192/512)
├── mobile-app/                # Expo/React Native native app
│   ├── App.js, api.js
│   └── screens/               # SetupScreen, InterviewScreen, ReportScreen
├── requirements.txt
├── uploads/                   # uploaded resumes
└── recordings/<session_id>/   # per-session audio answers + video chunks
```
