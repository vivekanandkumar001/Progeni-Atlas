'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  Code2,
  FileText,
  Video,
  Sparkles,
  Users,
  CheckCircle2,
  Mic2,
  PlayCircle,
  ChevronDown,
  Terminal,
  Cpu,
  Flame,
  Check,
  GraduationCap,
  Building2,
  Lightbulb,
  ShieldCheck,
  Clock,
  HeartHandshake,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const practiceRounds = [
  {
    icon: Code2,
    badge: 'Coding Round',
    badgeColor: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    title: 'Live DSA & Coding Round',
    desc: 'Solve algorithmic challenges in Python, C++, Java, or JavaScript on a real compiler. The AI gives intelligent hints when you stall, never giving away the answer.',
  },
  {
    icon: FileText,
    badge: 'Resume Round',
    badgeColor: 'text-blue-600 bg-blue-50 border-blue-200',
    title: 'Resume & Project Defense',
    desc: 'Upload your PDF resume. The AI reads your actual projects, frameworks, and internships, questioning your implementation choices and technical claims.',
  },
  {
    icon: Cpu,
    badge: 'Architecture',
    badgeColor: 'text-purple-600 bg-purple-50 border-purple-200',
    title: 'System Design Round',
    desc: 'Explain database schema trade-offs, caching layers (Redis), and horizontal scalability out loud. Defend your design against sudden traffic spikes.',
  },
  {
    icon: Users,
    badge: 'HR / Culture',
    badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    title: 'Behavioral & HR Round',
    desc: 'Master the STAR framework (Situation, Task, Action, Result). Answer tough situational and leadership questions without stage fright or stumbling.',
  },
];

const panelInterviewers = [
  {
    name: 'Sarah Chen',
    role: 'Staff Systems Lead',
    company: 'Ex-Google',
    level: 'Hard',
    levelColor: 'text-rose-500 bg-rose-50 border-rose-200',
    desc: 'Probes deep distributed concurrency, sliding window algorithms & edge case handling.',
    avatar: '/avatars/interviewer_female.jpg',
  },
  {
    name: 'Alex Rivera',
    role: 'Principal Architect',
    company: 'Ex-Meta',
    level: 'Medium',
    levelColor: 'text-amber-600 bg-amber-50 border-amber-200',
    desc: 'Evaluates real DOM performance, scalable API design, and clean modular code architecture.',
    avatar: '/avatars/interviewer_female.jpg',
  },
  {
    name: 'Dr. Vikram Sethi',
    role: 'Algorithms & DP Specialist',
    company: 'Competitive Programmer',
    level: 'Hard',
    levelColor: 'text-rose-500 bg-rose-50 border-rose-200',
    desc: 'Focuses on dynamic programming, graph invariants, asymptotic time & space bounds.',
    avatar: '/avatars/interviewer_female.jpg',
  },
  {
    name: 'Maya Patel',
    role: 'Engineering Manager',
    company: 'Ex-Amazon',
    level: 'Warm-up',
    levelColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    desc: 'Friendly and supportive. Great for first-timers to practice behavioral and resume defense.',
    avatar: '/avatars/interviewer_female.jpg',
  },
];

const targetCompanies = [
  'Google',
  'Amazon',
  'Microsoft',
  'TCS Digital',
  'Infosys',
  'Wipro Turbo',
  'Flipkart',
  'Uber',
  'Oracle',
  'Accenture',
];

