'use client';

import React from 'react';
import { ShieldCheck, Sparkles, Award, CheckCircle2 } from 'lucide-react';

interface ExecutiveScorecardBannerProps {
  overallScore: number;
  hiringRecommendation: string;
  percentileRank: number;
  executiveSummary: string;
  integrityScore: number;
  gazePercentage: number;
  tabSwitches: number;
}

export const ExecutiveScorecardBanner: React.FC<ExecutiveScorecardBannerProps> = ({
  overallScore = 88,
  hiringRecommendation = 'STRONG HIRE',
  percentileRank = 88,
  executiveSummary = 'Candidate Vivekanand Kumar demonstrated exceptional technical competence during the 45-minute AI technical screening. Showcased strong mastery over sliding window rate limiting algorithms, distributed Redis caching strategies, and stateless API gateway design. Highly recommended for placement.',
  integrityScore = 98,
  gazePercentage = 99.2,
  tabSwitches = 0
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

      {/* COLUMN 1: OVERALL COMPETENCY GAUGE (COL SPAN 4) */}
      <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left space-y-3 border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-6 lg:pb-0 lg:pr-6 relative z-10">
        <p className="text-caption font-mono uppercase text-slate-400 text-xs">
          Overall Competency Rating
        </p>
        
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 font-mono tracking-tight">
            {overallScore}
          </span>
          <span className="text-lg font-mono text-slate-500 font-normal">/ 100</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-start">
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-caption uppercase font-semibold text-xs inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>{hiringRecommendation.replace('_', ' ')}</span>
          </span>
          <span className="text-xs font-mono text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
            Top {100 - percentileRank}% among peers
          </span>
        </div>
      </div>

      {/* COLUMN 2: EXECUTIVE AI SUMMARY (COL SPAN 5) */}
      <div className="lg:col-span-5 space-y-2 relative z-10 border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-6 lg:pb-0 lg:pr-6">
        <div className="flex items-center gap-2 text-cyan-400">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-body font-semibold text-slate-200 text-sm">Evaluator Synthesis</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-normal">
          {executiveSummary}
        </p>
      </div>

      {/* COLUMN 3: PROCTORING & INTEGRITY SEAL (COL SPAN 3) */}
      <div className="lg:col-span-3 space-y-3 relative z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold text-slate-100">{integrityScore}% Integrity Rating</span>
        </div>

        <ul className="space-y-1.5 text-[11px] font-mono text-slate-400">
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Zero unauthorized tab switches ({tabSwitches})</span>
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Consistent camera gaze ({gazePercentage}%)</span>
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Single speaker audio confirmed</span>
          </li>
        </ul>
      </div>

    </div>
  );
};
