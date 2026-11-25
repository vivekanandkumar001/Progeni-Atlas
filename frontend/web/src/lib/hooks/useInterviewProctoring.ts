'use client';

/**
 * useInterviewProctoring — DISCLOSED interaction counters, not surveillance.
 *
 * Face/gaze/emotion inference was removed by product decision: it produced no
 * employment-relevant signal, scared away the best candidates, and is legally
 * radioactive (NYC LL144, Illinois HB 3773, EU AI Act).
 *
 * What remains is exactly what we disclose in the lobby:
 *   - tab switch / window blur (document visibility + focus)
 *   - fullscreen exit (real mode only)
 *   - paste attempts (the editor shows its own honest notice)
 *   - mic / camera toggles (reported by the room)
 *
 * These are COUNTS for a human reviewer. They are never auto-scored, never
 * "violations", and they never terminate the interview.
 */

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { ProctoringHealthState } from '@/lib/proctoring/proctoringHealth';
import { apiFetch } from '@/lib/api';
import {
  createIntegritySessionState,
  shouldReportIntegrityEvent,
} from '@/lib/proctoring/integritySession';

export interface UseInterviewProctoringOptions {
  sessionId: string;
  stream: MediaStream | null;
  isInterviewActive: boolean;
  onViolationTerminated?: () => void;
}

