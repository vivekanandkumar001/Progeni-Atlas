'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Gauge,
  Sparkles,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pill,
  RefreshButton,
  Spinner,
  StatCard,
  StatSkeleton,
} from '@/components/super-admin/ui';
import { formatNumber, saFetch, type UsageAnalytics } from '@/lib/super-admin';
import { TimeSeriesChart } from '@/components/super-admin/charts/TimeSeriesChart';
import { StatusBreakdownChart } from '@/components/super-admin/charts/StatusBreakdownChart';
import { RoleDistributionCard } from '@/components/super-admin/charts/RoleDistributionCard';

export default function SuperAdminUsagePage() {
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await saFetch<UsageAnalytics & { success: boolean }>(`/api/super-admin/usage?days=${days}`);
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load usage analytics.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const completionRate =
    data && data.totals.interviews > 0
      ? Math.round((data.totals.completed / data.totals.interviews) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage & Analytics"
        description="Interview throughput, status mix and platform activity — computed live from the database."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Trend window"
              className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs font-semibold text-ink outline-none transition-colors hover:border-line-strong"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <RefreshButton onClick={load} loading={loading} />
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : data ? (
        <>
          {/* Top KPI Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total interviews"
              value={formatNumber(data.totals.interviews)}
              icon={Video}
              tone="cyan"
              hint="All-time sessions created across tenants"
            />
            <StatCard
              label="Completed sessions"
              value={formatNumber(data.totals.completed)}
              icon={Gauge}
              tone="emerald"
              hint={`${completionRate}% completion rate`}
            />
            <StatCard
              label="AI evaluations"
              value={formatNumber(data.totals.aiEvaluations)}
              icon={Sparkles}
              tone="violet"
              hint="Scorecards generated & rated"
            />
            <StatCard
              label="Platform users"
              value={formatNumber(data.totals.users)}
              icon={Users}
              tone="amber"
              hint="Active candidates, recruiters & admins"
            />
          </div>

          {/* Primary Trend Chart */}
          <Card className="p-6">
            <CardHeader
              title={`Interview Volume Trend · Last ${data.days} Days`}
              subtitle="Daily sessions created across all organizations"
              icon={TrendingUp}
              action={
                <Pill tone="cyan">
                  {data.daily?.reduce((sum, d) => sum + d.count, 0) || 0} Sessions in Window
                </Pill>
              }
            />
            <div className="mt-4">
              <TimeSeriesChart
                data={data.daily || []}
                days={data.days}
                title="Interview Volume"
                subtitle="Daily sessions created"
                tone="cyan"
                unit="interviews"
              />
            </div>
          </Card>

          {/* Secondary Charts: Status Mix & Roles */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Status Mix Card */}
            <Card className="p-6">
              <CardHeader
                title="Interview Lifecycle Mix"
                subtitle="All-time distribution by session state"
                icon={BarChart3}
                action={
                  <Pill tone="neutral">
                    {formatNumber(data.totals.interviews)} Total
                  </Pill>
                }
              />
              <div className="mt-5">
                {data.statusBreakdown.length === 0 ? (
                  <EmptyState title="No interview data yet" icon={BarChart3} />
                ) : (
                  <StatusBreakdownChart
                    data={data.statusBreakdown}
                    total={data.totals.interviews}
                  />
                )}
              </div>
            </Card>

            {/* Accounts by Role Card */}
            <Card className="p-6">
              <CardHeader
                title="Accounts by Role"
                subtitle="Platform user distribution & access tier"
                icon={Users}
                action={
                  <Pill tone="emerald">
                    {formatNumber(data.totals.users)} Users
                  </Pill>
                }
              />
              <div className="mt-5">
                {data.roleBreakdown.length === 0 ? (
                  <EmptyState title="No user data yet" icon={Users} />
                ) : (
                  <RoleDistributionCard
                    data={data.roleBreakdown}
                    totalUsers={data.totals.users}
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Top Organizations Table */}
          <Card className="p-6">
            <CardHeader
              title="Top Organizations by Volume"
              subtitle="Most active customer workspaces and tenants"
              icon={Building2}
              action={
                <span className="text-xs text-ink-faint">
                  Showing top {data.topOrganizations.length} tenants
                </span>
              }
            />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    <th className="pb-3 pr-4">Rank & Organization</th>
                    <th className="pb-3 pr-4">Total Interviews</th>
                    <th className="pb-3 pr-4">Completed</th>
                    <th className="pb-3">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {data.topOrganizations.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState title="No organization activity yet" icon={Building2} />
                      </td>
                    </tr>
                  ) : (
                    data.topOrganizations.map((o, idx) => {
                      const rate = o.interviews > 0 ? Math.round((o.completed / o.interviews) * 100) : 0;
                      return (
                        <tr key={o.orgId} className="transition-colors hover:bg-surface-2/60">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3 text-xs font-bold text-ink-muted">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-ink truncate">{o.name}</p>
                                <p className="font-mono text-[11px] text-ink-faint truncate">
                                  {o.orgId === 'unassigned' ? 'System Unassigned' : o.orgId.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4 tabular-nums font-medium text-ink">
                            {formatNumber(o.interviews)}
                          </td>
                          <td className="py-3.5 pr-4 tabular-nums font-medium text-ink-muted">
                            {formatNumber(o.completed)}
                          </td>
                          <td className="py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-3">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-500"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold tabular-nums text-ink">
                                {rate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <Spinner />
        </Card>
      )}
    </div>
  );
}
