/**
 * Progeni Atlas — Desktop Media Device Probe
 * Pure utilities and device enumeration helpers for granular hardware detection.
 */

export type MediaErrorKind =
  | 'no_device'
  | 'permission_denied'
  | 'in_use'
  | 'secure_context'
  | 'unknown';

export interface DeviceProbeResult {
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoCount: number;
  audioCount: number;
  virtualCameraDetected: boolean;
  virtualCameraName: string | null;
}

export interface GranularMediaResult {
  stream: MediaStream | null;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  cameraError: MediaErrorKind | null;
  micError: MediaErrorKind | null;
  missing: {
    camera: boolean;
    mic: boolean;
  };
}

/**
 * True when the current document can use navigator.mediaDevices at all
 * (HTTPS, localhost, 127.0.0.1 or ::1). Returns true during SSR so callers
 * don't flash a warning before hydration.
 */
export function isMediaSecureContext(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.isSecureContext === 'boolean') return window.isSecureContext;
  const proto = window.location.protocol;
  const host = window.location.hostname;
  return (
    proto === 'https:' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1'
  );
}

const VIRTUAL_CAMERA_KEYWORDS = [
  'droidcam',
  'iriun',
  'camo',
  'epoccam',
  'obs virtual camera',
  'obs-camera',
  'vysor',
  'ivcam',
] as const;

/**
 * Classifies DOMExceptions / Media errors into standardized error kinds.
 */
export function classifyMediaError(err: unknown): MediaErrorKind {
  if (!err) return 'unknown';

  let name = '';
  let message = '';

  if (typeof err === 'object' && err !== null) {
    if ('name' in err && typeof (err as { name: unknown }).name === 'string') {
      name = (err as { name: string }).name.toLowerCase();
    }
    if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
      message = (err as { message: string }).message.toLowerCase();
    }
  } else if (typeof err === 'string') {
    message = err.toLowerCase();
  }

  const combined = (name + ' ' + message)?.toLowerCase();

  // Permission Denied / Not Allowed
  if (
    combined.includes('notallowederror') ||
    combined.includes('permissiondenied') ||
    combined.includes('securityerror') ||
    combined.includes('permission denied') ||
    combined.includes('not allowed') ||
    combined.includes('permission dismissed')
  ) {
    return 'permission_denied';
  }

  // Hardware not found / No devices
  if (
    combined.includes('notfounderror') ||
    combined.includes('devicesnotfound') ||
    combined.includes('requested device not found') ||
    combined.includes('no device') ||
    combined.includes('not found')
  ) {
    return 'no_device';
  }

  // In use / Hardware locked by another app
  if (
    combined.includes('notreadableerror') ||
    combined.includes('trackstarterror') ||
    combined.includes('aborterror') ||
    combined.includes('could not start video source') ||
    combined.includes('could not start audio source') ||
    combined.includes('already in use') ||
    combined.includes('device in use') ||
    combined.includes('concurrent')
  ) {
    return 'in_use';
  }

  return 'unknown';
}

/**
 * Checks if a device label indicates a virtual webcam / phone-over-USB/WiFi camera.
 */
export function isVirtualCameraLabel(label: string): boolean {
  if (!label || typeof label !== 'string') return false;
  const lower = label.toLowerCase();
  return VIRTUAL_CAMERA_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Extracts the matched virtual camera brand/app name from the device label.
 */
export function getVirtualCameraName(label: string): string | null {
  if (!label || typeof label !== 'string') return null;
  const lower = label.toLowerCase();
  for (const kw of VIRTUAL_CAMERA_KEYWORDS) {
    if (lower.includes(kw)) {
      if (kw.includes('droidcam')) return 'DroidCam';
      if (kw.includes('iriun')) return 'Iriun Webcam';
      if (kw.includes('camo')) return 'Camo';
      if (kw.includes('epoccam')) return 'EpocCam';
      if (kw.includes('obs')) return 'OBS Virtual Camera';
      if (kw.includes('ivcam')) return 'iVCam';
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }
  return null;
}

/**
 * Enumerates all connected media devices and checks for virtual camera drivers.
 */
export async function probeDevices(): Promise<DeviceProbeResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return {
      videoInputs: [],
      audioInputs: [],
      audioOutputs: [],
      videoCount: 0,
      audioCount: 0,
      virtualCameraDetected: false,
      virtualCameraName: null,
    };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');
    const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

    let virtualDetected = false;
    let virtualName: string | null = null;

    for (const v of videoInputs) {
      if (isVirtualCameraLabel(v.label)) {
        virtualDetected = true;
        virtualName = getVirtualCameraName(v.label);
        break;
      }
    }

    return {
      videoInputs,
      audioInputs,
      audioOutputs,
      videoCount: videoInputs.length,
      audioCount: audioInputs.length,
      virtualCameraDetected: virtualDetected,
      virtualCameraName: virtualName,
    };
  } catch (err) {
    console.warn('[DeviceProbe] Error enumerating devices:', err);
    return {
      videoInputs: [],
      audioInputs: [],
      audioOutputs: [],
      videoCount: 0,
      audioCount: 0,
      virtualCameraDetected: false,
      virtualCameraName: null,
    };
  }
}

