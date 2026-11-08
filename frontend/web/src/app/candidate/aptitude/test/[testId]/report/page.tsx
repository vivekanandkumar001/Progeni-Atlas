'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Brain,
  Award,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  BookOpen,
  Filter,
  Zap,
  Target,
  Sparkles,
  ChevronLeft,
  Share2,
} from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  fetchAptitudeReport,
  type AptitudeReportResponse,
  type AptitudeReviewItem,
} from '@/lib/api';

export default function AptitudeReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Array.isArray(params.testId) ? params.testId[0] : (params.testId as string);

  const [report, setReport] = useState<AptitudeReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function loadReport() {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await fetchAptitudeReport(sessionId);
        if (isMounted) {
          if (res && res.scorecard) {
            setReport(res);
          } else {
            setError('Report details are currently being finalized or session not found.');
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve assessment scorecard.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    void loadReport();
    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-white">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-base font-semibold text-slate-200">Generating Cognitive Evaluation Scorecard…</p>
          <p className="text-xs text-slate-500 mt-1">Aggregating 5-pillar performance, speed index & proctoring telemetry</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
          <XCircle className="w-12 h-12 mx-auto mb-2" />
          <h2 className="text-xl font-bold">Scorecard Unavailable</h2>
          <p className="text-sm text-slate-400 max-w-md mt-1">{error || 'Session could not be located.'}</p>
        </div>
        <Link
          href="/candidate/aptitude"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition"
        >
          <RotateCcw className="w-4 h-4" />
          Return to Aptitude Hub
        </Link>
      </div>
    );
  }

  const { scorecard, templateTitle, candidateName, telemetry } = report;
  const {
    overallScore,
    percentile,
    totalQuestions,
    attempted,
    correct,
    incorrect,
    unanswered,
    accuracyPercent,
    trustScore,
    speedIndex,
    sectionBreakdown,
    review = [],
  } = scorecard;

  // Filter questions
  const filteredReview = review.filter((item: AptitudeReviewItem) => {
    if (filter === 'correct') return item.isCorrect;
    if (filter === 'incorrect') return item.isAttempted && !item.isCorrect;
    if (filter === 'unanswered') return !item.isAttempted;
    return true;
  });

  const getScoreVerdict = (score: number) => {
    if (score >= 80) return { label: 'Exceptional (Top Tier)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (score >= 60) return { label: 'Placement Ready (Strong Core)', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' };
    if (score >= 40) return { label: 'Proficient (Needs Polish)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { label: 'Needs Remedial Practice', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  const verdict = getScoreVerdict(overallScore);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <Link
              href="/candidate/aptitude"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-400 transition mb-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back to Aptitude Arena
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Cognitive Assessment Scorecard</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${verdict.bg} ${verdict.color}`}>
                {verdict.label}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Candidate: <span className="text-slate-200 font-medium">{candidateName || 'Verified Candidate'}</span> • Test:{' '}
              <span className="text-cyan-300 font-medium">{templateTitle || 'Employability Assessment'}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
              title="Copy shareable scorecard URL"
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? 'Link Copied!' : 'Share Scorecard'}
            </button>
            <Link
              href="/candidate/aptitude"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retake / New Test
            </Link>
          </div>
        </div>

        {/* Hero Performance Overview KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
          {/* Overall Score */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-cyan-950/20 border border-cyan-500/20 relative overflow-hidden">
            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Award className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Overall Score</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-cyan-300">{overallScore}%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {correct} / {totalQuestions} Solved Correctly
            </p>
          </div>

          {/* Percentile Rank */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-purple-950/20 border border-purple-500/20 relative overflow-hidden">
            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cognitive Rank</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-purple-300">{percentile}th</span>
            </div>
            <p className="text-[11px] text-purple-400/90 mt-1">Percentile Benchmark</p>
          </div>

          {/* Accuracy % */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-emerald-950/20 border border-emerald-500/20 relative overflow-hidden">
            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Target className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Accuracy Rate</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-emerald-300">{accuracyPercent}%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {correct} Correct of {attempted} Attempted
            </p>
          </div>

          {/* Speed Index */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-amber-950/20 border border-amber-500/20 relative overflow-hidden">
            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pace & Velocity</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold text-amber-300 truncate">{speedIndex}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Response cadence vs median</p>
          </div>

          {/* Trust Score */}
          <div className="col-span-2 sm:col-span-1 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-teal-950/20 border border-teal-500/20 relative overflow-hidden">
            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Integrity Trust</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-teal-300">{trustScore}%</span>
            </div>
            <p className="text-[11px] text-teal-400/90 mt-1">Proctoring Telemetry Score</p>
          </div>
        </div>

        {/* 5-Pillar Cognitive Section Breakdown */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-cyan-400" />
              5-Pillar Cognitive Competency Matrix
            </h2>
            <span className="text-xs text-slate-400 hidden sm:inline">AMCAT & Mercer Mettl Calibrated Pillars</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(sectionBreakdown || {}).map(([secName, stats]) => {
              const scorePct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
              const mins = Math.floor(stats.timeSpent / 60);
              const secs = Math.round(stats.timeSpent % 60);

              let badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
              if (scorePct >= 75) badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
              else if (scorePct < 40) badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';

              return (
                <div
                  key={secName}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{secName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {stats.correct} of {stats.total} correct • {stats.attempted} attempted
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                      {scorePct}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Time: {mins > 0 ? `${mins}m ` : ''}{secs}s
                    </span>
                    <span className="text-slate-500">
                      {scorePct >= 75 ? 'Mastery' : scorePct >= 50 ? 'Proficient' : 'Needs Practice'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Question-by-Question Deep Review Arena */}
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Comprehensive Question Solutions & Derivations
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review your selections, correct answers, step-by-step logic, and mathematical shortcuts.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="px-2 py-1 text-slate-500 flex items-center gap-1 hidden sm:flex">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filter === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({review.length})
              </button>
              <button
                onClick={() => setFilter('correct')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filter === 'correct' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Correct ({correct})
              </button>
              <button
                onClick={() => setFilter('incorrect')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filter === 'incorrect' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Incorrect ({incorrect})
              </button>
              <button
                onClick={() => setFilter('unanswered')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filter === 'unanswered' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Unanswered ({unanswered})
              </button>
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4">
            {filteredReview.map((item: AptitudeReviewItem, idx: number) => {
              const hasOptions = Array.isArray(item.options) && item.options.length > 0;
              const hasPrompt = Boolean(item.prompt);

              return (
                <div
                  key={item.id || idx}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.isCorrect
                      ? 'bg-slate-900/60 border-emerald-500/20'
                      : item.isAttempted
                      ? 'bg-slate-900/60 border-rose-500/20'
                      : 'bg-slate-900/40 border-slate-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        Q{idx + 1}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/50 text-cyan-300">
                        {item.section}
                      </span>
                      <span className="text-xs text-slate-400">• {item.topic}</span>
                      <span
                        className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                          item.difficulty === 'hard'
                            ? 'bg-rose-950/60 text-rose-300'
                            : item.difficulty === 'medium'
                            ? 'bg-amber-950/60 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.difficulty}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Time: {Math.round(item.timeSpentSeconds || 0)}s
                      </span>
                      {item.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Correct
                        </span>
                      ) : item.isAttempted ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                          <XCircle className="w-4 h-4" /> Incorrect
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                          <HelpCircle className="w-4 h-4" /> Unanswered
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Prompt */}
                  {hasPrompt ? (
                    <div className="py-3">
                      <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed">
                        {item.prompt}
                      </p>
                    </div>
                  ) : null}

                  {/* Options List */}
                  {hasOptions ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
                      {item.options!.map((opt: string, optIdx: number) => {
                        const isCorrectOption = optIdx === item.correctIndex;
                        const isSelectedByCandidate = optIdx === item.selectedOptionIndex;

                        let optClass = 'bg-slate-900/60 border-slate-800 text-slate-300';
                        if (isCorrectOption) {
                          optClass = 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200 font-medium';
                        } else if (isSelectedByCandidate && !isCorrectOption) {
                          optClass = 'bg-rose-950/30 border-rose-500/60 text-rose-300';
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${optClass}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-800 text-slate-300">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{opt}</span>
                            </span>

                            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                              {isSelectedByCandidate && !isCorrectOption && (
                                <span className="text-rose-400">Your Selection</span>
                              )}
                              {isCorrectOption && (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Correct Answer
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="my-2 p-2.5 rounded-lg bg-slate-900/50 text-xs text-slate-400">
                      Answer Key: Option {String.fromCharCode(65 + item.correctIndex)} was correct.
                      {item.selectedOptionIndex !== null && item.selectedOptionIndex !== undefined ? (
                        <span> (You chose Option {String.fromCharCode(65 + item.selectedOptionIndex)})</span>
                      ) : (
                        <span> (Not attempted)</span>
                      )}
                    </div>
                  )}

                  {/* Pedagogical Derivation & Math Shortcuts */}
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 space-y-2">
                    {item.explanation && (
                      <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/70 text-xs sm:text-sm text-slate-300 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          Solution Derivation:
                        </div>
                        <p className="leading-relaxed text-slate-300 whitespace-pre-line">{item.explanation}</p>
                      </div>
                    )}

                    {item.formula && (
                      <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-200 flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-cyan-300">Formula / Rule: </span>
                          <span className="font-mono">{item.formula}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Anti-Cheating Telemetry Audit Box */}
        {telemetry && (
          <section className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              Proctoring Integrity Audit Trail
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Tab Switches</span>
                <span className="text-base font-bold text-white">
                  {String((telemetry as Record<string, unknown>).tabSwitchCount ?? 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Fullscreen Exits</span>
                <span className="text-base font-bold text-white">
                  {String((telemetry as Record<string, unknown>).fullscreenExitCount ?? 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">DevTools Incursions</span>
                <span className="text-base font-bold text-white">
                  {String((telemetry as Record<string, unknown>).devtoolsOpenedCount ?? 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Copy/Paste Blocks</span>
                <span className="text-base font-bold text-white">
                  {String((telemetry as Record<string, unknown>).copyPasteAttempts ?? 0)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Footer Next Actions */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-cyan-950/30 border border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base font-bold text-white">Ready for the Next Step in Your Pipeline?</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Practice 1-on-1 with Sarah Chen in the Humanoid AI Technical Interview Arena.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/candidate/aptitude"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Other Aptitude Tracks
            </Link>
            <button
              onClick={() => router.push('/candidate/dashboard')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 transition"
            >
              Go to Candidate Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

