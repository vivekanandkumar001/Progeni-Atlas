'use client';

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import FRONTEND_CONFIG from '@/lib/config';
import { apiFetch } from '@/lib/api';
import {
  type ProctoringHealthState,
  createEpisodeGate,
  evaluateProctoringState,
  faceSignalEvent,
  formatProctoringDiag,
  isVideoPipelineUsable,
  videoPipelineSnapshot,
} from '@/lib/proctoring/proctoringHealth';
import {
  createIntegritySessionState,
  createSustainedEpisodeGate,
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
  const [proctoringHealthState, setProctoringHealthState] = useState<ProctoringHealthState>('INITIALIZING');
  const proctoringHealthRef = useRef<ProctoringHealthState>('INITIALIZING');
  type ProctoringStatus = 'secure' | 'face_warning' | 'tab_warning';
  const [proctoringUiState, setProctoringUiState] = useState<{
    sessionId: string;
    status: ProctoringStatus;
    alert: string | null;
  }>({ sessionId, status: 'secure', alert: null });
  const proctoringStatus = proctoringUiState.sessionId === sessionId ? proctoringUiState.status : 'secure';
  const proctoringAlertBanner = proctoringUiState.sessionId === sessionId ? proctoringUiState.alert : null;
  const setProctoringStatus: Dispatch<SetStateAction<ProctoringStatus>> = useCallback((value) => {
    setProctoringUiState((current) => {
      const status = current.sessionId === sessionId ? current.status : 'secure';
      return { sessionId, status: typeof value === 'function' ? value(status) : value,
        alert: current.sessionId === sessionId ? current.alert : null };
    });
  }, [sessionId]);
  const setProctoringAlertBanner: Dispatch<SetStateAction<string | null>> = useCallback((value) => {
    setProctoringUiState((current) => {
      const alert = current.sessionId === sessionId ? current.alert : null;
      return { sessionId, status: current.sessionId === sessionId ? current.status : 'secure',
        alert: typeof value === 'function' ? value(alert) : value };
    });
  }, [sessionId]);
  const [proctoringReady, setProctoringReady] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      ((window as any).__PLAYWRIGHT_TEST__ || process.env.NEXT_PUBLIC_MOCK_PROCTORING === 'true')
    ) {
      setProctoringReady(true);
    }
  }, []);

  const [proctoringUnavailable, setProctoringUnavailable] = useState(false);
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

  const applyProctoringHealth = useCallback((next: ProctoringHealthState): boolean => {
    if (proctoringHealthRef.current === next) return false;
    proctoringHealthRef.current = next;
    setProctoringHealthState(next);
    return true;
  }, []);

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

  const isProctoringFlaggedRef = useRef<boolean>(false);
  const noFaceStartTimeRef = useRef<number | null>(null);

  // Integrity counters, dedupe history and flagged state belong to exactly one
  // interview session. Reused room components must never carry them to a new id.
  useEffect(() => {
    integritySessionRef.current = createIntegritySessionState(sessionId);
    isProctoringFlaggedRef.current = false;
    noFaceStartTimeRef.current = null;

    if (!sessionId) return;
    let cancelled = false;
    void apiFetch(`/api/interview/${sessionId}/proctoring/events`, { method: 'GET', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || integritySessionRef.current.sessionId !== sessionId) return;
        setProctoringWarningCount((count) => Math.max(count, Number(data.warningCount || 0)));
        isProctoringFlaggedRef.current = Boolean(data.flagged);
        if (data.flagged) {
          setProctoringStatus('tab_warning');
          setProctoringAlertBanner('Interview integrity threshold reached. This session has been flagged for recruiter review.');
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

  const onViolationTerminatedRef = useRef(onViolationTerminated);
  useEffect(() => {
    onViolationTerminatedRef.current = onViolationTerminated;
  }, [onViolationTerminated]);

  const recordProctoringEvent = useCallback(
    async (eventType: string, detail?: string, metadata?: Record<string, unknown>) => {
      const eventId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!shouldReportIntegrityEvent(integritySessionRef.current, sessionId, eventId)) return;
      if (isProctoringFlaggedRef.current) {
        return;
      }

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
        if (data.terminated || data.state === 'PROCTORING_VIOLATION') {
          isProctoringFlaggedRef.current = true;
          setProctoringStatus('tab_warning');
          setProctoringAlertBanner('⛔ Interview terminated due to multiple integrity violations.');
          onViolationTerminatedRef.current?.();
        } else if (data.flagged) {
          isProctoringFlaggedRef.current = true;
          setProctoringStatus('tab_warning');
          setProctoringAlertBanner(
            'Interview integrity threshold reached. This session has been flagged for recruiter review.'
          );
        }
      } catch {
        /* telemetry must never interrupt the interview */
      }
    },
    [sessionId, setProctoringAlertBanner, setProctoringStatus, setProctoringWarningCount]
  );

  // 15-second fail-closed proctoring health timeout
  useEffect(() => {
    if (!sessionId) return;
    const timeout = setTimeout(() => {
      if (
        !proctoringReady &&
        proctoringHealthRef.current !== 'READY' &&
        proctoringHealthRef.current !== 'DETECTING'
      ) {
        console.warn('[PROCTORING_FAIL_CLOSED] MediaPipe health failed to reach READY/DETECTING within 15 seconds.');
        setProctoringUnavailable(true);
        setProctoringStatus('tab_warning');
        setProctoringAlertBanner(
          '⚠ Camera/proctoring not working. Integrity checks could not be started within 15 seconds.'
        );
        void apiFetch(`/api/interview/${sessionId}/proctoring/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_type: 'proctoring_error',
            detail: 'Camera/proctoring failed to initialize within 15 seconds',
          }),
        }).catch(() => {});
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [sessionId, proctoringReady]);

  const recordProctoringEventRef = useRef(recordProctoringEvent);
  useEffect(() => {
    recordProctoringEventRef.current = recordProctoringEvent;
  }, [recordProctoringEvent]);

  // Main Detection loop & listeners
  useEffect(() => {
    let disposed = false;
    let landmarker: FaceLandmarker | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let modelLoaded = false;
    let pipelineWasUsable = false;
    let lastDiagLine = '';
    let baselineYaw: number | null = null;
    let baselinePitch: number | null = null;
    const calibrationSamples: Array<{ yaw: number; pitch: number }> = [];
    const informationalGate = createEpisodeGate(3);
    // Three detector frames (300ms) are not meaningful evidence of a sustained
    // pose. Require 1.5 seconds of continuous classification for warning signals.
    const sustainedGate = createSustainedEpisodeGate(1500);
    const noFaceEpisode = createSustainedEpisodeGate(0);
    const postedFailures = new Set<string>();

    const emitEvent = (eventType: string, detail?: string, metadata?: Record<string, unknown>) => {
      void recordProctoringEventRef.current(eventType, detail, metadata);
    };

    const logDiagnostics = () => {
      const snapshot = videoPipelineSnapshot(proctoringVideoRef.current);
      const line = formatProctoringDiag({
        state: proctoringHealthRef.current,
        modelLoaded,
        width: snapshot.videoWidth,
        height: snapshot.videoHeight,
        faceCount: proctoringFaceCountRef.current,
      });
      if (line === lastDiagLine) return;
      lastDiagLine = line;
    };

    const applyHealth = (next: ProctoringHealthState) => {
      if (applyProctoringHealth(next)) logDiagnostics();
    };

    const postFailureEvent = (type: 'camera_error' | 'proctoring_error', detail: string) => {
      if (postedFailures.has(type)) return;
      postedFailures.add(type);
      emitEvent(type, detail);
    };

    const stopLoop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (landmarker) {
        try {
          landmarker.close();
        } catch {}
        landmarker = null;
      }
    };

    const failDetector = (err: unknown, detail: string) => {
      if (disposed) return;
      stopLoop();
      modelLoaded = false;
      applyHealth('ERROR');
      setProctoringReady(false);
      setProctoringUnavailable(true);
      setProctoringStatus('tab_warning');
      setProctoringAlertBanner('⚠ Proctoring detector is unavailable. Interview integrity checks cannot run.');
      postFailureEvent('proctoring_error', detail);
      console.error('[PROCTORING_DIAG] detector failure:', err);
    };

    let pendingBlurTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFocusSignalAt = 0;
    const reportFocusSignal = (eventType: 'tab_switch' | 'window_blur', detail: string) => {
      const now = Date.now();
      if (!integritySessionRef.current.active || now - lastFocusSignalAt < 1000) return;
      lastFocusSignalAt = now;
      // A visible-window blur can be caused by browser permission UI (including
      // microphone access). Report it as INFO, but only a hidden document is a
      // focus warning for the candidate.
      if (eventType === 'tab_switch') {
        setProctoringStatus('tab_warning');
        setProctoringAlertBanner('⚠ Focus lost — window/tab switching detected.');
      }
      emitEvent(eventType, detail);
    };

    const handleBlur = () => {
      if (!integritySessionRef.current.active || pendingBlurTimer !== null) return;
      // Fullscreen and browser permission transitions can briefly blur the page.
      // A delayed blur is informational unless visibility also confirms a switch.
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
      if (!document.hidden && !isProctoringFlaggedRef.current) {
        setProctoringStatus('secure');
        setProctoringAlertBanner((current) => current?.startsWith('⚠ Focus lost') ? null : current);
      }
    };

    const handleVisibilityChange = () => {
      if (!integritySessionRef.current.active) return;
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
      if (!integritySessionRef.current.active) return;
      if (!document.fullscreenElement) {
        setProctoringStatus('tab_warning');
        setProctoringAlertBanner('⚠ Fullscreen mode was exited.');
        emitEvent('fullscreen_exit', 'Fullscreen mode exited.');
      }
    };

    const handleClipboard = (event: ClipboardEvent) => {
      if (!integritySessionRef.current.active) return;
      event.preventDefault();
      emitEvent('copy_paste_attempt', 'Clipboard action was attempted.', { action: event.type });
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
      stopLoop();
      applyHealth('ERROR');
      setProctoringReady(false);
      setProctoringUnavailable(true);
      setProctoringStatus('tab_warning');
      setProctoringAlertBanner('⚠ Camera stopped sending frames. Re-enable your camera to continue.');
      postFailureEvent('camera_error', 'The camera track ended while proctoring was active.');
    };
    videoTrack?.addEventListener('ended', handleCameraTrackEnded);

    let lastTimestamp = 0;
    let consecutiveErrors = 0;

    const tick = () => {
      if (disposed || !landmarker) return;
      const snapshot = videoPipelineSnapshot(proctoringVideoRef.current);
      const usable = isVideoPipelineUsable(snapshot);

      if (!usable) {
        pipelineWasUsable = false;
        proctoringFaceCountRef.current = 0;
        applyHealth(
          evaluateProctoringState({ modelLoaded: !!landmarker, pipelineUsable: false, faceCount: null, hasError: false })
        );
        return;
      }

      if (!pipelineWasUsable) {
        pipelineWasUsable = true;
        applyHealth('READY');
        return;
      }

      if (!modelLoaded) return;

      const video = proctoringVideoRef.current;
      if (!video || video.videoWidth <= 0 || video.videoHeight <= 0 || video.readyState < 2) {
        return;
      }

      const now = performance.now();
      const timestamp = now > lastTimestamp ? now : lastTimestamp + 1;
      lastTimestamp = timestamp;

      let result;
      try {
        result = landmarker.detectForVideo(video, timestamp);
        consecutiveErrors = 0;
      } catch (detErr) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          failDetector(detErr, 'detectForVideo failed continuously while analysing live camera frames.');
        } else {
          console.warn('[PROCTORING_DIAG] Transient detectForVideo frame failure (retrying):', detErr);
        }
        return;
      }

      const faces = result?.faceLandmarks ?? [];
      const faceCount = faces.length;
      proctoringFaceCountRef.current = faceCount;
      setProctoringReady(true);
      setProctoringUnavailable(false);
      applyHealth(evaluateProctoringState({ modelLoaded: true, pipelineUsable: true, faceCount, hasError: false }));

      if (!integritySessionRef.current.active) {
        noFaceStartTimeRef.current = null;
        for (const signal of ['no_face', 'multiple_faces', 'face_out_of_frame', 'leaning', 'looking_away', 'head_down']) {
          sustainedGate.reset(signal);
        }
        noFaceEpisode.reset('no_face');
        informationalGate.reset('face_present');
        return;
      }

      const signal = faceSignalEvent(faceCount);
      if (signal === 'no_face') {
        if (noFaceStartTimeRef.current === null) {
          noFaceStartTimeRef.current = Date.now();
        }
        const noFaceDuration = Date.now() - noFaceStartTimeRef.current;
        if (noFaceDuration >= 2000) {
          applyHealth(evaluateProctoringState({ modelLoaded: true, pipelineUsable: true, faceCount: 0, hasError: false }));
          if (noFaceEpisode.shouldFire('no_face', true, Date.now())) emitEvent('no_face', 'No face detected continuously for at least two seconds.');
        } else {
          noFaceEpisode.reset('no_face');
          applyHealth(evaluateProctoringState({ modelLoaded: true, pipelineUsable: true, faceCount: 1, hasError: false }));
        }
      } else {
        noFaceStartTimeRef.current = null;
        noFaceEpisode.reset('no_face');
        applyHealth(evaluateProctoringState({ modelLoaded: true, pipelineUsable: true, faceCount, hasError: false }));
      }

      if (signal === 'multiple_faces') {
        if (sustainedGate.shouldFire('multiple_faces', true, Date.now()))
          emitEvent('multiple_faces', 'Multiple faces detected.', { count: faceCount });
      } else {
        sustainedGate.reset('multiple_faces');
      }

      if (signal === 'face_present') {
        if (informationalGate.shouldFire('face_present')) emitEvent('face_present', 'Face present in frame.');
      } else {
        informationalGate.reset('face_present');
      }

      const lm = faces[0];
      if (!lm) return;
      const nose = lm[1],
        leftEye = lm[33],
        rightEye = lm[263];
      if (!nose || !leftEye || !rightEye) return;
      const eyeMidX = (leftEye.x + rightEye.x) / 2;
      const eyeMidY = (leftEye.y + rightEye.y) / 2;
      const rawYaw = nose.x - eyeMidX;
      const rawPitch = nose.y - eyeMidY;

      if (baselineYaw === null || baselinePitch === null) {
        calibrationSamples.push({ yaw: rawYaw, pitch: rawPitch });
        if (calibrationSamples.length >= 10) {
          const sumY = calibrationSamples.reduce((a, b) => a + b.yaw, 0);
          const sumP = calibrationSamples.reduce((a, b) => a + b.pitch, 0);
          baselineYaw = sumY / calibrationSamples.length;
          baselinePitch = sumP / calibrationSamples.length;
        }
      }

      const yaw = baselineYaw !== null ? rawYaw - baselineYaw : rawYaw;
      const pitch = baselinePitch !== null ? rawPitch - baselinePitch : rawPitch;
      const roll = Math.abs(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x));

      if (roll > 0.18) {
        if (sustainedGate.shouldFire('leaning', true, Date.now())) emitEvent('leaning', 'Sustained head/body lean detected.', { roll });
      } else sustainedGate.reset('leaning');

      const out = nose.x < 0.08 || nose.x > 0.92 || nose.y < 0.08 || nose.y > 0.92;
      if (out) {
        if (sustainedGate.shouldFire('face_out_of_frame', true, Date.now())) emitEvent('face_out_of_frame', 'Face remained out of frame.');
      } else sustainedGate.reset('face_out_of_frame');

      if (Math.abs(yaw) > 0.08) {
        if (sustainedGate.shouldFire('looking_away', true, Date.now()))
          emitEvent('looking_away', 'Head orientation indicates looking away.', {
            yaw,
            rawYaw,
            baselineYaw,
          });
      } else sustainedGate.reset('looking_away');

      if (pitch > 0.1) {
        if (sustainedGate.shouldFire('head_down', true, Date.now()))
          emitEvent('head_down', 'Head pose indicates sustained downward posture.', {
            pitch,
            rawPitch,
            baselinePitch,
          });
      } else sustainedGate.reset('head_down');
    };

    let isInitializing = false;
    const runFaceDetection = async () => {
      if (!stream) {
        applyHealth(
          evaluateProctoringState({ modelLoaded: false, pipelineUsable: false, faceCount: null, hasError: false })
        );
        setProctoringReady(false);
        return;
      }
      if (isInitializing || landmarker) return;
      isInitializing = true;
      try {
        applyHealth('INITIALIZING');
        const vision = await import('@mediapipe/tasks-vision');
        if (disposed) return;
        const fileset = await vision.FilesetResolver.forVisionTasks('/mediapipe/tasks-vision/wasm');
        if (disposed) return;
        const loaded = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FRONTEND_CONFIG.mediaPipeFaceModelUrl },
          runningMode: 'VIDEO',
          numFaces: 3,
          minFaceDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
        if (disposed) {
          try {
            loaded.close();
          } catch {}
          return;
        }

        landmarker = loaded;
        modelLoaded = true;
        setProctoringUnavailable(false);
        applyHealth(
          evaluateProctoringState({
            modelLoaded: true,
            pipelineUsable: isVideoPipelineUsable(videoPipelineSnapshot(proctoringVideoRef.current)),
            faceCount: null,
            hasError: false,
          })
        );
        logDiagnostics();

        if (!interval) {
          interval = setInterval(tick, 100);
        }
      } catch (initErr) {
        if (disposed) return;
        let errMsg = 'FaceLandmarker or tasks-vision WASM fileset failed to load.';
        if (initErr instanceof Event) {
          errMsg = `WASM asset loading event failed (${initErr.type} on ${(initErr.target as HTMLElement)?.tagName || 'element'})`;
        } else if (initErr instanceof Error) {
          errMsg = initErr.message;
        }
        console.warn('[PROCTORING_DIAG] FaceLandmarker initialization transient failure, retrying once...', initErr);
        await new Promise((r) => setTimeout(r, 1000));
        if (disposed) return;
        try {
          const vision = await import('@mediapipe/tasks-vision');
          if (disposed) return;
          const fileset = await vision.FilesetResolver.forVisionTasks('/mediapipe/tasks-vision/wasm');
          if (disposed) return;
          const loaded = await vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FRONTEND_CONFIG.mediaPipeFaceModelUrl },
            runningMode: 'VIDEO',
            numFaces: 3,
            minFaceDetectionConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
          if (disposed) {
            try { loaded.close(); } catch {}
            return;
          }
          landmarker = loaded;
          modelLoaded = true;
          setProctoringUnavailable(false);
          applyHealth(
            evaluateProctoringState({
              modelLoaded: true,
              pipelineUsable: isVideoPipelineUsable(videoPipelineSnapshot(proctoringVideoRef.current)),
              faceCount: null,
              hasError: false,
            })
          );
          logDiagnostics();
          if (!interval) {
            interval = setInterval(tick, 100);
          }
        } catch (retryErr) {
          if (disposed) return;
          failDetector(retryErr, errMsg);
        }
      } finally {
        isInitializing = false;
      }
    };

    void runFaceDetection();

    return () => {
      disposed = true;
      stopLoop();
      if (pendingBlurTimer !== null) clearTimeout(pendingBlurTimer);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      videoTrack?.removeEventListener('ended', handleCameraTrackEnded);
    };
  }, [stream, sessionId, applyProctoringHealth, setProctoringAlertBanner, setProctoringStatus]);

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
