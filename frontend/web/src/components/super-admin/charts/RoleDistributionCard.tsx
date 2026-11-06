'use client';

import React, { useMemo, useState } from 'react';
import { Briefcase, ShieldAlert, Users, UserCheck, type LucideIcon } from 'lucide-react';
import { formatNumber } from '@/lib/super-admin';

export interface RoleItem {
  role: string;
  count: number;
  label?: string;
}

interface RoleDistributionCardProps {
  data: RoleItem[];
  totalUsers: number;
}

interface RoleConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
  badgeTone: 'cyan' | 'emerald' | 'violet';
  barGradient: string;
  bgTone: string;
  borderTone: string;
}

const ROLE_METADATA: Record<string, RoleConfig> = {
  candidate: {
    title: 'Candidate',
    subtitle: 'Applicants, interviewees & assessment takers',
    icon: UserCheck,
    color: '#06b6d4',
    badgeTone: 'cyan',
    barGradient: 'from-cyan-400 to-indigo-500',
    bgTone: 'bg-cyan-500/10',
    borderTone: 'border-cyan-500/30',
  },
  recruiter: {
    title: 'Recruiter',
    subtitle: 'Talent teams, interviewers & hiring managers',
    icon: Briefcase,
    color: '#10b981',
    badgeTone: 'emerald',
    barGradient: 'from-emerald-400 to-emerald-600',
    bgTone: 'bg-emerald-500/10',
    borderTone: 'border-emerald-500/30',
  },
  super_admin: {
    title: 'Super Admin',
    subtitle: 'Platform governance, audit & system operators',
    icon: ShieldAlert,
    color: '#8b5cf6',
    badgeTone: 'violet',
    barGradient: 'from-violet-400 to-purple-600',
    bgTone: 'bg-violet-500/10',
    borderTone: 'border-violet-500/30',
  },
};

function getRoleConfig(roleKey: string, customLabel?: string): RoleConfig {
  const key = roleKey.toLowerCase().trim();
  const found = ROLE_METADATA[key];
  if (found) {
    return customLabel ? { ...found, title: customLabel } : found;
  }
  return {
    title: customLabel || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: 'Platform account',
    icon: Users,
    color: '#6366f1',
    badgeTone: 'cyan',
    barGradient: 'from-indigo-400 to-indigo-600',
    bgTone: 'bg-indigo-500/10',
    borderTone: 'border-indigo-500/30',
  };
}

export function RoleDistributionCard({ data, totalUsers }: RoleDistributionCardProps) {
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  const items = useMemo(() => {
    return data.map((d) => {
      const cfg = getRoleConfig(d.role, d.label);
      const pct = totalUsers > 0 ? (d.count / totalUsers) * 100 : 0;
      return {
        ...d,
        cfg,
        pct,
      };
    });
  }, [data, totalUsers]);

  return (
    <div className="space-y-4">
      {/* Top Multi-Segment Ribbon Bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-muted">
          <span className="font-semibold">Platform Distribution</span>
          <span className="font-bold tabular-nums text-ink">{formatNumber(totalUsers)} Users</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3 p-0.5">
          {items.map((item) => (
            <div
              key={item.role}
              style={{ width: `${Math.max(4, item.pct)}%` }}
              className={`h-full first:rounded-l-full last:rounded-r-full bg-gradient-to-r ${item.cfg.barGradient} transition-all duration-300 ${
                hoveredRole === item.role ? 'brightness-125 scale-y-110' : ''
              }`}
              title={`${item.cfg.title}: ${item.count} (${item.pct.toFixed(1)}%)`}
              onMouseEnter={() => setHoveredRole(item.role)}
              onMouseLeave={() => setHoveredRole(null)}
            />
          ))}
        </div>
      </div>

      {/* Role Breakdown List */}
      <div className="space-y-2.5 pt-1">
        {items.map((item) => {
          const Icon = item.cfg.icon;
          const isHovered = hoveredRole === item.role;

          return (
            <div
              key={item.role}
              onMouseEnter={() => setHoveredRole(item.role)}
              onMouseLeave={() => setHoveredRole(null)}
              className={`group cursor-pointer rounded-xl border p-3 transition-all ${
                isHovered
                  ? 'border-line-strong bg-surface-2 shadow-sm'
                  : 'border-line/60 bg-inset/40 hover:bg-surface-2/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${item.cfg.borderTone} ${item.cfg.bgTone}`}
                    style={{ color: item.cfg.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">{item.cfg.title}</p>
                    <p className="text-[11px] text-ink-faint truncate">{item.cfg.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-black tabular-nums text-ink">
                    {formatNumber(item.count)}
                  </span>
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-bold tabular-nums text-ink-muted">
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${item.cfg.barGradient} transition-all duration-500`}
                  style={{ width: `${Math.max(3, item.pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
