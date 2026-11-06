/** Display-only one-second ticker. Server timestamps/deadlines remain authoritative. */
export function startInterviewCountdownTicker(onTick: () => void): () => void {
  const interval = setInterval(onTick, 1000);
  return () => clearInterval(interval);
}

/** Preserve an authoritative zero; missing values are never replaced with duration. */
export function readAuthoritativeSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.ceil(value))
    : null;
}

export function decrementDisplayedSeconds(value: number | null): number | null {
  return value === null ? null : Math.max(0, value - 1);
}
