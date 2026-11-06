'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface StrengthsAndGrowthCardsProps {
  strengths: string[];
  growthAreas: string[];
  /** Renders an inline note when a list is empty, so the absence reads as real. */
  strengthsEmptyNote: string;
  growthEmptyNote: string;
}

const List = ({
  items,
  emptyNote,
  bulletClass
}: {
  items: string[];
  emptyNote: string;
  bulletClass: string;
}) => {
  if (items.length === 0) {
    return <p className="text-xs text-ink-muted leading-relaxed">{emptyNote}</p>;
  }
  return (
    <ul className="space-y-3 text-xs text-ink">
      {items.map((item, idx) => {
        const separator = item.indexOf(':');
        const title = separator > 0 ? item.slice(0, separator) : null;
        const body = separator > 0 ? item.slice(separator + 1).trim() : item;
        return (
          <li key={idx} className="flex items-start gap-2.5">
            <span className={`${bulletClass} font-bold mt-0.5`}>•</span>
            <span className="leading-relaxed">
              {title && <strong className="text-ink font-semibold">{title}:</strong>}
              {body}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export const StrengthsAndGrowthCards: React.FC<StrengthsAndGrowthCardsProps> = ({
  strengths,
  growthAreas,
  strengthsEmptyNote,
  growthEmptyNote
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* LEFT CARD: VERIFIED TECHNICAL STRENGTHS */}
      <div className="md:col-span-1 bg-surface border border-line p-6 rounded-2xl space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <CheckCircle2 className="w-5 h-5 text-accent-emerald shrink-0" />
          <h3 className="text-sm font-bold text-ink">Verified Technical Strengths</h3>
        </div>

        <List items={strengths} emptyNote={strengthsEmptyNote} bulletClass="text-accent-emerald" />
      </div>

      {/* RIGHT CARD: TARGETED GROWTH AREAS */}
      <div className="md:col-span-1 bg-surface border border-line p-6 rounded-2xl space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <AlertTriangle className="w-5 h-5 text-accent-amber shrink-0" />
          <h3 className="text-sm font-bold text-ink">Targeted Growth Areas</h3>
        </div>

        <List items={growthAreas} emptyNote={growthEmptyNote} bulletClass="text-accent-amber" />
      </div>
    </div>
  );
};
