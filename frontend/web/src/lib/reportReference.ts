import { formatInterviewDate } from './dateTime';

/**
 * Stable, human-readable report reference derived from report metadata.
 * Deliberately does not include the internal session id, which is only needed
 * as a route parameter and must not appear in candidate-facing copy or print.
 */
export function buildReportReference(
  interviewDate: string | null | undefined,
  roleTitle: string | null | undefined
): string {
  const datePart = interviewDate ? formatInterviewDate(interviewDate) : 'Date unavailable';
  const compactDate = /^\d{2} \w{3} (\d{4})$/.exec(datePart)?.[1] ??
    (() => {
      const parsed = interviewDate ? new Date(interviewDate) : null;
      return parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getFullYear()) : 'DATE';
    })();

  const rolePart =
    (roleTitle ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase())
      .filter(Boolean)
      .join('-') || 'INTERVIEW';

  return `PG-${compactDate}-${rolePart}`;
}
