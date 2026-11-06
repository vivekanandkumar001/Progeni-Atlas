'use client';

import React from 'react';
import { PracticeDrillItem } from '@/types/practice';
import { Sparkles, ArrowRight, Clock, Target, ShieldCheck } from 'lucide-react';

interface RecommendedDrillsBannerProps {
  recommendedDrills: PracticeDrillItem[];
  onStartDrill: (drill: PracticeDrillItem) => void;
}

export const RecommendedDrillsBanner: React.FC<RecommendedDrillsBannerProps> = ({
  recommendedDrills,
  onStartDrill
}) => {
  if (!recommendedDrills || recommendedDrills.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface via-indigo-950/40 to-surface border border-line p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-6">
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-accent-cyan shrink-0" />
          <div>
            <h2 className="text-body font-bold text-ink text-base">
              AI-Curated Micro-Drills Matched to Your Growth Profile
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Targeted practice scenarios automatically selected based on your recent evaluation reports
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan text-xs font-mono shrink-0">
          Smart Recommendation Engine
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {recommendedDrills.slice(0, 2).map((drill, idx) => (
          <div
            key={`${drill.id}-${idx}`}
            className="p-5 rounded-xl bg-inset/80 border border-line space-y-4 flex flex-col justify-between hover:border-line-strong transition-all shadow-lg"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-accent-indigo border border-indigo-500/30 text-[10px] font-mono">
                  {drill.recommendedReason || 'Growth Recommendation'}
                </span>
                <span className="text-[11px] text-ink-muted font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-ink-muted" />
                  {drill.estimatedMinutes} mins
                </span>
              </div>

              <h3 className="text-sm font-bold text-ink leading-snug">{drill.title}</h3>
              <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{drill.description}</p>

              {/* Core Skills Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {drill.coreSkillsTested.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded bg-surface border border-line text-ink-muted text-[10px] font-mono"
                  >
                    #{skill}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStartDrill(drill)}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer group mt-2"
            >
              <span>Launch AI Micro-Mock →</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
