'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  BookOpen,
  ArrowRight,
  Target,
  Sparkles,
  BarChart3,
  Flame,
} from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  fetchAptitudeTemplates,
  startAptitudeSession,
  fetchCandidateAptitudeHistory,
  type AptitudeTemplate,
  type AptitudeAttemptHistory,
} from '@/lib/api';

const DEFAULT_TEMPLATES: AptitudeTemplate[] = [
  {
    id: 'template-campus-general',
    title: 'Standard Campus Employability Assessment',
    subtitle: 'AMCAT & CoCubes Benchmark Pattern',
    description: 'Comprehensive 5-pillar cognitive screening simulating top IT & product company hiring filters.',
    durationMinutes: 30,
    totalQuestions: 12,
    sections: [
      { name: 'Quantitative', questionCount: 4, timeMinutes: 10 },
      { name: 'Logical', questionCount: 3, timeMinutes: 8 },
      { name: 'Verbal', questionCount: 2, timeMinutes: 5 },
      { name: 'Data Interpretation', questionCount: 2, timeMinutes: 5 },
      { name: 'Abstract', questionCount: 1, timeMinutes: 2 },
    ],
    negativeMarking: false,
    proctoringStrictness: 'STRICT',
  },
  {
    id: 'template-quant-speed-sprint',
    title: 'Quantitative Speed & Accuracy Sprint',
    subtitle: 'High-Velocity Math & Number Systems',
    description: 'Focus on arithmetic shortcuts, probability, percentages, and modular speed math.',
    durationMinutes: 15,
    totalQuestions: 5,
    sections: [{ name: 'Quantitative', questionCount: 5, timeMinutes: 15 }],
    negativeMarking: true,
    proctoringStrictness: 'STANDARD',
  },
  {
    id: 'template-analytical-reasoning',
    title: 'Logical & Critical Deductions Test',
    subtitle: 'Puzzles, Arrangements & Syllogisms',
    description: 'Evaluate non-verbal fluid intelligence, critical reasoning, and algorithmic logic under pressure.',
    durationMinutes: 15,
    totalQuestions: 4,
    sections: [{ name: 'Logical', questionCount: 4, timeMinutes: 15 }],
    negativeMarking: false,
    proctoringStrictness: 'STANDARD',
  },
];

export default function AptitudeHubPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<AptitudeTemplate[]>(DEFAULT_TEMPLATES);
  const [history, setHistory] = useState<AptitudeAttemptHistory[]>([]);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [tmpls, hist] = await Promise.all([
          fetchAptitudeTemplates(),
          fetchCandidateAptitudeHistory(),
        ]);
        if (tmpls && tmpls.length > 0) setTemplates(tmpls);
        if (hist) setHistory(hist);
      } catch (err) {
        console.warn('[AptitudeHub] Failed to load data:', err);
      }
    }
    void loadData();
  }, []);

  const handleStartTest = async (templateId: string) => {
    setStartingTemplateId(templateId);
    setErrorMsg(null);
    try {
      const session = await startAptitudeSession(templateId);
      if (!session || !session.sessionId) {
        throw new Error('Unable to assemble test session. Please try again.');
      }
      router.push(`/candidate/aptitude/test/${session.sessionId}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to launch test.');
      setStartingTemplateId(null);
    }
  };

  const completedAttempts = history.filter((h) => h.status === 'completed');
  const avgAccuracy =
    completedAttempts.length > 0
      ? Math.round(completedAttempts.reduce((acc, h) => acc + h.accuracy, 0) / completedAttempts.length)
      : 0;
  const bestPercentile =
    completedAttempts.length > 0
      ? Math.max(...completedAttempts.map((h) => h.percentile))
      : 0;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans relative overflow-x-clip selection:bg-cyan-500/30 selection:text-accent-cyan">
      {/* Background ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Fixed Header Shell */}
      <DashboardHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* HERO BANNER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-slate-800 p-6 sm:p-8 shadow-2xl">
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Standardized Cognitive Screening
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Aptitude & Critical Reasoning Arena
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Calibrated against top recruitment benchmarks (AMCAT, CoCubes, eLitmus). Master Quantitative Speed,
              Logical Deductions, Verbal Nuance, and Data Interpretation under strict anti-cheating protocols.
            </p>

            {/* Quick Stats Pill Strip */}
            <div className="pt-2 flex flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                <Target className="w-4 h-4 text-cyan-400" />
                <span>Attempts: <strong className="text-white">{completedAttempts.length}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Avg Accuracy: <strong className="text-emerald-400">{avgAccuracy}%</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Best Percentile: <strong className="text-amber-300">{bestPercentile}th</strong></span>
              </div>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SECTION 1: STANDARDIZED TEST TRACKS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Select Assessment Track
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Tests run in fullscreen mode with server-authoritative monotonic timers and anti-tamper telemetry.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {templates.map((tmpl) => {
              const isStarting = startingTemplateId === tmpl.id;
              return (
                <div
                  key={tmpl.id}
                  className="rounded-2xl bg-surface border border-slate-800 p-6 flex flex-col justify-between hover:border-cyan-500/50 transition-all duration-300 shadow-xl group hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:scale-105 transition-transform">
                        <Brain className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                        {tmpl.proctoringStrictness}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {tmpl.title}
                      </h3>
                      <p className="text-xs text-cyan-400/90 font-medium">{tmpl.subtitle}</p>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                      {tmpl.description}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration
                        </span>
                        <span className="font-semibold text-white">{tmpl.durationMinutes} Minutes</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <BarChart3 className="w-3.5 h-3.5 text-slate-400" /> Questions
                        </span>
                        <span className="font-semibold text-white">{tmpl.totalQuestions} Items</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Negative Marking
                        </span>
                        <span className={tmpl.negativeMarking ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                          {tmpl.negativeMarking ? 'Yes (-0.25)' : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      disabled={isStarting}
                      onClick={() => handleStartTest(tmpl.id)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isStarting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Assembling Session…</span>
                        </>
                      ) : (
                        <>
                          <span>Start Assessment</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: ATTEMPT HISTORY & SCORECARDS */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            Previous Assessment Scorecards
          </h2>

          {history.length === 0 ? (
            <div className="p-8 rounded-2xl bg-surface/50 border border-slate-800 text-center space-y-3">
              <Brain className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-white">No Test Attempts Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Launch a 15-minute speed sprint or standard campus mock to benchmark your speed, accuracy, and percentile rank.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-surface shadow-xl">
              <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 sm:px-6">Assessment</th>
                    <th className="py-3.5 px-4">Score</th>
                    <th className="py-3.5 px-4">Accuracy</th>
                    <th className="py-3.5 px-4">Percentile</th>
                    <th className="py-3.5 px-4">Integrity Trust</th>
                    <th className="py-3.5 px-4">Velocity</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((att) => (
                    <tr key={att.sessionId} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-medium text-white">
                        <div>{att.templateTitle}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(att.startedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-cyan-300">{att.score}%</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-semibold">{att.accuracy}%</td>
                      <td className="py-3.5 px-4 font-bold text-amber-400">{att.percentile}th</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 font-semibold ${att.trustScore >= 80 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {att.trustScore}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{att.speedIndex}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/candidate/aptitude/test/${att.sessionId}/report`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 font-medium text-xs transition-colors"
                        >
                          <span>Scorecard</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

