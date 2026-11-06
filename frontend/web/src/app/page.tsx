'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
  Database,
  LockKeyhole,
  BarChart3,
  PlayCircle,
  ChevronDown,
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

const benefits = [
  ['AI-Driven Technical Assessment', 'Evaluate demonstrated skills, not just resume keywords.', BrainCircuit],
  ['Consistent Candidate Evaluation', 'Use structured criteria across interviews and roles.', CheckCircle2],
  ['Real-Time Interviewing', 'Let the AI interviewer listen, ask and adapt naturally.', Mic2],
  ['Secure AI Proctoring', 'Protect interview integrity throughout the session.', ShieldCheck],
  ['Automated Scorecards', 'Generate competency breakdowns and evidence for review.', FileText],
  ['Enterprise Governance', 'Centralize organizations, users, interviews and audit visibility.', Building2],
];

const pricing = [
  { name: 'Starter Practice', price: '₹0', note: '2 Free Practice Sessions', items: ['2 Practice interviews', 'Basic feedback scorecard', 'Candidate profile'] },
  { name: 'Candidate Pro', price: '₹999', note: 'For career advancement', items: ['20 Advanced practice sessions', 'Detailed AI analysis', 'Interview history'], popular: true },
  { name: 'Hiring Team Growth', price: '₹8,999', note: 'For hiring teams & agencies', items: ['50 Candidate interviews', 'Recruiter dashboards', 'Candidate dossiers'] },
  { name: 'Enterprise Scale', price: 'Custom', note: 'For large organizations', items: ['SSO & governance', 'Custom integrations', 'Security & audit controls'] },
];