export interface UseInterviewProctoringReturn {
  proctoringHealthState: ProctoringHealthState;
  proctoringStatus: 'secure' | 'face_warning' | 'tab_warning';
  proctoringReady: boolean;
  proctoringUnavailable: boolean;
  proctoringAlertBanner: string | null;
  proctoringWarningCount: number;
  bindProctoringVideo: (video: HTMLVideoElement | null) => (() => void) | undefined;
  recordProctoringEvent: (eventType: string, detail?: string, metadata?: Record<string, unknown>) => Promise<void>;
  proctoringVideoRef: React.RefObject<HTMLVideoElement | null>;
  proctoringFaceCountRef: React.MutableRefObject<number>;
  setProctoringStatus: React.Dispatch<React.SetStateAction<'secure' | 'face_warning' | 'tab_warning'>>;
  setProctoringAlertBanner: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useInterviewProctoring({
  sessionId,
  stream,
  isInterviewActive,
  onViolationTerminated,
}: UseInterviewProctoringOptions): UseInterviewProctoringReturn {
  // No detector to wait for — counters are live from the moment listeners bind.
  const [proctoringHealthState] = useState<ProctoringHealthState>('READY');
  const proctoringHealthRef = useRef<ProctoringHealthState>('READY');
  const [proctoringStatus, setProctoringStatus] = useState<'secure' | 'face_warning' | 'tab_warning'>('secure');
  const [proctoringAlertBanner, setProctoringAlertBanner] = useState<string | null>(null);
  const [proctoringReady] = useState(true);
  const [proctoringUnavailable] = useState(false);
  const [warningCountState, setWarningCountState] = useState({ sessionId, count: 0 });
  const proctoringWarningCount = warningCountState.sessionId === sessionId ? warningCountState.count : 0;
  const setProctoringWarningCount = useCallback((value: SetStateAction<number>) => {
    setWarningCountState((current) => {
      const count = current.sessionId === sessionId ? current.count : 0;
      return { sessionId, count: typeof value === 'function' ? value(count) : value };
    });
  }, [sessionId]);
  const integritySessionRef = useRef(createIntegritySessionState(sessionId));
  const proctoringVideoRef = useRef<HTMLVideoElement | null>(null);
  const proctoringFaceCountRef = useRef<number>(0);

  // Integrity counters belong to exactly one interview session.
  useEffect(() => {
    integritySessionRef.current = createIntegritySessionState(sessionId);

    if (!sessionId) return;
    let cancelled = false;
    void apiFetch(`/api/interview/${sessionId}/proctoring/events`, { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || integritySessionRef.current.sessionId !== sessionId) return;
        setProctoringWarningCount((count) => Math.max(count, Number(data.warningCount || 0)));
        // Counters are facts for a human reviewer, never a verdict shown to the candidate.
        if (data.flagged) {
          setProctoringStatus('tab_warning');
          setProctoringAlertBanner('The hiring team can see this session had several tab switches. It will be reviewed with the rest of your evidence.');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId, setProctoringAlertBanner, setProctoringStatus, setProctoringWarningCount]);

  useEffect(() => {
    if (integritySessionRef.current.sessionId === sessionId) {
      integritySessionRef.current.active = isInterviewActive;
    }
  }, [sessionId, isInterviewActive]);

  const recordProctoringEvent = useCallback(
    async (eventType: string, detail?: string, metadata?: Record<string, unknown>) => {
      const eventId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!shouldReportIntegrityEvent(integritySessionRef.current, sessionId, eventId)) return;

      try {
        const res = await apiFetch(`/api/interview/${sessionId}/proctoring/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: eventType, event_id: eventId, detail, metadata }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (integritySessionRef.current.sessionId !== sessionId) return;
        setProctoringWarningCount((count) => Math.max(count, Number(data.warningCount || 0)));
        if (data.flagged) {
          setProctoringStatus('tab_warning');
          setProctoringAlertBanner('A few tab switches have been noted for the hiring team — that is all. The interview continues as normal.');
        }
      } catch {
        /* telemetry must never interrupt the interview */
      }
    },
    [sessionId, setProctoringAlertBanner, setProctoringStatus, setProctoringWarningCount]
  );

  // Listeners: focus/visibility/fullscreen/clipboard — the disclosed counters.
  useEffect(() => {
    let disposed = false;
    const integrity = integritySessionRef.current;

    const emitEvent = (eventType: string, detail?: string, metadata?: Record<string, unknown>) => {
      void recordProctoringEvent(eventType, detail, metadata);
    };

    let pendingBlurTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFocusSignalAt = 0;
    const reportFocusSignal = (eventType: 'tab_switch' | 'window_blur', detail: string) => {
      const now = Date.now();
      if (!integrity.active || now - lastFocusSignalAt < 1000) return;
      lastFocusSignalAt = now;
      if (eventType === 'tab_switch') {
        setProctoringStatus('tab_warning');
        setProctoringAlertBanner('You switched away from the interview tab. The team can see the count — stay with us.');
      }
      emitEvent(eventType, detail);
    };

    const handleBlur = () => {
      if (!integrity.active || pendingBlurTimer !== null) return;
      pendingBlurTimer = setTimeout(() => {
        pendingBlurTimer = null;
        if (!document.hidden) reportFocusSignal('window_blur', 'Browser window lost focus while the interview was active.');
      }, 750);
    };

    const handleFocus = () => {
      if (pendingBlurTimer !== null) {
        clearTimeout(pendingBlurTimer);
        pendingBlurTimer = null;
      }
      if (!document.hidden) {
        setProctoringStatus('secure');
        setProctoringAlertBanner((current) => (current?.startsWith('You switched away') ? null : current));
      }
    };

    const handleVisibilityChange = () => {
      if (!integrity.active) return;
      if (document.hidden) {
        if (pendingBlurTimer !== null) {
          clearTimeout(pendingBlurTimer);
          pendingBlurTimer = null;
        }
        reportFocusSignal('tab_switch', 'Interview document became hidden.');
      } else {
        handleFocus();
      }
    };

    const handleFullscreen = () => {
      if (!integrity.active) return;
      if (!document.fullscreenElement) {
        setProctoringAlertBanner('Fullscreen mode was exited. The team will see this was noted — re-entering fullscreen is enough.');
        emitEvent('fullscreen_exit', 'Fullscreen mode exited.');
      }
    };

    const handleClipboard = (event: ClipboardEvent) => {
      if (!integrity.active) return;
      if (event.type === 'paste') {
        emitEvent('paste_event', 'Paste was attempted in the interview.', { action: event.type });
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('paste', handleClipboard);

    const videoTrack = stream ? stream.getVideoTracks()[0] ?? null : null;
    const handleCameraTrackEnded = () => {
      if (disposed) return;
      setProctoringStatus('tab_warning');
      setProctoringAlertBanner('⚠ Your camera stopped sending frames. Re-enable the camera to continue.');
      emitEvent('camera_disabled', 'The camera track ended while the interview was active.');
    };
    videoTrack?.addEventListener('ended', handleCameraTrackEnded);

    return () => {
      disposed = true;
      if (pendingBlurTimer !== null) clearTimeout(pendingBlurTimer);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      videoTrack?.removeEventListener('ended', handleCameraTrackEnded);
    };
  }, [stream, sessionId, recordProctoringEvent, setProctoringAlertBanner, setProctoringStatus]);

  const bindProctoringVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video) {
        proctoringVideoRef.current = null;
        return;
      }
      proctoringVideoRef.current = video;
      video.muted = true;
      video.playsInline = true;
      if (video.srcObject !== stream) video.srcObject = stream;
      if (stream) void video.play().catch(() => {});
      return () => {
        if (proctoringVideoRef.current === video) proctoringVideoRef.current = null;
        video.srcObject = null;
      };
    },
    [stream]
  );

  return {
    proctoringHealthState,
    proctoringStatus,
    proctoringReady,
    proctoringUnavailable,
    proctoringAlertBanner,
    proctoringWarningCount,
    bindProctoringVideo,
    recordProctoringEvent,
    proctoringVideoRef,
    proctoringFaceCountRef,
    setProctoringStatus,
    setProctoringAlertBanner,
  };
}
