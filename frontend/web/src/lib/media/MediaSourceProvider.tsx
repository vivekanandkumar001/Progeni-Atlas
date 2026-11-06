'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Room,
  RoomEvent,
  ConnectionState,
  RemoteTrack,
  Track,
} from 'livekit-client';
import {
  probeDevices,
  requestMediaSeparately,
  type DeviceProbeResult,
  type MediaErrorKind,
} from './deviceProbe';
import { apiFetch, isValidSessionId } from '@/lib/api';
import FRONTEND_CONFIG from '@/lib/config';

export type MediaSourceType = 'local' | 'phone' | 'none';

export interface PairingInfo {
  token: string;
  expiresAt: string;
  qrUrl: string;
}

export interface MediaSourceContextValue {
  source: MediaSourceType;
  stream: MediaStream | null;
  status: 'idle' | 'probing' | 'ready' | 'connecting_phone' | 'error';
  liveKitConnected: boolean;
  missing: {
    camera: boolean;
    mic: boolean;
  };
  errorKind: MediaErrorKind | null;
  cameraError: MediaErrorKind | null;
  micError: MediaErrorKind | null;
  phoneStatus: ConnectionState | 'idle' | 'expired';
  pairing: PairingInfo | null;
  probeResult: DeviceProbeResult | null;
  audioUnlocked: boolean;
  unlockAudio: () => Promise<boolean>;
  enableMediaAndAudio: () => Promise<boolean>;
  startPairing: () => Promise<void>;
  cancelPairing: () => void;
  retryLocal: () => Promise<void>;
  setLocalDevices: (videoDeviceId?: string, audioDeviceId?: string) => Promise<void>;
  toggleMic: () => boolean;
  toggleCamera: () => boolean;
  stopAll: () => void;
}

const MediaSourceContext = createContext<MediaSourceContextValue | null>(null);

interface MediaSourceProviderProps {
  sessionId: string;
  children: React.ReactNode;
}

