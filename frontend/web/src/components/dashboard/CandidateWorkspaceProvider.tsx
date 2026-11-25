'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchCandidateAptitudeHistory,
  fetchCandidateDashboard,
  fetchCandidateInterviews,
  fetchCandidateInvitations,
  fetchCandidateProfile,
  type AptitudeAttemptHistory,
  type CandidateDashboard,
  type CandidateProfile,
  type InterviewInvitation,
  type InterviewSession,
} from '@/lib/api';

/**
 * One authoritative load for the candidate dashboard.
 *
 * Previously each dashboard section independently fetched the same five
 * endpoints. That produced duplicate derived data, competing loading states,
 * and "no data" copy while requests were still in flight. `apiJson` still
 * deduplicates identical in-flight GETs, but this provider also gives every
 * section the same loading/failure truth and one place to refresh.
 */
interface CandidateWorkspaceValue {
  dashboard: CandidateDashboard | null;
  profile: CandidateProfile | null;
  interviews: InterviewSession[] | null;
  aptitudeAttempts: AptitudeAttemptHistory[] | null;
  invitations: InterviewInvitation[] | null;
  loading: boolean;
  refresh: () => void;
}

const CandidateWorkspaceContext = createContext<CandidateWorkspaceValue | null>(null);

export function CandidateWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [dashboard, setDashboard] = useState<CandidateDashboard | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [interviews, setInterviews] = useState<InterviewSession[] | null>(null);
  const [aptitudeAttempts, setAptitudeAttempts] = useState<AptitudeAttemptHistory[] | null>(null);
  const [invitations, setInvitations] = useState<InterviewInvitation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);

  const load = useCallback(async (isActive: () => boolean) => {
    setLoading(true);
    // All five requests start together. `apiJson` dedupes and caches each GET,
    // so this is the only network fan-out for the whole dashboard.
    const [dashboardResult, profileResult, interviewResult, aptitudeResult, invitationResult] =
      await Promise.all([
        fetchCandidateDashboard(),
        fetchCandidateProfile(),
        fetchCandidateInterviews(),
        fetchCandidateAptitudeHistory(),
        fetchCandidateInvitations(),
      ]);

    if (!isActive()) return;
    setDashboard(dashboardResult);
    setProfile(profileResult);
    setInterviews(interviewResult);
    setAptitudeAttempts(aptitudeResult);
    setInvitations(invitationResult);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load, generation]);

  const value = useMemo<CandidateWorkspaceValue>(
    () => ({
      dashboard,
      profile,
      interviews,
      aptitudeAttempts,
      invitations,
      loading,
      refresh: () => setGeneration((current) => current + 1),
    }),
    [dashboard, profile, interviews, aptitudeAttempts, invitations, loading]
  );

  return <CandidateWorkspaceContext.Provider value={value}>{children}</CandidateWorkspaceContext.Provider>;
}

export function useCandidateWorkspace(): CandidateWorkspaceValue {
  const value = useContext(CandidateWorkspaceContext);
  if (!value) {
    throw new Error('useCandidateWorkspace must be used inside CandidateWorkspaceProvider');
  }
  return value;
}
