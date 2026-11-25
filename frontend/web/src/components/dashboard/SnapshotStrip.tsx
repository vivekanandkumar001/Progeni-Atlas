'use client';

import React from 'react';
import { Skeleton } from '@/components/ui';
import { useCandidateWorkspace } from './CandidateWorkspaceProvider';

/**
 * Dense 6-up stat rail. Real numbers only, hairline-separated, no boxes.
 * Every value comes from the shared workspace load — no section-level fetches.
 */
export const SnapshotStrip: React.FC = () => {
  const { dashboard, interviews, aptitudeAttempts, loading } = useCandidateWorkspace();

  const failed =
    !loading && (dashboard === null || interviews === null || aptitudeAttempts === null);

  const interviewsDone = (interviews ?? []).filter(
    (s) => String(s.status || '').toLowerCase() === 'completed'
  ).length;
  const aptCompleted = (aptitudeAttempts ?? []).filter((a) => a.status === 'completed');
  const aptBest = aptCompleted.reduce<number | null>(
    (acc, a) => (acc === null || a.score > acc ? a.score : acc),
    null
  );
  const aptAvg =
    aptCompleted.length > 0
      ? Math.round(aptCompleted.reduce((sum, a) => sum + a.accuracy, 0) / aptCompleted.length)
      : null;
  const skillCount = dashboard?.skill_count ?? 0;
  const readinessScore = dashboard?.candidate?.readinessScore;
  const hasReadinessScore = typeof readinessScore === 'number' && Number.isFinite(readinessScore);

  if (failed) {
    return (
      <div className="card-panel px-4 sm:px-5 py-4 text-xs text-ink-muted">
        Your snapshot could not be loaded. Refresh the page to retry.
      </div>
    );
  }

  const stats = [
    { label: 'Interviews done', value: interviewsDone, sub: 'Total scored sessions' },
    { label: 'Aptitude attempts', value: aptCompleted.length, sub: '5-pillar assessments' },
    {
      label: 'Best aptitude',
      value: aptBest != null ? `${aptBest}%` : '—',
      sub: aptBest != null ? 'vs 60% benchmark' : 'No completed attempts yet',
    },
    {
      label: 'Avg APT accuracy',
      value: aptAvg != null ? `${aptAvg}%` : '—',
      sub: aptAvg != null ? 'Correct / attempted' : 'No completed attempts yet',
    },
    {
      label: 'Skills on file',
      value: skillCount,
      sub: dashboard?.has_resume ? 'Resume parsed' : 'No resume on file',
    },
    {
      label: 'Readiness score',
      value: hasReadinessScore ? `${readinessScore}` : '—',
      sub: hasReadinessScore ? 'Score of record' : 'Not available yet',
    },
  ];

  return (
    <div className="card-panel grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-line overflow-hidden">
      {stats.map((stat) => (
        <div key={stat.label} className="px-4 sm:px-5 py-4 min-w-0">
          <p className="kicker truncate">{stat.label}</p>
          {loading ? (
            <>
              <Skeleton className="mt-2 h-7 w-14" />
              <Skeleton className="mt-2 h-2.5 w-24" />
            </>
          ) : (
            <>
              <p className="mt-1.5 kpi-value">{stat.value}</p>
              <p className="mt-1.5 text-[10px] text-ink-faint leading-tight truncate">{stat.sub}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
