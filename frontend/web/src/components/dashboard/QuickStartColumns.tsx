'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Video, Brain, Calendar, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui';
import type { InterviewSession } from '@/lib/api';
import { useCandidateWorkspace } from './CandidateWorkspaceProvider';

function isUpcoming(s: InterviewSession): boolean {
  const status = String(s.status || '').toLowerCase();
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return false;
  return true;
}

/**
 * Two equal-weight lanes side by side: AI Interview on the left, Aptitude on
 * the right. Same width, same density, same visual priority — the candidate
 * picks what needs work. Data comes from the shared workspace load.
 */
export const QuickStartColumns: React.FC = () => {
  const { dashboard, invitations, aptitudeAttempts, loading } = useCandidateWorkspace();

  const nextInterview = useMemo(
    () => (dashboard?.upcoming_interviews ?? []).filter(isUpcoming)[0] ?? null,
    [dashboard]
  );
  const invitation = useMemo(
    () => (nextInterview ? invitations?.find((inv) => inv.session_id === nextInterview.id) : undefined),
    [invitations, nextInterview]
  );
  const aptAttempts = useMemo(
    () => (aptitudeAttempts ?? []).filter((a) => a.status === 'completed'),
    [aptitudeAttempts]
  );

  const interviewFailed = !loading && dashboard === null;
  const aptitudeFailed = !loading && aptitudeAttempts === null;

  const interviewMeta = nextInterview?.scheduled_at
    ? [new Date(nextInterview.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        (nextInterview.scheduled_at.includes('T') ? ` · ${new Date(nextInterview.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''),
        nextInterview.duration_minutes ? `${nextInterview.duration_minutes} min` : null,
      ].filter(Boolean).join(' · ')
    : null;

  const interviewTitle = invitation?.job_title || nextInterview?.session_type || 'AI Technical Interview';
  const aptBest = aptAttempts.reduce<number | null>((acc, a) => (acc === null || a.score > acc ? a.score : acc), null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ---- AI Interview lane ---- */}
      <div className="card-panel-hover p-5 flex flex-col gap-3 min-h-[148px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-faint">
            <Video className="w-4 h-4 text-accent-cyan" />
            AI Interview
          </h3>
          <Link href="/candidate/interviews" className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink-muted hover:text-accent-cyan transition-colors">
            All sessions
          </Link>
        </div>

        {loading ? (
          <div aria-hidden="true" className="space-y-2.5 pt-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-56" />
            <Skeleton className="h-9 w-40 rounded-lg mt-1" />
          </div>
        ) : interviewFailed ? (
          <p className="text-sm text-ink-muted leading-relaxed">
            Upcoming interviews could not be loaded. Refresh the page to try again.
          </p>
        ) : nextInterview ? (
          <div className="space-y-2">
            <p className="text-base font-bold text-ink leading-snug">{interviewTitle}</p>
            <p className="text-xs text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{interviewMeta}</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Scheduled</span>
            </p>
            <Link
              href={`/candidate/interview/${nextInterview.id}/lobby`}
              className="inline-flex items-center gap-1.5 mt-1 text-xs font-bold btn-primary-gradient text-on-brand px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              Enter interview lobby
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted leading-relaxed">
              No sessions scheduled yet. Recruiters send invites here — or run a practice loop now.
            </p>
            <Link
              href="/candidate/practice"
              className="inline-flex items-center gap-1.5 text-xs font-bold btn-primary-gradient text-on-brand px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              Practice the interview loop
            </Link>
          </div>
        )}
      </div>

      {/* ---- Aptitude lane ---- */}
      <div className="card-panel-hover p-5 flex flex-col gap-3 min-h-[148px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-faint">
            <Brain className="w-4 h-4 text-accent-violet" />
            Aptitude
          </h3>
          <Link href="/candidate/aptitude" className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink-muted hover:text-accent-violet transition-colors">
            Aptitude arena
          </Link>
        </div>

        {loading ? (
          <div aria-hidden="true" className="space-y-2.5 pt-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-60" />
            <Skeleton className="h-9 w-44 rounded-lg mt-1" />
          </div>
        ) : aptitudeFailed ? (
          <p className="text-sm text-ink-muted leading-relaxed">
            Aptitude attempts could not be loaded. Refresh the page to try again.
          </p>
        ) : aptAttempts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-base font-bold text-ink leading-snug">
              {aptAttempts.length} attempt{aptAttempts.length === 1 ? '' : 's'} · best {aptBest}%
            </p>
            <p className="text-xs text-ink-muted font-mono">AMCAT-style · 5 pillars · section-wise percentiles</p>
            <Link
              href="/candidate/aptitude"
              className="inline-flex items-center gap-1.5 mt-1 text-xs font-bold btn-primary-gradient text-on-brand px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              Keep climbing — retake
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-ink-muted leading-relaxed">
              No attempts yet. Recruiters shortlist on sectional percentiles — take a 15-minute baseline.
            </p>
            <Link
              href="/candidate/aptitude"
              className="inline-flex items-center gap-1.5 text-xs font-bold btn-primary-gradient text-on-brand px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              Take your aptitude baseline
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
