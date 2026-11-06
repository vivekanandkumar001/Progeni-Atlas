/**
 * Pure proctoring state-machine helpers for the candidate interview room.
 *
 * No DOM, no React, no MediaPipe imports: every function here is deterministic
 * so the runtime contract (state machine, video readiness guard, episode
 * debounce, transition-only diagnostics) can be asserted directly by tests
 * instead of being re-implemented inside the test file.
 */

/** Detection state machine for the room's proctoring loop. */
export type ProctoringHealthState =
  | 'INITIALIZING'
  | 'CAMERA_WAITING'
  | 'READY'
  | 'DETECTING'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'ERROR';

export const PROCTORING_HEALTH_STATES: readonly ProctoringHealthState[] = [
  'INITIALIZING',
  'CAMERA_WAITING',
  'READY',
  'DETECTING',
  'NO_FACE',
  'MULTIPLE_FACES',
  'ERROR',
];

/** HTMLMediaElement.readyState === HAVE_CURRENT_DATA: a frame is available. */
export const HAVE_CURRENT_DATA = 2;

/**
 * Minimal structural view of a video element. Kept structural (instead of
 * `HTMLVideoElement`) so Node-based tests can exercise the real guard.
 */
export interface VideoLike {
  readonly srcObject?: unknown;
  readonly readyState?: number;
  readonly videoWidth?: number;
  readonly videoHeight?: number;
}

export interface VideoPipelineSnapshot {
  hasVideoElement: boolean;
  hasSrcObject: boolean;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
}

/** Snapshot the video readiness inputs; a missing element snapshots to all-zero. */
export function videoPipelineSnapshot(video: VideoLike | null | undefined): VideoPipelineSnapshot {
  if (!video) {
    return { hasVideoElement: false, hasSrcObject: false, readyState: 0, videoWidth: 0, videoHeight: 0 };
  }
  return {
    hasVideoElement: true,
    hasSrcObject: video.srcObject !== null && video.srcObject !== undefined,
    readyState: video.readyState ?? 0,
    videoWidth: video.videoWidth ?? 0,
    videoHeight: video.videoHeight ?? 0,
  };
}

/**
 * Video readiness guard that must hold before `FaceLandmarker.detectForVideo`:
 * element exists, a stream is bound, at least one frame is available, and the
 * decoded frame has non-zero dimensions in both axes.
 */
export function isVideoPipelineUsable(snapshot: VideoPipelineSnapshot): boolean {
  return (
    snapshot.hasVideoElement &&
    snapshot.hasSrcObject &&
    snapshot.readyState >= HAVE_CURRENT_DATA &&
    snapshot.videoWidth > 0 &&
    snapshot.videoHeight > 0
  );
}

export interface ProctoringStateInput {
  /** MediaPipe landmarker finished loading (WASM + model ready). */
  modelLoaded: boolean;
  /** `isVideoPipelineUsable()` result for the bound proctoring video element. */
  pipelineUsable: boolean;
  /** Faces from the last committed detection, or `null` when none committed yet. */
  faceCount: number | null;
  /** A model-load, camera-track or `detectForVideo` failure was observed. */
  hasError: boolean;
}

/**
 * The only place health state is derived. READY is never returned from a model
 * load alone: it requires a usable video pipeline, so "ready" always means the
 * camera feed is actually flowing into the detector.
 */
export function evaluateProctoringState(input: ProctoringStateInput): ProctoringHealthState {
  if (input.hasError) return 'ERROR';
  if (!input.modelLoaded) return 'INITIALIZING';
  if (!input.pipelineUsable) return 'CAMERA_WAITING';
  if (input.faceCount === null || input.faceCount === undefined) return 'READY';
  if (input.faceCount < 1) return 'NO_FACE';
  if (input.faceCount === 1) return 'DETECTING';
  return 'MULTIPLE_FACES';
}

/** Proctoring event reported for a committed face classification. */
export type FaceSignalEvent = 'no_face' | 'face_present' | 'multiple_faces';

export function faceSignalEvent(faceCount: number): FaceSignalEvent {
  if (faceCount < 1) return 'no_face';
  if (faceCount === 1) return 'face_present';
  return 'multiple_faces';
}

export interface EpisodeGate {
  /**
   * Returns `true` exactly once per sustained episode: on the
   * `requiredConsecutive`-th consecutive call, and never again until `reset`.
   */
  shouldFire(key: string): boolean;
  /** Clears the episode (condition recovered), allowing the next one to fire. */
  reset(key: string): void;
  /** Current consecutive count for the key (test/diagnostic helper). */
  count(key: string): number;
}

/**
 * Episode debounce used for every proctoring telemetry event. A condition must
 * hold for `requiredConsecutive` consecutive checks before it is reported, and
 * a sustained condition reports only once — recovery (`reset`) re-arms it.
 * This bounds client event volume regardless of how long a condition lasts.
 */
export function createEpisodeGate(requiredConsecutive = 3): EpisodeGate {
  const counts = new Map<string, number>();
  return {
    shouldFire(key: string): boolean {
      const next = (counts.get(key) ?? 0) + 1;
      if (next < requiredConsecutive) {
        counts.set(key, next);
        return false;
      }
      counts.set(key, requiredConsecutive);
      return next === requiredConsecutive;
    },
    reset(key: string): void {
      counts.delete(key);
    },
    count(key: string): number {
      return counts.get(key) ?? 0;
    },
  };
}

export interface ProctoringDiag {
  state: ProctoringHealthState;
  modelLoaded: boolean;
  width: number;
  height: number;
  faceCount: number;
}

/**
 * Transition-only diagnostic line, e.g.
 * `[PROCTORING_DIAG] landmarker=READY video=1280x720 faces=1 state=DETECTING`.
 * Callers log it only when the formatted line changes.
 */
export function formatProctoringDiag(diag: ProctoringDiag): string {
  return [
    `landmarker=${diag.modelLoaded ? 'READY' : 'LOADING'}`,
    `video=${diag.width}x${diag.height}`,
    `faces=${diag.faceCount}`,
    `state=${diag.state}`,
  ].join(' ');
}
