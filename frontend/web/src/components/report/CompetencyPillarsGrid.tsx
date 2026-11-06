'use client';

import React from 'react';
import { Cpu } from 'lucide-react';
import type { ScorecardCompetency } from '@/lib/api';

interface CompetencyPillarsGridProps {
  competencies: ScorecardCompetency[];
}

const GRADIENTS = [
  'from-cyan-500 to-indigo-400',
  'from-emerald-500 to-cyan-400',
  'from-indigo-500 to-purple-400',
  'from-sky-400 to-cyan-400',
  'from-amber-500 to-orange-400'
];
const TEXT = [
  'text-accent-cyan',
  'text-accent-emerald',
  'text-accent-indigo',
  'text-sky-400',
  'text-accent-amber'
];

/**
 * The evaluator chooses its own competency names (they are LLM free text, not a
 * fixed set of four pillars), so the grid renders whatever the scorecard
 * actually stored, along with the real evidence and evaluator comment. The
 * previous version forced four fixed pillars with `|| 88` style fallbacks.
 */
export const CompetencyPillarsGrid: React.FC<CompetencyPillarsGridProps> = ({ competencies }) => {
  if (competencies.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-surface border border-line text-center space-y-1">
        <p className="text-sm text-ink">No competency breakdown available</p>
        <p className="text-xs text-ink-muted">
          Competencies are produced once a scorecard is generated for this session.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {competencies.map((item, idx) => {
        const hasScore = typeof item.score === 'number';
        const pct = hasScore ? Math.max(0, Math.min(100, item.score as number)) : 0;
        return (
          <div
            key={`${item.competency}-${idx}`}
            className="p-5 rounded-2xl bg-surface border border-line space-y-3 backdrop-blur-md hover:border-line-strong transition-all shadow-lg"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Cpu className={`w-4 h-4 shrink-0 ${TEXT[idx % TEXT.length]}`} />
                <span className="text-xs font-semibold text-ink truncate">{item.competency}</span>
              </div>
              <span className={`font-mono font-bold text-sm shrink-0 ${TEXT[idx % TEXT.length]}`}>
                {hasScore ? `${item.score}%` : '--'}
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full bg-inset border border-line overflow-hidden p-0.5">
              {hasScore && (
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${GRADIENTS[idx % GRADIENTS.length]} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>

            {typeof item.weight === 'number' && (
              <p className="text-[11px] font-mono text-ink-muted">Weight: {item.weight}</p>
            )}

            {item.evidence ? (
              <p className="text-[11px] text-ink-muted leading-relaxed font-normal">{item.evidence}</p>
            ) : item.evaluator_comment ? (
              <p className="text-[11px] text-ink-muted leading-relaxed font-normal">
                {item.evaluator_comment}
              </p>
            ) : (
              <p className="text-[11px] text-ink-faint">No commentary recorded for this competency.</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
