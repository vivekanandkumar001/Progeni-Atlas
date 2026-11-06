export interface RepairDecision {
  allowed: boolean;
  terminal: boolean;
  reason?: 'terminal_max_attempts' | 'cooldown_active';
}

/**
 * Pure evaluation function for phone re-pairing attempts.
 * Prevents rapid infinite re-pairing loops by enforcing:
 * 1. A maximum attempt ceiling (default 3).
 * 2. A minimum cooldown period between attempts (default 10,000ms / 10s).
 */
export function evaluateRepairAttempt(
  lastAttemptTime: number,
  currentAttempts: number,
  maxAttempts: number = 3,
  cooldownMs: number = 10000,
  now: number = Date.now()
): RepairDecision {
  if (currentAttempts >= maxAttempts) {
    return {
      allowed: false,
      terminal: true,
      reason: 'terminal_max_attempts',
    };
  }

  if (lastAttemptTime > 0 && now - lastAttemptTime < cooldownMs) {
    return {
      allowed: false,
      terminal: false,
      reason: 'cooldown_active',
    };
  }

  return {
    allowed: true,
    terminal: false,
  };
}
