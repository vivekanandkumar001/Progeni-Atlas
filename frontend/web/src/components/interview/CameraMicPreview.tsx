'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Mic,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
  Check,
  ChevronDown
} from 'lucide-react';

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface CameraMicPreviewProps {
  onCameraStateChange?: (passed: boolean, selectedDevice: string) => void;
  onMicStateChange?: (passed: boolean, selectedDevice: string) => void;
  onSpeakerStateChange?: (passed: boolean) => void;
}

export const CameraMicPreview: React.FC<CameraMicPreviewProps> = ({
  onCameraStateChange,
  onMicStateChange,
  onSpeakerStateChange
}) => {
  // Device Selection Lists
  const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([]);
  const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');

  // Statuses
  const [cameraStatus, setCameraStatus] = useState<'checking' | 'passed' | 'denied'>('checking');
  const [resolutionLabel, setResolutionLabel] = useState<string>('1080p Full HD');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [segmentsActive, setSegmentsActive] = useState<number>(0);

  // Speaker Test State
  const [speakerTested, setSpeakerTested] = useState<boolean>(false);
  const [isPlayingChime, setIsPlayingChime] = useState<boolean>(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Enumerate Devices & Start Stream
  useEffect(() => {
    async function initMedia() {
      try {
        setCameraStatus('checking');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Determine resolution
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.height && settings.height >= 1080) {
            setResolutionLabel('1080p Full HD');
          } else if (settings.height && settings.height >= 720) {
            setResolutionLabel('720p HD');
          } else {
            setResolutionLabel('SD Camera Active');
          }
        }

        setCameraStatus('passed');
        onCameraStateChange?.(true, videoTrack?.label || 'Integrated Webcam');

        // Enumerate input devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevs = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        const aDevs = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));

        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs.length > 0) setSelectedVideoId(vDevs[0].deviceId);
        if (aDevs.length > 0) setSelectedAudioId(aDevs[0].deviceId);

        // Web Audio API Audio Level Meter
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateAudioMeter = () => {
          if (!streamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setAudioLevel(level);

          // 12 segments
          const active = Math.min(12, Math.round((level / 100) * 12));
          setSegmentsActive(active);

          if (level > 5) {
            onMicStateChange?.(true, aDevs[0]?.label || 'Default Microphone');
          }

          requestAnimationFrame(updateAudioMeter);
        };
        updateAudioMeter();

      } catch (err) {
        console.error('Camera/Mic access error:', err);
        setCameraStatus('denied');
        onCameraStateChange?.(false, 'None');
        onMicStateChange?.(false, 'None');
      }
    }

    initMedia();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Switch Video Device
  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideoId(deviceId);
    try {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => t.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: true
      });
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      const track = newStream.getVideoTracks()[0];
      onCameraStateChange?.(true, track?.label || 'Selected Webcam');
    } catch (e) {
      console.warn('Could not switch video device:', e);
    }
  };

  // Switch Audio Device
  const handleAudioDeviceChange = async (deviceId: string) => {
    setSelectedAudioId(deviceId);
    try {
      const dev = audioDevices.find((d) => d.deviceId === deviceId);
      onMicStateChange?.(true, dev?.label || 'Selected Microphone');
    } catch (e) {
      console.warn('Could not switch audio device:', e);
    }
  };

  // Play 440Hz Two-Tone Test Chime
  const playTestChime = () => {
    setIsPlayingChime(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      
      // Tone 1: 440Hz
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.4);

      // Tone 2: 880Hz
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
      gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.9);

      setTimeout(() => {
        setIsPlayingChime(false);
        setSpeakerTested(true);
      }, 1000);
    } catch (e) {
      setIsPlayingChime(false);
      setSpeakerTested(true);
    }
  };

  const confirmSpeaker = (passed: boolean) => {
    onSpeakerStateChange?.(passed);
  };

  return (
    <div className="space-y-6">
      
      {/* 16:9 LIVE WEBRTC CAMERA VIEWPORT */}
      <div className="relative aspect-video w-full rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex items-center justify-center group">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />

        {/* Ambient Top Glow */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/60"></div>

        {/* Top-Right Status Chip */}
        <div className="absolute top-3 right-3 z-10">
          {cameraStatus === 'passed' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-emerald-500/30 text-emerald-400 font-mono text-xs shadow-lg backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              ● HD Camera Active ({resolutionLabel})
            </span>
          ) : cameraStatus === 'denied' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-rose-500/30 text-rose-400 font-mono text-xs backdrop-blur-md">
              <AlertTriangle className="w-3.5 h-3.5" />
              Camera Permission Denied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700 text-slate-300 font-mono text-xs backdrop-blur-md">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              Initializing Camera...
            </span>
          )}
        </div>

        {/* Camera Permission Denied Warning Overlay */}
        {cameraStatus === 'denied' && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-100">Webcam Permission Required</h4>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Please click the lock icon in your browser address bar and set Camera & Microphone permissions to <strong className="text-slate-200">&quot;Allow&quot;</strong>.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
            >
              Refresh Permissions Check
            </button>
          </div>
        )}
      </div>

      {/* DEVICE SELECTOR DROPDOWNS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Camera Select */}
        <div className="space-y-1.5">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
            <span>Camera Device</span>
          </label>
          <div className="relative">
            <select
              value={selectedVideoId}
              onChange={(e) => handleVideoDeviceChange(e.target.value)}
              className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer pr-10"
            >
              {videoDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Microphone Select */}
        <div className="space-y-1.5">
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>Microphone Input</span>
          </label>
          <div className="relative">
            <select
              value={selectedAudioId}
              onChange={(e) => handleAudioDeviceChange(e.target.value)}
              className="w-full appearance-none px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 cursor-pointer pr-10"
            >
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* REAL-TIME 12-SEGMENT AUDIO INPUT METER */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">Microphone Level Test</span>
          </div>
          <span className="text-xs font-mono text-cyan-400 font-bold">{audioLevel}% Sensitivity</span>
        </div>

        {/* 12 Segment Visualizer */}
        <div className="grid grid-cols-12 gap-1.5 h-3.5 items-center">
          {Array.from({ length: 12 }).map((_, idx) => {
            const isActive = idx < segmentsActive;
            const isHigh = idx >= 9;
            const isMid = idx >= 6 && idx < 9;
            return (
              <div
                key={idx}
                className={`h-full rounded-md transition-all duration-75 ${
                  isActive
                    ? isHigh
                      ? 'bg-rose-500 shadow-sm shadow-rose-500/50'
                      : isMid
                      ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                      : 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : 'bg-slate-900 border border-slate-800/80'
                }`}
              ></div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400">
          Speak a few words to calibrate your microphone sensitivity.
        </p>
      </div>

      {/* SPEAKER OUTPUT DIAGNOSTIC */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">Audio Output & Speaker Check</span>
          </div>
          <button
            type="button"
            onClick={playTestChime}
            disabled={isPlayingChime}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPlayingChime ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isPlayingChime ? 'Playing Chime...' : 'Play Test Chime'}</span>
          </button>
        </div>

        {speakerTested && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="text-slate-300">Did you hear the chime clearly?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => confirmSpeaker(true)}
                className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-medium transition-colors cursor-pointer"
              >
                Yes, Sounds Good
              </button>
              <button
                type="button"
                onClick={() => confirmSpeaker(false)}
                className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-300 text-xs font-medium transition-colors cursor-pointer"
              >
                No, Change Speaker
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
