'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Video,
  Play,
  CheckCircle2,
  Building2,
  TrendingUp,
  Award,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Star,
  Clock,
  Terminal,
} from 'lucide-react';

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<'interview' | 'code' | 'dossier'>('interview');

  const caseStudies = [
    {
      company: 'Apex Financial Technologies',
      industry: 'Global FinTech (1,400+ Engineers)',
      headline: 'Reduced Technical Screening Turnaround from 18 Days to 36 Hours',
      impact: '78% Faster Throughput',
      stats: [
        { label: 'Interviews Conducted', value: '3,200+' },
        { label: 'Time Saved per Recruiter', value: '14 hrs/wk' },
        { label: 'Candidate CSAT Rating', value: '4.9 / 5' },
      ],
      quote:
        'Progeni Atlas transformed our high-volume graduate and senior engineering intake. Candidates loved taking interviews on their own schedule without bias.',
      author: 'Marcus Vance, VP of Engineering Talent',
    },
    {
      company: 'CloudScale Infrastructure',
      industry: 'Enterprise DevOps SaaS',
      headline: 'Standardized Senior Distributed Systems Rubrics Across 14 Global Hubs',
      impact: '99.4% Proctoring Integrity',
      stats: [
        { label: 'Engineering Hours Reclaimed', value: '450+ hrs/mo' },
        { label: 'Rubric Adherence', value: '100%' },
        { label: 'Unbiased Hiring Rate', value: '+34%' },
      ],
      quote:
        'Instead of engineers debating subjective opinions, we now get a verifiable dossier with exact code diffs and audio transcript quotes.',
      author: 'Elena Rostova, Chief People Officer',
    },
    {
      company: 'NeuraHealth AI',
      industry: 'Healthcare Technology',
      headline: 'Eliminated Candidate No-Shows with 24/7 On-Demand Video Interviews',
      impact: '60% Higher Completion Rate',
      stats: [
        { label: 'Interview Drop-off', value: '-60%' },
        { label: 'ATS Integration Speed', value: '1 Day' },
        { label: 'Offer Acceptance Rate', value: '88%' },
      ],
      quote:
        'Candidates in different timezones no longer have to wake up at 3 AM for a technical screen. The AI interviewer conducts deep, adaptive technical dialogues effortlessly.',
      author: 'Tariq Al-Hamad, Head of Talent Acquisition',
    },
  ];

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-cyan-500/20">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface via-surface to-surface-deep py-20 lg:py-28">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-[500px] h-[350px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/5 text-[#185adb]  text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Platform Showcase &amp; Track Record
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight leading-[1.1]">
            Proven Results.{' '}
            <span className="bg-gradient-to-r from-[#185adb] via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Enterprise Scale.
            </span>
          </h1>

          <p className="max-w-3xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed">
            Explore our platform in action and discover how forward-thinking talent teams evaluate engineering excellence without hiring bottlenecks.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Link
              href="/candidate/practice"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all"
            >
              Test Practice Drills <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#case-studies"
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-6 py-3.5 text-sm font-semibold text-ink hover:bg-surface-2 transition-all"
            >
              Read Client Case Studies
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive Platform Tour (#showcase & #demo) */}
      <section id="showcase" className="py-20 border-b border-line bg-surface scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
            <span className="text-xs font-bold text-accent-cyan uppercase tracking-wider block">
              INTERACTIVE PREVIEW
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
              Experience the TalentPulse Ecosystem
            </h2>
            <p className="text-sm text-ink-muted">
              Select a platform module below to inspect the candidate and recruiter interfaces.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-10 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('interview')}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'interview'
                  ? 'bg-[#072448] text-white shadow-md'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-3'
              }`}
            >
              <Video className="w-4 h-4" />
              1. Two-Way AI Video Interviewer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'code'
                  ? 'bg-[#072448] text-white shadow-md'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-3'
              }`}
            >
              <Terminal className="w-4 h-4" />
              2. Live Code Execution &amp; Whiteboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dossier')}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'dossier'
                  ? 'bg-[#072448] text-white shadow-md'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-3'
              }`}
            >
              <Award className="w-4 h-4" />
              3. Evidence-Based Recruiter Dossier
            </button>
          </div>

          {/* Interactive Mockup Container */}
          <div id="demo" className="rounded-3xl border border-line bg-surface-deep shadow-2xl p-6 sm:p-10 scroll-mt-24">
            {activeTab === 'interview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fadeIn">
                <div className="space-y-5">
                  <span className="text-[11px] font-bold text-accent-cyan uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                    Live Video Session Mode
                  </span>
                  <h3 className="text-2xl font-black text-ink">
                    Empathetic AI Persona with Real-Time Vocal Branching
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    The AI interviewer listens to the candidate&apos;s verbal explanation, dynamically analyzes semantic depth, and asks follow-ups on architectural tradeoffs.
                  </p>
                  <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
                    <p className="text-xs font-mono text-accent-cyan font-bold">AI Interviewer Prompt:</p>
                    <p className="text-sm text-ink italic">
                      &quot;You mentioned using Redis for cache invalidation. How would you handle cache stampede if 50,000 requests hit simultaneously on an expired key?&quot;
                    </p>
                  </div>
                  <Link
                    href="/candidate/practice"
                    prefetch={false}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs shadow-md"
                  >
                    Try This Drill Live <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="rounded-2xl border border-line-strong bg-inset p-4 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-line">
                    <span className="flex items-center gap-2 text-accent-emerald font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Session In Progress
                    </span>
                    <span className="font-mono text-ink-muted">Turn 3 of 7</span>
                  </div>
                  <div className="h-56 sm:h-64 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 flex flex-col items-center justify-center text-white space-y-3 relative overflow-hidden">
                    <div className="w-20 h-20 rounded-full border-2 border-cyan-400 bg-cyan-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                      <Sparkles className="w-8 h-8 text-cyan-300 animate-pulse" />
                    </div>
                    <p className="text-xs font-mono text-cyan-200">AI Interviewer Speaking...</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fadeIn">
                <div className="space-y-5">
                  <span className="text-[11px] font-bold text-accent-indigo uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    Live Coding Runtime
                  </span>
                  <h3 className="text-2xl font-black text-ink">
                    Production Code Execution with Unit Tests
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Candidates write code in their preferred language with autocomplete, execution runtimes, and automated test-case evaluation.
                  </p>
                  <ul className="space-y-2 text-xs text-ink-muted">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent-emerald" /> 6 Supported languages with instant sandbox spin-up
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent-emerald" /> Edge-case fuzzing and memory allocation metrics
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent-emerald" /> Keystroke and revision history stored for recruiter audit
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-line-strong bg-slate-950 p-4 font-mono text-xs text-slate-200 shadow-2xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px]">
                    <span className="text-cyan-400 font-bold">solution.py</span>
                    <span className="text-emerald-400">All Tests Passed (4/4)</span>
                  </div>
                  <pre className="py-4 text-[12px] leading-relaxed text-slate-300 overflow-x-auto">
{`def find_median_sorted_arrays(nums1, nums2):
    # Binary search partitioning O(log(min(m, n)))
    if len(nums1) > len(nums2):
        nums1, nums2 = nums2, nums1
    
    m, n = len(nums1), len(nums2)
    low, high = 0, m
    ...
    return median # Verified 0.04ms runtime`}
                  </pre>
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[11px]">
                    ✓ Passed: Test cases (Empty, Even-Length, Duplicates, Negative Values)
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'dossier' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fadeIn">
                <div className="space-y-5">
                  <span className="text-[11px] font-bold text-[#185adb]  uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                    Audit-Ready Dossier
                  </span>
                  <h3 className="text-2xl font-black text-ink">
                    Quantifiable Evidence Behind Every Hiring Decision
                  </h3>
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Hiring managers receive a granular breakdown across Technical Depth, Coding Quality, Architecture, and Communication.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link
                      href="/recruiter/dossiers"
                      className="px-5 py-2.5 rounded-xl bg-[#072448] text-white font-bold text-xs hover:brightness-110"
                    >
                      Open Full Recruiter Portal
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-line">
                    <div>
                      <h4 className="text-sm font-bold text-ink">Senior Backend Engineer Candidate</h4>
                      <p className="text-xs text-ink-muted">Overall Score: 94 / 100 • Strong Hire</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-accent-emerald text-xs font-bold border border-emerald-500/30">
                      Recommended
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-ink-muted">Technical Depth &amp; Scaling</span>
                        <span className="font-bold text-ink">95%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full w-[95%]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-ink-muted">Code Cleanliness &amp; Tests</span>
                        <span className="font-bold text-ink">92%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full w-[92%]" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-ink-muted">Anti-Cheating Integrity Score</span>
                        <span className="font-bold text-emerald-500">99.8% (Clean)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full w-[99%]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Case Studies Section (#case-studies) */}
      <section id="case-studies" className="py-20 border-b border-line bg-surface-deep scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-xs font-bold text-accent-emerald uppercase tracking-wider block">
              ENTERPRISE VALIDATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
              Trusted by High-Velocity Engineering Organizations
            </h2>
            <p className="text-sm sm:text-base text-ink-muted">
              Discover how leading companies replace screening bottlenecks with high-throughput, unbiased assessments.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {caseStudies.map((cs, idx) => (
              <div
                key={idx}
                className="p-8 rounded-3xl border border-line bg-surface shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#185adb]  font-mono">
                      {cs.industry}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-accent-emerald border border-emerald-500/20">
                      {cs.impact}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-ink leading-snug">
                    {cs.company}
                  </h3>

                  <p className="text-xs sm:text-sm text-ink-muted font-medium">
                    {cs.headline}
                  </p>

                  <div className="grid grid-cols-3 gap-2 py-4 border-y border-line text-center">
                    {cs.stats.map((s, i) => (
                      <div key={i}>
                        <p className="text-base font-black text-ink">{s.value}</p>
                        <p className="text-[10px] text-ink-muted">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs italic text-ink-muted leading-relaxed">
                    &quot;{cs.quote}&quot;
                  </p>
                </div>

                <div className="pt-2 text-xs font-bold text-ink border-t border-line">
                  {cs.author}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