const candidatePricing = [
  {
    name: 'Starter Practice',
    price: '₹0',
    note: '100% Free · No Card Needed',
    badge: 'Free Trial',
    items: [
      '1 Full Mock Interview (20-30 mins)',
      'Spoken audio & video with Sarah Chen',
      'Live code compiler (Python, C++, Java, JS)',
      'Instant post-interview report card',
      'Actionable improvement tips',
    ],
    cta: 'Start Free Mock',
    popular: false,
  },
  {
    name: 'Warm-Up Pack',
    price: '₹49',
    note: '30 Credits included',
    badge: 'Quick Practice',
    items: [
      '30 Practice Credits',
      'Targeted DSA or Resume Round',
      'Adaptive AI hints when stuck',
      'Detailed code efficiency grading',
      'No expiration date on credits',
    ],
    cta: 'Get 30 Credits',
    popular: false,
  },
  {
    name: 'Placement Ready',
    price: '₹99',
    note: '70 Credits included',
    badge: 'Most Popular',
    items: [
      '70 Practice Credits (Best value)',
      'Multiple full-length mock rounds',
      'Company-specific interview tracks',
      'Complete turn-by-turn audio transcript',
      'Benchmark score vs other applicants',
    ],
    cta: 'Get 70 Credits',
    popular: true,
  },
  {
    name: 'Pro Mastery',
    price: '₹199',
    note: '150 Credits included',
    badge: 'Total Prep',
    items: [
      '150 Practice Credits',
      'Unlimited system design & coding drills',
      'Custom role & resume fine-tuning',
      'Comprehensive performance analytics',
      'Priority access to new AI personas',
    ],
    cta: 'Get 150 Credits',
    popular: false,
  },
];

