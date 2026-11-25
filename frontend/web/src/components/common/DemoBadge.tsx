import React from 'react';
import { formatDemoLabel } from '@/lib/formatters';

interface DemoBadgeProps {
  demoNumber?: number | string | null;
  compact?: boolean;
}

/**
 * Visible label for seeded/demo sessions. Demo data must never be mistaken
 * for a verified recruiter assessment in candidate-facing lists or reports.
 */
export const DemoBadge: React.FC<DemoBadgeProps> = ({ demoNumber, compact = false }) => (
  <span
    className={`inline-flex items-center rounded-full border border-accent-amber/35 bg-accent-amber/10 font-semibold text-accent-amber ${
      compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
    }`}
    title="Seeded demo session — not a verified recruiter assessment"
  >
    {formatDemoLabel(demoNumber)}
  </span>
);
