'use client';

import React, { useId, useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Zap, Info } from 'lucide-react';
import { formatNumber } from '@/lib/super-admin';

export interface TimeSeriesPoint {
  date: string;
  count: number;
  label?: string;
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  days: number;
  title?: string;
  subtitle?: string;
  tone?: 'cyan' | 'indigo' | 'emerald' | 'violet';
  unit?: string;
}

export function TimeSeriesChart({
  data,
  days,
  title = 'Activity Volume',
  subtitle,
  tone = 'cyan',
  unit = 'sessions',
}: TimeSeriesChartProps) {
  const chartId = useId();
  const [viewMode, setViewMode] = useState<'bars' | 'curve'>('bars');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Normalize data so every single day in the period is present in chronological order
  const normalizedData = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) {
      if (d && d.date) {
        map.set(d.date.slice(0, 10), (map.get(d.date.slice(0, 10)) || 0) + Number(d.count || 0));
      }
    }

    const result: TimeSeriesPoint[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = days - 1; offset >= 0; offset--) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - offset);
      const iso = dt.toISOString().slice(0, 10);
      result.push({
        date: iso,
        count: map.get(iso) ?? 0,
      });
    }

    return result;
  }, [data, days]);

  const total = useMemo(() => normalizedData.reduce((s, p) => s + p.count, 0), [normalizedData]);
  const max = useMemo(() => Math.max(...normalizedData.map((p) => p.count), 1), [normalizedData]);
  const activeDays = useMemo(() => normalizedData.filter((p) => p.count > 0).length, [normalizedData]);
  const peakDay = useMemo(() => {
    let peak = normalizedData[0];
    for (const p of normalizedData) {
      if (p.count > (peak?.count || 0)) peak = p;
    }
    return peak;
  }, [normalizedData]);

  const avgPerDay = (total / Math.max(1, days)).toFixed(1);

  // Tone palette
  const tones = {
    cyan: {
      barFill: 'from-cyan-500/20 via-cyan-500/70 to-cyan-400',
      barGlow: 'hover:shadow-[0_0_16px_rgba(6,182,212,0.45)]',
      areaStroke: '#06b6d4',
      areaGradient: ['#06b6d4', 'rgba(6, 182, 212, 0.0)'],
      accentDot: 'bg-cyan-400',
      activeText: 'text-accent-cyan',
      badgeBg: 'bg-cyan-500/10 text-accent-cyan border-cyan-500/30',
    },
    emerald: {
      barFill: 'from-emerald-500/20 via-emerald-500/70 to-emerald-400',
      barGlow: 'hover:shadow-[0_0_16px_rgba(16,185,129,0.45)]',
      areaStroke: '#10b981',
      areaGradient: ['#10b981', 'rgba(16, 185, 129, 0.0)'],
      accentDot: 'bg-emerald-400',
      activeText: 'text-accent-emerald',
      badgeBg: 'bg-emerald-500/10 text-accent-emerald border-emerald-500/30',
    },
    indigo: {
      barFill: 'from-indigo-500/20 via-indigo-500/70 to-indigo-400',
      barGlow: 'hover:shadow-[0_0_16px_rgba(99,102,241,0.45)]',
      areaStroke: '#6366f1',
      areaGradient: ['#6366f1', 'rgba(99, 102, 241, 0.0)'],
      accentDot: 'bg-indigo-400',
      activeText: 'text-accent-indigo',
      badgeBg: 'bg-indigo-500/10 text-accent-indigo border-indigo-500/30',
    },
    violet: {
      barFill: 'from-violet-500/20 via-violet-500/70 to-violet-400',
      barGlow: 'hover:shadow-[0_0_16px_rgba(139,92,246,0.45)]',
      areaStroke: '#8b5cf6',
      areaGradient: ['#8b5cf6', 'rgba(139, 92, 246, 0.0)'],
      accentDot: 'bg-violet-400',
      activeText: 'text-accent-violet',
      badgeBg: 'bg-violet-500/10 text-accent-violet border-violet-500/30',
    },
  }[tone];

  // SVG dimensions for curve mode
  const svgWidth = 800;
  const svgHeight = 180;
  const paddingX = 24;
  const paddingY = 24;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  // Build points for smooth curve
  const points = useMemo(() => {
    const len = normalizedData.length;
    return normalizedData.map((p, i) => {
      const x = paddingX + (len > 1 ? (i / (len - 1)) * chartW : chartW / 2);
      const y = paddingY + chartH - (max > 0 ? (p.count / max) * chartH : 0);
      return { x, y, ...p };
    });
  }, [normalizedData, chartW, chartH, max]);

  // Smooth spline curve algorithm
  const pathData = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return path;
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const baselineY = paddingY + chartH;
    return `${pathData} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
  }, [pathData, points, chartH]);

  const hoveredPoint = hoveredIdx !== null ? normalizedData[hoveredIdx] : null;

  const formatDateLabel = (isoDate: string) => {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const dt = new Date(year, month - 1, day);
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return isoDate.slice(5);
    }
  };

  const formatWeekday = (isoDate: string) => {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const dt = new Date(year, month - 1, day);
      return dt.toLocaleDateString(undefined, { weekday: 'narrow' });
    } catch {
      return '';
    }
  };

  const formatFullDate = (isoDate: string) => {
    try {
      const [year, month, day] = isoDate.split('-').map(Number);
      const dt = new Date(year, month - 1, day);
      return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  // Determine label interval so x-axis doesn't get cluttered for 30/90 days
  const labelInterval = days <= 14 ? 1 : days <= 30 ? 2 : 5;

  return (
    <div className="w-full">
      {/* Metrics Banner */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-3 sm:pb-4">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full no-scrollbar">
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-inset px-2.5 py-1 text-xs shrink-0 whitespace-nowrap">
            <span className="text-ink-faint">Total:</span>
            <span className="font-bold text-ink">{formatNumber(total)} {unit}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-inset px-2.5 py-1 text-xs shrink-0 whitespace-nowrap">
            <span className="text-ink-faint">Daily avg:</span>
            <span className="font-bold text-ink">{avgPerDay} / day</span>
          </div>
          {peakDay && peakDay.count > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-inset px-2.5 py-1 text-xs shrink-0 whitespace-nowrap">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-ink-faint">Peak:</span>
              <span className="font-bold text-ink">
                {peakDay.count} on {formatDateLabel(peakDay.date)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-inset px-2.5 py-1 text-xs shrink-0 whitespace-nowrap">
            <span className="text-ink-faint">Active:</span>
            <span className="font-bold text-ink">
              {activeDays} of {days} days
            </span>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center self-end sm:self-auto shrink-0 rounded-xl border border-line bg-inset p-1">
          <button
            type="button"
            onClick={() => setViewMode('bars')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'bars'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
            title="Bar Chart Mode"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Bars</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('curve')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'curve'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink'
            }`}
            title="Area Trend Mode"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Trend Line</span>
          </button>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="relative pt-2">
        {/* Floating Tooltip readout on top */}
        <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-1 text-xs">
          {hoveredPoint ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-semibold text-ink">{formatFullDate(hoveredPoint.date)}:</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tones.badgeBg}`}>
                {hoveredPoint.count} {unit}
              </span>
              <span className="text-ink-faint text-[11px]">
                ({total > 0 ? Math.round((hoveredPoint.count / total) * 100) : 0}% of window)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-ink-faint text-[11px] sm:text-xs">
              <Info className="h-3 w-3 shrink-0" />
              <span>Hover or tap any bar or trend point to inspect daily details</span>
            </div>
          )}
        </div>

        {/* ================= BAR MODE ================= */}
        {viewMode === 'bars' ? (
          <div className="relative overflow-x-auto pb-2 scrollbar-thin">
            <div className="relative min-w-[500px] sm:min-w-0">
              {/* Horizontal Grid lines */}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-48 flex-col justify-between text-[10px] text-ink-faint/60">
                <div className="flex items-center gap-2 border-b border-line/40">
                  <span className="w-6 text-right tabular-nums font-mono">{max}</span>
                </div>
                <div className="flex items-center gap-2 border-b border-dashed border-line/40">
                  <span className="w-6 text-right tabular-nums font-mono">{Math.round(max / 2)}</span>
                </div>
                <div className="flex items-center gap-2 border-b border-line/80">
                  <span className="w-6 text-right tabular-nums font-mono">0</span>
                </div>
              </div>

              {/* Bars Column Flow */}
              <div className="relative ml-8 flex h-48 items-end gap-1 sm:gap-2">
                {normalizedData.map((d, idx) => {
                  const heightPct = max > 0 ? (d.count / max) * 100 : 0;
                  const isHovered = hoveredIdx === idx;
                  const isPeak = d.count === max && max > 0;

                  return (
                    <div
                      key={d.date}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-xl transition-colors hover:bg-surface-2/60 cursor-pointer"
                    >
                      {/* The bar element with bounded width */}
                      <div className="relative flex w-full justify-center">
                        {d.count > 0 ? (
                          <div
                            className={`w-full max-w-[28px] sm:max-w-[36px] rounded-t-lg bg-gradient-to-t ${tones.barFill} transition-all duration-300 ${tones.barGlow} ${
                              isHovered ? 'scale-y-[1.03] brightness-125' : ''
                            }`}
                            style={{
                              height: `${Math.max(8, (heightPct / 100) * 160)}px`,
                              transformOrigin: 'bottom',
                            }}
                          >
                            {/* Highlight cap */}
                            <div className="h-1 w-full rounded-t-lg bg-white/40" />
                            {/* Value badge for peak or hovered */}
                            {(isHovered || isPeak) && (
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-surface border border-line px-1.5 py-0.5 text-[10px] font-bold text-ink shadow-md tabular-nums z-10 pointer-events-none">
                                {d.count}
                              </span>
                            )}
                          </div>
                        ) : (
                          /* Zero-day indicator baseline dot */
                          <div
                            className={`h-1.5 w-full max-w-[16px] rounded-full transition-colors ${
                              isHovered ? 'bg-cyan-500/50' : 'bg-surface-3'
                            }`}
                            title={`${d.date}: 0`}
                          />
                        )}
                      </div>

                      {/* Date label underneath */}
                      <div className="mt-2 flex flex-col items-center">
                        {idx % labelInterval === 0 && (
                          <>
                            <span className={`text-[10px] font-medium transition-colors ${isHovered ? tones.activeText : 'text-ink-muted'}`}>
                              {formatDateLabel(d.date)}
                            </span>
                            {days <= 14 && (
                              <span className="text-[9px] text-ink-faint">
                                {formatWeekday(d.date)}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================= CURVE MODE ================= */
          <div className="relative ml-6 sm:ml-8 overflow-x-auto pb-2 scrollbar-thin">
            <div className="relative min-w-[500px] sm:min-w-0">
            {/* SVG container */}
            <div className="relative h-48 w-full overflow-hidden rounded-xl border border-line bg-surface-2/40 p-2">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="h-full w-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tones.areaGradient[0]} stopOpacity="0.35" />
                    <stop offset="85%" stopColor={tones.areaGradient[0]} stopOpacity="0.05" />
                    <stop offset="100%" stopColor={tones.areaGradient[1]} stopOpacity="0.0" />
                  </linearGradient>
                  <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={tones.areaStroke} floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* Grid guidelines */}
                <line x1={paddingX} y1={paddingY} x2={svgWidth - paddingX} y2={paddingY} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                <line x1={paddingX} y1={paddingY + chartH / 2} x2={svgWidth - paddingX} y2={paddingY + chartH / 2} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 3" />
                <line x1={paddingX} y1={paddingY + chartH} x2={svgWidth - paddingX} y2={paddingY + chartH} stroke="currentColor" strokeOpacity="0.15" />

                {/* Filled Area */}
                <path d={areaPath} fill={`url(#grad-${chartId})`} />

                {/* Glowing Smooth Curve Stroke */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={tones.areaStroke}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#glow-${chartId})`}
                />

                {/* Point nodes */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  return (
                    <g key={pt.date}>
                      {pt.count > 0 && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 3.5}
                          fill={isHovered ? '#ffffff' : tones.areaStroke}
                          stroke={tones.areaStroke}
                          strokeWidth={isHovered ? 3 : 1.5}
                          className="transition-all duration-200"
                        />
                      )}
                      {/* Invisible hover trigger column */}
                      <rect
                        x={pt.x - chartW / (points.length * 2)}
                        y={0}
                        width={chartW / points.length}
                        height={svgHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      />
                    </g>
                  );
                })}

                {/* Vertical Scrubber Line on hover */}
                {hoveredIdx !== null && points[hoveredIdx] && (
                  <g pointerEvents="none">
                    <line
                      x1={points[hoveredIdx].x}
                      y1={paddingY}
                      x2={points[hoveredIdx].x}
                      y2={paddingY + chartH}
                      stroke={tones.areaStroke}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      strokeOpacity="0.8"
                    />
                    <circle
                      cx={points[hoveredIdx].x}
                      cy={points[hoveredIdx].y}
                      r={7}
                      fill="#ffffff"
                      stroke={tones.areaStroke}
                      strokeWidth="3"
                    />
                  </g>
                )}
              </svg>
            </div>

            {/* X-axis date labels */}
            <div className="mt-2 flex justify-between px-2 text-[10px] text-ink-muted">
              {normalizedData
                .filter((_, idx) => idx % labelInterval === 0 || idx === normalizedData.length - 1)
                .map((d) => (
                  <span key={d.date} className="font-medium">
                    {formatDateLabel(d.date)}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