const faqs = [
  ['How does the AI interviewer create questions?', 'It uses the interview context — resume, job description, role, skills and previous answers — to determine the next question.'],
  ['Is the interview two-way?', 'Yes. The candidate communicates with the AI interviewer through the supported voice/video experience. The AI can ask follow-up questions based on the response.'],
  ['Can HR schedule real interviews?', 'Yes. Recruiters can create positions, invite candidates and use the scheduled interview workflow. Practice interviews remain separate.'],
  ['Does TalentPulse support coding interviews?', 'Yes. The candidate experience includes a live coding workspace and system-design interview stages.'],
  ['What does the final scorecard contain?', 'It can include technical depth, coding, system design, problem solving, communication and role-specific evidence.'],
];

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-canvas text-ink overflow-x-clip">
      <Navbar />

      {/* HERO */}
      <section id="hero" className="relative border-b border-line overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-80" />
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-[520px] w-[520px] rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:pb-20 lg:pt-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-cyan">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
              AI-Powered Technical Video Interviews
            </div>

            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-ink sm:text-5xl lg:text-6xl lg:leading-[1.04]">
              Interview Smarter.
              <br />
              Evaluate Deeper.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">Hire with AI.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">
              Progeni Atlas conducts intelligent two-way technical video interviews where an AI interviewer adapts questions to the candidate&apos;s resume, job description, role and previous responses.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/15 transition hover:brightness-110">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#live-demo" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold text-ink transition hover:border-cyan-400/50 hover:bg-surface-2">
                <PlayCircle className="h-4 w-4 text-accent-cyan" /> Experience AI Interview
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
              {['Resume + JD Based Questions', 'Real-Time AI Interviewer', 'Live Coding', 'AI Proctoring', 'Automated Scorecards'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent-cyan" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-[28px] bg-gradient-to-r from-cyan-500/10 to-violet-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-inset shadow-2xl shadow-cyan-500/10">
              <Image
                src="/landing-page-image.png"
                alt="Progeni Atlas two-way AI video interview dashboard showing AI interviewer, candidate, live coding and AI analysis"
                width={1536}
                height={1024}
                priority
                className="h-auto w-full"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
              <span>Live AI Interview Workspace</span>
              <span className="inline-flex items-center gap-1.5 text-accent-emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Interview in progress</span>
            </div>
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section id="features" className="border-b border-line bg-surface-deep">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-5 lg:px-10">
          {featureCards.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-inset p-5 shadow-lg">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-accent-cyan">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-ink">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative border-b border-line px-5 py-20 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">How It Works</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">From context to adaptive AI interview</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">The interview is personalized before it starts and adapts while the candidate is speaking.</p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-5">
            {[
              ['01', 'Resume', 'Candidate experience, skills and background'],
              ['02', 'JD + Role', 'Hiring requirements and competency context'],
              ['03', 'LLM Interview Engine', 'Builds and adapts the interview plan'],
              ['04', 'Candidate ↔ AI', 'Two-way video/voice conversation + coding'],
              ['05', 'Scorecard', 'Evidence-based technical assessment'],
            ].map(([number, title, text]) => (
              <div key={number} className="relative rounded-2xl border border-line bg-surface-deep p-5">
                <span className="text-xs font-mono text-accent-cyan">{number}</span>
                <h3 className="mt-3 text-base font-bold text-ink">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-ink-muted">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent-cyan">Adaptive example</p>
              <p className="mt-2 text-sm text-ink">Candidate explains API scaling → AI detects strong fundamentals → AI asks a deeper distributed-systems follow-up.</p>
            </div>
            <div className="rounded-xl border border-line-strong bg-inset p-4 font-mono text-xs text-ink">
              <span className="text-accent-cyan">AI:</span> How would you scale this API to 10M requests/day?
              <br /><br />
              <span className="text-violet-400">AI analysis:</span> API fundamentals strong → probe caching, queues and failure handling.
            </div>
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="live-demo" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">Interview Demo</span>
              <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Experience the AI interviewer</h2>
              <p className="mt-5 text-sm leading-6 text-ink-muted">
                Candidate and AI interviewer communicate in real time. Questions are generated from resume + JD + role and can change based on the answer.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  ['AI asks', 'How would you design a scalable URL shortening service?'],
                  ['Candidate answers', 'The candidate explains the architecture, trade-offs and implementation.'],
                  ['AI adapts', 'The next question probes collision handling, caching or data consistency.'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-inset p-4">
                    <p className="text-xs font-bold text-accent-cyan">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">{value}</p>
                  </div>
                ))}
              </div>
              <Link href="/candidate/practice" prefetch={false} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white">
                Try Interview Demo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-indigo-400/25 bg-inset shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs">
                <span className="font-semibold text-ink">AI Interviewer ↔ Candidate</span>
                <span className="inline-flex items-center gap-1.5 text-accent-emerald"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live</span>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <div className="rounded-xl border border-cyan-400/20 bg-surface-deep p-3">
                  <div className="flex items-center justify-between text-xs"><span className="font-bold text-ink">AI Interviewer</span><span className="text-accent-emerald">Speaking</span></div>
                  <div className="mt-3 flex h-44 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-950 to-cyan-950">
                    <div className="h-24 w-24 rounded-full border-2 border-cyan-300/60 bg-gradient-to-br from-cyan-400/30 to-violet-500/30 shadow-[0_0_35px_rgba(34,211,238,.25)]" />
                  </div>
                  <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs leading-5 text-ink">Questions are generated from the candidate resume, job description, role and approved rubric.</p>
                </div>
                <div className="rounded-xl border border-violet-400/20 bg-surface-deep p-3">
                  <div className="flex items-center justify-between text-xs"><span className="font-bold text-ink">Candidate</span><span className="text-accent-emerald">Listening</span></div>
                  <div className="mt-3 flex h-44 items-center justify-center rounded-lg bg-gradient-to-br from-surface to-indigo-950">
                    <Users className="h-20 w-20 text-accent-indigo/50" />
                  </div>
                  <p className="mt-3 rounded-lg border border-line-strong bg-inset p-3 text-xs leading-5 text-ink-muted">Candidate response is transcribed and analyzed in real time.</p>
                </div>
              </div>
              <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-3">
                <div className="rounded-lg border border-line bg-surface p-3"><p className="text-[10px] uppercase text-ink-muted">Current competency</p><p className="mt-1 text-sm font-bold text-ink">Rubric-defined competency</p></div>
                <div className="rounded-lg border border-line bg-surface p-3"><p className="text-[10px] uppercase text-ink-muted">Live analysis</p><p className="mt-1 text-sm font-bold text-accent-cyan">Evidence-linked</p></div>
                <div className="rounded-lg border border-line bg-surface p-3"><p className="text-[10px] uppercase text-ink-muted">Next</p><p className="mt-1 text-sm font-bold text-accent-violet">Adaptive follow-up</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY TALENTPULSE */}
      <section id="benefits" className="border-b border-line px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-emerald">Why TalentPulse</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Designed for candidates, recruiters and enterprise teams</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-ink-muted">One platform with role-specific experiences across the candidate journey, recruiter workflow and platform governance.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(([title, text, Icon]) => {
              const BenefitIcon = Icon as React.ElementType;
              return (
                <div key={title as string} className="rounded-2xl border border-line bg-inset p-5">
                  <BenefitIcon className="h-5 w-5 text-accent-cyan" />
                  <h3 className="mt-4 text-sm font-bold text-ink">{title as string}</h3>
                  <p className="mt-2 text-xs leading-5 text-ink-muted">{text as string}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Link href="/candidate/dashboard" className="group rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-surface-deep p-6 transition hover:border-cyan-400/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">For Candidates</span>
              <h3 className="mt-2 text-xl font-black text-ink">Practice. Prepare. Perform.</h3>
              <p className="mt-2 text-sm text-ink-muted">Profile, resume, practice interviews, scheduled interviews, history and scorecards.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent-cyan">Candidate Portal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
            <Link href="/recruiter/dashboard" className="group rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-surface-deep p-6 transition hover:border-indigo-400/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-indigo">For Recruiters</span>
              <h3 className="mt-2 text-xl font-black text-ink">Interview at Scale.</h3>
              <p className="mt-2 text-sm text-ink-muted">Jobs, candidate dossiers, invitations, interviews, rubrics and structured assessments.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent-indigo">Recruiter Portal <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          </div>
        </div>
      </section>

      {/* SCORECARD */}
      <section id="scorecard" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-violet">Audit-Ready Candidate Dossier</span>
            <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Evidence behind every assessment</h2>
            <p className="mt-4 text-sm leading-6 text-ink-muted">Review competency scores, interview evidence and the context behind the final assessment.</p>
          </div>

          <div className="mt-10 rounded-2xl border border-line bg-inset p-5 sm:p-7 shadow-2xl">
            <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-center">
              <div><p className="font-mono text-xs text-accent-cyan">VERIFIED DOSSIER PREVIEW</p><h3 className="mt-1 text-xl font-black text-ink">Evidence-linked assessment</h3><p className="text-xs text-ink-muted">Candidate and role data are loaded from the authenticated interview record.</p></div>
              <div className="rounded-xl border border-line bg-inset px-5 py-3"><span className="text-sm font-black text-accent-cyan">Generated after interview</span></div>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-line bg-surface-deep p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent-cyan">Verified response evidence</p>
                <p className="mt-3 text-sm italic leading-6 text-ink">Actual candidate answers, evaluator notes and competency evidence appear here after a completed interview.</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-accent-emerald"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1">✓ Real transcript</span><span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1">✓ Server-authoritative scoring</span></div>
              </div>
              <div className="space-y-4">
                {['Technical depth', 'System design', 'Coding', 'Communication'].map((name) => (
                  <div key={name}><div className="flex justify-between text-xs"><span className="text-ink-muted">{name}</span><span className="font-bold text-accent-cyan">Generated after interview</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400/50 to-indigo-500/50" /></div></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-b border-line px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="text-center"><span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-emerald">Plans</span><h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Simple, predictable pricing</h2><p className="mt-4 text-sm text-ink-muted">Choose the workflow that matches your interview needs.</p></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {pricing.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border p-5 ${plan.popular ? 'border-cyan-400/60 bg-cyan-400/5 shadow-lg shadow-cyan-500/10' : 'border-line bg-inset'}`}>
                {plan.popular && <span className="absolute -top-3 left-5 rounded-full bg-cyan-400 px-2.5 py-1 text-[10px] font-black uppercase text-slate-950">Popular</span>}
                <h3 className="text-base font-bold text-ink">{plan.name}</h3><p className="mt-1 text-xs text-ink-muted">{plan.note}</p><p className="mt-5 text-3xl font-black text-ink">{plan.price}{plan.price.startsWith('₹') && plan.price !== '₹0' && <span className="text-xs font-medium text-ink-muted"> /mo</span>}</p>
                <ul className="mt-5 space-y-3">{plan.items.map((item) => <li key={item} className="flex gap-2 text-xs text-ink-muted"><CheckCircle2 className="h-4 w-4 shrink-0 text-accent-emerald" />{item}</li>)}</ul>
                <Link
                  href={plan.name === 'Enterprise Scale' ? '/contact' : '/register'}
                  className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-xs font-bold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20 hover:opacity-95'
                      : 'border border-line bg-surface-2 text-ink hover:bg-surface-3 hover:border-cyan-500/40 hover:text-accent-cyan'
                  }`}
                >
                  {plan.name === 'Starter Practice'
                    ? 'Start Practicing Free'
                    : plan.name === 'Candidate Pro'
                    ? 'Upgrade to Pro'
                    : plan.name === 'Enterprise Scale'
                    ? 'Contact Enterprise Sales'
                    : 'Start Team Trial'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-line bg-surface-deep px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center"><span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">FAQ</span><h2 className="mt-3 text-3xl font-black text-ink">Got questions? We have answers.</h2></div>
          <div className="mt-10 space-y-3">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group rounded-xl border border-line bg-inset">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-ink"><span>{question}</span><ChevronDown className="h-4 w-4 text-accent-cyan transition group-open:rotate-180" /></summary>
                <p className="px-5 pb-5 text-sm leading-6 text-ink-muted">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA + FOOTER */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-r from-indigo-950/80 via-cyan-950/40 to-indigo-950/80 px-5 py-16 text-center">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="relative mx-auto max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent-cyan">Progeni Atlas</span>
          <h2 className="mt-3 text-3xl font-black text-ink sm:text-4xl">Ready to transform technical interviews?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-ink-muted">Conduct intelligent two-way AI interviews, evaluate deeper technical skills and generate structured candidate assessments.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-3 text-sm font-bold text-white">Get Started Free →</Link>
            <a href="#live-demo" className="rounded-xl border border-line-strong bg-inset px-6 py-3 text-sm font-semibold text-ink">Experience AI Interview</a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
