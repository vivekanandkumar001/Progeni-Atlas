'use client';

import React from 'react';
import { PracticeDrillItem, DrillDifficulty } from '@/types/practice';
import { Clock, Play, Award, Zap, ChevronRight, CheckCircle2 } from 'lucide-react';

interface DrillCardGridProps {
  drills: PracticeDrillItem[];
  onStartDrill: (drill: PracticeDrillItem) => void;
}

export const DrillCardGrid: React.FC<DrillCardGridProps> = ({ drills, onStartDrill }) => {
  const getDifficultyBadge = (difficulty: DrillDifficulty) => {
    switch (difficulty) {
      case 'BEGINNER':
        return { label: 'Beginner', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
      case 'INTERMEDIATE':
        return { label: 'Intermediate', bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' };
      case 'ADVANCED':
        return { label: 'Advanced', bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' };
      default:
        return { label: difficulty, bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  if (drills.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
        <p className="text-slate-400 text-sm">No practice drills found matching your active filter criteria.</p>
        <p className="text-slate-500 text-xs font-mono">Try adjusting your category selection or search query.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {drills.map((drill) => {
        const diffBadge = getDifficultyBadge(drill.difficulty);
        return (
          <div
            key={drill.id}
            className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between space-y-4 backdrop-blur-md hover:border-slate-700 transition-all shadow-xl group"
          >
            <div className="space-y-3">
              {/* Header Badges */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${diffBadge.bg}`}>
                  {diffBadge.label}
                </span>

                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {drill.estimatedMinutes} mins
                </span>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors leading-snug">
                  {drill.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-3">
                  {drill.description}
                </p>
              </div>

              {/* Starter Question Preview Box */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Sample Starter Scenario:
                </span>
                <p className="text-[11px] text-slate-300 italic line-clamp-2">
                  &quot;{drill.sampleStarterQuestion}&quot;
                </p>
              </div>

              {/* Core Skills Tags */}
              <div className="flex flex-wrap gap-1.5">
                {drill.coreSkillsTested.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-mono"
                  >
                    #{skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Progress & Action Row */}
            <div className="pt-3 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  {drill.totalAttempts > 0 ? `${drill.totalAttempts} Attempts` : 'Not Attempted'}
                </span>
                {drill.userBestScore !== undefined && (
                  <span className="font-mono text-emerald-400 font-bold">
                    Best: {drill.userBestScore}%
                  </span>
                )}
              </div>

              {drill.userBestScore !== undefined && (
                <div className="w-full h-1.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                    style={{ width: `${drill.userBestScore}%` }}
                  ></div>
                </div>
              )}

              <button
                type="button"
                onClick={() => onStartDrill(drill)}
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 font-medium text-xs transition-all cursor-pointer group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 group-hover:text-cyan-300"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
                <span>Start Practice Drill</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
