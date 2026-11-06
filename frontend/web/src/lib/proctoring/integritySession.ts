/** Small per-interview integrity state; deliberately independent of React/DOM. */
export interface IntegritySessionState {
  sessionId: string;
  active: boolean;
  seenEventIds: Set<string>;
}

export function createIntegritySessionState(sessionId: string): IntegritySessionState {
  return {
    sessionId,
    active: false,
    seenEventIds: new Set(),
  };
}

/**
 * Reject pre-start events and duplicate deliveries without suppressing a
 * distinct event of the same type. Server-side idempotency applies the same
 * event id in case a request is retried after leaving the browser.
 */
export function shouldReportIntegrityEvent(
  state: IntegritySessionState,
  sessionId: string,
  eventId: string,
): boolean {
  if (!state.active || state.sessionId !== sessionId || state.seenEventIds.has(eventId)) return false;
  state.seenEventIds.add(eventId);
  return true;
}

export interface SustainedEpisodeGate {
  shouldFire(key: string, condition: boolean, now: number): boolean;
  reset(key: string): void;
}

/** A signal must remain continuously true for the supplied duration to fire. */
export function createSustainedEpisodeGate(durationMs: number): SustainedEpisodeGate {
  const startedAt = new Map<string, number>();
  const fired = new Set<string>();
  return {
    shouldFire(key, condition, now) {
      if (!condition) {
        startedAt.delete(key);
        fired.delete(key);
        return false;
      }
      if (fired.has(key)) return false;
      const start = startedAt.get(key) ?? now;
      startedAt.set(key, start);
      if (now - start < durationMs) return false;
      fired.add(key);
      return true;
    },
    reset(key) {
      startedAt.delete(key);
      fired.delete(key);
    },
  };
}
