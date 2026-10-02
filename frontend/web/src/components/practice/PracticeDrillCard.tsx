'use client';

import React from 'react';
import { PracticeDrillItem, DrillDifficulty } from '@/types/practice';
import { Clock, Play, Award, ArrowRight } from 'lucide-react';

interface PracticeDrillCardProps {
  drill: PracticeDrillItem;
  onStartDrill: (drill: PracticeDrillItem) => void;
}

export const PracticeDrillCard: React.FC<PracticeDrillCardProps> = ({ drill, onStartDrill }) => {
  const getDifficultyChip = (difficulty: DrillDifficulty) => {
    switch (difficulty) {
      case 'BEGINNER':
        return { label: 'Beginner', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'INTERMEDIATE':
        return { label: 'Intermediate', style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      case 'ADVANCED':
        return { label: 'Advanced', style: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      default:
        return { label: difficulty, style: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const diffChip = getDifficultyChip(drill.difficulty);

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 flex flex-col justify-between space-y-4 backdrop-blur-md hover:border-slate-700 transition-all shadow-xl group">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <span className="text-caption font-mono text-cyan-400 text-xs font-semibold uppercase tracking-wider">
          {drill.category.replace('_', ' ')}
        </span>

        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${diffChip.style}`}>
          {diffChip.label}
        </span>
      </div>

      {/* Title & Description */}
      <div className="space-y-2">
        <h3 className="text-body font-bold text-slate-100 text-base group-hover:text-cyan-300 transition-colors leading-snug">
          {drill.title}
        </h3>
        <p className="text-body text-slate-400 text-xs leading-relaxed line-clamp-2">
          {drill.description}
        </p>

        {/* Skill Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
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

      {/* Card Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-caption text-slate-400 text-xs flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>~{drill.estimatedMinutes} Mins</span>
          </p>
          <p className="text-caption font-mono text-[11px]">
            {drill.userBestScore !== undefined ? (
              <span className="text-emerald-400 font-bold">Best: {drill.userBestScore}/100</span>
            ) : (
              <span className="text-slate-500">Not Attempted Yet</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onStartDrill(drill)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/30 text-slate-200 hover:text-cyan-300 text-xs font-semibold transition-all cursor-pointer group-hover:scale-[1.02]"
        >
          <span>Start Drill →</span>
        </button>
      </div>
    </div>
  );
};
