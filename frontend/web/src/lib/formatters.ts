/**
 * Shared formatting helpers across candidate, recruiter, and admin portals.
 */

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

/** Recommendation labels are shared by badges, tallies and summary cards. */
export function formatRecommendation(value: string | null | undefined): string {
  if (!value) return 'Not available yet';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Percentile is a rank, not a percentage; avoid "29.2th". */
export function formatPercentile(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Number(value.toFixed(1))} percentile`;
}

/** One label for seeded sessions across lists, reports and the lobby. */
export function formatDemoLabel(demoNumber?: number | string | null): string {
  const normalized = demoNumber == null ? '' : String(demoNumber).trim();
  return normalized ? `Demo #${normalized}` : 'Demo interview';
}
