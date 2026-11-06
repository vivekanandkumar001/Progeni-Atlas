'use client';

import { useEffect } from 'react';

/**
 * Global guard for browser Web Stream teardown race conditions.
 *
 * When navigating away or unmounting WebRTC/LiveKit/React 19 streaming connections,
 * the browser may close the underlying writable stream before cleanup routines finish.
 * Chromium throws `TypeError: Cannot write to a CLOSED writable stream` or
 * `TypeError: Cannot close a CLOSED writable stream`.
 * This guard catches these benign teardown rejections and prevents noisy unhandled errors.
 */
export function StreamErrorGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isClosedStreamError = (err: unknown): boolean => {
      const msg =
        (err as { message?: string })?.message ||
        (err as { stack?: string })?.stack ||
        (typeof err === 'string' ? err : String(err || ''));
      return (
        msg.includes('CLOSED writable stream') ||
        msg.includes('closed writable stream') ||
        msg.includes('WritableStreamDefaultWriter') ||
        msg.includes('Cannot close a CLOSED') ||
        msg.includes('Cannot write to a CLOSED') ||
        msg.includes('closed or errored')
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (isClosedStreamError(event?.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    };

    const handleError = (event: ErrorEvent) => {
      if (isClosedStreamError(event?.error || event?.message)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    };

    const origConsoleError = console.error;
    console.error = function (...args: unknown[]) {
      for (const arg of args) {
        if (isClosedStreamError(arg)) {
          return;
        }
      }
      origConsoleError.apply(console, args);
    };

    window.addEventListener('unhandledrejection', handleRejection, true);
    window.addEventListener('error', handleError, true);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection, true);
      window.removeEventListener('error', handleError, true);
      console.error = origConsoleError;
    };
  }, []);

  return null;
}
