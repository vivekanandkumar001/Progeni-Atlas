'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Database, FileLock2, ScrollText, ShieldCheck } from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pill,
  RefreshButton,
  StatCard,
  StatSkeleton,
} from '@/components/super-admin/ui';
import { formatNumber, saFetch, type DataGovernance } from '@/lib/super-admin';

const OBJECT_ICON: Record<string, typeof Database> = {
  resumes: FileLock2,
  scorecards: ScrollText,
  interviews: Database,
  audit_events: ShieldCheck,
};

export default function SuperAdminDataGovernancePage() {
  const [data, setData] = useState<DataGovernance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await saFetch<DataGovernance & { success: boolean }>('/api/super-admin/data-governance');
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load data governance summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Governance"
        description="Retention posture and sensitive-data inventory. Only aggregate counts are returned — never resumes, transcripts, recordings or PII."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          (data?.objects || []).map((o) => {
            const Icon = OBJECT_ICON[o.key] || Database;
            return <StatCard key={o.key} label={o.label} value={formatNumber(o.count)} icon={Icon} tone="cyan" />;
          })
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Retention & access policy" subtitle="What happens to sensitive data" icon={FileLock2} />
          <div className="mt-4 space-y-3">
            {(data?.retention || []).length === 0 ? (
              <EmptyState title="No policy data" icon={FileLock2} />
            ) : (
              data!.retention.map((r) => (
                <div key={r.key} className="rounded-xl border border-line bg-surface-2 p-3">
                  <p className="text-xs font-bold text-ink">{r.label}</p>
                  <p className="mt-1 text-[11px] leading-5 text-ink-muted">{r.policy}</p>
                </div>
              ))
            )}
          </div>
          {data?.deletionNote && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-accent-amber">
              {data.deletionNote}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Guardrails" subtitle="Non-negotiable controls" icon={ShieldCheck} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li>• Organization data export requires explicit authorization and is audited.</li>
            <li>• Candidate recordings are reason-gated and access-audited.</li>
            <li>• Deletion runs as a privacy workflow, never a raw console delete.</li>
            <li>• This surface exposes counts only, so it cannot become an exfiltration path.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="emerald">Counts only</Pill>
            <Pill tone="amber">Reason-gated</Pill>
            <Pill tone="violet">Audited</Pill>
          </div>
        </Card>
      </div>
    </div>
  );
}
