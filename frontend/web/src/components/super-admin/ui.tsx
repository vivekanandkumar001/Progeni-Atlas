'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Inbox, Loader2, RefreshCw, Search, type LucideIcon } from 'lucide-react';
import type { Verdict } from '@/lib/super-admin';

/* ------------------------------------------------------------------ shells */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-accent-cyan">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- stats */

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'cyan',
  href,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: 'cyan' | 'violet' | 'emerald' | 'amber';
  href?: string;
  onClick?: () => void;
}) {
  const tones: Record<string, { badge: string; borderHover: string; text: string }> = {
    cyan: {
      badge: 'border-cyan-500/20 bg-cyan-500/10 text-accent-cyan',
      borderHover: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      text: 'text-accent-cyan',
    },
    violet: {
      badge: 'border-violet-500/20 bg-violet-500/10 text-accent-violet',
      borderHover: 'hover:border-violet-500/50 hover:shadow-violet-500/10',
      text: 'text-accent-violet',
    },
    emerald: {
      badge: 'border-emerald-500/20 bg-emerald-500/10 text-accent-emerald',
      borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      text: 'text-accent-emerald',
    },
    amber: {
      badge: 'border-amber-500/20 bg-amber-500/10 text-accent-amber',
      borderHover: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
      text: 'text-accent-amber',
    },
  };

  const currentTone = tones[tone] || tones.cyan;
  const isInteractive = Boolean(href || onClick);

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-muted group-hover:text-ink transition-colors">
            {label}
          </span>
          {isInteractive && (
            <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:text-ink transition-all duration-200" />
          )}
        </div>
        <span
          className={`rounded-xl border p-2.5 transition-transform duration-200 ${currentTone.badge} ${
            isInteractive ? 'group-hover:scale-110 shadow-sm' : ''
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-ink">{value}</p>

      {hint && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-ink-muted leading-normal">{hint}</p>
          {isInteractive && (
            <span className={`text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${currentTone.text}`}>
              Open &rarr;
            </span>
          )}
        </div>
      )}
    </>
  );

  const containerClasses = `group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-all duration-200 block text-left ${
    isInteractive
      ? `cursor-pointer hover:-translate-y-1 hover:shadow-xl active:translate-y-0 ${currentTone.borderHover}`
      : 'hover:shadow-lg'
  }`;

  if (href) {
    return (
      <Link href={href} className={containerClasses} title={`Open ${label}`}>
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${containerClasses} w-full`} title={`Open ${label}`}>
        {cardContent}
      </button>
    );
  }

  return <div className={containerClasses}>{cardContent}</div>;
}

export function StatSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <div className="h-3 w-24 rounded-md bg-surface-3" />
        <div className="h-9 w-9 rounded-xl bg-surface-3" />
      </div>
      <div className="mt-4 h-8 w-20 rounded-lg bg-surface-3" />
      <div className="mt-3 h-3 w-28 rounded bg-surface-3" />
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

export function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-line/50">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="py-3.5">
              <div
                className="h-3.5 animate-pulse rounded bg-surface-3"
                style={{ width: `${55 + ((r + c) % 4) * 12}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CompletionBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-ink-faint">—</span>;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-ink-muted">{value}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------- pills */

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet' | 'indigo';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line bg-surface-2 text-ink-muted',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-accent-cyan',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-accent-emerald',
    amber: 'border-amber-500/30 bg-amber-500/10 text-accent-amber',
    rose: 'border-rose-500/30 bg-rose-500/10 text-accent-rose',
    violet: 'border-violet-500/30 bg-violet-500/10 text-accent-violet',
    indigo: 'border-indigo-500/30 bg-indigo-500/10 text-accent-indigo',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function VerdictPill({ verdict, children }: { verdict: Verdict; children: React.ReactNode }) {
  const map: Record<Verdict, { tone: 'emerald' | 'amber' | 'rose'; dot: string }> = {
    allow: { tone: 'emerald', dot: 'bg-emerald-500' },
    conditional: { tone: 'amber', dot: 'bg-amber-500' },
    deny: { tone: 'rose', dot: 'bg-rose-500' },
  };
  const { tone, dot } = map[verdict] || map.conditional;
  return (
    <Pill tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </Pill>
  );
}

export function StatusDot({ status }: { status?: string | null }) {
  const s = String(status || '').toLowerCase();
  const tone =
    s.includes('operational') || s.includes('active') || s.includes('healthy') || s.includes('completed')
      ? 'bg-emerald-500'
      : s.includes('degrad') || s.includes('progress') || s.includes('pending') || s.includes('scheduled')
      ? 'bg-amber-500'
      : s.includes('suspend') || s.includes('fail') || s.includes('cancel') || s.includes('error')
      ? 'bg-rose-500'
      : 'bg-ink-faint';
  return <span className={`inline-block h-2 w-2 rounded-full ${tone}`} />;
}

/* ------------------------------------------------------------ states/other */

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-accent-rose">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Icon className="h-8 w-8 text-ink-faint" />
      <p className="text-sm font-semibold text-ink-muted">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function RefreshButton({
  onClick,
  loading,
  label = 'Refresh',
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={label}
      aria-label={label}
      className="cursor-pointer rounded-xl border border-line bg-surface-2 p-2 text-ink transition-colors hover:bg-surface-3 disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  onEnter,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
        className="w-full rounded-xl border border-line bg-inset py-1.5 pl-8 pr-3 text-xs text-ink outline-none placeholder:text-ink-faint"
      />
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label || 'Loading…'}
    </div>
  );
}

export function GhostButton({
  children,
  onClick,
  icon: Icon,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-3 disabled:opacity-50 ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/** Compact horizontal bar used for usage analytics. */
export function MiniBar({ value, max, tone = 'cyan' }: { value: number; max: number; tone?: 'cyan' | 'emerald' }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const grad = tone === 'emerald' ? 'from-emerald-400 to-emerald-600' : 'from-cyan-400 to-indigo-500';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
