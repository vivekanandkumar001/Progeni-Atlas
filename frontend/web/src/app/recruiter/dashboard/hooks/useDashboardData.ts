'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  INITIAL_OVERVIEW,
  type CandidateDossier,
  type DashboardError,
  type JobProfile,
  type OverviewStats,
} from '../dashboard-types';

export function useDashboardData() {
  // STATE MANAGEMENT
  const [overview, setOverview] = useState<OverviewStats>(INITIAL_OVERVIEW);
  const [jobProfiles, setJobProfiles] = useState<JobProfile[]>([]);
  const [candidates, setCandidates] = useState<CandidateDossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dossiers' | 'jobs'>('dossiers');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [error, setError] = useState<DashboardError | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch wallet + dashboard in parallel — never serialize them
      const walletPromise = apiFetch('/api/billing/wallet')
        .then(async (walletRes) => {
          if (walletRes.ok) {
            const wData = await walletRes.json();
            if (wData?.success && wData?.wallet) {
              setWalletBalance(Number(wData.wallet.availableCredits ?? 0));
            }
          }
        })
        .catch(() => {
          // non-fatal wallet balance fallback
        });

      const res = await apiFetch('/api/recruiter/dashboard');
      await walletPromise;
      if (res.ok) {
        const data = await res.json();
        if (data.overview) setOverview(data.overview);
        if (data.jobProfiles) setJobProfiles(data.jobProfiles);
        if (data.candidates) setCandidates(data.candidates);
      } else if (res.status === 401) {
        setJobProfiles([]);
        setCandidates([]);
        if (typeof window !== 'undefined') {
          window.location.href = '/login?error=session_expired&next=' + encodeURIComponent(window.location.pathname);
          return;
        }
      } else if (res.status === 403) {
        setJobProfiles([]);
        setCandidates([]);
        const body = await res.json().catch(() => ({} as Record<string, unknown>));
        const rawErr = String(body.error || body.message || '');
        if (rawErr.toLowerCase().includes('role') || rawErr.toLowerCase().includes('forbidden')) {
          setError({
            title: 'Recruiter Account Required',
            message:
              'You are currently signed in with a Candidate account. The Recruiter Dashboard requires a Recruiter or Administrator account.',
            errorType: 'role_forbidden',
          });
        } else {
          setError({
            title: 'Organization Access Required',
            message:
              rawErr ||
              'Your recruiter account is not linked to an organization yet. Ask an admin to add you to an organization, then retry.',
            errorType: 'org_missing',
          });
        }
      } else {
        setJobProfiles([]);
        setCandidates([]);
        setError({
          title: 'Dashboard Unavailable',
          message: `The recruiter dashboard could not be loaded (HTTP ${res.status}). Please retry.`,
          errorType: 'generic',
        });
      }
    } catch (err) {
      console.warn('Dashboard API connection warning:', err);
      setJobProfiles([]);
      setCandidates([]);
      setError({
        title: 'Backend API Connection Error',
        message: 'Could not reach the recruiter backend API. Please ensure the backend server is running.',
      });
    } finally {
      setLoading(false);
    }
  };

  // FETCH DASHBOARD DATA ON MOUNT & HANDLE DIRECT HASH ROUTING
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: identical mount-time fetch behavior as the original monolithic page (sets loading state, then data)
    fetchDashboard();

    const checkHash = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash === '#rubrics' || hash === '#jobs') {
          setActiveTab('jobs');
        } else if (hash === '#dossiers') {
          setActiveTab('dossiers');
        }
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  return {
    overview,
    jobProfiles,
    setJobProfiles,
    candidates,
    setCandidates,
    loading,
    activeTab,
    setActiveTab,
    error,
    walletBalance,
    isZeroBalance: walletBalance !== null && walletBalance <= 0,
    fetchDashboard,
  };
}
