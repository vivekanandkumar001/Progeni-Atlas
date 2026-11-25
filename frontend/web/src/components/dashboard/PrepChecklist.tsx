'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Upload, Brain, Play, Video } from 'lucide-react';
import { candidateDemoQuota } from '@/lib/api';
import { useCandidateWorkspace } from './CandidateWorkspaceProvider';

/**
 * State-driven prep checklist — items flip green as the candidate
 * progresses. No hardcoded values; everything derives from the shared
 * workspace load.
 */
export const PrepChecklist: React.FC = () => {
  const { dashboard, aptitudeAttempts, interviews, loading } = useCandidateWorkspace();
  const failed =
    !loading && (dashboard === null || aptitudeAttempts === null || interviews === null);

  const hasResume = Boolean(dashboard?.has_resume || dashboard?.resume_status === 'PARSED');
  const skillCount = dashboard?.skill_count ?? 0;
  const aptCompleted = (aptitudeAttempts ?? []).filter((x) => x.status === 'completed').length;
  const scoredInterviews = (interviews ?? []).filter(
    (x) => String(x.status || '').toLowerCase() === 'completed'
  ).length;
  const demoQuota = candidateDemoQuota(dashboard);
  const demosUsed = demoQuota?.used ?? 0;

  const steps = useMemo(
    () => [
      { icon: Upload, label: 'Upload & parse resume', hint: 'Skills auto-tagged from your file', done: hasResume, href: '/candidate/profile' },
      { icon: Brain, label: 'Build 3+ tagged skills', hint: 'Recruiters search by these', done: skillCount >= 3, href: '/candidate/skills' },
      { icon: Brain, label: 'Complete aptitude baseline', hint: '15–30 min AMCAT-style assessment', done: aptCompleted >= 1, href: '/candidate/aptitude' },
      { icon: Play, label: 'Complete 1 practice interview', hint: '10 min, scored live', done: demosUsed >= 1, href: '/candidate/practice' },
      { icon: Video, label: 'Finish 1 scored interview', hint: 'Review your score and readiness in Reports', done: scoredInterviews >= 1, href: '/candidate/reports?tab=interviews' },
    ],
    [hasResume, skillCount, aptCompleted, demosUsed, scoredInterviews],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="kicker">Your checklist</h3>
        <span className="text-[11px] text-ink-muted font-mono" aria-live="polite">
          {loading ? '—' : failed ? 'Unavailable' : `${doneCount}/${steps.length} · ${pct}%`}
        </span>
      </div>

      {/* Progress hairline — neutral while the underlying APIs are loading */}
      <div
        className="h-[2px] w-full rounded-full bg-inset overflow-hidden"
        role="progressbar"
        aria-label="Checklist progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={loading || failed ? undefined : pct}
      >
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-700"
          style={{ width: `${loading || failed ? 0 : pct}%` }}
        />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading checklist">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3 py-2 animate-pulse">
              <div className="h-4 w-4 rounded-full bg-surface-3 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/5 rounded bg-surface-3" />
                <div className="h-2.5 w-3/5 rounded bg-surface-3/70" />
              </div>
            </div>
          ))}
          <span className="sr-only">Loading checklist…</span>
        </div>
      ) : failed ? (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink-muted">
          Your checklist could not be loaded. Refresh the page to try again.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line/70">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li key={step.label}>
                <Link href={step.href} className="flex items-start gap-3 py-2.5 hover:bg-surface-2/50 transition-colors -mx-2 px-2 rounded-md group">
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-ink-faint shrink-0 mt-0.5 group-hover:text-accent-cyan transition-colors" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-snug ${step.done ? 'text-ink-muted line-through decoration-ink-faint' : 'text-ink'}`}>
                      {step.label}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5 truncate">{step.hint}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
