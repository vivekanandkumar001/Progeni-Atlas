'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Video,
  Code2,
  ShieldCheck,
  FileText,
  Sliders,
  Sparkles,
  ArrowRight,
  Terminal,
  Cpu,
  CheckCircle2,
  Layers,
  Zap,
  PlayCircle,
} from 'lucide-react';

export default function ServicesPage() {
  const serviceList = [
    {
      id: 'interviewer',
      icon: Video,
      badge: 'FLAGSHIP AI SERVICE',
      badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-accent-cyan',
      title: 'Two-Way Autonomous Video & Voice Interviewer',
      description:
        'A natural candidate ↔ AI interviewer conversation with sub-300ms vocal response latency, adaptive follow-ups, and empathetic conversational flow.',
      features: [
        'Dynamic question branching based on the candidate’s actual answers',
        'Ingests Candidate CV, Job Description, and Role Level in seconds',
        'Automatic transcription with speaker diarization and audio replays',
        'Available 24/7 in 25+ international languages and accents',
      ],
      linkText: 'Test Live AI Interviewer',
      linkHref: '/portfolio#demo',
    },
    {
      id: 'coding',
      icon: Code2,
      badge: 'TECHNICAL RUNTIME',
      badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-accent-indigo',
      title: 'Interactive Live Coding & System Architecture Sandbox',
      description:
        'Evaluate genuine problem solving in a real-time IDE environment with multi-language execution, unit test suites, and an interactive distributed-systems whiteboard.',
      features: [
        'Native execution environments for Python, TypeScript, Java, Go, C++, Rust',
        'Algorithmic unit testing with edge-case validation and Big-O efficiency analysis',
        'Integrated Architecture Whiteboard with drag-and-drop cloud primitives (APIs, Queues, DBs)',
        'Keystroke replay to observe candidate debugging and refactoring habits',
      ],
      linkText: 'Explore Coding Drills',
      linkHref: '/candidate/practice',
    },
    {
      id: 'proctoring',
      icon: ShieldCheck,
      badge: 'SECURITY & INTEGRITY',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-accent-emerald',
      title: 'Real-Time AI Proctoring & Anti-Cheating Intelligence',
      description:
        'Maintain absolute confidence in interview integrity with client-side vision telemetry, multi-face presence tracking, and tab-focus departure telemetry.',
      features: [
        'Client-side camera face-mesh (MediaPipe) detecting candidate absence or multi-face presence',
        'Browser tab switch frequency and window blur timestamps logged in report',
        'Continuous speech activity capture and transcript telemetry without background audio surveillance',
        'Non-intrusive and GDPR/CCPA compliant without collecting permanent facial biometrics',
      ],
      linkText: 'Review Security Controls',
      linkHref: '/about#integrity',
    },
    {
      id: 'dossiers',
      icon: FileText,
      badge: 'AUDIT-READY REPORTING',
      badgeColor: 'border-blue-500/30 bg-blue-500/10 text-[#185adb] ',
      title: 'Comprehensive Candidate Dossiers & Structured Scorecards',
      description:
        'Transform subjective interview impressions into quantifiable, defensible assessment dossiers with direct quote evidence and rubric-linked grading.',
      features: [
        'Instant scoring across Technical Depth, System Architecture, and Problem Solving',
        'Quote-backed justifications for each rating, avoiding black-box bias',
        'One-click PDF export suitable for hiring committees and executive summaries',
        'Shareable candidate link with role-based recruiter permissions',
      ],
      linkText: 'View Recruiter Dossiers',
      linkHref: '/recruiter/dossiers',
    },
    {
      id: 'rubrics',
      icon: Sliders,
      badge: 'ENTERPRISE CUSTOMIZATION',
      badgeColor: 'border-violet-500/30 bg-violet-500/10 text-accent-violet',
      title: 'Custom Evaluation Rubrics & Weight Calibration',
      description:
        'Align AI assessments directly with your company’s engineering levels. Fine-tune competency weights, mandatory prerequisites, and pass/fail thresholds.',
      features: [
        'Role-specific templates for Junior, Mid, Senior, Staff, and Engineering Managers',
        'Custom scoring curves matching your internal engineering ladders',
        'Automated ATS webhook triggers based on calibrated score thresholds',
        'Audit log tracking every rubric modification by hiring managers',
      ],
      linkText: 'Configure Rubrics',
      linkHref: '/recruiter/rubrics',
    },
  ];

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-cyan-500/20">
      <Navbar />

      {/* Services Hero */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface via-surface to-surface-deep py-20 lg:py-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#185adb]/30 bg-[#185adb]/5 text-[#185adb]  text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Hiring Suite
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight leading-[1.1]">
            End-to-End Solutions for{' '}
            <span className="bg-gradient-to-r from-[#185adb] via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Modern Technical Assessment
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed">
            From autonomous multi-modal video interviews and browser-based coding runtimes to evidence-backed scorecards, discover our modular platform built to scale technical hiring.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all"
            >
              View Pricing &amp; Plans <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold text-ink hover:bg-surface-2 hover:border-cyan-400/50 transition-all"
            >
              <PlayCircle className="w-4 h-4 text-accent-cyan" /> View Live Showcase
            </Link>
          </div>
        </div>
      </section>

      {/* Services Cards Section */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {serviceList.map((service, index) => {
            const IconComponent = service.icon;
            const isReversed = index % 2 === 1;

            return (
              <div
                key={service.id}
                id={service.id}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-10 items-center scroll-mt-24 p-8 sm:p-10 rounded-xl border border-line bg-surface-deep shadow-sm hover:shadow-xl transition-shadow`}
              >
                {/* Content side (7 cols) */}
                <div className={`lg:col-span-7 space-y-6 ${isReversed ? 'lg:order-2' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#072448] text-white flex items-center justify-center">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${service.badgeColor}`}>
                      {service.badge}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-ink tracking-tight">
                    {service.title}
                  </h2>

                  <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                    {service.description}
                  </p>

                  <div className="space-y-2.5 pt-2">
                    {service.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-ink-muted">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Link
                      href={service.linkHref}
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#185adb]  hover:underline"
                    >
                      {service.linkText} <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Visual Graphic side (5 cols) */}
                <div className={`lg:col-span-5 ${isReversed ? 'lg:order-1' : ''}`}>
                  <div className="p-6 rounded-2xl bg-surface border border-line shadow-inner space-y-4">
                    <div className="flex items-center justify-between text-xs text-ink-muted border-b border-line pb-3">
                      <span className="font-mono text-[11px] font-bold text-accent-cyan">MODULE // {service.id.toUpperCase()}</span>
                      <span className="flex items-center gap-1.5 text-accent-emerald text-[11px] font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Ready
                      </span>
                    </div>

                    <div className="space-y-2 font-mono text-xs text-ink-muted">
                      <div className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between">
                        <span>Latency</span>
                        <span className="text-accent-emerald font-bold">&lt; 280ms</span>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between">
                        <span>Anti-Cheat Coverage</span>
                        <span className="text-accent-cyan font-bold">Multi-Signal MediaPipe</span>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-2 border border-line flex items-center justify-between">
                        <span>Evaluation Rubric</span>
                        <span className="text-indigo-500 font-bold">Standardized</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Link
                        href="/register"
                        className="w-full py-2.5 rounded-xl bg-[#072448]  text-white font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                      >
                        Launch Interactive Trial
                      </Link>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* Enterprise ATS Integration Strip */}
      <section className="py-16 border-t border-line bg-surface-deep">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <span className="text-xs font-bold text-accent-cyan uppercase tracking-wider block">
            ECOSYSTEM INTEGRATIONS
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-ink">
            Integrates Smoothly with Your Existing Hiring Stack
          </h2>
          <p className="text-sm text-ink-muted max-w-2xl mx-auto">
            Sync interview invitations, candidate scorecards, and final hiring verdicts directly into your Applicant Tracking System with one-click webhook integrations.
          </p>

          <div className="flex flex-wrap justify-center items-center gap-8 pt-4">
            {['Greenhouse', 'Lever', 'Workday', 'Ashby', 'BambooHR', 'Slack Notifications'].map((ats) => (
              <div
                key={ats}
                className="px-5 py-2.5 rounded-xl border border-line bg-surface text-xs font-bold text-ink shadow-xs"
              >
                {ats}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
