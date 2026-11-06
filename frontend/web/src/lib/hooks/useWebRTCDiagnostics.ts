'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { apiJson } from '@/lib/api';

export interface UseWebRTCDiagnosticsOptions {
  email: string;
  onToast: (text: string, type: 'success' | 'error') => void;
}

export interface UseWebRTCDiagnosticsReturn {
  diagRunning: boolean;
  micStatus: 'idle' | 'checking' | 'passed' | 'failed';
  camStatus: 'idle' | 'checking' | 'passed' | 'failed';
  latencyMs: number | null;
  audioLevel: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  runHardwareDiagnostics: () => Promise<void>;
  stopMediaTracks: () => void;
}

export function useWebRTCDiagnostics({
  email,
  onToast,
}: UseWebRTCDiagnosticsOptions): UseWebRTCDiagnosticsReturn {
  const [diagRunning, setDiagRunning] = useState(false);
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [camStatus, setCamStatus] = useState<'idle' | 'checking' | 'passed' | 'failed'>('idle');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopMediaTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopMediaTracks();
    };
  }, [stopMediaTracks]);

  const runHardwareDiagnostics = useCallback(async () => {
    stopMediaTracks();
    setDiagRunning(true);
    setMicStatus('checking');
    setCamStatus('checking');
    setLatencyMs(null);

    const startTime = performance.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCamStatus('passed');
      setMicStatus('passed');

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkAudioLevel = () => {
        if (!streamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        requestAnimationFrame(checkAudioLevel);
      };
      checkAudioLevel();

      apiJson<unknown>('/api/candidate/diagnostics', {
        method: 'POST',
        body: JSON.stringify({
          email,
          micStatus: 'passed',
          cameraStatus: 'passed',
          latencyMs: elapsed,
        }),
      }).catch(() => {});

      onToast('Hardware pre-flight check completed: Camera & Microphone verified!', 'success');
    } catch (err) {
      console.error('Media permission check error:', err);
      setCamStatus('failed');
      setMicStatus('failed');
      onToast('Microphone or Camera access denied. Please allow browser permissions.', 'error');
    } finally {
      setDiagRunning(false);
    }
  }, [email, onToast, stopMediaTracks]);

  return {
    diagRunning,
    micStatus,
    camStatus,
    latencyMs,
    audioLevel,
    videoRef,
    runHardwareDiagnostics,
    stopMediaTracks,
  };
}
