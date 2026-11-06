'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CompletionBar,
  EmptyState,
  ErrorBanner,
  PageHeader,
  RefreshButton,
  StatCard,
  StatSkeleton,
  TableSkeleton,
} from '@/components/super-admin/ui';
import {
  formatDateTime,
  formatNumber,
  saFetch,
  type AuditLogItem,
  type Overview,
  type SystemHealth,
} from '@/lib/super-admin';

type AuditResponse = { success: boolean; logs?: AuditLogItem[]; items?: AuditLogItem[] };

export default function SuperAdminOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ov, sh, al] = await Promise.allSettled([
      saFetch<Overview>('/api/super-admin/overview'),
      saFetch<SystemHealth>('/api/super-admin/system-health'),
      saFetch<AuditResponse>('/api/super-admin/audit-logs?limit=8'),
    ]);
    if (ov.status === 'fulfilled') setOverview(ov.value);
    if (sh.status === 'fulfilled') setHealth(sh.value);
    if (al.status === 'fulfilled') setAudit(al.value.logs || al.value.items || []);
    if (ov.status === 'rejected') {
      setError(ov.reason instanceof Error ? ov.reason.message : 'Unable to load platform overview.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = overview?.stats;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Live, honest platform aggregates. Nothing here is seeded or estimated — values come straight from the database."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              label="Organizations"
              value={formatNumber(stats?.organizations)}
              icon={Building2}
              tone="cyan"
              hint="Active tenants on the platform"
              href="/super-admin/organizations"
            />
            <StatCard
              label="Candidates"
              value={formatNumber(stats?.candidates)}
              icon={Users}
              tone="violet"
              hint="Registered candidate accounts"
              href="/super-admin/users?role=candidate"
            />
            <StatCard
              label="Interview Sessions"
              value={formatNumber(stats?.interviews)}
              icon={Video}
              tone="emerald"
              hint="All-time sessions across tenants"
              href="/super-admin/interviews"
            />
            <StatCard
              label="Services Online"
              value={health ? `${health.operationalCount}/${health.totalCount}` : '—'}
              icon={Activity}
              tone={health && health.overall === 'operational' ? 'emerald' : 'amber'}
              hint={health ? `Overall: ${health.overall}` : 'Checking dependencies…'}
              href="/super-admin/system-health"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Organizations */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Organization activity"
            subtitle="Per-tenant candidate and interview load with completion rate"
            icon={Building2}
            action={
              <Link
                href="/super-admin/organizations"
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-3"
              >
                Manage <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="pb-2 pr-4 font-bold">Organization</th>
                  <th className="pb-2 pr-4 font-bold">Candidates</th>
                  <th className="pb-2 pr-4 font-bold">Interviews</th>
                  <th className="pb-2 font-bold">Completion</th>
                </tr>
              </thead>
              <tbody>
                {loading && !overview ? (
                  <TableSkeleton rows={5} cols={4} />
                ) : (overview?.organizations?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState title="No organizations yet" hint="Tenants will appear here once they are provisioned." />
                    </td>
                  </tr>
                ) : (
                  overview!.organizations.map((org) => (
                    <tr
                      key={org.id}
                      onClick={() => router.push(`/super-admin/organizations/${org.id}`)}
                      className="group cursor-pointer border-t border-line/60 transition-colors hover:bg-surface-2/70"
                    >
                      <td className="py-3 pr-4 font-medium text-ink flex items-center justify-between">
                        <span>{org.name}</span>
                        <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100 text-accent-cyan" />
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-ink-muted">{formatNumber(org.candidates)}</td>
                      <td className="py-3 pr-4 tabular-nums text-ink-muted">{formatNumber(org.interviews)}</td>
                      <td className="py-3">
                        <CompletionBar value={org.completionRate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Health + Activity */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Service availability" subtitle="Live dependency checks" icon={Activity} />
            <div className="mt-4 space-y-2.5">
              {loading && !health ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded-xl bg-surface-3" />
                  ))}
                </div>
              ) : (health?.services?.length ?? 0) === 0 ? (
                <EmptyState title="No health data" icon={Activity} />
              ) : (
                health!.services.slice(0, 6).map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-inset px-3 py-2">
                    <span className="truncate text-xs text-ink-muted">{s.label}</span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        s.status === 'operational'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-accent-emerald'
                          : 'border-amber-500/30 bg-amber-500/10 text-accent-amber'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                ))
              )}
              <Link
                href="/super-admin/system-health"
                className="flex items-center justify-center gap-1 pt-1 text-xs font-semibold text-accent-cyan hover:underline"
              >
                View full system health <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent activity" subtitle="Latest audited platform events" icon={Clock} />
            <div className="mt-4 space-y-3">
              {loading && audit.length === 0 ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-3" />
                  ))}
                </div>
              ) : audit.length === 0 ? (
                <EmptyState title="No audited activity yet" icon={Clock} />
              ) : (
                audit.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                      <CheckCircle2 className="h-3.5 w-3.5 text-accent-cyan" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink">{log.action}</p>
                      <p className="truncate text-[11px] text-ink-faint">
                        {log.actorEmail || log.actorName || 'system'} · {formatDateTime(log.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <Link
                href="/super-admin/audit-logs"
                className="flex items-center justify-center gap-1 pt-1 text-xs font-semibold text-accent-cyan hover:underline"
              >
                Open audit trail <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Governance strip */}
      <Card className="border-emerald-400/20 bg-emerald-400/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-emerald" />
            <div>
              <p className="text-sm font-bold text-ink">Governed administrative access</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Super Admin reach is broad but bounded, auditable and reversible. Privileged candidate-data
                access requires an explicit support reason.
              </p>
            </div>
          </div>
          <Link
            href="/super-admin/roles"
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            Review RBAC matrix <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
