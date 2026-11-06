'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileWarning,
  KeyRound,
  Mail,
  Radio,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pill,
  RefreshButton,
  SearchInput,
  Spinner,
  StatCard,
  StatSkeleton,
  TableSkeleton,
} from '@/components/super-admin/ui';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import { formatDateTime, formatNumber, saFetch } from '@/lib/super-admin';

type PlatformInterviewStats = {
  total: number;
  in_progress: number;
  completed: number;
  scheduled: number;
  cancelled_or_abandoned: number;
};

type InterviewItem = {
  id: string;
  orgId: string | null;
  organizationName: string;
  candidateId: string | null;
  candidateName: string;
  candidateEmail?: string | null;
  recruiterId: string | null;
  status: string;
  sessionType?: string | null;
  mode?: string | null;
  durationMinutes: number;
  jobTitle: string;
  companyName?: string | null;
  proctoringFlags?: number;
  createdAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

type InterviewResponse = {
  success: boolean;
  items?: InterviewItem[];
  total?: number;
  page?: number;
  limit?: number;
  stats?: PlatformInterviewStats;
};

type SessionDetail = {
  id: string;
  orgId: string | null;
  organizationName: string;
  candidateId: string | null;
  candidateName: string;
  candidateEmail?: string | null;
  recruiterId: string | null;
  status: string;
  currentStage?: string | null;
  sessionType?: string | null;
  mode?: string | null;
  jobTitle: string;
  durationMinutes: number;
  overallScore?: number | null;
  proctoringFlags: number;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string | null;
};

const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'rose' | 'cyan' | 'neutral'> = {
  completed: 'emerald',
  in_progress: 'cyan',
  scheduled: 'amber',
  cancelled: 'rose',
  abandoned: 'rose',
};

const PAGE_SIZE = 20;

export default function SuperAdminInterviewsPage() {
  const { supportReason, openSupport, toast } = useSuperAdmin();
  const [items, setItems] = useState<InterviewItem[]>([]);
  const [stats, setStats] = useState<PlatformInterviewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session Detail Drawer / Modal
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionReason, setActionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (appliedSearch.trim()) params.set('q', appliedSearch.trim());
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const body = await saFetch<InterviewResponse>(`/api/super-admin/interviews?${params.toString()}`);
      setItems(Array.isArray(body.items) ? body.items : []);
      setTotal(Number(body.total) || 0);
      if (body.stats) {
        setStats(body.stats);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load interviews.');
    } finally {
      setLoading(false);
    }
  }, [status, appliedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-debounce search query so user does not need to press a Search button
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setAppliedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const openSessionDetail = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setDetailLoading(true);
    setActionReason('');
    try {
      // First attempt query-param which works across all server instances
      const res = await saFetch<{ success: boolean; session: SessionDetail }>(
        `/api/super-admin/interviews?id=${encodeURIComponent(sessionId)}`
      );
      if (res.success && res.session) {
        setSessionDetail(res.session);
        return;
      }
      throw new Error('Interview details not returned.');
    } catch {
      try {
        const fallback = await saFetch<{ success: boolean; session: SessionDetail }>(
          `/api/super-admin/interviews/${encodeURIComponent(sessionId)}`
        );
        if (fallback.success && fallback.session) {
          setSessionDetail(fallback.session);
          return;
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Unable to load interview details.', 'error');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (sessionId: string, nextStatus: 'cancelled' | 'abandoned' | 'completed') => {
    if (!window.confirm(`Are you sure you want to set this session to "${nextStatus}"?`)) return;

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/interviews/${sessionId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: nextStatus,
            reason: actionReason.trim() || `Administrative ${nextStatus} via Super Admin Console`,
          }),
        }
      );
      toast(res.message || `Session status updated to ${nextStatus}.`, 'success');
      await load();
      if (selectedSessionId === sessionId) {
        await openSessionDetail(sessionId);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update session status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs & Interview Oversight"
        description="Platform-wide interview sessions, candidate identities, and live telemetry across tenants. Super Admin joins a live room only with a recorded operational justification."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      {/* Top Metric Overview StatCards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading && !stats ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Interviews"
              value={formatNumber(stats?.total ?? total)}
              hint="Platform-wide recorded sessions"
              tone="cyan"
              icon={Video}
            />
            <StatCard
              label="Live In-Progress"
              value={formatNumber(stats?.in_progress ?? 0)}
              hint="Candidate & AI active in room"
              tone="cyan"
              icon={Activity}
            />
            <StatCard
              label="Completed"
              value={formatNumber(stats?.completed ?? 0)}
              hint="Finished evaluation & scorecards generated"
              tone="emerald"
              icon={CheckCircle2}
            />
            <StatCard
              label="Cancelled / Abandoned"
              value={formatNumber(stats?.cancelled_or_abandoned ?? 0)}
              hint="Terminated or timeout sessions"
              tone="amber"
              icon={AlertTriangle}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader
          title="Interview Sessions"
          subtitle="Real-time session oversight, candidate resolution, and proctoring flags"
          icon={Video}
          action={
            <div className="flex items-center gap-2">
              <Pill tone="neutral">{formatNumber(total)} total</Pill>
            </div>
          }
        />

        {/* Search & Filter Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by candidate name, email, job title, or session ID…"
            className="min-w-[280px] flex-1"
          />

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
          >
            <option value="all">All statuses</option>
            <option value="in_progress">In progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="abandoned">Abandoned</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="pb-2 pr-4 font-bold">Session</th>
                <th className="pb-2 pr-4 font-bold">Candidate</th>
                <th className="pb-2 pr-4 font-bold">Organization</th>
                <th className="pb-2 pr-4 font-bold">Status</th>
                <th className="pb-2 pr-4 font-bold">Proctoring</th>
                <th className="pb-2 pr-4 font-bold">Job / Mode</th>
                <th className="pb-2 font-bold">Created</th>
                <th className="pb-2 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <TableSkeleton rows={8} cols={8} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No interviews found"
                      hint="Adjust the search term or status filter to see more."
                      icon={Video}
                    />
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const key = String(it.status || '').toLowerCase();
                  const isLive = key === 'in_progress';
                  const flags = Number(it.proctoringFlags || 0);

                  return (
                    <tr
                      key={it.id}
                      onClick={() => openSessionDetail(it.id)}
                      className="group cursor-pointer border-t border-line/60 align-middle transition-colors hover:bg-surface-2/70"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-ink-muted">
                        <span className="flex items-center gap-1.5">
                          {isLive && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
                            </span>
                          )}
                          {it.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-ink truncate">{it.candidateName}</p>
                          {it.candidateEmail && (
                            <p className="font-mono text-[11px] text-ink-muted truncate">{it.candidateEmail}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs font-medium text-ink">
                        {it.organizationName || it.companyName || (it.orgId ? it.orgId.slice(0, 8) : 'Direct')}
                      </td>
                      <td className="py-3 pr-4">
                        {it.status ? (
                          <Pill tone={STATUS_TONE[key] || 'neutral'}>
                            {it.status.replace(/_/g, ' ')}
                          </Pill>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {flags > 0 ? (
                          <Pill tone="rose">
                            <span className="text-[11px] font-bold">⚠️ {flags} flag{flags > 1 ? 's' : ''}</span>
                          </Pill>
                        ) : (
                          <span className="text-[11px] text-emerald-500 font-mono font-medium">Clean</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink">
                        <p className="truncate font-semibold">{it.jobTitle || 'Technical Screening'}</p>
                        <p className="text-[10px] text-ink-faint uppercase tracking-wider">
                          {[it.sessionType, it.mode].filter(Boolean).join(' • ') || 'Live AI'}
                        </p>
                      </td>
                      <td className="py-3 text-xs text-ink-faint">{formatDateTime(it.createdAt)}</td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSessionDetail(it.id);
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink hover:border-cyan-500/40 hover:text-accent-cyan"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3 text-xs text-ink-muted">
            <p>
              Showing{' '}
              <span className="font-semibold text-ink">
                {Math.min((page - 1) * PAGE_SIZE + 1, total)}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-ink">
                {Math.min(page * PAGE_SIZE, total)}
              </span>{' '}
              of <span className="font-semibold text-ink">{total}</span> sessions
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink hover:border-cyan-500/40 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="px-2 font-mono text-[11px]">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink hover:border-cyan-500/40 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Exceptional Access" subtitle="When Super Admin may touch a live session" icon={ShieldAlert} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li>• Joining a live interview requires an explicit, active privileged support reason.</li>
            <li>• Viewer tokens maintain read-only observation to preserve exam validity.</li>
            <li>• Every exceptional join is written to the immutable tamper-resistant audit trail.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Session Recovery Runbook" subtitle="Handling failed, disconnected or stuck sessions" icon={FileWarning} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li>• Stuck in-progress sessions with candidate disconnects can be marked Abandoned.</li>
            <li>• Sessions corrupted by network partition can be Cancelled to free reserved seat quotas.</li>
            <li>• All status overrides require administrative justification.</li>
          </ul>
        </Card>
      </div>

      {/* Session Detail Drawer / Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-accent-cyan" />
                <div>
                  <h3 className="text-base font-bold text-ink">Interview Session Dossier</h3>
                  <p className="font-mono text-[11px] text-ink-muted">{selectedSessionId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetail(null);
                }}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailLoading || !sessionDetail ? (
              <div className="py-12 flex justify-center">
                <Spinner label="Loading session telemetry..." />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2 p-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Organization</span>
                    <p className="font-semibold text-ink mt-0.5">
                      {sessionDetail.orgId ? (
                        <Link
                          href={`/super-admin/organizations/${sessionDetail.orgId}`}
                          className="hover:text-accent-cyan hover:underline inline-flex items-center gap-1"
                        >
                          {sessionDetail.organizationName}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        sessionDetail.organizationName
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Job Title</span>
                    <p className="font-semibold text-ink mt-0.5">{sessionDetail.jobTitle}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Candidate</span>
                    <p className="font-semibold text-ink mt-0.5">{sessionDetail.candidateName}</p>
                    <p className="text-[11px] text-ink-muted">{sessionDetail.candidateEmail || 'No email'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ink-faint">Status</span>
                    <div className="mt-1">
                      <Pill tone={STATUS_TONE[sessionDetail.status.toLowerCase()] || 'neutral'}>
                        {sessionDetail.status.replace(/_/g, ' ')}
                      </Pill>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-line bg-inset p-2.5">
                    <span className="text-[10px] text-ink-faint block">Duration</span>
                    <span className="font-mono font-bold text-ink">{sessionDetail.durationMinutes} min</span>
                  </div>
                  <div className="rounded-xl border border-line bg-inset p-2.5">
                    <span className="text-[10px] text-ink-faint block">Overall Score</span>
                    <span className="font-mono font-bold text-accent-cyan">
                      {sessionDetail.overallScore != null ? `${sessionDetail.overallScore}%` : '—'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-line bg-inset p-2.5">
                    <span className="text-[10px] text-ink-faint block">Proctoring Flags</span>
                    <span className={`font-mono font-bold ${sessionDetail.proctoringFlags > 0 ? 'text-accent-rose' : 'text-accent-emerald'}`}>
                      {sessionDetail.proctoringFlags > 0 ? `⚠️ ${sessionDetail.proctoringFlags}` : '0 Clean'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-ink-muted rounded-xl border border-line p-3 bg-surface-2">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatDateTime(sessionDetail.createdAt)}</span>
                  </div>
                  {sessionDetail.startedAt && (
                    <div className="flex justify-between">
                      <span>Started:</span>
                      <span>{formatDateTime(sessionDetail.startedAt)}</span>
                    </div>
                  )}
                  {sessionDetail.endedAt && (
                    <div className="flex justify-between">
                      <span>Ended:</span>
                      <span>{formatDateTime(sessionDetail.endedAt)}</span>
                    </div>
                  )}
                </div>

                {/* Emergency Live Room Observation (Governed by Support Reason) */}
                {sessionDetail.status === 'in_progress' && (
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-accent-cyan animate-pulse" />
                        <div>
                          <p className="text-xs font-bold text-ink">Active Live Session</p>
                          <p className="text-[10px] text-ink-muted">Read-only emergency observation room</p>
                        </div>
                      </div>
                      {supportReason ? (
                        <a
                          href={`/candidate/interview/${sessionDetail.id}/room`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-accent-cyan hover:bg-cyan-500/30"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Join Viewer Room
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openSupport()}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-accent-amber hover:bg-amber-500/20"
                        >
                          <KeyRound className="h-3 w-3" />
                          Grant Required
                        </button>
                      )}
                    </div>
                    {!supportReason && (
                      <p className="mt-2 text-[10px] text-accent-amber">
                        Privileged Support Grant required before observing a live technical interview.
                      </p>
                    )}
                  </div>
                )}

                {/* Administrative Recovery Controls */}
                <div className="pt-2 border-t border-line">
                  <h4 className="text-xs font-bold text-ink mb-1">Administrative Session Control</h4>
                  <p className="text-[10px] text-ink-muted mb-2">Override stuck or disconnected sessions with audit logging.</p>
                  <div>
                    <input
                      type="text"
                      placeholder="Operational justification for audit trail (required)..."
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none mb-3"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sessionDetail.status !== 'cancelled' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(sessionDetail.id, 'cancelled')}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-accent-rose hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        Cancel Session
                      </button>
                    )}
                    {sessionDetail.status !== 'abandoned' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(sessionDetail.id, 'abandoned')}
                        className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-accent-amber hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        Mark Abandoned
                      </button>
                    )}
                    {sessionDetail.status !== 'completed' && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleUpdateStatus(sessionDetail.id, 'completed')}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-accent-emerald hover:bg-emerald-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
