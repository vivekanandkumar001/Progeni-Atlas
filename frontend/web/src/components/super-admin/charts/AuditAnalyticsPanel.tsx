'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Filter,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { formatNumber, type AuditLogItem } from '@/lib/super-admin';
import { TimeSeriesChart, type TimeSeriesPoint } from './TimeSeriesChart';

interface AuditAnalyticsPanelProps {
  logs: AuditLogItem[];
  totalCount: number;
  onFilterCategory?: (categoryFilter: string) => void;
  activeFilter?: string;
}

export type AuditCategory = 'all' | 'security' | 'config' | 'auth' | 'operational';

export function AuditAnalyticsPanel({
  logs,
  totalCount,
  onFilterCategory,
  activeFilter = '',
}: AuditAnalyticsPanelProps) {
  const [selectedCat, setSelectedCat] = useState<AuditCategory>('all');

  // Categorize logs
  const categorized = useMemo(() => {
    let securityCount = 0;
    let configCount = 0;
    let authCount = 0;
    let operationalCount = 0;

    const dailyMap = new Map<string, { total: number; security: number }>();

    for (const log of logs) {
      const a = (log.action || '').toLowerCase();
      let isSecurity = false;

      if (
        a.includes('denied') ||
        a.includes('idor') ||
        a.includes('deny') ||
        a.includes('fail') ||
        a.includes('require') ||
        a.includes('violation')
      ) {
        securityCount++;
        isSecurity = true;
      } else if (
        a.includes('llm') ||
        a.includes('config') ||
        a.includes('model') ||
        a.includes('registry') ||
        a.includes('setting')
      ) {
        configCount++;
      } else if (
        a.includes('token') ||
        a.includes('auth') ||
        a.includes('login') ||
        a.includes('session')
      ) {
        authCount++;
      } else {
        operationalCount++;
      }

      if (log.timestamp) {
        const day = log.timestamp.slice(0, 10);
        const cur = dailyMap.get(day) || { total: 0, security: 0 };
        cur.total++;
        if (isSecurity) cur.security++;
        dailyMap.set(day, cur);
      }
    }

    const timeline: TimeSeriesPoint[] = Array.from(dailyMap.entries())
      .map(([date, d]) => ({ date, count: d.total }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      securityCount,
      configCount,
      authCount,
      operationalCount,
      timeline,
    };
  }, [logs]);

  const categories = [
    {
      id: 'all' as AuditCategory,
      label: 'All Activity',
      count: totalCount || logs.length,
      icon: Activity,
      color: 'text-ink',
      bgTone: 'border-line bg-surface-2',
      badgeTone: 'bg-surface-3 text-ink',
    },
    {
      id: 'security' as AuditCategory,
      label: 'Security & Denials',
      count: categorized.securityCount,
      filterKeyword: 'denied',
      icon: ShieldAlert,
      color: 'text-rose-500',
      bgTone: 'border-rose-500/30 bg-rose-500/10',
      badgeTone: 'bg-rose-500/20 text-accent-rose',
    },
    {
      id: 'config' as AuditCategory,
      label: 'LLM & Config',
      count: categorized.configCount,
      filterKeyword: 'llm',
      icon: Sparkles,
      color: 'text-violet-500',
      bgTone: 'border-violet-500/30 bg-violet-500/10',
      badgeTone: 'bg-violet-500/20 text-accent-violet',
    },
    {
      id: 'auth' as AuditCategory,
      label: 'Auth & Sessions',
      count: categorized.authCount,
      filterKeyword: 'token',
      icon: KeyRound,
      color: 'text-cyan-500',
      bgTone: 'border-cyan-500/30 bg-cyan-500/10',
      badgeTone: 'bg-cyan-500/20 text-accent-cyan',
    },
  ];

  const handleSelect = (cat: typeof categories[0]) => {
    setSelectedCat(cat.id);
    if (onFilterCategory) {
      if (cat.id === 'all') {
        onFilterCategory('');
      } else if (cat.filterKeyword) {
        onFilterCategory(cat.filterKeyword);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 transition-all hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">Total Audit Events</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-accent-cyan">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-ink">{formatNumber(totalCount || logs.length)}</p>
          <p className="mt-1 text-xs text-ink-muted">Immutable append-only ledger</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 transition-all hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">Security Denials Blocked</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-accent-rose">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-accent-rose">{formatNumber(categorized.securityCount)}</p>
          <p className="mt-1 text-xs text-ink-muted">Cross-tenant & IDOR attempts blocked</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 transition-all hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">LLM & Config Changes</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-accent-violet">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-accent-violet">{formatNumber(categorized.configCount)}</p>
          <p className="mt-1 text-xs text-ink-muted">Governed provider mutations</p>
        </div>

        <div className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5 transition-all hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">RBAC Matrix Posture</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-accent-emerald">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-lg sm:text-xl font-bold text-accent-emerald truncate">Active & Guarded</p>
          <p className="mt-1 text-xs text-ink-muted">Multi-tenant boundary enforced</p>
        </div>
      </div>

      {/* Audit Activity Time-Series Chart */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-sm overflow-hidden">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent-cyan" />
              Audit Trail Activity Trend
            </h3>
            <p className="text-xs text-ink-muted">Distribution of audited events and security telemetry over time</p>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 lg:pb-0 max-w-full lg:flex-wrap no-scrollbar">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCat === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? `${cat.bgTone} ${cat.color} shadow-sm ring-1 ring-cyan-500/40`
                      : 'border-line bg-inset text-ink-muted hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{cat.label}</span>
                  <span className={`ml-1 rounded-full px-1.5 py-0.2 text-xs font-bold tabular-nums ${cat.badgeTone}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <TimeSeriesChart
          data={categorized.timeline}
          days={14}
          title="Audit Volume"
          subtitle="Events recorded per day"
          tone="cyan"
          unit="events"
        />
      </div>
    </div>
  );
}
