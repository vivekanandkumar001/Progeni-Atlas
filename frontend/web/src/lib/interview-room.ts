import { POST_PREFLIGHT_STATES, STAGES } from '@/app/candidate/interview/[id]/room/room-types';

// Pure business logic shared by the live interview room screen. No React, no
// I/O: every function here is a pure move out of room/page.tsx.

// Turn math: clamp the server turn index onto the fixed STAGES list.
export function mapTurnIndexToStage(turnIndex: number): string {
  return STAGES[Math.min(turnIndex, STAGES.length - 1)] || STAGES[0];
}

export function findStageIndexByName(stageName: string): number {
  return Math.max(
    0,
    STAGES.findIndex((s) => s?.toLowerCase() === stageName?.toLowerCase())
  );
}

// Message classification: a preflight that failed with 409 / MEDIA_READY (or a
// state already past MEDIA_READY) means the stage was already satisfied, so the
// failure is treated as success and the flow continues to /start.
export function isPreflightAlreadySatisfiedError(preflightErr: unknown): boolean {
  const err = preflightErr as { status_code?: number; current_state?: string } | null | undefined;
  const errMsg = preflightErr instanceof Error ? preflightErr.message : String(preflightErr);
  const stateFromErr = err?.current_state;
  return Boolean(
    err?.status_code === 409 ||
      stateFromErr === 'MEDIA_READY' ||
      (stateFromErr && POST_PREFLIGHT_STATES.includes(stateFromErr)) ||
      errMsg.includes('409') ||
      errMsg.includes('MEDIA_READY')
  );
}

// Message classification: /start was refused because the session already began
// — recover by reading the current state instead of failing the interview.
export function isInterviewAlreadyStartedError(err: unknown): boolean {
  const errMsg = err instanceof Error ? err.message : String(err);
  return (
    errMsg.includes('already has a start time') ||
    errMsg.includes('already started') ||
    errMsg.includes('409')
  );
}

// Message classification: the session is already final server-side, so the
// conclusion flow may proceed straight to the redirect.
export function isConclusionAlreadyFinalMessage(msg: string): boolean {
  return msg.includes('already') || msg.includes('COMPLETED') || msg.includes('ended');
}

// Message classification: authentication/expiry failures route the candidate
// to the expired-session screen instead of showing a generic error banner.
export function isSessionExpiredApiError(apiError: string): boolean {
  return (
    apiError.includes('Session expired') ||
    apiError.includes('log in again') ||
    apiError.includes('Authentication required')
  );
}