/**
 * Requests camera and microphone SEPARATELY.
 * If microphone succeeds but camera fails (or vice versa), captures the working track
 * and returns granular errors and missing flags instead of failing completely.
 */
export async function requestMediaSeparately(options?: {
  videoDeviceId?: string;
  audioDeviceId?: string;
}): Promise<GranularMediaResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    // navigator.mediaDevices is only defined in a *secure context* (HTTPS or
    // localhost / 127.0.0.1). A plain-HTTP LAN origin (e.g. http://192.168.x.x:3000)
    // leaves it undefined, which is the usual cause of this failure.
    const insecureContext =
      typeof window !== 'undefined' && window.isSecureContext === false;
    if (insecureContext) {
      console.warn(
        '[MediaDiag] MEDIA_INIT_FAILED: Camera/microphone require a secure context ' +
          '(HTTPS or http://localhost / http://127.0.0.1). This page is running on ' +
          `"${typeof window !== 'undefined' ? window.location.origin : 'unknown'}" — ` +
          'open it via localhost or an HTTPS tunnel to enable getUserMedia.'
      );
    } else {
      console.warn('[MediaDiag] MEDIA_INIT_FAILED: getUserMedia API unavailable');
    }
    const kind: MediaErrorKind = insecureContext ? 'secure_context' : 'no_device';
    return {
      stream: null,
      videoTrack: null,
      audioTrack: null,
      cameraError: kind,
      micError: kind,
      missing: { camera: true, mic: true },
    };
  }

  let videoTrack: MediaStreamTrack | null = null;
  let audioTrack: MediaStreamTrack | null = null;
  let cameraError: MediaErrorKind | null = null;
  let micError: MediaErrorKind | null = null;

  // 1. Request Camera separately (Mobile-Safe Fallback Chain)
  try {
    let camStream: MediaStream | null = null;

    // Attempt A: User-selected device ID if provided
    if (options?.videoDeviceId && options.videoDeviceId.trim()) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: options.videoDeviceId },
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e) {
        console.warn('[MediaDiag] Specific deviceId camera request failed, falling back to mobile defaults:', e);
        camStream = null;
      }
    }

    // Attempt B: Mobile front-facing camera with ideal HD resolution
    if (!camStream) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Attempt C: Mobile front-facing camera without resolution constraints
        try {
          camStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'user' } },
            audio: false,
          });
        } catch {
          // Attempt D: Generic video: true
          camStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
    }

    const tracks = camStream ? camStream.getVideoTracks() : [];
    if (tracks.length > 0 && tracks[0].readyState === 'live') {
      videoTrack = tracks[0];
    } else {
      cameraError = 'no_device';
    }
  } catch (err) {
    cameraError = classifyMediaError(err);
    console.warn('[MediaDiag] Camera acquisition error:', cameraError, err);
  }

  // 2. Request Microphone separately (Mobile-Safe Fallback Chain)
  try {
    let micStream: MediaStream | null = null;

    // Attempt A: Selected audio device ID if provided
    if (options?.audioDeviceId && options.audioDeviceId.trim()) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { ideal: options.audioDeviceId },
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
          video: false,
        });
      } catch (e) {
        console.warn('[MediaDiag] Specific audioDeviceId microphone request failed, falling back:', e);
        micStream = null;
      }
    }

    // Attempt B: Ideal mobile audio constraints
    if (!micStream) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
          video: false,
        });
      } catch {
        // Attempt C: Generic audio: true
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
    }

    const tracks = micStream ? micStream.getAudioTracks() : [];
    if (tracks.length > 0 && tracks[0].readyState === 'live') {
      audioTrack = tracks[0];
    } else {
      micError = 'no_device';
    }
  } catch (err) {
    micError = classifyMediaError(err);
    console.warn('[MediaDiag] Microphone acquisition error:', micError, err);
  }

  // 3. Assemble combined MediaStream from available tracks
  const combinedTracks: MediaStreamTrack[] = [];
  if (videoTrack) combinedTracks.push(videoTrack);
  if (audioTrack) combinedTracks.push(audioTrack);

  const stream = combinedTracks.length > 0 ? new MediaStream(combinedTracks) : null;

  return {
    stream,
    videoTrack,
    audioTrack,
    cameraError,
    micError,
    missing: {
      camera: !videoTrack || videoTrack.readyState !== 'live',
      mic: !audioTrack || audioTrack.readyState !== 'live',
    },
  };
}