export function MediaSourceProvider({ sessionId, children }: MediaSourceProviderProps) {
  const [source, setSource] = useState<MediaSourceType>('none');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [liveKitConnected, setLiveKitConnected] = useState(false);
  const [status, setStatus] = useState<'idle' | 'probing' | 'ready' | 'connecting_phone' | 'error'>('idle');
  const [missing, setMissing] = useState<{ camera: boolean; mic: boolean }>({ camera: true, mic: true });
  const [cameraError, setCameraError] = useState<MediaErrorKind | null>(null);
  const [micError, setMicError] = useState<MediaErrorKind | null>(null);
  const [phoneStatus, setPhoneStatus] = useState<ConnectionState | 'idle' | 'expired'>('idle');
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [probeResult, setProbeResult] = useState<DeviceProbeResult | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      if (sessionStorage.getItem(`tp_audio_unlocked_${sessionId}`) === 'true') {
        setAudioUnlocked(true);
      }
    }
  }, [sessionId]);

  const unlockAudio = useCallback(async (): Promise<boolean> => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      }
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      await silentAudio.play().catch(() => {});
      setAudioUnlocked(true);
      if (typeof window !== 'undefined' && sessionId) {
        sessionStorage.setItem(`tp_audio_unlocked_${sessionId}`, 'true');
      }
      return true;
    } catch (err) {
      console.warn('[MediaSourceProvider] Audio unlock notice:', err);
      return false;
    }
  }, [sessionId]);

  // Selected device IDs
  const [currentVideoDeviceId, setCurrentVideoDeviceId] = useState<string | undefined>(undefined);
  const [currentAudioDeviceId, setCurrentAudioDeviceId] = useState<string | undefined>(undefined);

  // Refs for StrictMode guards and resource management
  const streamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const initialProbeDoneRef = useRef<boolean>(false);
  const isCleaningUpRef = useRef<boolean>(false);
  const liveKitAuthFailedRef = useRef<boolean>(false);

  // Helper to safely replace active MediaStream and sync streamRef
  const updateStream = useCallback(
    (newStream: MediaStream | null, reason = 'updateStream') => {
      // If replacing an old stream, stop old tracks if they aren't part of newStream
      if (streamRef.current && streamRef.current !== newStream) {
        const newTrackIds = new Set(newStream?.getTracks().map((t) => t.id) || []);
        streamRef.current.getTracks().forEach((track) => {
          if (!newTrackIds.has(track.id)) {
            try {
              track.stop();
            } catch {}
          }
        });
      }

      streamRef.current = newStream;
      setStream(newStream);

      // Sync with hidden video element (ensures Chrome processes remote audio without speaker bleed)
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = newStream;
      }
    },
    [sessionId]
  );

  // ---------------------------------------------------------------------------
  // 1. Probe & Request Local Media
  // ---------------------------------------------------------------------------
  const probeAndRequestLocal = useCallback(
    async (videoDeviceId?: string, audioDeviceId?: string, isManualRetry = false) => {
      setStatus('probing');

      // 1. Check if we already have a healthy local stream
      const currentStream = streamRef.current;
      const currentVideo = currentStream?.getVideoTracks()[0];
      const currentAudio = currentStream?.getAudioTracks()[0];
      const isCurrentHealthy =
        !isManualRetry &&
        currentStream &&
        currentVideo?.readyState === 'live' &&
        currentAudio?.readyState === 'live';

      let targetStream: MediaStream | null = null;
      // Fresh permission results for THIS invocation. The state setters above
      // don't update this closure, and the state values captured when the
      // callback was created may be stale ΓÇö so the publish guard below must
      // read these locals, not `cameraError`/`micError` state.
      let latestCameraError = cameraError;
      let latestMicError = micError;

      if (isCurrentHealthy && currentStream) {
        targetStream = currentStream;
        setSource('local');
        setStatus('ready');
      } else {
        // 2. Probe hardware devices
        const probe = await probeDevices();
        setProbeResult(probe);

        // 3. Request camera & mic separately
        const res = await requestMediaSeparately({
          videoDeviceId: videoDeviceId || currentVideoDeviceId,
          audioDeviceId: audioDeviceId || currentAudioDeviceId,
        });

        setCameraError(res.cameraError);
        setMicError(res.micError);
        setMissing(res.missing);
        latestCameraError = res.cameraError;
        latestMicError = res.micError;

        const hasLiveTrack = !!(res.stream && res.stream.getTracks().some((t) => t.readyState === 'live'));

        if (hasLiveTrack && res.stream) {
          targetStream = res.stream;
          updateStream(res.stream, 'probeAndRequestLocal_acquired');
          setSource('local');
          setStatus('ready');

          // Re-probe devices to populate actual hardware labels once permission is granted
          probeDevices().then((updatedProbe) => setProbeResult(updatedProbe)).catch(() => {});
        } else {
          setLiveKitConnected(false);
          updateStream(null, 'probeAndRequestLocal_failed');
          setSource('none');
          setStatus('error');
          return;
        }
      }

      // 4. LiveKit Transport Publish (Guard: require valid permissions and live tracks)
      const hasLiveVideoTrack = !!targetStream?.getVideoTracks().some((t) => t.readyState === 'live');
      const hasLiveAudioTrack = !!targetStream?.getAudioTracks().some((t) => t.readyState === 'live');
      const permissionsValid = latestCameraError === null && latestMicError === null;

      if (isValidSessionId(sessionId) && targetStream && hasLiveVideoTrack && hasLiveAudioTrack && permissionsValid && !liveKitAuthFailedRef.current) {
        try {
          let room = roomRef.current;
          if (!room || room.state === ConnectionState.Disconnected) {
            if (room) {
              try {
                await room.disconnect();
              } catch {}
            }

            const tokenRes = await apiFetch(`/api/v1/interview-sessions/${sessionId}/candidate-media-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
            });

            if (tokenRes.ok) {
              const tokenData = await tokenRes.json();
              if (tokenData.livekitUrl && tokenData.jwt) {
                room = new Room({ adaptiveStream: true, dynacast: true });
                roomRef.current = room;

                room.on(RoomEvent.Disconnected, (reason) => {
                  setLiveKitConnected(false);
                  // CRITICAL: LiveKit disconnect does NOT stop local MediaStream or call updateStream(null)
                });

                await room.connect(tokenData.livekitUrl, tokenData.jwt);
              }
            } else {
              const errPayload = await tokenRes.json().catch(() => ({}));
              console.warn('[MediaDiag] Candidate media token rejected:', tokenRes.status, errPayload);
            }
          }

          if (room && room.state === ConnectionState.Connected) {
            let videoPublished = false;
            let audioPublished = false;

            for (const track of targetStream.getTracks()) {
              if (track.readyState === 'live') {
                try {
                  await room.localParticipant.publishTrack(track, {
                    name: track.kind === 'video' ? 'candidate-camera' : 'candidate-microphone',
                    source: track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
                  });
                  if (track.kind === 'video') videoPublished = true;
                  if (track.kind === 'audio') audioPublished = true;
                } catch (pubErr) {
                  console.warn('[MediaDiag] Track publication notice:', pubErr);
                }
              }
            }

            if (videoPublished && audioPublished) {
              setLiveKitConnected(true);
            }
          }
        } catch (liveKitError: unknown) {
          setLiveKitConnected(false);
          const errStr = String((liveKitError as Error)?.message || liveKitError || '');
          if (errStr.includes('invalid API key') || errStr.includes('401') || errStr.includes('Authentication failed')) {
            liveKitAuthFailedRef.current = true;
            console.info('[MediaSourceProvider] LiveKit credentials not active or pending. Running cleanly in high-res local WebRTC stream mode.');
          } else {
            console.warn('[MediaSourceProvider] LiveKit transport notice (local stream remains active):', liveKitError);
          }
        }
      } else {
        setLiveKitConnected(false);
      }
    },
    [sessionId, currentVideoDeviceId, currentAudioDeviceId, updateStream]
  );

  // Probe on Mount and when sessionId becomes valid (StrictMode protected)
  const probedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // If sessionId is invalid, only do initial device probe once if never probed before
    if (!isValidSessionId(sessionId)) {
      if (probedSessionIdRef.current === null) {
        probedSessionIdRef.current = '';
        probeAndRequestLocal();
      }
      return;
    }

    // If we already probed for this exact valid sessionId, skip duplicate probe
    if (probedSessionIdRef.current === sessionId) return;
    probedSessionIdRef.current = sessionId;

    probeAndRequestLocal();
  }, [sessionId, probeAndRequestLocal]);

  // ---------------------------------------------------------------------------
  // 2. Phone Pairing & LiveKit Viewer Connection
  // ---------------------------------------------------------------------------
  const startPairing = useCallback(async () => {
    try {
      if (!isValidSessionId(sessionId)) {
        console.warn('[MediaSourceProvider] Refusing to start pairing with invalid sessionId:', sessionId);
        return;
      }
      setLiveKitConnected(false);
      setPhoneStatus('idle');

      // Stop existing local tracks when switching to phone source
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch { }
        });
        streamRef.current = null;
      }

      // A. POST relative /api/v1/interview-sessions/${sessionId}/companion/pair
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      const pairRes = await apiFetch(`/api/v1/interview-sessions/${sessionId}/companion/pair`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!pairRes.ok) {
        const errorText = await pairRes.text();
        throw new Error(`Failed to generate pairing token: ${pairRes.statusText} - ${errorText}`);
      }

      const pairData = await pairRes.json();
      const origin =
        typeof window !== 'undefined'
          ? FRONTEND_CONFIG.publicBaseUrl
          : '';
      const qrUrl = `${origin}/companion/${pairData.token}`;

      setPairing({
        token: pairData.token,
        expiresAt: pairData.expiresAt,
        qrUrl,
      });

      // B. Fetch viewer token & join LiveKit room in subscribe-only mode
      setStatus('connecting_phone');
      const viewerRes = await apiFetch(
        `/api/v1/interview-sessions/${sessionId}/companion/viewer-token`,
        {
          method: 'POST',
          headers,
        }
      );

      if (!viewerRes.ok) {
        console.warn('[MediaSourceProvider] Viewer token non-ok response. Falling back to local media preview.');
        await probeAndRequestLocal();
        return;
      }

      const viewerData = await viewerRes.json();
      if (!viewerData.livekitUrl || !viewerData.jwt) {
        console.warn('[MediaSourceProvider] LiveKit local fallback mode active. Falling back to local webcam/mic.');
        await probeAndRequestLocal();
        return;
      }

      // Disconnect existing room if any
      if (roomRef.current) {
        await roomRef.current.disconnect();
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Track phone tracks
      const phoneTracks: {
        video?: MediaStreamTrack;
        audio?: MediaStreamTrack;
      } = {};

      const checkAndAssemblePhoneStream = () => {
        const combined: MediaStreamTrack[] = [];
        if (phoneTracks.video) combined.push(phoneTracks.video);
        if (phoneTracks.audio) combined.push(phoneTracks.audio);

        const ready = room.state === ConnectionState.Connected &&
          phoneTracks.video?.readyState === 'live' && phoneTracks.audio?.readyState === 'live';
        setLiveKitConnected(!!ready);
        setMissing({ camera: !phoneTracks.video, mic: !phoneTracks.audio });
        if (ready) {
          updateStream(new MediaStream(combined));
          setSource('phone');
          setStatus('ready');
        } else {
          updateStream(null);
          setStatus('connecting_phone');
        }
      };

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        setPhoneStatus(state);
        if (state !== ConnectionState.Connected) {
          setLiveKitConnected(false);
          updateStream(null);
        } else checkAndAssemblePhoneStream();
      });

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video) {
          phoneTracks.video = track.mediaStreamTrack;
        } else if (track.kind === Track.Kind.Audio) {
          phoneTracks.audio = track.mediaStreamTrack;
        }
        checkAndAssemblePhoneStream();
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && phoneTracks.video?.id === track.mediaStreamTrack.id) {
          phoneTracks.video = undefined;
        } else if (track.kind === Track.Kind.Audio && phoneTracks.audio?.id === track.mediaStreamTrack.id) {
          phoneTracks.audio = undefined;
        }
        checkAndAssemblePhoneStream();
      });

      room.on(RoomEvent.Disconnected, () => {
        setPhoneStatus(ConnectionState.Disconnected);
        setLiveKitConnected(false);
        updateStream(null);
      });

      await room.connect(viewerData.livekitUrl, viewerData.jwt);
    } catch (err) {
      if (err instanceof Error && (err.name === 'ConnectionError' || err.message?.toLowerCase().includes('disconnect'))) {
        // Benign client-initiated disconnect during component unmount/re-mount
        return;
      }
      console.warn('[MediaSourceProvider] Pairing/Viewer notice (using local fallback media):', err);
      try {
        await probeAndRequestLocal();
      } catch (fallbackErr) {
        console.error('[MediaSourceProvider] Local fallback failed:', fallbackErr);
        setStatus('error');
      }
    }
  }, [sessionId, updateStream]);

  const cancelPairing = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch { }
      });
      streamRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setPairing(null);
    setPhoneStatus('idle');

    // If local stream was previously active, revert to local
    if (source === 'phone') {
      probeAndRequestLocal();
    }
  }, [source, probeAndRequestLocal]);

  // ---------------------------------------------------------------------------
  // 3. Device Switching & Retries
  // ---------------------------------------------------------------------------
  const retryLocal = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    await probeAndRequestLocal(currentVideoDeviceId, currentAudioDeviceId, true);
  }, [probeAndRequestLocal, currentVideoDeviceId, currentAudioDeviceId, sessionId]);

  const setLocalDevices = useCallback(
    async (videoDeviceId?: string, audioDeviceId?: string) => {
      if (videoDeviceId) setCurrentVideoDeviceId(videoDeviceId);
      if (audioDeviceId) setCurrentAudioDeviceId(audioDeviceId);
      await probeAndRequestLocal(videoDeviceId, audioDeviceId);
    },
    [probeAndRequestLocal]
  );

  // ---------------------------------------------------------------------------
  // 4. Track Mute / Unmute Toggles (Only flips track.enabled)
  // ---------------------------------------------------------------------------
  const toggleMic = useCallback((): boolean => {
    if (!streamRef.current) return false;
    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return false;

    const nextState = !audioTracks[0].enabled;
    audioTracks.forEach((t) => {
      t.enabled = nextState;
    });
    return nextState;
  }, []);

  const toggleCamera = useCallback((): boolean => {
    if (!streamRef.current) return false;
    const videoTracks = streamRef.current.getVideoTracks();
    if (videoTracks.length === 0) return false;

    const nextState = !videoTracks[0].enabled;
    videoTracks.forEach((t) => {
      t.enabled = nextState;
    });
    return nextState;
  }, []);

  // ---------------------------------------------------------------------------
  // 5. Cleanup Everything (stopAll)
  // ---------------------------------------------------------------------------
  const stopAll = useCallback(() => {
    isCleaningUpRef.current = true;
    setLiveKitConnected(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }

    if (roomRef.current) {
      try {
        void roomRef.current.disconnect().catch(() => {});
      } catch {
        // Ignore
      }
      roomRef.current = null;
    }

    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
    }

    setStream(null);
    setSource('none');
    setStatus('idle');
  }, []);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);

  const enableMediaAndAudio = useCallback(async (): Promise<boolean> => {
    await probeAndRequestLocal(undefined, undefined, true);
    const unlocked = await unlockAudio();
    return unlocked;
  }, [probeAndRequestLocal, unlockAudio]);

  // Combined errorKind (prefer camera error if present, else mic)
  const errorKind: MediaErrorKind | null = useMemo(() => {
    return cameraError || micError || null;
  }, [cameraError, micError]);

  const contextValue = useMemo<MediaSourceContextValue>(
    () => ({
      source,
      stream,
      status,
      liveKitConnected,
      missing,
      errorKind,
      cameraError,
      micError,
      phoneStatus,
      pairing,
      probeResult,
      audioUnlocked,
      unlockAudio,
      enableMediaAndAudio,
      startPairing,
      cancelPairing,
      retryLocal,
      setLocalDevices,
      toggleMic,
      toggleCamera,
      stopAll,
    }),
    [
      source,
      stream,
      status,
      liveKitConnected,
      missing,
      errorKind,
      cameraError,
      micError,
      phoneStatus,
      pairing,
      probeResult,
      audioUnlocked,
      unlockAudio,
      enableMediaAndAudio,
      startPairing,
      cancelPairing,
      retryLocal,
      setLocalDevices,
      toggleMic,
      toggleCamera,
      stopAll,
    ]
  );

  return (
    <MediaSourceContext.Provider value={contextValue}>
      {children}
      {/* Hidden Muted Video Element for WebAudio analyser routing without desktop speaker audio */}
      <video
        ref={hiddenVideoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </MediaSourceContext.Provider>
  );
}

export function useMediaSource(): MediaSourceContextValue {
  const context = useContext(MediaSourceContext);
  if (!context) {
    throw new Error('useMediaSource must be used within a MediaSourceProvider');
  }
  return context;
}
