'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  ShieldCheck,
  Award,
  Users,
  BrainCircuit,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Globe2,
  Target,
  Clock,
  Compass,
} from 'lucide-react';

export default function AboutPage() {
  const teamMembers = [
    {
      name: 'Dr. Evelyn Vance',
      role: 'Chief AI Scientist & Co-Founder',
      bio: 'Ex-DeepMind NLP researcher specializing in speech intelligence and multi-modal conversational agents.',
      avatar: 'EV',
      gradient: 'from-blue-600 to-cyan-500',
    },
    {
      name: 'Marcus Chen',
      role: 'VP of Distributed Systems',
      bio: 'Former Staff Engineer at Stripe & AWS. Architect of our ultra-low latency proctoring and code evaluation sandbox.',
      avatar: 'MC',
      gradient: 'from-indigo-600 to-violet-500',
    },
    {
      name: 'Sarah Al-Mansoor',
      role: 'Head of People Science & Rubrics',
      bio: 'Organizational Psychologist specializing in equitable psychometric grading and bias elimination algorithms.',
      avatar: 'SA',
      gradient: 'from-cyan-600 to-teal-500',
    },
    {
      name: 'David Thorne',
      role: 'Head of Enterprise Security',
      bio: '15+ years securing cloud infra, SOC-2 Type II audit compliance, and multi-tenant biometric governance.',
      avatar: 'DT',
      gradient: 'from-slate-700 to-slate-900',
    },
  ];

  const milestones = [
    { number: '150,000+', label: 'Technical Interviews Conducted' },
    { number: '85%', label: 'Reduction in Screening Turnaround' },
    { number: '99.4%', label: 'AI Proctoring Accuracy' },
    { number: '40+', label: 'Supported Tech Stacks & Sandboxes' },
  ];

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-cyan-500/20">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface via-surface to-surface-deep py-20 lg:py-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute -top-40 right-0 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-20 -left-40 w-[450px] h-[450px] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-accent-cyan text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Empowering Merit-Based Hiring
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight leading-[1.1]">
            We&apos;re Building the Future of{' '}
            <span className="bg-gradient-to-r from-[#185adb] via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Autonomous Technical Evaluation
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed">
            Progeni Atlas was founded with a singular conviction: technical competence should be measured by demonstrated engineering ability, logical depth, and system reasoning—not by resume keyword gymnastics or interview scheduling fatigue.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all"
            >
              Explore AI Services <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold text-ink hover:bg-surface-2 hover:border-cyan-400/50 transition-all"
            >
              Contact Leadership
            </Link>
          </div>
        </div>
      </section>

      {/* Numbers / Traction */}
      <section className="border-b border-line bg-surface-deep py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {milestones.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <p className="text-3xl sm:text-4xl font-black text-[#185adb]  font-mono">
                  {item.number}
                </p>
                <p className="text-xs sm:text-sm text-ink-muted font-medium">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision Section (#mission) */}
      <section id="mission" className="py-20 border-b border-line bg-surface scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-bold text-accent-cyan uppercase tracking-wider block">
                MISSION &amp; PHILOSOPHY
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
                Eliminating Interviewer Fatigue, Restoring Engineering Depth
              </h2>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                Traditional hiring processes ask engineers to spend 20+ hours a week repeating basic technical screens, leading to burnout, subjective grading, and lost candidates.
              </p>
              <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                Progeni Atlas provides candidates with an intelligent, patient, two-way conversational partner that adapts questions in real-time. Whether probing distributed systems tradeoffs or debugging live Python code, our platform listens, evaluates, and compiles evidence-based dossiers that hiring managers can verify in minutes.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  '100% Equal Opportunity: Every candidate receives uniform baseline scrutiny.',
                  'Zero Scheduling Delays: Complete technical screens 24/7 at the candidate’s convenience.',
                  'Comprehensive Transcripts: Audit every turn of conversation with exact audio timestamps.',
                ].map((point, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent-emerald shrink-0 mt-0.5" />
                    <span className="text-sm text-ink-muted">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-line bg-surface-deep p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-line">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#185adb] to-cyan-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ink">Adaptive Evaluation Engine</h3>
                    <p className="text-xs text-ink-muted">Context-aware question synthesis</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-surface border border-line">
                    <p className="font-bold text-accent-cyan uppercase text-[10px] tracking-wider mb-1">
                      Context Ingestion
                    </p>
                    <p className="text-ink">Resume + Job Description + Role Competencies extracted into rubric matrices.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface border border-line">
                    <p className="font-bold text-indigo-500 uppercase text-[10px] tracking-wider mb-1">
                      Two-Way Audio/Video Dialog
                    </p>
                    <p className="text-ink">Real-time candidate vocal answers trigger intelligent follow-ups on trade-offs.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface border border-line">
                    <p className="font-bold text-emerald-500 uppercase text-[10px] tracking-wider mb-1">
                      Server-Authoritative Scorecard
                    </p>
                    <p className="text-ink">Mathematical scoring based on verified rubric evidence, never arbitrary scores.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrity & Anti-Bias Section (#integrity) */}
      <section id="integrity" className="py-20 border-b border-line bg-surface-deep scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <span className="text-xs font-bold text-accent-emerald uppercase tracking-wider block">
              TRUST, GOVERNANCE &amp; ETHICS
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
              Anti-Bias Guardrails &amp; AI Proctoring Integrity
            </h2>
            <p className="text-sm sm:text-base text-ink-muted">
              We hold our models to strict ethical boundaries. Progeni Atlas audits every model output to prevent demographic skew and protect session validity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-accent-emerald flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink">Blinded Demographic Evaluation</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Candidate scoring relies strictly on semantic code accuracy and reasoning rubric parameters. Voice tone, gender, race, or accent are neutralized.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-accent-cyan flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink">Multi-Signal Proctoring</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Client-side MediaPipe vision monitors display window focus departures, tab switching, and multi-face anomalies without storing invasive biometric records.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-line shadow-sm space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-accent-indigo flex items-center justify-center">
                <Globe2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink">Enterprise Regulatory Compliance</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Fully compliant with EU AI Act High-Risk Employment requirements, EEOC algorithmic transparency, and GDPR Right to Explanation standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership & Team Section (#team) */}
      <section id="team" className="py-20 border-b border-line bg-surface scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
            <span className="text-xs font-bold text-[#185adb]  uppercase tracking-wider block">
              OUR LEADERSHIP
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
              Engineered by Practitioners, Driven by Science
            </h2>
            <p className="text-sm sm:text-base text-ink-muted">
              Our core team brings together specialists in large language models, low-latency audio streaming, and high-stakes psychometric assessment.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, i) => (
              <div key={i} className="p-6 rounded-2xl bg-surface-deep border border-line hover:border-cyan-400/40 transition-colors space-y-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${member.gradient} text-white flex items-center justify-center font-bold text-base shadow-md`}>
                  {member.avatar}
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">{member.name}</h3>
                  <p className="text-xs font-semibold text-[#185adb]  mt-0.5">{member.role}</p>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-16 bg-gradient-to-r from-[#072448] via-[#0c3666] to-[#185adb] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black">Ready to experience merit-based hiring?</h2>
          <p className="text-slate-200 text-sm sm:text-base max-w-xl mx-auto">
            Try a simulated interview session or speak with our solutions engineering team for a personalized enterprise trial.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/candidate/practice"
              prefetch={false}
              className="px-6 py-3 rounded-full bg-white text-[#072448] font-bold text-sm hover:bg-slate-100 transition-colors shadow-md"
            >
              Start Free Practice Interview
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-full border border-white/40 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              View Pricing &amp; Plans
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
