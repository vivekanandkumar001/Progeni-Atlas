'use client';

import React from 'react';
import Link from 'next/link';
import { CandidatePracticeStats } from '@/types/practice';
import { ArrowLeft, Target, Zap, Clock, Award, ShieldCheck } from 'lucide-react';

interface PracticeHeaderStatsProps {
  stats: CandidatePracticeStats;
}

export const PracticeHeaderStats: React.FC<PracticeHeaderStatsProps> = ({ stats }) => {
  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/candidate/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-accent-cyan transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Candidate Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-heading font-bold text-ink text-2xl sm:text-3xl tracking-tight">
              Practice Drills & Mock Question Lab
            </h1>
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan text-xs font-mono font-medium hidden md:inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Self-Paced AI Micro-Mock Engine</span>
            </span>
          </div>
          <p className="text-body text-ink-muted text-sm mt-1">
            Sharpen your technical articulation with 5-to-15 minute focused scenario drills and instant AI rubric feedback.
          </p>
        </div>

        <Link
          href="/candidate/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border border-line text-ink text-xs font-medium transition-colors shrink-0 self-start sm:self-auto"
        >
          <ShieldCheck className="w-4 h-4 text-accent-emerald" />
          <span>Candidate Dashboard</span>
        </Link>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-ink-muted text-xs flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Completed Drills</span>
          </p>
          <p className="text-2xl font-bold font-mono text-ink">{stats.totalDrillsCompleted}</p>
          <p className="text-[11px] text-ink-muted">Recorded self-paced sessions</p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-ink-muted text-xs flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-accent-emerald" />
            <span>Average Score</span>
          </p>
          <p className="text-2xl font-bold font-mono text-accent-emerald">{stats.averageScore}%</p>
          <p className="text-[11px] text-accent-emerald font-mono">Top performance tier</p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-ink-muted text-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent-indigo" />
            <span>Practice Time</span>
          </p>
          <p className="text-2xl font-bold font-mono text-accent-indigo">{stats.totalPracticeMinutes} mins</p>
          <p className="text-[11px] text-ink-muted">Dedicated preparation</p>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-ink-muted text-xs flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Interview Readiness</span>
          </p>
          <p className="text-2xl font-bold font-mono text-accent-cyan">{stats.readinessPercentage}%</p>
          <p className="text-[11px] text-accent-cyan font-mono">Aggregated skill readiness</p>
        </div>
      </div>
    </div>
  );
};