const candidateFaqs = [
  [
    'Is the first mock interview really free?',
    'Yes! Your first full mock interview is completely free. You do not need to enter any credit card or payment details. Just sign up and start talking to the AI interviewer right away.',
  ],
  [
    'Which programming languages can I code in?',
    'The live compiler supports Python 3, C++, Java, and TypeScript/JavaScript. Your code is executed in real time against hidden test cases just like in a real technical screening.',
  ],
  [
    'Does the AI actually analyze my resume?',
    'Yes. When you upload your resume PDF, our AI reads your listed projects, internships, and tech stack. It will ask you specific questions about your architectural decisions, libraries used, and how you solved real engineering problems.',
  ],
  [
    'What happens if I get stuck while coding?',
    'Just like a great human interviewer, the AI listens to your explanation. If you stall or get stuck on an edge case, it gives gentle conversational hints to nudge you forward without spoiling the solution.',
  ],
  [
    'Can I practice for campus placements (TCS, Infosys, Wipro)?',
    'Absolutely. Progeni Atlas includes targeted interview tracks for mass recruiters as well as top product companies like Google, Amazon, and Microsoft.',
  ],
  [
    'What do I get in my report card after the interview?',
    'Within seconds of finishing, you receive a detailed score breakdown covering Algorithmic Accuracy, Coding Speed, Communication Clarity, and Resume Defense, along with concrete tips on what to fix first.',
  ],
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
    <main className="min-h-screen bg-canvas text-ink overflow-x-clip selection:bg-cyan-500/20 selection:text-cyan-700">
      <Navbar />

      {/* =====================================================================
          HERO SECTION: CANDIDATE-FIRST HEADLINE & INTERACTIVE SIMULATOR
          ===================================================================== */}
      <section id="hero" className="relative border-b border-line overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-24">
        {/* Masked Geometric Grid */}
        <div className="sakshaat-grid" />

        {/* Ambient Drifting Glow Orbs */}
        <div className="absolute -left-20 -top-32 h-[680px] w-[680px] rounded-full bg-radial from-cyan-500/20 via-cyan-500/5 to-transparent blur-3xl pointer-events-none anim-drift-a" />
        <div className="absolute right-[-140px] top-10 h-[620px] w-[620px] rounded-full bg-radial from-indigo-500/20 via-purple-500/5 to-transparent blur-3xl pointer-events-none anim-drift-b" />
        <div className="absolute left-1/3 bottom-0 h-[480px] w-[480px] rounded-full bg-radial from-amber-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none anim-drift-a" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.96fr_1.04fr] lg:px-10">
          
          {/* Left Column: Candidate Value Proposition */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          >
            {/* Live Kicker Pill: First Mock Free */}
            <div className="relative inline-flex mb-6">
              <span className="absolute -inset-1 rounded-full bg-cyan-400/25 blur-md anim-aura pointer-events-none" />
              <div className="relative inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-surface/90 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-cyan shadow-sm backdrop-blur-md">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </span>
                1st Mock Interview Free · No Card Needed
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-ink sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Crack your next
              <br />
              <span className="bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 bg-clip-text text-transparent">
                tech interview.
              </span>
              <br />
              Practice out loud.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
              Face a Senior AI Lead before your real placement or company interview. Solve live DSA problems on a shared compiler, defend your resume line-by-line, and get an honest report on what to fix.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row items-stretch sm:items-center">
              <Link
                href="/candidate/practice"
                className="sheen-sweeper group relative inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600 px-7 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-600/25 transition-all duration-300 hover:brightness-110 hover:shadow-cyan-600/35 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Start Free Mock Round</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-line-strong bg-surface/80 px-6 py-4 text-sm font-semibold text-ink backdrop-blur-md transition-all duration-300 hover:border-cyan-400/50 hover:bg-surface-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <PlayCircle className="h-4 w-4 text-accent-cyan" />
                <span>See How It Works</span>
              </a>
            </div>

            {/* Key Candidate Guarantees */}
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
              {[
                '100% Private & Zero Judgment',
                'Live Hints When Stuck',
                'Instant Post-Call Report Card',
                'Credits Start at Just ₹49',
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-cyan" />
                  {item}
                </span>
              ))}
            </div>

            {/* Trust badge with Twinkling Star Sparks */}
            <div className="relative mt-8 max-w-sm">
              <svg className="trust-sparkle -top-3 -right-2 w-5 h-5 text-cyan-500 fill-cyan-500" viewBox="0 0 24 24">
                <path d="M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z" />
              </svg>
              <svg className="trust-sparkle top-7 -left-3 w-3.5 h-3.5 text-indigo-500 fill-indigo-500" style={{ animationDelay: '1.2s' }} viewBox="0 0 24 24">
                <path d="M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z" />
              </svg>

              <div className="conic-border-box">
                <div className="sheen-sweeper relative z-10 flex items-center gap-3.5 rounded-[1.15rem] bg-surface/95 px-4 py-3 backdrop-blur-md">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
                    <span className="ping-ripple" />
                    <Check className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">Placement &amp; Job Prep</p>
                    <p className="text-xs font-semibold text-ink">
                      <strong className="font-extrabold text-sm text-cyan-600">10,000+</strong> candidates prepped for tech interviews
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Live Mock Interview Call Simulator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/15 to-purple-500/20 blur-2xl pointer-events-none anim-aura" />

            {/* The Live Video Interview Room Window */}
            <div className="relative overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-950 text-white shadow-2xl shadow-cyan-500/15">
              
              {/* Window Status Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 text-xs backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="font-mono text-slate-500">|</span>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="font-semibold text-emerald-300">Live Mock Call</span>
                    <span className="font-mono text-[11px] text-slate-400">· {formatTimer(timerSeconds)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                    Live DSA &amp; Resume Round
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">Python 3.12</span>
                </div>
              </div>

              {/* Video Tiles: Sarah Chen & Candidate */}
              <div className="grid gap-3 p-3.5 sm:grid-cols-2 bg-slate-950/70">
                
                {/* AI Interviewer Video Tile */}
                <div className="relative overflow-hidden rounded-xl border border-cyan-400/60 bg-slate-900 shadow-lg ring-2 ring-cyan-400/30">
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/avatars/interviewer_female.jpg"
                      alt="Sarah Chen"
                      className="h-full w-full object-cover object-center interviewer-sway brightness-105 contrast-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                    
                    {/* Interviewer Name Tag + Equalizer Waveform */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-lg bg-slate-950/85 px-2.5 py-1 backdrop-blur-md border border-slate-700/60">
                        <span className="text-[11px] font-bold text-white">Sarah Chen</span>
                        <span className="text-[9px] font-mono text-cyan-400 font-semibold uppercase">AI Lead</span>
                      </div>

                      {/* Animated Voice Bars */}
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

                {/* Candidate Video Tile */}
                <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-md">
                  <div className="relative flex h-44 w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950/60">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shadow-inner">
                      <Users className="h-8 w-8" />
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 rounded-lg bg-slate-950/85 px-2.5 py-1 backdrop-blur-md border border-slate-800">
                        <span className="text-[11px] font-bold text-white">You</span>
                        <span className="text-[9px] font-mono text-slate-400">(Candidate)</span>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                        <Mic2 className="h-3 w-3" /> Speaking out loud
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shared Live Code Editor */}
              <div className="border-t border-slate-800 bg-slate-950 p-3.5 font-mono text-xs">
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

                {/* Real-time Compiler Output */}
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
          TARGET COMPANIES PREP CHIPS
          ===================================================================== */}
      <section className="border-b border-line bg-surface py-6 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
            Practice Company-Specific Patterns:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {targetCompanies.map((company) => (
              <Link
                key={company}
                href="/candidate/practice"
                className="px-3.5 py-1.5 rounded-full border border-line bg-surface-2 hover:bg-cyan-50 hover:border-cyan-400/40 text-xs font-bold text-slate-800 transition-all duration-200"
              >
                {company}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          4 CORE PRACTICE ROUNDS
          ===================================================================== */}
      <section id="rounds" className="border-b border-line bg-canvas py-16 px-5 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">What You Can Practice</span>
            <h2 className="mt-2 text-3xl font-black text-ink">Master All 4 Rounds of Tech Interviews</h2>
            <p className="mt-2 text-sm text-ink-muted">From coding to system architecture and behavioral questions — practice in one place.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {practiceRounds.map(({ icon: Icon, badge, badgeColor, title, desc }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="card-lift-hover flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-accent-cyan shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${badgeColor}`}>
                      {badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">{desc}</p>
                </div>

                <Link
                  href="/candidate/practice"
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-accent-cyan hover:underline"
                >
                  <span>Practice this round</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          WHY PRACTICE OUT LOUD (OVERCOMING INTERVIEW ANXIETY)
          ===================================================================== */}
      <section className="border-b border-line bg-surface-deep py-16 px-5 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">Conquer Interview Fear</span>
              <h2 className="mt-2 text-3xl font-black text-ink sm:text-4xl">
                Solving LeetCode on paper won&apos;t prepare you for speaking under pressure.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Most students know the code, but freeze when a Senior Engineer stares at them and asks, <em>&quot;Can you explain your thought process out loud?&quot;</em>
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Zero-Judgment Safe Space</h4>
                    <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                      Fumble, pause, restart, and make mistakes here in private. Don&apos;t let your first interview mistake happen in front of the actual recruiter.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 shrink-0">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Learn to Think Aloud</h4>
                    <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                      Senior interviewers care more about <em>how</em> you break down edge cases than memorized syntaxes. Build muscle memory for talking while coding.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Pacing &amp; Time Management</h4>
                    <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                      Practice finishing problem analysis, coding, and testing within realistic 25-minute interview rounds.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Interviewer Panel Carousel */}
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-cyan font-mono">
                  Pick Your AI Interviewer
                </span>
                <span className="text-[11px] text-slate-500">4 Specializations</span>
              </div>

              <div className="space-y-3">
                {panelInterviewers.map((panel) => (
                  <div
                    key={panel.name}
                    className="flex items-center gap-4 rounded-xl border border-line bg-inset p-3.5 transition hover:border-cyan-400/40"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-cyan-400/40 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={panel.avatar} alt={panel.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-ink">{panel.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${panel.levelColor}`}>
                          {panel.level}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-accent-cyan">{panel.role} · {panel.company}</p>
                      <p className="mt-1 text-xs text-ink-muted line-clamp-1">{panel.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/candidate/practice"
                className="mt-5 w-full block text-center rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-sm hover:brightness-110 transition"
              >
                Choose Interviewer &amp; Start →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          HOW IT WORKS (CANDIDATE 3 STEPS)
          ===================================================================== */}
      <section id="how-it-works" className="relative border-b border-line px-5 py-20 sm:px-8 lg:px-10 bg-canvas">
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">Simple 3-Step Process</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">One round, three parts, all out loud.</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">From uploading your resume to receiving your detailed scorecard in under 30 minutes.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              [
                '01',
                'Upload Resume & Pick Role',
                'Upload your PDF resume or paste a target Job Description. The AI tailors the questions specifically to your listed projects, skills, and target seniority.',
              ],
              [
                '02',
                'Live Spoken Call & Coding',
                'Connect via mic and video. Talk through your architecture, write code on the shared compiler, and receive organic hints whenever you get stuck.',
              ],
              [
                '03',
                'Instant Report Card',
                'Spoken the moment you finish: get an objective breakdown of your algorithmic accuracy, communication clarity, and the exact things to improve first.',
              ],
            ].map(([number, title, text], idx) => (
              <motion.div
                key={number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="card-lift-hover relative rounded-2xl border border-line bg-surface p-6 shadow-sm"
              >
                <span className="text-2xl font-black font-mono text-accent-cyan">{number}</span>
                <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-muted">{text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          CANDIDATE REPORT CARD PREVIEW (REPLACING "AUDIT DOSSIER")
          ===================================================================== */}
      <section id="scorecard" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">Post-Interview Feedback</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Your Post-Interview Report Card</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">Honest, actionable feedback generated the second your call finishes.</p>
          </div>

          <div className="mt-10 rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
              <div>
                <p className="font-mono text-xs text-accent-cyan font-bold">MOCK INTERVIEW RESULT</p>
                <h3 className="mt-1 text-xl font-black text-ink">Senior SDE Mock Assessment</h3>
                <p className="text-xs text-ink-muted">Evaluated across Problem Solving, DSA Code Quality, and Communication.</p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-700 font-bold text-sm">
                Overall: 89% · Benchmark: Top 10%
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-line bg-inset p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">Key Evaluator Feedback</p>
                <p className="mt-3 text-sm italic leading-6 text-ink">
                  &quot;Candidate articulated the sliding window optimization cleanly with O(N) time complexity. Strong grasp of deque edge cases. Area to improve: practice stating your space complexity trade-offs before typing code.&quot;
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-accent-emerald">
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1">✓ Complete Audio Transcript</span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1">✓ Test Cases Verified</span>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  ['Problem Solving & DSA', '94%'],
                  ['Code Efficiency & Edge Cases', '88%'],
                  ['Resume & Project Knowledge', '92%'],
                  ['Communication & Thinking Aloud', '85%'],
                ].map(([name, score]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-ink">{name}</span>
                      <span className="font-bold text-accent-cyan">{score}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2 border border-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 transition-all duration-1000"
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
          STUDENT-FRIENDLY PRICING (FROM ₹49)
          ===================================================================== */}
      <section id="pricing" className="border-b border-line px-5 py-20 sm:px-8 lg:px-10 bg-canvas">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-emerald">Pocket-Friendly Pricing</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Practice packs starting from ₹49</h2>
            <p className="mt-4 text-sm text-ink-muted">No expensive subscriptions. Pay only for what you practice.</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {candidatePricing.map((plan) => (
              <div
                key={plan.name}
                className={`card-lift-hover relative rounded-2xl border p-6 flex flex-col justify-between ${
                  plan.popular
                    ? 'border-cyan-500/70 bg-gradient-to-b from-cyan-500/5 to-surface shadow-xl shadow-cyan-500/10'
                    : 'border-line bg-surface'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                    Most Popular
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                  <p className="mt-1 text-xs text-ink-muted">{plan.note}</p>
                  <p className="mt-5 text-3xl font-black text-ink">
                    {plan.price}
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
                  href="/candidate/practice"
                  className={`mt-8 block rounded-xl px-4 py-3 text-center text-xs font-bold transition-all duration-300 ${
                    plan.popular
                      ? 'sheen-sweeper bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/25 hover:brightness-110'
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
          CANDIDATE FAQS
          ===================================================================== */}
      <section id="faq" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">FAQ</span>
            <h2 className="mt-3 text-3xl font-black text-ink">Frequently Asked Questions</h2>
          </div>
          <div className="mt-10 space-y-3.5">
            {candidateFaqs.map(([question, answer]) => (
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
          FINAL CANDIDATE CTA
          ===================================================================== */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-r from-indigo-950 via-slate-950 to-indigo-950 px-5 py-20 text-center text-white">
        <div className="sakshaat-grid" />
        <div className="absolute inset-0 bg-radial from-cyan-500/15 via-transparent to-transparent pointer-events-none anim-drift-a" />
        <div className="relative mx-auto max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Your First Mock is On Us</span>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Face your interview before it&apos;s real.</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-300">
            Sign up in 30 seconds, connect your microphone, and practice your first live coding and resume round for free.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row">
            <Link
              href="/candidate/practice"
              className="sheen-sweeper rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-600/25 transition hover:brightness-110"
            >
              Start Free Mock Interview →
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
