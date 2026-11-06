'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, RefreshCw, ServerCog, TriangleAlert } from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pill,
  RefreshButton,
  Spinner,
} from '@/components/super-admin/ui';
import { formatDateTime, saFetch, type SystemHealth } from '@/lib/super-admin';

export default function SuperAdminSystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await saFetch<SystemHealth & { success: boolean }>('/api/super-admin/system-health');
      setHealth(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load system health.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overall = health?.overall;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Live availability of every platform dependency. Credentials are reported only as configured / not configured — secret values are never returned."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      {loading && !health ? (
        <Card>
          <Spinner label="Running dependency checks…" />
        </Card>
      ) : health ? (
        <>
          <Card className={overall === 'operational' ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${overall === 'operational' ? 'border-emerald-500/30 bg-emerald-500/10 text-accent-emerald' : 'border-amber-500/30 bg-amber-500/10 text-accent-amber'}`}>
                  {overall === 'operational' ? <CheckCircle2 className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">
                    {overall === 'operational' ? 'All systems operational' : 'Some services are degraded'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {health.operationalCount} of {health.totalCount} services healthy · checked {formatDateTime(health.checkedAt)}
                  </p>
                </div>
              </div>
              <Pill tone={overall === 'operational' ? 'emerald' : 'amber'}>{overall}</Pill>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {health.services.map((s) => (
              <Card key={s.key}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2">
                      <ServerCog className="h-4 w-4 text-accent-cyan" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">{s.label}</p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">{s.detail || 'Healthy'}</p>
                    </div>
                  </div>
                  <Pill tone={s.status === 'operational' ? 'emerald' : 'amber'}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {s.status}
                  </Pill>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="How to read this" subtitle="Design intent" icon={Activity} />
            <ul className="mt-4 space-y-2 text-xs text-ink-muted">
              <li>• A <strong className="text-ink">degraded</strong> service has missing configuration or failed its live check — it is never masked as operational.</li>
              <li>• Secrets (API keys, SMTP credentials, LiveKit secret) are never exposed, only their presence.</li>
              <li>• Use this surface to correlate failed interviews with LiveKit / AI provider availability.</li>
            </ul>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState title="No health data" icon={Activity} />
        </Card>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Re-run checks
        </button>
      </div>
    </div>
  );
}
