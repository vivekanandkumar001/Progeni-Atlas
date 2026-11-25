const MS_PER_DAY = 86_400_000;

/**
 * ISO-8601 week number (Monday-start weeks, week 1 contains the first
 * Thursday). A plain "days since Jan 1" calculation drifts from ISO weeks at
 * year boundaries, which is why the dashboard week pill can be wrong.
 */
export function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // Mon = 0 ... Sun = 6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // Thursday of this week

  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);

  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
}

/** Absolute, locale-stable timestamp for candidate-facing lists. */
export function formatAbsoluteDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'Date unavailable';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** One authoritative date format for report headers and printable summaries. */
export function formatInterviewDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Date unavailable';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
