'use client';

import React, { useEffect, useState } from 'react';
import {
  fetchCandidateDashboard,
  fetchCandidateInterviews,
  fetchCandidateAptitudeHistory,
  type CandidateDashboard,
  type InterviewSession,
  type AptitudeAttemptHistory,
} from '@/lib/api';

/**
 * Dense 6-up stat rail. Real numbers only, hairline-separated, no boxes.
 */
export const SnapshotStrip: React.FC = () => {
  const [dashboard, setDashboard] = useState<CandidateDashboard | null>(null);
  const [interviews, setInterviews] = useState<InterviewSession[] | null>(null);
  const [apt, setApt] = useState<AptitudeAttemptHistory[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, i, a] = await Promise.all([
        fetchCandidateDashboard(),
        fetchCandidateInterviews(),
        fetchCandidateAptitudeHistory(),
      ]);
      if (cancelled) return;
      setDashboard(d);
      setInterviews(Array.isArray(i) ? i : []);
      setApt(Array.isArray(a) ? a : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const interviewsDone = (interviews ?? []).filter((s) => String(s.status || '').toLowerCase() === 'completed').length;
  const aptCompleted = (apt ?? []).filter((a) => a.status === 'completed');
  const aptBest = aptCompleted.reduce<number | null>((acc, a) => (acc === null || a.score > acc ? a.score : acc), null);
  const aptAvg =
    aptCompleted.length > 0 ? Math.round(aptCompleted.reduce((sum, a) => sum + a.accuracy, 0) / aptCompleted.length) : null;
  const skillCount = dashboard?.skill_count ?? 0;

  const stats = [
    { label: 'Interviews done', value: interviews === null ? '…' : interviewsDone, sub: 'Total scored sessions' },
    { label: 'Aptitude attempts', value: apt === null ? '…' : aptCompleted.length, sub: '5-pillar assessments' },
    { label: 'Best aptitude', value: aptBest != null ? `${aptBest}%` : '—', sub: 'vs 60% benchmark' },
    { label: 'Avg APT accuracy', value: aptAvg != null ? `${aptAvg}%` : '—', sub: 'Correct / attempted' },
    { label: 'Skills on file', value: dashboard === null ? '…' : skillCount, sub: dashboard?.has_resume ? 'Resume parsed' : 'No resume yet' },
    { label: 'Readiness score', value: '—', sub: 'Unlocks after 1st interview' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-line border-y border-line">
      {stats.map((stat) => (
        <div key={stat.label} className="px-4 sm:px-5 py-4 first:pl-0 sm:first:pl-5 last:pr-0">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-ink-faint truncate">{stat.label}</p>
          <p className="mt-1 text-2xl font-extrabold text-ink tabular-nums leading-none">{stat.value}</p>
          <p className="mt-1 text-[10px] text-ink-faint leading-tight truncate">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
};
