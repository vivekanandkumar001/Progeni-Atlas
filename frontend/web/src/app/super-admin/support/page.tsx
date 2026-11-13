'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, KeyRound, ShieldAlert, Undo2, Wrench } from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  GhostButton,
  PageHeader,
  Pill,
  RefreshButton,
  TableSkeleton,
} from '@/components/super-admin/ui';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import { formatDateTime, saFetch, type AuditLogItem } from '@/lib/super-admin';

type AuditResponse = { success: boolean; logs?: AuditLogItem[] };

export default function SuperAdminSupportPage() {
  const { supportReason, openSupport, toast } = useSuperAdmin();
  const [events, setEvents] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Surface support/override related activity (backend filters by action keyword).
      const body = await saFetch<AuditResponse>('/api/super-admin/audit-logs?action=support&limit=25');
      setEvents(Array.isArray(body.logs) ? body.logs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load support activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deactivate = () => {
    window.sessionStorage.removeItem('tp_support_reason');
    toast('Privileged Support Grant deactivated.', 'success');
    // Force the shell to re-read by reloading the page context.
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Incident Management"
        description="Controlled administrative override with full traceability. Every override records reason, actor, timestamp and result."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      <Card className={supportReason ? 'border-amber-500/30 bg-amber-500/5' : ''}>
        <CardHeader
          title="Privileged Support Grant"
          subtitle="Reason-based, session-scoped candidate-data access"
          icon={KeyRound}
          action={
            supportReason ? (
              <GhostButton icon={Undo2} onClick={deactivate} className="border-rose-500/30 text-accent-rose hover:bg-rose-500/10">
                Deactivate
              </GhostButton>
            ) : (
              <GhostButton icon={KeyRound} onClick={openSupport} className="border-amber-500/30 text-accent-amber hover:bg-amber-500/10">
                Activate grant
              </GhostButton>
            )
          }
        />
        <div className="mt-4">
          {supportReason ? (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-accent-amber">Active reason</p>
              <p className="mt-1 text-xs text-ink">{supportReason}</p>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">
              No active support grant. Without one, Super Admin has no routine access to candidate recordings,
              resumes or scorecards. Activate a grant only with a valid operational justification.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader title="Resolve access problems" subtitle="Common runbook" icon={Wrench} />
          <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
            <li>• Re-verify the account and organization status.</li>
            <li>• Initiate secure, self-service account recovery.</li>
            <li>• Never read or set a user password.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Failed workflows" subtitle="Diagnose with data" icon={ShieldAlert} />
          <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
            <li>• Correlate failed interviews with System Health.</li>
            <li>• Check LiveKit and AI provider availability.</li>
            <li>• Inspect payment failures in Plans &amp; Billing.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Controlled overrides" subtitle="Bounded and reversible" icon={Undo2} />
          <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
            <li>• Every override needs a recorded reason.</li>
            <li>• Overrides are attributable and reversible.</li>
            <li>• Results are written to the audit trail.</li>
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Support activity" subtitle="Recent support / override audit events" icon={LifeBuoy} />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="pb-2 pr-4 font-bold">Action</th>
                <th className="pb-2 pr-4 font-bold">Actor</th>
                <th className="pb-2 font-bold">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <TableSkeleton rows={4} cols={3} />
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <EmptyState title="No support activity recorded" hint="Support and override events will appear here." icon={LifeBuoy} />
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-line/60">
                    <td className="py-3 pr-4">
                      <Pill tone="amber">{e.action || '—'}</Pill>
                    </td>
                    <td className="py-3 pr-4 text-xs text-ink-muted">{e.actorName || e.actorEmail || 'system'}</td>
                    <td className="py-3 text-xs text-ink-faint">{formatDateTime(e.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}