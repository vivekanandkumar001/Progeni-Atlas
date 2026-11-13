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

interface AptitudeBankStats {
  staticSeed: number;
  generated: number;
  total: number;
  target: number;
  parameterizedFamilies: number;
  usage: { totalUsageEvents?: number; uniqueItemsServed?: number; uniqueUsersPracticed?: number };
  generatedBySection: { section: string; n: number }[];
  generatedByDifficulty: { difficulty: string; n: number }[];
  settings: {
    lastRunDate?: string | null;
    lastFailureDate?: string | null;
    lastResult?: { accepted?: number; rejected?: number; at?: string; status?: string } | null;
    dailyBatch?: number;
  } | null;
}
import { TimeSeriesChart } from '@/components/super-admin/charts/TimeSeriesChart';
import { StatusBreakdownChart } from '@/components/super-admin/charts/StatusBreakdownChart';
import { RoleDistributionCard } from '@/components/super-admin/charts/RoleDistributionCard';

export default function SuperAdminUsagePage() {
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bank, setBank] = useState<AptitudeBankStats | null>(null);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankError, setBankError] = useState<string | null>(null);
  const [armGenerate, setArmGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);

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

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    setBankError(null);
    try {
      const body = await saFetch<{ success: boolean; bank?: AptitudeBankStats }>('/api/super-admin/aptitude/bank-stats');
      setBank(body.bank ?? null);
    } catch (e) {
      setBankError(e instanceof Error ? e.message : 'Unable to load question-bank stats.');
    } finally {
      setBankLoading(false);
    }
  }, []);

  const runGenerate = useCallback(async () => {
    setArmGenerate(false);
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await saFetch<{
        success: boolean;
        accepted?: number;
        rejected?: number;
        deduped?: number;
        bankTotal?: number;
        status?: string;
      }>('/api/super-admin/aptitude/generate-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_spend: true, count: 50 }),
      });
      setGenResult(
        `Banked ${res.accepted ?? 0} verified items (rejected ${res.rejected ?? 0}, deduped ${res.deduped ?? 0}) — bank total ${res.bankTotal ?? '-'} / 2000.`
      );
      await loadBank();
    } catch (e) {
      setGenResult(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [loadBank]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadBank();
  }, [loadBank]);

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

          {/* Aptitude & Cognitive Screening */}
          {data.aptitude && (
            <Card className="p-6">
              <CardHeader
                title="Aptitude & Cognitive Screening"
                subtitle="AMCAT-style assessments attempted, completion and report-page funnel events"
                icon={Gauge}
                action={<Pill tone="violet">{data.aptitude.sessions} sessions</Pill>}
              />
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl bg-inset p-4 text-center">
                  <p className="text-[11px] font-mono uppercase text-ink-faint">Attempts</p>
                  <p className="mt-1 text-2xl font-black text-ink tabular-nums">{data.aptitude.sessions}</p>
                  <p className="text-[10px] text-ink-muted">{data.aptitude.completed} completed</p>
                </div>
                <div className="rounded-xl bg-inset p-4 text-center">
                  <p className="text-[11px] font-mono uppercase text-ink-faint">Avg Score</p>
                  <p className="mt-1 text-2xl font-black text-ink tabular-nums">{data.aptitude.avgScore != null ? `${data.aptitude.avgScore}%` : '—'}</p>
                  <p className="text-[10px] text-ink-muted">vs 60% benchmark</p>
                </div>
                <div className="rounded-xl bg-inset p-4 text-center">
                  <p className="text-[11px] font-mono uppercase text-ink-faint">Avg Accuracy</p>
                  <p className="mt-1 text-2xl font-black text-ink tabular-nums">{data.aptitude.avgAccuracy != null ? `${data.aptitude.avgAccuracy}%` : '—'}</p>
                  <p className="text-[10px] text-ink-muted">correct / attempted</p>
                </div>
                <div className="rounded-xl bg-inset p-4">
                  <p className="text-[11px] font-mono uppercase text-ink-faint">Report funnel (A/B)</p>
                  <div className="mt-1.5 space-y-1">
                    {(data.aptitude.events.length ? data.aptitude.events : [{ name: 'report_view', count: 0 }, { name: 'retake_click', count: 0 }]).map((e) => (
                      <div key={e.name} className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-muted font-mono">{e.name}</span>
                        <span className="font-bold text-ink tabular-nums">{e.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Aptitude Question Bank — families, LLM-verified items, exposure ledger */}
          <Card className="p-6">
            <CardHeader
              title="Aptitude Question Bank"
              subtitle="Parameterized families + verified LLM items · 2000-item hard cap · per-candidate exposure ≤ 3"
              icon={Sparkles}
              action={
                <Pill tone="violet">
                  {bank
                    ? `${bank.total} / ${bank.target} banked`
                    : bankLoading
                      ? 'Loading…'
                      : 'Unavailable'}
                </Pill>
              }
            />
            {bankError && (
              <div className="mt-3 rounded-xl border border-accent-rose/30 bg-accent-rose/10 px-4 py-2.5 text-xs text-accent-rose">
                {bankError}
              </div>
            )}
            {bank ? (
              <div className="mt-4 grid gap-5 lg:grid-cols-5">
                {/* Left: capacity + generate */}
                <div className="space-y-4 lg:col-span-2">
                  <div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold text-ink-muted">Bank capacity</span>
                      <span className="tabular-nums font-black text-ink">
                        {bank.total} <span className="text-ink-faint">/ {bank.target}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-inset">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, (bank.total / Math.max(1, bank.target)) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-ink-faint">
                      Daily 05:00 AM IST auto-batch runs if the admin misses one; generation pauses permanently at 2000 banked items. Solver-verified items only.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-inset p-3">
                      <p className="text-[10px] font-mono uppercase text-ink-faint">Families</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-accent-cyan">{bank.parameterizedFamilies}</p>
                      <p className="text-[9px] text-ink-faint">parameterized</p>
                    </div>
                    <div className="rounded-xl bg-inset p-3">
                      <p className="text-[10px] font-mono uppercase text-ink-faint">Static</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-ink">{bank.staticSeed}</p>
                      <p className="text-[9px] text-ink-faint">seed items</p>
                    </div>
                    <div className="rounded-xl bg-inset p-3">
                      <p className="text-[10px] font-mono uppercase text-ink-faint">LLM</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-accent-emerald">{bank.generated}</p>
                      <p className="text-[9px] text-ink-faint">verified & banked</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-surface-2 p-3 text-[10px] leading-relaxed text-ink-muted">
                    {bank.settings?.lastResult
                      ? `Last batch ${bank.settings.lastRunDate ?? ''}: ${bank.settings.lastResult.accepted ?? 0} accepted / ${bank.settings.lastResult.rejected ?? 0} rejected · ${bank.settings.lastResult.at ? new Date(bank.settings.lastResult.at).toLocaleString() : ''}`
                      : 'No batch generated yet — auto-run at 5:00 AM IST or trigger one manually below.'}
                    {bank.settings?.lastFailureDate && (
                      <span className="mt-1 block text-accent-amber">Last failure {bank.settings.lastFailureDate} — auto-retry is suppressed until the next day.</span>
                    )}
                  </div>

                  {genResult && (
                    <div className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/10 px-3.5 py-2.5 text-[11px] text-accent-cyan">
                      {genResult}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={armGenerate ? runGenerate : () => { setArmGenerate(true); window.setTimeout(() => setArmGenerate(false), 4000); }}
                    disabled={generating || bank.total >= bank.target}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                      armGenerate
                        ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:opacity-95'
                    }`}
                  >
                    {generating ? 'Generating & verifying…' : armGenerate ? 'Confirm — spend LLM tokens' : bank.total >= bank.target ? 'Bank Full (2000)' : 'Generate 50 Now'}
                  </button>
                </div>

                {/* Right: exposure ledger + composition */}
                <div className="space-y-4 lg:col-span-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-inset p-3">
                      <p className="text-[10px] font-mono uppercase text-ink-faint">Exposures</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-ink">{bank.usage.totalUsageEvents ?? 0}</p>
                      <p className="text-[9px] text-ink-faint">items served</p>
                    </div>
                    <div className="rounded-xl bg-inset p-3">
                      <p className="text-[10px] font-mono uppercase text-ink-faint">Unique Served</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-ink">{bank.usage.uniqueItemsServed ?? 0}</p>
                      <p className="text-[9px] text-ink-faint">distinct items</p>
                    </div>
                    <div className="rounded-xl bg-inset p-3">
                      <p className="text-[10px] font-mono uppercase text-ink-faint">Practiced</p>
                      <p className="mt-0.5 text-xl font-black tabular-nums text-ink">{bank.usage.uniqueUsersPracticed ?? 0}</p>
                      <p className="text-[9px] text-ink-faint">distinct users</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Generated items by section</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {bank.generatedBySection.length === 0 ? (
                        <span className="text-[11px] italic text-ink-faint">LLM bank empty — family + static seeds cover current load</span>
                      ) : (
                        bank.generatedBySection.map((s) => (
                          <span key={s.section} className="rounded-full border border-accent-cyan/25 bg-accent-cyan/10 px-2.5 py-0.5 text-[10px] font-bold text-accent-cyan">
                            {s.section} · {s.n}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {bank.generatedByDifficulty.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Generated items by difficulty</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {bank.generatedByDifficulty.map((d) => (
                          <span key={d.difficulty} className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                            {d.difficulty} · {d.n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <StatSkeleton />
              </div>
            )}
          </Card>

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
