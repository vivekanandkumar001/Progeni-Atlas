'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber } from '@/lib/super-admin';

export interface StatusItem {
  status: string;
  count: number;
  label?: string;
}

interface StatusBreakdownChartProps {
  data: StatusItem[];
  total: number;
}

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bgTone: string;
  borderTone: string;
  badgeTone: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'neutral';
  barGradient: string;
}

const STATUS_METADATA: Record<string, StatusConfig> = {
  in_progress: {
    label: 'In Progress',
    icon: PlayCircle,
    color: '#06b6d4',
    bgTone: 'bg-cyan-500/10',
    borderTone: 'border-cyan-500/30',
    badgeTone: 'cyan',
    barGradient: 'from-cyan-400 to-indigo-500',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: '#10b981',
    bgTone: 'bg-emerald-500/10',
    borderTone: 'border-emerald-500/30',
    badgeTone: 'emerald',
    barGradient: 'from-emerald-400 to-emerald-600',
  },
  scheduled: {
    label: 'Scheduled',
    icon: Calendar,
    color: '#8b5cf6',
    bgTone: 'bg-violet-500/10',
    borderTone: 'border-violet-500/30',
    badgeTone: 'violet',
    barGradient: 'from-violet-400 to-purple-600',
  },
  abandoned: {
    label: 'Abandoned',
    icon: AlertTriangle,
    color: '#f59e0b',
    bgTone: 'bg-amber-500/10',
    borderTone: 'border-amber-500/30',
    badgeTone: 'amber',
    barGradient: 'from-amber-400 to-orange-500',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: '#f43f5e',
    bgTone: 'bg-rose-500/10',
    borderTone: 'border-rose-500/30',
    badgeTone: 'rose',
    barGradient: 'from-rose-400 to-red-600',
  },
};

function getStatusConfig(statusKey: string, customLabel?: string): StatusConfig {
  const key = statusKey.toLowerCase().trim();
  const found = STATUS_METADATA[key];
  if (found) {
    return customLabel ? { ...found, label: customLabel } : found;
  }
  // Generic fallback
  return {
    label: customLabel || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: Clock,
    color: '#64748b',
    bgTone: 'bg-surface-3',
    borderTone: 'border-line-strong',
    badgeTone: 'neutral',
    barGradient: 'from-slate-400 to-slate-600',
  };
}

export function StatusBreakdownChart({ data, total }: StatusBreakdownChartProps) {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  // Normalize data with config
  const items = useMemo(() => {
    return data.map((d) => {
      const cfg = getStatusConfig(d.status, d.label);
      const pct = total > 0 ? (d.count / total) * 100 : 0;
      return {
        ...d,
        cfg,
        pct,
      };
    });
  }, [data, total]);

  // SVG Donut geometry calculations
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute strokeDasharray and strokeDashoffset for each segment
  const donutSegments = useMemo(() => {
    let currentOffset = 0;
    return items.map((item) => {
      const dashLength = (item.pct / 100) * circumference;
      const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
      const strokeDashoffset = -currentOffset;
      currentOffset += dashLength;
      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [items, circumference]);

  const activeItem = useMemo(() => {
    if (!hoveredStatus) return null;
    return items.find((i) => i.status === hoveredStatus) || null;
  }, [hoveredStatus, items]);

  return (
    <div className="grid gap-6 md:grid-cols-5 items-center">
      {/* Left: Interactive Donut Gauge (2 cols) */}
      <div className="relative flex flex-col items-center justify-center md:col-span-2">
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            {/* Background Track Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-surface-3/50"
            />
            {/* Segment Arcs */}
            {donutSegments.map((seg) => {
              const isHovered = hoveredStatus === seg.status;
              return (
                <circle
                  key={seg.status}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={seg.cfg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-300 cursor-pointer"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 8px ${seg.cfg.color})` : 'none',
                  }}
                  onMouseEnter={() => setHoveredStatus(seg.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                />
              );
            })}
          </svg>

          {/* Central Stat Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            {activeItem ? (
              <>
                <span className="text-2xl font-black text-ink tracking-tight tabular-nums animate-fadeIn">
                  {formatNumber(activeItem.count)}
                </span>
                <span className="text-[11px] font-bold text-ink-muted truncate max-w-[100px]">
                  {activeItem.cfg.label}
                </span>
                <span className="text-[10px] font-semibold text-accent-cyan tabular-nums">
                  {activeItem.pct.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl font-black text-ink tracking-tight tabular-nums">
                  {formatNumber(total)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  Sessions
                </span>
                <span className="text-[9px] text-ink-faint">All time</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Detailed Status Breakdown Rows (3 cols) */}
      <div className="space-y-3 md:col-span-3">
        {items.map((item) => {
          const Icon = item.cfg.icon;
          const isHovered = hoveredStatus === item.status;

          return (
            <div
              key={item.status}
              onMouseEnter={() => setHoveredStatus(item.status)}
              onMouseLeave={() => setHoveredStatus(null)}
              className={`group cursor-pointer rounded-xl border p-2.5 transition-all ${
                isHovered
                  ? 'border-line-strong bg-surface-2 shadow-sm'
                  : 'border-line/60 bg-inset/40 hover:bg-surface-2/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${item.cfg.borderTone} ${item.cfg.bgTone}`}
                    style={{ color: item.cfg.color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-semibold text-ink truncate">{item.cfg.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold tabular-nums text-ink">
                    {formatNumber(item.count)}
                  </span>
                  <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink-muted">
                    {item.pct.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${item.cfg.barGradient} transition-all duration-500`}
                  style={{ width: `${Math.max(2, item.pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
