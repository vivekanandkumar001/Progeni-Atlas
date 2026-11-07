'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  Code2,
  ShieldCheck,
  FileText,
  Video,
  Sparkles,
  Users,
  Building2,
  CheckCircle2,
  Mic2,
  BarChart3,
  PlayCircle,
  ChevronDown,
  Terminal,
  Cpu,
  Flame,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const featureCards = [
  { icon: Video, title: 'Two-Way AI Video Interviews', text: 'A natural candidate ↔ AI interviewer conversation with live voice, video and adaptive follow-up questions.' },
  { icon: BrainCircuit, title: 'Resume + JD + Role Intelligence', text: 'The interview context is built from the candidate resume, job description, target role and skills.' },
  { icon: Code2, title: 'Live Coding & System Design', text: 'Assess coding, architecture and technical reasoning inside a focused interview workspace.' },
  { icon: ShieldCheck, title: 'AI Proctoring', text: 'Monitor interview integrity signals such as focus changes and unauthorized actions.' },
  { icon: BarChart3, title: 'Evidence-Based Scorecards', text: 'Turn answers, coding performance and competency signals into a structured assessment.' },
];

const panelInterviewers = [
  {
    name: 'Sarah Chen',
    role: 'Staff Systems Engineer',
    level: 'Hard',
    levelColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    desc: 'Deep dives on distributed concurrency, locking semantics & high-throughput pipelines.',
    avatar: '/avatars/interviewer_female.jpg',
  },
  {
    name: 'Alex Rivera',
    role: 'Principal Frontend Architect',
    level: 'Medium',
    levelColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    desc: 'Tests real DOM performance, state reactivity, micro-frontends and accessibility.',
    avatar: '/avatars/interviewer_female.jpg',
  },
  {
    name: 'Dr. Vikram Sethi',
    role: 'Lead ML & Algorithms Lead',
    level: 'Hard',
    levelColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    desc: 'Probes dynamic programming, graph invariants, transformer latency & memory bounds.',
    avatar: '/avatars/interviewer_female.jpg',
  },
  {
    name: 'Maya Patel',
    role: 'Engineering Manager (Behavioral)',
    level: 'Warm-up',
    levelColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    desc: 'Evaluates architecture trade-offs, cross-functional leadership, and conflict resolution.',
    avatar: '/avatars/interviewer_female.jpg',
  },
];

const benefits = [
  ['AI-Driven Technical Assessment', 'Evaluate demonstrated skills, not just resume keywords.', BrainCircuit],
  ['Consistent Candidate Evaluation', 'Use structured criteria across interviews and roles.', CheckCircle2],
  ['Real-Time Interviewing', 'Let the AI interviewer listen, ask and adapt naturally.', Mic2],
  ['Secure AI Proctoring', 'Protect interview integrity throughout the session.', ShieldCheck],
  ['Automated Scorecards', 'Generate competency breakdowns and evidence for review.', FileText],
  ['Enterprise Governance', 'Centralize organizations, users, interviews and audit visibility.', Building2],
];

const pricing = [
  {
    name: 'Free Starter',
    price: '₹0',
    credits: '10 Credits',
    note: 'Instant on OTP verification',
    items: [
      '1 Full AI Technical Mock Round',
      'Live Coding & Spoken Voice Analysis',
      'Instant Scorecard & Feedback',
      'No Credit Card Required',
    ],
    popular: false,
    cta: 'Start Free Trial',
    href: '/register',
  },
  {
    name: 'Warm-up Pack',
    price: '₹49',
    credits: '30 Credits',
    note: 'Quick practice before real interview',
    items: [
      '30 AI Credits (~15-20 mins practice)',
      '1 Full DSA or Behavioral Round',
      'Turn-by-Turn Audio & Transcripts',
      'Target Role & Topic Tailoring',
    ],
    popular: false,
    cta: 'Get 30 Credits',
    href: '/candidate/wallet',
  },
  {
    name: 'Placement Ready',
    price: '₹99',
    credits: '70 Credits',
    note: 'Most chosen for campus & job prep',
    items: [
      '70 AI Credits (~35-40 mins practice)',
      '2-3 Full Technical & Design Rounds',
      'Resume Defense + Custom JD Parsing',
      'Company Benchmark Scoring (TCS, Google)',
    ],
    popular: true,
    cta: 'Get 70 Credits (Save 30%)',
    href: '/candidate/wallet',
  },
  {
    name: 'Pro Mastery',
    price: '₹199',
    credits: '150 Credits',
    note: 'Best value for placements',
    items: [
      '150 AI Credits (~75-80 mins practice)',
      '5+ Full Technical, DSA & HR Rounds',
      'Company-Specific Question Sets',
      'Priority AI Speech & Audio Latency',
    ],
    popular: false,
    cta: 'Get 150 Credits',
    href: '/candidate/wallet',
  },
];

