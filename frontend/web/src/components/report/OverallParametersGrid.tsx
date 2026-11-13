'use client';

import React from 'react';
import type { EvaluationParameterScore } from '@/lib/api';
import { Sliders, Award, Target, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface OverallParametersGridProps {
  overallParameters: EvaluationParameterScore[];
  overallScore: number | null;
}

const PARAM_CONFIG: Record<
  string,
  {
    gradient: string;
    text: string;
    bgBadge: string;
    borderBadge: string;
    iconColor: string;
    defaultDesc: string;
  }
> = {
  Relevance: {
    gradient: 'from-cyan-500 to-blue-500',
    text: 'text-accent-cyan',
    bgBadge: 'bg-cyan-500/10',
    borderBadge: 'border-cyan-500/30',
    iconColor: 'text-accent-cyan',
    defaultDesc: 'Alignment with question prompts, directness, and comprehensive intent coverage across all turns.',
  },
  'Technical Depth': {
    gradient: 'from-indigo-500 to-purple-500',
    text: 'text-accent-indigo',
    bgBadge: 'bg-indigo-500/10',
    borderBadge: 'border-indigo-500/30',
    iconColor: 'text-accent-indigo',
    defaultDesc: 'Architectural mechanics, edge case handling, scalability design, and production tradeoffs.',
  },
  'Correctness & Accuracy': {
    gradient: 'from-emerald-500 to-teal-500',
    text: 'text-accent-emerald',
    bgBadge: 'bg-emerald-500/10',
    borderBadge: 'border-emerald-500/30',
    iconColor: 'text-accent-emerald',
    defaultDesc: 'Factual accuracy of technical syntax, tools, logic, algorithmic rigor, and best practices.',
  },
};

function getPerformanceBadge(percentage: number | null | undefined): { label: string; color: string } {
  if (percentage === null || percentage === undefined) {
    return { label: 'Pending', color: 'text-ink-muted bg-accent-violet/10 border-accent-violet/20' };
  }
  if (percentage >= 80) {
    return { label: 'Exemplary', color: 'text-accent-emerald bg-emerald-500/10 border-emerald-500/30' };
  }
  if (percentage >= 65) {
    return { label: 'Proficient', color: 'text-accent-cyan bg-cyan-500/10 border-cyan-500/30' };
  }
  if (percentage >= 40) {
    return { label: 'Needs Growth', color: 'text-accent-amber bg-amber-500/10 border-amber-500/30' };
  }
  return { label: 'Critical Gap', color: 'text-accent-rose bg-rose-500/10 border-rose-500/30' };
}

export const OverallParametersGrid: React.FC<OverallParametersGridProps> = ({
  overallParameters,
  overallScore,
}) => {
  // Fallback default parameters if empty
  const parameters =
    overallParameters.length > 0
      ? overallParameters
      : [
          {
            name: 'Relevance',
            score: null,
            max_score: 10,
            percentage: null,
            description: PARAM_CONFIG['Relevance'].defaultDesc,
          },
          {
            name: 'Technical Depth',
            score: null,
            max_score: 10,
            percentage: null,
            description: PARAM_CONFIG['Technical Depth'].defaultDesc,
          },
          {
            name: 'Correctness & Accuracy',
            score: null,
            max_score: 10,
            percentage: null,
            description: PARAM_CONFIG['Correctness & Accuracy'].defaultDesc,
          },
        ];

  return (
    <div className="bg-surface border border-line rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-lg font-bold text-ink">Overall Parameter-Wise Evaluation Marks</h2>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Aggregate scores awarded across all interview questions, evaluated on standardized engineering parameters.
          </p>
        </div>

        {typeof overallScore === 'number' && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-ink-muted">Overall Aggregate:</span>
            <span className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 font-mono font-bold text-xs text-accent-cyan flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              {overallScore} / 100
            </span>
          </div>
        )}
      </div>

      {/* 3 PARAMETERS + SUMMARY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {parameters.map((param, idx) => {
          const cfg = PARAM_CONFIG[param.name] || {
            gradient: 'from-cyan-500 to-indigo-500',
            text: 'text-accent-cyan',
            bgBadge: 'bg-cyan-500/10',
            borderBadge: 'border-cyan-500/30',
            iconColor: 'text-accent-cyan',
            defaultDesc: 'Standardized evaluation parameter metric.',
          };

          const hasScore = typeof param.score === 'number';
          const pct =
            typeof param.percentage === 'number'
              ? param.percentage
              : hasScore
              ? Math.max(0, Math.min(100, (param.score as number) * 10))
              : 0;

          const badge = getPerformanceBadge(hasScore ? pct : null);

          return (
            <div
              key={param.name || idx}
              className="p-5 rounded-xl bg-inset space-y-3.5 hover:bg-surface-2 transition-all shadow-md group relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted block">
                    Parameter #{idx + 1}
                  </span>
                  <h3 className="font-semibold text-ink text-sm mt-0.5">{param.name}</h3>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-semibold shrink-0 ${badge.color}`}
                >
                  {badge.label}
                </span>
              </div>

              {/* SCORE DISPLAY */}
              <div className="flex items-baseline justify-between pt-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black font-mono tracking-tight ${cfg.text}`}>
                    {hasScore ? param.score : '--'}
                  </span>
                  <span className="text-xs font-mono text-ink-muted">/ {param.max_score || 10} marks</span>
                </div>

                <span className="text-xs font-mono font-bold text-ink">
                  {hasScore ? `${Math.round(pct)}%` : '--'}
                </span>
              </div>

              {/* PROGRESS BAR */}
              <div className="w-full h-2.5 rounded-full bg-surface border border-line overflow-hidden p-0.5">
                {hasScore && (
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>

              {/* BENCHMARK COMPARISON */}
              <div className="flex items-center justify-between text-[11px] font-mono text-ink-muted pt-1">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3 text-ink-muted" /> Target: 7.0+
                </span>
                <span>
                  {hasScore && pct >= 70 ? (
                    <span className="text-accent-emerald flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Met benchmark
                    </span>
                  ) : hasScore ? (
                    <span className="text-accent-amber flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Below target
                    </span>
                  ) : (
                    'Evaluation pending'
                  )}
                </span>
              </div>

              {/* DESCRIPTION */}
              <p className="text-[11px] text-ink-muted leading-relaxed border-t border-line/60 pt-2 font-normal">
                {param.description || cfg.defaultDesc}
              </p>
            </div>
          );
        })}
      </div>

      {/* FOOTER CALLOUT */}
      <div className="p-3.5 rounded-xl bg-cyan-500/5 flex items-center gap-3 relative z-10 text-xs">
        <ShieldCheck className="w-4 h-4 text-accent-cyan shrink-0" />
        <p className="text-ink-muted leading-normal">
          <strong>Parameter Scoring Rigor:</strong> Each answer is independently rated on these 3 criteria (0-10 scale), which directly drive your core competency pillars and executive hiring recommendation.
        </p>
      </div>
    </div>
  );
};