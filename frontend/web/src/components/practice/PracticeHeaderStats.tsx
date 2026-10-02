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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-300 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Candidate Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-heading font-bold text-slate-100 text-2xl sm:text-3xl tracking-tight">
              Practice Drills & Mock Question Lab
            </h1>
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-medium hidden md:inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Self-Paced AI Micro-Mock Engine</span>
            </span>
          </div>
          <p className="text-body text-slate-400 text-sm mt-1">
            Sharpen your technical articulation with 5-to-15 minute focused scenario drills and instant AI rubric feedback.
          </p>
        </div>

        <Link
          href="/candidate/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors shrink-0 self-start sm:self-auto"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Candidate Dashboard</span>
        </Link>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-slate-400 text-xs flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>Completed Drills</span>
          </p>
          <p className="text-2xl font-bold font-mono text-slate-100">{stats.totalDrillsCompleted}</p>
          <p className="text-[11px] text-slate-400">Recorded self-paced sessions</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-slate-400 text-xs flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Average Score</span>
          </p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{stats.averageScore}%</p>
          <p className="text-[11px] text-emerald-400 font-mono">Top performance tier</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-slate-400 text-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Practice Time</span>
          </p>
          <p className="text-2xl font-bold font-mono text-indigo-300">{stats.totalPracticeMinutes} mins</p>
          <p className="text-[11px] text-slate-400">Dedicated preparation</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md space-y-1">
          <p className="text-caption font-mono text-slate-400 text-xs flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interview Readiness</span>
          </p>
          <p className="text-2xl font-bold font-mono text-cyan-400">{stats.readinessPercentage}%</p>
          <p className="text-[11px] text-cyan-300 font-mono">Aggregated skill readiness</p>
        </div>
      </div>
    </div>
  );
};
