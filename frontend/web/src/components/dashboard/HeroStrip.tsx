'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, Zap, Lock, CheckCircle2, X, Play, Flame } from 'lucide-react';
import {
  candidateDemoQuota,
  fetchCandidateDashboard,
  fetchCandidateProfile,
  type CandidateDashboard,
  type CandidateProfile,
} from '@/lib/api';
import { LOADING_RESUME_STATUS } from '@/constants/ui_strings';

const MILESTONES = [
  { key: 'resume', label: 'Resume' },
  { key: 'skills', label: 'Skills' },
  { key: 'profile', label: 'Profile' },
  { key: 'demo', label: 'Demo interview' },
  { key: 'scored', label: 'Scored interview' },
];

/**
 * Flat hero strip. No border, no card — dense type, inline meta,
 * real candidate progress track.
 */
export const HeroStrip: React.FC = () => {
  const [dashboard, setDashboard] = useState<CandidateDashboard | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [summary, record] = await Promise.all([fetchCandidateDashboard(), fetchCandidateProfile()]);
      if (cancelled) return;
      setDashboard(summary);
      setProfile(record);
      setLoading(false);
    })();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('interview_completed') === 'true') setJustCompleted(true);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] ||
    profile?.fullName?.trim().split(/\s+/)[0] ||
    (dashboard?.candidate?.name && dashboard.candidate.name !== 'Candidate'
      ? dashboard.candidate.name.trim().split(/\s+/)[0]
      : undefined);

  const hasResume = Boolean(dashboard?.has_resume || profile?.resume);
  const skillCount = dashboard?.skill_count ?? 0;
  const demoQuota = candidateDemoQuota(dashboard);
  const demosLeft = demoQuota?.remaining ?? 0;
  const demoTotal = demoQuota?.total ?? 0;
  const recentInterviews = dashboard?.recent_interviews ?? [];
  const readinessScore = dashboard?.candidate?.readinessScore;
  const hasReadinessScore = typeof readinessScore === 'number' && Number.isFinite(readinessScore);

  const hasProfileDetails = Boolean(
    profile?.course || profile?.academic_year || profile?.academicYear || profile?.headline,
  );
  const hasDemoCompleted =
    (demoQuota?.used ?? 0) > 0 || recentInterviews.some((s) => Boolean(s.isDemo));
  const hasScoredCompleted =
    hasReadinessScore ||
    recentInterviews.some((s) => typeof s.total_score === 'number' && Number.isFinite(s.total_score));

  const eyebrowLabel =
    [profile?.course, profile?.academic_year || profile?.academicYear].filter(Boolean).join(' · ') ||
    dashboard?.candidate?.academicTag?.trim() ||
    'Candidate Workspace';

  const resumeLabel =
    dashboard === null && profile === null
      ? 'Resume status unavailable'
      : !hasResume
        ? 'No resume on file'
        : dashboard?.resume_status === 'PARSED' || profile?.resume
          ? 'Resume verified'
          : 'Resume on file';

  return (
    <div className="space-y-5">
      {justCompleted && (
        <div className="flex items-center justify-between gap-3 border-l-2 border-emerald-500 pl-3 py-1 text-xs text-accent-emerald">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Interview submitted — the recruiter team will review your recording and scorecard.
          </span>
          <button
            type="button"
            onClick={() => setJustCompleted(false)}
            className="p-1 rounded hover:bg-accent-emerald/20 cursor-pointer transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-mono font-semibold text-ink-faint uppercase tracking-[0.16em] flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent-cyan" />
            {loading ? 'Candidate Workspace' : eyebrowLabel}
          </p>
          <h1 className="mt-1.5 text-2xl sm:text-[26px] font-bold text-ink tracking-tight leading-tight">
            {loading
              ? 'Loading your dashboard…'
              : firstName
                ? `Welcome back, ${firstName}`
                : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted max-w-lg leading-relaxed">
            Two tracks, one goal. Close the gap one interview at a time — and make every score count.
          </p>

          {/* Prep milestone track — flat stepper */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
            {MILESTONES.map((m, i) => {
              const done =
                (m.key === 'resume' && hasResume) ||
                (m.key === 'skills' && skillCount > 0) ||
                (m.key === 'profile' && hasProfileDetails) ||
                (m.key === 'demo' && hasDemoCompleted) ||
                (m.key === 'scored' && hasScoredCompleted);
              return (
                <React.Fragment key={m.key}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold border transition-colors ${
                      done ? 'bg-emerald-500/10 text-accent-emerald border-emerald-500/30' : 'bg-surface text-ink-muted border-line-strong'
                    }`}
                  >
                    {done && <CheckCircle2 className="w-3 h-3" />}
                    {m.label}
                  </span>
                  {i < MILESTONES.length - 1 && <span className="text-ink-faint">/</span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          {demoTotal > 0 && (
            <span className="text-[11px] font-mono text-accent-cyan flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              {demosLeft} of {demoTotal} free demos left
            </span>
          )}
          <Link
            href="/candidate/practice"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-xs font-bold text-on-brand btn-primary-gradient transition-all cursor-pointer whitespace-nowrap shadow-[0_10px_28px_-10px_var(--brand-glow)]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {dashboard === null
              ? 'Choose an interview'
              : demosLeft > 0
                ? 'Start free demo interview'
                : 'Start practice interview'}
          </Link>
          <div className="flex items-center gap-3 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-accent-emerald" />
              {loading ? LOADING_RESUME_STATUS : resumeLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent-indigo" />
              {dashboard === null ? '…' : `${skillCount} skills`}
            </span>
            <span className="flex items-center gap-1.5">
              {hasReadinessScore ? (
                <Award className="w-3.5 h-3.5 text-accent-emerald" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              {loading
                ? 'Readiness calculating…'
                : hasReadinessScore
                  ? `Readiness ${readinessScore}`
                  : 'Readiness unavailable'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
