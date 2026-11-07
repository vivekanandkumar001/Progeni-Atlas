'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Check,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Zap,
  Users,
  Building2,
  Lock,
  ArrowRight,
} from 'lucide-react';

export default function PricingPage() {
  const [audience, setAudience] = useState<'candidate' | 'recruiter'>('candidate');

  const candidatePlans = [
    {
      name: 'Free Starter',
      badge: 'INSTANT TRIAL',
      price: '₹0',
      credits: '10 Credits',
      period: 'on OTP verification',
      description: 'Ideal for trying out the AI interviewer with full video, audio and code execution.',
      popular: false,
      buttonText: 'Start Free Mock',
      buttonHref: '/register',
      features: [
        '1 Full AI Technical Mock Interview',
        'Live Spoken Dialogue & Adaptive Follow-ups',
        'Browser Code Execution (Python, C++, JS)',
        'Instant Scorecard & Competency Report',
        'No Credit Card Required',
      ],
      notIncluded: [
        'Resume Defense Round',
        'Company Specific Question Banks',
      ],
    },
    {
      name: 'Warm-up Pack',
      badge: 'FOR QUICK PRACTICE',
      price: '₹49',
      credits: '30 Credits',
      period: 'one-time pack',
      description: 'Quick pre-interview brush-up right before your actual technical round.',
      popular: false,
      buttonText: 'Buy Pack (₹49)',
      buttonHref: '/candidate/wallet',
      features: [
        '30 AI Credits (~15-20 mins practice)',
        '1 Full In-Depth DSA or Behavioral Round',
        'Turn-by-Turn Audio Transcripts',
        'Code Efficiency & Complexity Analysis',
        'Actionable Improvement Guidance',
      ],
      notIncluded: [
        'Company Specific Question Banks',
      ],
    },
    {
      name: 'Placement Ready',
      badge: 'MOST POPULAR FOR CAMPUS',
      price: '₹99',
      credits: '70 Credits',
      period: 'one-time pack (Save 30%)',
      description: 'Most chosen by engineering students preparing for placements and product companies.',
      popular: true,
      buttonText: 'Get 70 Credits (₹99)',
      buttonHref: '/candidate/wallet',
      features: [
        '70 AI Credits (~35-40 mins practice)',
        '2-3 Full Technical & Architecture Rounds',
        'Resume Defense & Target JD Parsing',
        'Company-Specific Question Sets (Google, TCS, Amazon)',
        'Detailed Turn-by-Turn Telemetry & Audio Replays',
      ],
      notIncluded: [],
    },
    {
      name: 'Pro Mastery',
      badge: 'BEST VALUE',
      price: '₹199',
      credits: '150 Credits',
      period: 'one-time pack',
      description: 'Comprehensive preparation for high-stakes FAANG, startup, and campus hiring.',
      popular: false,
      buttonText: 'Get 150 Credits (₹199)',
      buttonHref: '/candidate/wallet',
      features: [
        '150 AI Credits (~75-80 mins practice)',
        '5+ Full Technical, DSA & HR Mock Rounds',
        'Full Multi-Modal Proctoring Simulation',
        'Priority AI Voice & Video Response Latency',
        'Lifetime Scorecard Dossier History',
      ],
      notIncluded: [],
    },
  ];

  const recruiterPlans = [
    {
      name: 'Team Starter',
      badge: 'FOR STARTUPS',
      price: '₹999',
      credits: '800 Credits',
      period: 'per pack',
      description: 'Screen up to 15-20 candidates automatically with AI technical lead interviews.',
      popular: false,
      buttonText: 'Buy 800 Credits',
      buttonHref: '/recruiter/billing',
      features: [
        '800 Screening Credits (~400 mins)',
        '15-20 Candidate Interview Sessions',
        'Automated Candidate Dossiers & PDF Reports',
        'Standard Role Rubric Templates',
        '3 Team Member Seats',
      ],
      notIncluded: ['Custom ATS Sync'],
    },
    {
      name: 'Scale Hiring',
      badge: 'HIGH VOLUME',
      price: '₹1,999',
      credits: '1,800 Credits',
      period: 'per pack (Save 20%)',
      description: 'For fast-growing hiring teams scaling their technical screening funnel.',
      popular: true,
      buttonText: 'Buy 1,800 Credits',
      buttonHref: '/recruiter/billing',
      features: [
        '1,800 Screening Credits (~900 mins)',
        '45-50 Candidate Interview Sessions',
        'Custom Role Rubric Templates & Weights',
        'Full Video Proctoring Telemetry',
        'Bulk CSV Candidate Scheduling',
      ],
      notIncluded: [],
    },
    {
      name: 'Enterprise Bulk',
      badge: 'CAMPUS & LATERAL',
      price: '₹4,999',
      credits: '4,500 Credits',
      period: 'per pack (Best ROI)',
      description: 'High-volume hiring campaigns with custom ATS synchronization and compliance.',
      popular: false,
      buttonText: 'Buy 4,500 Credits',
      buttonHref: '/recruiter/billing',
      features: [
        '4,500 Screening Credits (~2,250 mins)',
        '110+ Candidate Screenings',
        'Dedicated AI Persona & Organization Branding',
        'Priority Compute & Zero-Queue Capacity',
        'Full Audit Trail & Compliance Export',
      ],
      notIncluded: [],
    },
  ];

  const activePlans = audience === 'candidate' ? candidatePlans : recruiterPlans;

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-cyan-500/20">
      <Navbar />

      {/* Pricing Header */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface via-surface to-surface-deep py-16 lg:py-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-accent-emerald text-xs font-bold uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            Transparent Pricing // No Subscriptions, Pay Only As You Practice
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight leading-[1.1]">
            Pocket-Friendly Practice Packs for{' '}
            <span className="bg-gradient-to-r from-[#185adb] via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Every Candidate
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-ink-muted">
            Start completely free with 10 credits. When you&apos;re ready to level up, choose simple one-time credit packs starting at just ₹49.
          </p>

          {/* Candidate vs Recruiter Tab Switcher */}
          <div className="pt-2 flex items-center justify-center">
            <div className="inline-flex p-1 rounded-2xl bg-surface-2 border border-line shadow-xs">
              <button
                type="button"
                onClick={() => setAudience('candidate')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  audience === 'candidate'
                    ? 'bg-[#072448] text-white shadow-md'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Candidate Practice Packs (₹49 - ₹199)</span>
              </button>
              <button
                type="button"
                onClick={() => setAudience('recruiter')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  audience === 'recruiter'
                    ? 'bg-[#072448] text-white shadow-md'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span>Recruiter &amp; Team Packs</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="py-16 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-1 md:grid-cols-2 ${audience === 'candidate' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
            {activePlans.map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-3xl border ${
                  plan.popular
                    ? 'border-[#185adb] bg-surface-deep shadow-2xl relative ring-2 ring-[#185adb]/25'
                    : 'border-line bg-surface-deep shadow-sm'
                } flex flex-col justify-between space-y-6 transition hover:translate-y-[-4px] hover:shadow-lg`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#185adb] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                    Most Popular Choice
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">
                      {plan.badge}
                    </span>
                    <h3 className="text-xl font-bold text-ink mt-1">{plan.name}</h3>
                    <p className="text-xs text-ink-muted mt-2 min-h-[36px] leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="pt-2 border-t border-line/60">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-ink">{plan.price}</span>
                      <span className="text-xs font-medium text-ink-muted"> / {plan.period}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-accent-cyan text-xs font-mono font-bold">
                      <Zap className="w-3.5 h-3.5 fill-cyan-400 text-cyan-400" />
                      <span>{plan.credits}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-line/60">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      What&apos;s Included:
                    </p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-ink-muted">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Link
                  href={plan.buttonHref}
                  className={`w-full py-3 rounded-xl text-center text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                    plan.popular
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-cyan-500/20 hover:brightness-110'
                      : 'border border-[#072448] text-[#072448] hover:bg-slate-100'
                  }`}
                >
                  <span>{plan.buttonText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* Guarantee / Free Trial Banner */}
          <div className="mt-14 p-6 sm:p-8 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-surface to-surface-deep shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-cyan">
                <ShieldCheck className="w-4 h-4 text-cyan-500" />
                <span>100% Student Friendly · No Hidden Charges</span>
              </div>
              <h3 className="text-xl font-bold text-ink">
                Start with 10 Free Credits upon Signup
              </h3>
              <p className="text-xs sm:text-sm text-ink-muted max-w-xl">
                Every new user gets 10 credits after OTP verification. Practice your first live AI interview without entering any payment card.
              </p>
            </div>
            <Link
              href="/register"
              className="px-6 py-3.5 rounded-xl bg-[#072448] text-white text-xs sm:text-sm font-bold shadow-md hover:bg-[#0c3666] transition shrink-0 whitespace-nowrap"
            >
              Claim 10 Free Credits →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
