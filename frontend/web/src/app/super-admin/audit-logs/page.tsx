'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Lock, Search, ShieldCheck } from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  GhostButton,
  PageHeader,
  Pill,
  RefreshButton,
  SearchInput,
  TableSkeleton,
} from '@/components/super-admin/ui';
import { formatDateTime, formatNumber, saFetch, type AuditLogItem } from '@/lib/super-admin';
import { AuditAnalyticsPanel } from '@/components/super-admin/charts/AuditAnalyticsPanel';

type AuditResponse = { success: boolean; count?: number; logs?: AuditLogItem[] };

function actionTone(action: string): 'cyan' | 'violet' | 'rose' | 'amber' | 'indigo' | 'neutral' {
  const a = action.toLowerCase();
  if (a.includes('role') || a.includes('permission')) return 'violet';
  if (a.includes('delete') || a.includes('remove') || a.includes('revoke')) return 'rose';
  if (a.includes('suspend') || a.includes('support') || a.includes('override') || a.includes('login_fail')) return 'amber';
  if (a.includes('export') || a.includes('download')) return 'indigo';
  if (a.includes('login') || a.includes('auth') || a.includes('session')) return 'cyan';
  return 'neutral';
}

export default function SuperAdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQuery.trim()) params.set('action', appliedQuery.trim());
      params.set('limit', String(limit));
      const body = await saFetch<AuditResponse>(`/api/super-admin/audit-logs?${params.toString()}`);
      setLogs(Array.isArray(body.logs) ? body.logs : []);
      setCount(Number(body.count) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const distinctActions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) if (l.action) set.add(l.action);
    return Array.from(set).sort().slice(0, 12);
  }, [logs]);

  const applySearch = () => setAppliedQuery(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Audit Logs"
        description="A tamper-resistant record of platform activity. These entries cannot be deleted or edited through the admin interface."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      <AuditAnalyticsPanel
        logs={logs}
        totalCount={count}
        onFilterCategory={(filterWord) => {
          setQuery(filterWord);
          setAppliedQuery(filterWord);
        }}
        activeFilter={appliedQuery}
      />

      <Card>
        <CardHeader
          title="Audit trail"
          subtitle="Filter by action keyword; newest first"
          icon={FileText}
          action={<Pill tone="neutral">{formatNumber(count)} events</Pill>}
        />

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            onEnter={applySearch}
            placeholder="Filter by action (e.g. role, support, login)…"
            className="w-full sm:min-w-[240px] sm:flex-1"
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Result limit"
              className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none flex-1 sm:flex-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
            <GhostButton icon={Search} onClick={applySearch} disabled={loading} className="flex-1 sm:flex-none justify-center">
              {loading ? 'Searching…' : 'Search'}
            </GhostButton>
          </div>
        </div>

        {distinctActions.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1.5 max-w-full sm:flex-wrap no-scrollbar">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint shrink-0 mr-1 hidden sm:inline">
              Quick filters:
            </span>
            {distinctActions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setQuery(a);
                  setAppliedQuery(a);
                }}
                className="shrink-0 cursor-pointer rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[10px] font-mono text-ink-muted transition-colors hover:border-line-strong hover:text-ink whitespace-nowrap active:scale-95"
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 overflow-x-auto rounded-xl border border-line/60 sm:border-0 scrollbar-thin">
          <table className="w-full min-w-[720px] sm:min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="pb-2.5 pr-4 pl-2 font-bold">Action</th>
                <th className="pb-2.5 pr-4 font-bold">Actor</th>
                <th className="pb-2.5 pr-4 font-bold">Entity</th>
                <th className="pb-2.5 pr-4 font-bold">Organization</th>
                <th className="pb-2.5 font-bold pr-2">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <TableSkeleton rows={8} cols={5} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No audit events found" hint="Try a different action filter." icon={FileText} />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="cursor-pointer border-t border-line/60 align-top transition-colors hover:bg-surface-2"
                      onClick={() => setExpanded((v) => (v === log.id ? null : log.id))}
                    >
                      <td className="py-3 pr-4 pl-2">
                        <Pill tone={actionTone(log.action || '')}>{log.action || '—'}</Pill>
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink-muted max-w-[160px] truncate">
                        {log.actorName || log.actorEmail || 'system'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-ink-faint max-w-[140px] truncate">
                        {log.entityType || '—'}
                        {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-ink-faint">
                        {log.orgId ? log.orgId.slice(0, 8) : '—'}
                      </td>
                      <td className="py-3 pr-2 text-xs text-ink-faint whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                    </tr>
                    {expanded === log.id && log.detail && (
                      <tr className="border-t border-line/40 bg-inset">
                        <td colSpan={5} className="px-3 sm:px-4 py-3">
                          <pre className="overflow-x-auto max-w-[calc(100vw-3rem)] sm:max-w-none rounded-xl bg-surface p-3 font-mono text-[11px] leading-relaxed text-ink-muted scrollbar-thin">
{JSON.stringify(log.detail, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Immutability" subtitle="Write-once by design" icon={Lock} />
          <p className="mt-3 text-xs text-ink-muted">
            Audit rows are append-only. There is no delete or update path exposed to any admin role.
          </p>
        </Card>
        <Card>
          <CardHeader title="What gets logged" subtitle="Coverage" icon={ShieldCheck} />
          <ul className="mt-3 space-y-1.5 text-xs text-ink-muted">
            <li>• Role and permission changes</li>
            <li>• Suspicious logins and session events</li>
            <li>• Support overrides and exceptional access</li>
            <li>• Exports and administrative actions</li>
          </ul>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader title="Incident response" subtitle="Containment" icon={ShieldCheck} />
          <p className="mt-3 text-xs text-ink-muted">
            During a security incident, sessions can be revoked and accounts frozen — each action is itself
            audited and reversible.
          </p>
        </Card>
      </div>
    </div>
  );
}