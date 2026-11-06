# TalentPulse AI (Progeni Atlas)

> Autonomous, Enterprise-Grade Technical Screening & Live Multi-Modal Interviewing Platform.

TalentPulse AI is a real-time conversational technical interview platform designed to simulate an authentic 1-on-1 interview with a Senior Technical Lead. Featuring low-latency neural speech, multi-modal proctoring, synchronized code execution, and rubric-driven candidate assessments.

---

## 🏛️ Architecture Overview

The repository is cleanly partitioned into two core microservices:

```
talentpulse-AI/
├── frontend/             # Next.js 15 App Router Frontend & Interactive Interview Room
│   └── web/
│       ├── src/app/      # App Router (Candidate Lobby, Room, Report, Recruiter Dashboard)
│       ├── src/components# AIAvatarViewport, CandidateVideoPreview, CodeEditor, Captions
│       └── src/lib/      # Audio Recorder, Speech Synthesis, MediaPipe Proctoring
│
└── backend/              # Python 3.11+ Enterprise REST API & Interview Engine
    ├── app/              # Interviewer policy engine, scoring contracts, LLM service
    ├── core/             # Argon2id security, JWT authentication, MongoDB Atlas driver
    ├── database/         # Schemas, seeding scripts, and data models
    └── routes/           # Authentication, Session Management, Real-time TTS/STT Routes
```

---

## 🚀 Key Highlights & Enhancements

1. **Humanized Conversational Interview Experience**:
   - Persona: Senior Technical Lead (*Sarah Chen*) engaging in collegial, sharp, conversational technical dialogue.
   - Conversational Bridging: Contextual acknowledgements mirroring the candidate's actual architecture and code choices.
   - Studio Neural Audio: Multi-tier TTS leveraging Microsoft Azure Neural Edge-TTS (`en-US-AriaNeural`) and OpenAI (`tts-1`) with in-memory caching.
   - Adaptive Silence Detection: 12-second speech threshold with candidate thinking time extension buffers.

2. **Enterprise Security & Hardening**:
   - Zero-backdoor JWT validation with cryptographically secure secret signing.
   - OWASP-standard Argon2id password hashing with zero-downtime SHA-256 legacy migration.
   - Enterprise HTTP headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `HSTS`.

3. **Multi-Modal Proctoring & Telephony Sync**:
   - MediaPipe on-device gaze and presence tracking.
   - Dual-device companion pairing via QR and WebRTC.
   - Live closed captions and real-time audio waveform visualizers.

---

## 🛠️ Getting Started

### Backend Setup

```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python app.py
```

### Frontend Setup

```bash
cd frontend/web
npm install
npm run dev
```

---

## 🌐 Production Deployment

- **Web Application**: Hosted on [atlas.progeni.live](https://atlas.progeni.live) (Vercel)
- **API Engine**: Dockerized Gunicorn / Flask container on port 8406