const faqs = [
  ['How does the AI interviewer create questions?', 'It uses the interview context — resume, job description, role, skills and previous answers — to determine the next question in real time.'],
  ['Is the interview two-way?', 'Yes. The candidate communicates with the AI interviewer through real-time neural voice and video. The AI adapts and asks organic follow-up questions.'],
  ['Can HR schedule real interviews?', 'Yes. Recruiters can create positions, invite candidates and use the scheduled interview workflow. Practice interviews remain separate.'],
  ['Does Progeni Atlas support coding interviews?', 'Yes. The candidate experience includes a live code workspace, terminal execution, and system-design stages.'],
  ['What does the final scorecard contain?', 'It includes technical depth, coding speed, architecture trade-offs, problem solving, and evidence-linked transcripts.'],
];

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeCodeTab, setActiveCodeTab] = useState<'python' | 'cpp' | 'ts'>('python');
  const [timerSeconds, setTimerSeconds] = useState(462); // 07:42

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tp_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && (u.id || u.email)) {
          const role = String(u.role || 'candidate').toLowerCase().trim();
          const target = role === 'super_admin'
            ? '/super-admin'
            : (role === 'recruiter' || role === 'admin' || role === 'hr')
              ? '/recruiter/dashboard'
              : '/candidate/dashboard';
          router.replace(target);
          return;
        }
      }
    } catch {}
    setCheckingAuth(false);
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-canvas text-ink overflow-x-clip selection:bg-cyan-500/20 selection:text-cyan-200">
      <Navbar />

      {/* =====================================================================
          HERO SECTION - SAKSHAAT-STYLE DYNAMIC AMBIENT MOTION
          ===================================================================== */}
      <section id="hero" className="relative border-b border-line overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Masked Geometric Grid */}
        <div className="sakshaat-grid" />

        {/* Floating Ambient Glow Orbs (Sakshaat lpDriftA & lpDriftB) */}
        <div className="absolute -left-20 -top-32 h-[680px] w-[680px] rounded-full bg-radial from-cyan-500/20 via-cyan-500/5 to-transparent blur-3xl pointer-events-none anim-drift-a" />
        <div className="absolute right-[-140px] top-10 h-[620px] w-[620px] rounded-full bg-radial from-indigo-500/20 via-purple-500/5 to-transparent blur-3xl pointer-events-none anim-drift-b" />
        <div className="absolute left-1/3 bottom-0 h-[480px] w-[480px] rounded-full bg-radial from-amber-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none anim-drift-a" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
          
          {/* Left Column: Headline & Action */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {/* Live Kicker Pill with Radar Beacon Dot & Brand Aura */}
            <div className="relative inline-flex mb-6">
              <span className="absolute -inset-1 rounded-full bg-cyan-400/25 blur-md anim-aura pointer-events-none" />
              <div className="relative inline-flex items-center gap-2.5 rounded-full border border-cyan-400/40 bg-surface/90 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-cyan shadow-sm backdrop-blur-md">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </span>
                Spoken Interviews · Live Coding · Instant Dossier
              </div>
            </div>

            {/* Title with Gradient Highlight */}
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-ink sm:text-5xl lg:text-6xl lg:leading-[1.06]">
              Face your interview
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
                before it&apos;s real.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
              Spoken mock interviews with an adaptive AI interviewer. Solve real coding problems on a live editor, defend your system architecture, and receive an audit-ready scorecard.
            </p>

            {/* CTAs with Sheen Sweeper Effect */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row items-stretch sm:items-center">
              <Link
                href="/register"
                className="sheen-sweeper group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:brightness-110 hover:shadow-cyan-500/35 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start Free Interview</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              
              <a
                href="#live-demo"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface/80 px-6 py-4 text-sm font-semibold text-ink backdrop-blur-md transition-all duration-300 hover:border-cyan-400/50 hover:bg-surface-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <PlayCircle className="h-4 w-4 text-accent-cyan" />
                <span>Watch Interactive Demo</span>
              </a>
            </div>

            {/* Checked features list with micro-animations */}
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 text-xs text-ink-muted">
              {['Live DSA Coding', 'Spoken Voice Follow-ups', 'MediaPipe Proctoring', 'Server-Graded Rubrics'].map((item, idx) => (
                <span key={item} className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-accent-cyan" />
                  {item}
                </span>
              ))}
            </div>

            {/* Trust badge with Sakshaat-style twinkling star sparks */}
            <div className="relative mt-8 max-w-sm">
              {/* Twinkling Star Sparks */}
              <svg className="trust-sparkle -top-3 -right-2 w-5 h-5 text-cyan-400 fill-cyan-400" viewBox="0 0 24 24">
                <path d="M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z" />
              </svg>
              <svg className="trust-sparkle top-7 -left-3 w-3.5 h-3.5 text-indigo-400 fill-indigo-400" style={{ animationDelay: '1.2s' }} viewBox="0 0 24 24">
                <path d="M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z" />
              </svg>

              {/* Rotating Conic Border Frame */}
              <div className="conic-border-box">
                <div className="sheen-sweeper relative z-10 flex items-center gap-3.5 rounded-[1.15rem] bg-surface/95 px-4 py-3 backdrop-blur-md">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
                    <span className="ping-ripple" />
                    <Check className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">Verified Technical Rigor</p>
                    <p className="text-xs font-semibold text-ink">
                      <strong className="font-extrabold text-sm text-cyan-500">10,000+</strong> technical screenings completed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Interactive Live Video Call & Code Editor Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative"
          >
            {/* Ambient Aura Background */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/15 to-purple-500/20 blur-2xl pointer-events-none anim-aura" />

            {/* The Live Video Interview Room Window (Sakshaat Style) */}
            <div className="relative overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-950 text-white shadow-2xl shadow-cyan-500/15">
              
              {/* Window Titlebar / Live Status Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 text-xs backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="font-mono text-slate-400">|</span>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="font-semibold text-emerald-300">Live Call</span>
                    <span className="font-mono text-[11px] text-slate-400">· {formatTimer(timerSeconds)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                    Live DSA & Concurrency Round
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Python 3.12</span>
                </div>
              </div>

              {/* Dual Video Tiles: AI Interviewer & Candidate */}
              <div className="grid gap-3 p-3.5 sm:grid-cols-2 bg-slate-950/70">
                
                {/* AI Interviewer Viewport */}
                <div className="relative overflow-hidden rounded-xl border border-cyan-400/60 bg-slate-900 shadow-lg ring-2 ring-cyan-400/30">
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/avatars/interviewer_female.jpg"
                      alt="Sarah Chen"
                      className="h-full w-full object-cover object-center interviewer-sway brightness-105 contrast-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                    
                    {/* Active Voice Equalizer Overlay (11 Equalizer Bars) */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-lg bg-slate-950/85 px-2.5 py-1 backdrop-blur-md border border-slate-700/60">
                        <span className="text-[11px] font-bold text-white">Sarah Chen</span>
                        <span className="text-[9px] font-mono text-cyan-400 font-semibold uppercase">Lead AI</span>
                      </div>

                      {/* Equalizer Waveform Bars */}
                      <div className="flex items-end gap-1 h-5 px-2 py-1 rounded-md bg-slate-950/85 border border-cyan-500/30 backdrop-blur-md">
                        {[0.2, 0.5, 0.8, 0.4, 0.9, 0.3, 0.7, 1.0, 0.6, 0.4, 0.8].map((delay, i) => (
                          <div
                            key={i}
                            className="voice-bar bg-cyan-400"
                            style={{ animationDelay: `${delay}s`, animationDuration: `${0.8 + (i % 4) * 0.2}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Video Preview */}
                <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-md">
                  <div className="relative flex h-44 w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950/60">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shadow-inner">
                      <Users className="h-8 w-8" />
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-lg bg-slate-950/85 px-2.5 py-1 backdrop-blur-md border border-slate-800">
                        <span className="text-[11px] font-bold text-white">Arpita S.</span>
                        <span className="text-[9px] font-mono text-slate-400">(Candidate)</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                        <Mic2 className="h-3 w-3" /> Audio Active
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time Live Code Editor Workspace */}
              <div className="border-t border-slate-800 bg-slate-950 p-3.5 font-mono text-xs">
                {/* Code Tabs */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-[11px] font-bold text-slate-300">Solution.py</span>
                  </div>
                  <div className="flex gap-1 text-[10px]">
                    <button
                      onClick={() => setActiveCodeTab('python')}
                      className={`px-2 py-0.5 rounded transition ${activeCodeTab === 'python' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                    >
                      Python
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('cpp')}
                      className={`px-2 py-0.5 rounded transition ${activeCodeTab === 'cpp' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                    >
                      C++
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('ts')}
                      className={`px-2 py-0.5 rounded transition ${activeCodeTab === 'ts' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                    >
                      TypeScript
                    </button>
                  </div>
                </div>

                {/* Code Lines with Syntax Highlighting and Active Line Caret */}
                <div className="space-y-1 text-slate-300 leading-relaxed">
                  <div className="flex gap-3">
                    <span className="w-4 select-none text-slate-600">1</span>
                    <div>
                      <span className="text-purple-400">class</span> <span className="text-yellow-300">Solution</span>:
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-4 select-none text-slate-600">2</span>
                    <div className="pl-4">
                      <span className="text-purple-400">def</span> <span className="text-blue-400">maxSlidingWindow</span>(self, nums: <span className="text-cyan-400">list[int]</span>, k: <span className="text-cyan-400">int</span>) -&gt; <span className="text-cyan-400">list[int]</span>:
                    </div>
                  </div>
                  <div className="flex gap-3 rounded bg-cyan-500/10 py-0.5 -mx-1 px-1 border-l-2 border-cyan-400">
                    <span className="w-4 select-none text-cyan-400 font-bold">3</span>
                    <div className="pl-4">
                      dq = collections.<span className="text-blue-400">deque</span>()  <span className="text-slate-500"># monotonic queue</span><span className="typing-caret" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-4 select-none text-slate-600">4</span>
                    <div className="pl-4">
                      res = []
                    </div>
                  </div>
                </div>

                {/* Real-time Compiler & Execution Badge */}
                <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-2 text-[11px] text-emerald-300">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Runtime: 14ms (Beats 98.4%) · Memory: 28.2MB
                  </span>
                  <span className="font-mono font-bold text-emerald-400">12/12 Tests Passed</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          AI INTERVIEWER PANEL CAROUSEL (SAKSHAAT-STYLE lp-pn-strip)
          Continuous marquee scrolling of AI interviewers
          ===================================================================== */}
      <section className="relative border-b border-line bg-surface-deep py-16 overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">
              <Sparkles className="h-3.5 w-3.5" /> Autonomous Interview Engine
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-black text-ink">
              Your AI-Powered Panel is Ready. Are You?
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-muted max-w-md">
            Each interviewer specializes in different competencies — from distributed consensus to architectural trade-offs.
          </p>
        </div>

        {/* Horizontal Infinite Marquee Carousel */}
        <div className="relative w-full overflow-hidden mask-linear-gradient">
          <div className="marquee-track-h flex gap-5 py-2">
            {[...panelInterviewers, ...panelInterviewers].map((panel, idx) => (
              <div
                key={idx}
                className="card-lift-hover group flex w-[360px] shrink-0 items-center gap-4 rounded-2xl border border-line bg-inset p-4.5 shadow-sm transition-all duration-300"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-cyan-400/50 shadow-md shadow-cyan-500/10 transition-transform duration-300 group-hover:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={panel.avatar} alt={panel.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink truncate">{panel.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${panel.levelColor}`}>
                      {panel.level}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-accent-cyan truncate">{panel.role}</p>
                  <p className="mt-1 text-xs text-ink-muted line-clamp-2 leading-relaxed">{panel.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          CAPABILITIES GRID
          ===================================================================== */}
      <section id="features" className="border-b border-line bg-canvas py-16 px-5 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">Platform Capabilities</span>
            <h2 className="mt-2 text-3xl font-black text-ink">Built for Enterprise Rigor</h2>
            <p className="mt-2 text-sm text-ink-muted">Everything needed to screen candidates with authentic technical depth.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {featureCards.map(({ icon: Icon, title, text }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="card-lift-hover rounded-2xl border border-line bg-surface p-5 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-accent-cyan shadow-sm shadow-cyan-500/10">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-ink">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-muted">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          HOW IT WORKS (STEP BY STEP)
          ===================================================================== */}
      <section id="how-it-works" className="relative border-b border-line px-5 py-20 sm:px-8 lg:px-10 bg-surface-deep">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">How It Works</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">From context to adaptive AI interview</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">The interview is personalized before it starts and adapts while the candidate is speaking.</p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-5">
            {[
              ['01', 'Resume', 'Candidate experience, skills and background parsed atomically.'],
              ['02', 'JD + Role', 'Hiring requirements and competency expectations.'],
              ['03', 'LLM Engine', 'Builds and adapts the real-time dialogue rubric.'],
              ['04', 'Candidate ↔ AI', 'Spoken voice, live code and multi-modal proctoring.'],
              ['05', 'Scorecard', 'Evidence-based audit dossier and technical grading.'],
            ].map(([number, title, text], idx) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="card-lift-hover relative rounded-2xl border border-line bg-surface p-5 shadow-sm"
              >
                <span className="text-xs font-mono font-bold text-accent-cyan">{number}</span>
                <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-muted">{text}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/5 p-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent-cyan">Adaptive Dialogue Example</p>
              <p className="mt-2 text-sm text-ink leading-relaxed">
                Candidate explains API scaling → AI evaluates foundational clarity → AI organically probes distributed cache eviction and failure scenarios.
              </p>
            </div>
            <div className="rounded-xl border border-line-strong bg-surface p-4 font-mono text-xs text-ink shadow-inner">
              <span className="text-accent-cyan font-bold">AI:</span> &quot;How would you handle cache stampede if 10k workers query the same key?&quot;
              <br /><br />
              <span className="text-purple-500 font-bold">AI analysis:</span> Foundation verified → testing mutex locking &amp; probabilistic early expiration.
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          BENEFITS
          ===================================================================== */}
      <section id="benefits" className="border-b border-line px-5 py-20 sm:px-8 lg:px-10 bg-canvas">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-emerald">Why Progeni Atlas</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Designed for candidates, recruiters and enterprise teams</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">One unified platform providing authentic role-specific mock practice and production enterprise screening.</p>
          </div>
          
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(([title, text, Icon], idx) => {
              const BenefitIcon = Icon as React.ElementType;
              return (
                <motion.div
                  key={title as string}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                  className="card-lift-hover rounded-2xl border border-line bg-surface p-5 shadow-sm"
                >
                  <BenefitIcon className="h-5 w-5 text-accent-cyan" />
                  <h3 className="mt-4 text-sm font-bold text-ink">{title as string}</h3>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">{text as string}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Link
              href="/candidate/dashboard"
              className="card-lift-hover group rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 via-surface to-surface p-7 shadow-sm transition hover:border-cyan-400"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">For Candidates</span>
              <h3 className="mt-2 text-xl font-black text-ink">Practice. Prepare. Perform.</h3>
              <p className="mt-2 text-sm text-ink-muted">Practice interviews, full-length mock exams, live coding, and actionable turn-by-turn dossiers.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent-cyan">
                Candidate Portal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>

            <Link
              href="/recruiter/dashboard"
              className="card-lift-hover group rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 via-surface to-surface p-7 shadow-sm transition hover:border-indigo-400"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-indigo">For Recruiters &amp; Teams</span>
              <h3 className="mt-2 text-xl font-black text-ink">Interview at Scale.</h3>
              <p className="mt-2 text-sm text-ink-muted">Create job campaigns, bulk invite candidates, inspect proctoring trust scores and verified dossiers.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent-indigo">
                Recruiter Portal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SCORECARD PREVIEW
          ===================================================================== */}
      <section id="scorecard" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-violet">Audit-Ready Candidate Dossier</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Evidence behind every assessment</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">Review competency scores, verified transcripts and objective grading.</p>
          </div>

          <div className="mt-10 rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
              <div>
                <p className="font-mono text-xs text-accent-cyan font-bold">VERIFIED DOSSIER PREVIEW</p>
                <h3 className="mt-1 text-xl font-black text-ink">Evidence-Linked Competency Breakdown</h3>
                <p className="text-xs text-ink-muted">Evaluated across algorithmic correctness, systems architecture, and proctoring integrity.</p>
              </div>
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/5 px-4 py-2.5">
                <span className="text-sm font-black text-accent-cyan">Instant AI Generation</span>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-line bg-inset p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">Verified Response Evidence</p>
                <p className="mt-3 text-sm italic leading-6 text-ink">
                  &quot;Candidate articulated the difference between pessimistic and optimistic locking with distributed Redis leases; clearly accounted for clock skew via Redlock algorithm.&quot;
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-accent-emerald">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1">✓ Complete Audio Transcript</span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1">✓ Server-Verified Scoring</span>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  ['Technical Depth', '94%'],
                  ['System Design', '88%'],
                  ['Live Coding Execution', '92%'],
                  ['Communication & Articulation', '85%'],
                ].map(([name, score]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-ink">{name}</span>
                      <span className="font-bold text-accent-cyan">{score}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2 border border-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-1000"
                        style={{ width: score }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          PRICING
          ===================================================================== */}
      <section id="pricing" className="border-b border-line px-5 py-20 sm:px-8 lg:px-10 bg-canvas">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-emerald">Transparent Pricing</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Simple, predictable plans</h2>
            <p className="mt-4 text-sm text-ink-muted">Choose the plan tailored to your interview volume.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`card-lift-hover relative rounded-2xl border p-6 flex flex-col justify-between ${
                  plan.popular
                    ? 'border-cyan-400/70 bg-gradient-to-b from-cyan-500/5 to-surface shadow-xl shadow-cyan-500/10'
                    : 'border-line bg-surface'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                    Most Popular
                  </span>
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
                      {plan.credits}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{plan.note}</p>
                  <p className="mt-4 text-3xl font-black text-ink">
                    {plan.price}
                    {plan.price !== '₹0' && (
                      <span className="text-xs font-medium text-ink-muted"> one-time</span>
                    )}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {plan.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-ink-muted">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-emerald" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={plan.href}
                  className={`mt-8 block rounded-xl px-4 py-3 text-center text-xs font-bold transition-all duration-300 ${
                    plan.popular
                      ? 'sheen-sweeper bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/25 hover:brightness-110'
                      : 'border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-cyan-500/40 hover:text-accent-cyan'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          FAQ
          ===================================================================== */}
      <section id="faq" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">FAQ</span>
            <h2 className="mt-3 text-3xl font-black text-ink">Frequently Asked Questions</h2>
          </div>
          <div className="mt-10 space-y-3.5">
            {faqs.map(([question, answer]) => (
              <details
                key={question}
                className="group rounded-xl border border-line bg-surface transition-colors duration-200"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-sm font-semibold text-ink">
                  <span>{question}</span>
                  <ChevronDown className="h-4 w-4 text-accent-cyan transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted border-t border-line/50 pt-3">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          FINAL CTA
          ===================================================================== */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-r from-indigo-950 via-slate-950 to-indigo-950 px-5 py-20 text-center text-white">
        <div className="sakshaat-grid" />
        <div className="absolute inset-0 bg-radial from-cyan-500/15 via-transparent to-transparent pointer-events-none anim-drift-a" />
        <div className="relative mx-auto max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Progeni Atlas</span>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Ready to transform your technical interviews?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Conduct intelligent two-way AI interviews, evaluate technical problem solving and generate structured candidate dossiers.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row">
            <Link
              href="/register"
              className="sheen-sweeper rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
            >
              Get Started Free →
            </Link>
            <a
              href="#hero"
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-7 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Back to Top
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
