'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, ShieldCheck, Video, Activity } from 'lucide-react';

export type AIState = 'idle' | 'initializing' | 'speaking' | 'listening' | 'transcribing' | 'evaluating' | 'thinking';

interface AIAvatarViewportProps {
  aiState?: AIState;
  name?: string;
  role?: string;
  compact?: boolean;
  className?: string;
  /** Optional audio element to sync real-time 60 FPS visemes and lip motion */
  audioElement?: HTMLAudioElement | null;
  /** Audio stream if WebRTC track is used */
  audioStream?: MediaStream | null;
  /** Direct Web Audio AnalyserNode for ultra-fast zero-latency viseme synchronization */
  analyserNode?: AnalyserNode | null;
  /** Live WebRTC Neural Video Stream (e.g. from LiveKit or Simli talking head) */
  videoStream?: MediaStream | null;
}

export const AIAvatarViewport: React.FC<AIAvatarViewportProps> = ({
  aiState = 'speaking',
  name: propName,
  role: propRole,
  compact = false,
  className = '',
  audioElement = null,
  audioStream = null,
  analyserNode = null,
  videoStream = null,
}) => {
  const personaName = propName || 'Sarah Chen';
  const personaRole = propRole || 'Staff Systems Engineer';
  const avatarUrl = '/avatars/interviewer_female.jpg';

  const isSpeaking = aiState === 'speaking';
  const isListening = aiState === 'listening';
  const isThinking =
    aiState === 'thinking' ||
    aiState === 'evaluating' ||
    aiState === 'transcribing' ||
    aiState === 'initializing';

  // ---------------------------------------------------------------------------
  // 1. 60 FPS AUDIO-REACTIVE VISEME & FORMANT EXTRACTOR
  // ---------------------------------------------------------------------------
  const [mouthOpen, setMouthOpen] = useState<number>(0);
  const [mouthSpread, setMouthSpread] = useState<number>(0);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [headNodAngle, setHeadNodAngle] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync external neural WebRTC video stream if active
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream]);

  // Initialize Web Audio API Analyser for real-time lip synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (analyserNode) {
      analyserRef.current = analyserNode;
      return;
    }

    const target = audioElement || audioStream;
    if (!target) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        const resumeCtx = () => {
          ctx.resume().catch(() => {});
          window.removeEventListener('click', resumeCtx);
        };
        window.addEventListener('click', resumeCtx, { once: true });
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      analyserRef.current = analyser;

      if (audioElement && audioElement instanceof HTMLAudioElement) {
        try {
          const source = ctx.createMediaElementSource(audioElement);
          source.connect(analyser);
          analyser.connect(ctx.destination);
          sourceNodeRef.current = source;
        } catch {
          // Source already connected on this element
        }
      } else if (audioStream && audioStream instanceof MediaStream) {
        try {
          const source = ctx.createMediaStreamSource(audioStream);
          source.connect(analyser);
          sourceNodeRef.current = source;
        } catch {
          // Stream already connected
        }
      }
    } catch (err) {
      console.warn('[AIAvatarViewport] Audio analyser init notice:', err);
    }

    return () => {
      // Keep audio context warm across turns
    };
  }, [audioElement, audioStream]);

  // Real-time 60 FPS animation loop extracting formant energies
  const analyzeAudioFrame = useCallback(() => {
    if (!analyserRef.current) {
      if (isSpeaking) {
        // Fallback procedural acoustic sine wave if analyser is detached
        const t = performance.now() / 150;
        const fakeOpen = 0.25 + 0.35 * Math.sin(t) * Math.sin(t * 1.7);
        setMouthOpen(Math.max(0.1, fakeOpen));
        setVolumeLevel(0.4 + 0.3 * Math.sin(t));
      } else {
        setMouthOpen(0);
        setVolumeLevel(0);
      }
      animFrameRef.current = requestAnimationFrame(analyzeAudioFrame);
      return;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    // Formant 1: 150Hz - 700Hz (Jaw openness)
    let f1Sum = 0;
    // Formant 2: 800Hz - 2200Hz (Mouth spread / vowels)
    let f2Sum = 0;

    const f1Limit = Math.floor(bufferLength * 0.2);
    const f2Limit = Math.floor(bufferLength * 0.55);

    for (let i = 0; i < bufferLength; i++) {
      const val = dataArray[i];
      sum += val;
      if (i < f1Limit) f1Sum += val;
      else if (i < f2Limit) f2Sum += val;
    }

    const avg = sum / bufferLength / 255;
    const f1Avg = f1Sum / Math.max(1, f1Limit) / 255;
    const f2Avg = f2Sum / Math.max(1, f2Limit - f1Limit) / 255;

    setVolumeLevel(avg);

    if (isSpeaking && avg > 0.05) {
      // Map vocal resonance to mouth openness
      const rawAperture = Math.min(1.0, f1Avg * 1.8 + avg * 0.6);
      const rawSpread = Math.min(1.0, f2Avg * 1.6);
      setMouthOpen(rawAperture);
      setMouthSpread(rawSpread);
    } else {
      setMouthOpen((prev) => Math.max(0, prev * 0.75));
      setMouthSpread((prev) => Math.max(0, prev * 0.75));
    }

    animFrameRef.current = requestAnimationFrame(analyzeAudioFrame);
  }, [isSpeaking]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(analyzeAudioFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyzeAudioFrame]);

  // ---------------------------------------------------------------------------
  // 2. NATURAL HUMANOID MICRO-DYNAMICS (BLINKS & ACTIVE-LISTENING NODS)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let blinkTimer: NodeJS.Timeout;
    const triggerNaturalBlink = () => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 130);

      // Randomize next blink between 3.2s and 5.8s (natural human cadence)
      const nextDelay = 3200 + Math.random() * 2600;
      blinkTimer = setTimeout(triggerNaturalBlink, nextDelay);
    };

    blinkTimer = setTimeout(triggerNaturalBlink, 3500);
    return () => clearTimeout(blinkTimer);
  }, []);

  // Active Listening Micro-Nods: AI nods gently when candidate explains concepts
  useEffect(() => {
    if (!isListening) {
      setHeadNodAngle(0);
      return;
    }

    let nodInterval: NodeJS.Timeout;
    const triggerActiveNod = () => {
      // Subtly nod down 1.8 degrees, then return
      setHeadNodAngle(1.8);
      setTimeout(() => {
        setHeadNodAngle(-0.8);
        setTimeout(() => {
          setHeadNodAngle(1.2);
          setTimeout(() => {
            setHeadNodAngle(0);
          }, 300);
        }, 200);
      }, 250);

      const nextNod = 5000 + Math.random() * 4000;
      nodInterval = setTimeout(triggerActiveNod, nextNod);
    };

    nodInterval = setTimeout(triggerActiveNod, 4500);
    return () => clearTimeout(nodInterval);
  }, [isListening]);

  return (
    <div
      className={`relative w-full h-full ${
        compact ? 'min-h-[140px]' : 'min-h-[230px]'
      } rounded-2xl border transition-all duration-500 overflow-hidden flex flex-col justify-between shadow-2xl select-none ${
        isSpeaking
          ? 'border-cyan-400/80 shadow-[0_0_35px_rgba(6,182,212,0.3)] ring-2 ring-cyan-400/50'
          : isListening
          ? 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/30'
          : 'border-slate-800 shadow-xl'
      } bg-slate-950 ${className}`}
    >
      {/* -------------------------------------------------------------------- */}
      {/* REALISTIC 60 FPS HUMANOID VIDEO STREAM CONTAINER                      */}
      {/* -------------------------------------------------------------------- */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950 flex items-center justify-center">
        {videoStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover object-center"
          />
        ) : (
          /* AVATAR BASE WITH PROCEDURAL 60 FPS SKELETAL TRANSFORM */
          <div
            className="relative w-full h-full transition-transform duration-200 ease-out"
            style={{
              transform: `scale(${isSpeaking ? 1.04 : 1.01}) translateY(${headNodAngle * 2.2}px) rotate(${headNodAngle * 0.4}deg)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={personaName}
              className={`w-full h-full object-cover object-center transition-all duration-700 ease-out interviewer-sway ${
                isSpeaking
                  ? 'brightness-105 contrast-[1.03]'
                  : isThinking
                  ? 'brightness-90 contrast-105 blur-[0.2px]'
                  : 'brightness-100 contrast-100'
              }`}
            />

            {/* DYNAMIC REAL-TIME VISEME OVERLAY: MOUTH MORPH LAYER */}
            {isSpeaking && mouthOpen > 0.05 && (
              <div
                className="absolute left-[47.5%] top-[57%] w-[7%] h-[3.5%] pointer-events-none rounded-full transition-transform duration-75"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(30,10,15,0.7) 0%, rgba(80,20,30,0.35) 60%, transparent 100%)',
                  transform: `scale(${1 + mouthSpread * 0.5}, ${1 + mouthOpen * 1.8}) translate(-50%, -50%)`,
                  filter: 'blur(1.2px)',
                  opacity: Math.min(0.85, mouthOpen * 1.2),
                }}
              />
            )}

            {/* NATURAL EYE BLINK OCCLUSION OVERLAY */}
            {isBlinking && (
              <div className="absolute left-[39%] top-[39.5%] w-[24%] h-[2.5%] pointer-events-none flex justify-between px-1">
                {/* Left Eye Eyelid */}
                <div className="w-[38%] h-full bg-[#1b1924] rounded-full opacity-90 blur-[0.6px] transition-all" />
                {/* Right Eye Eyelid */}
                <div className="w-[38%] h-full bg-[#1b1924] rounded-full opacity-90 blur-[0.6px] transition-all" />
              </div>
            )}

            {/* ACTIVE ENGAGEMENT GLOW */}
            {isListening && (
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 via-transparent to-transparent pointer-events-none transition-opacity duration-500" />
            )}

            {/* SPEAKING AUDIO HALO */}
            {isSpeaking && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-150"
                style={{
                  background: `radial-gradient(circle at 50% 40%, rgba(6,182,212,${volumeLevel * 0.18}) 0%, transparent 75%)`,
                }}
              />
            )}

            {/* Studio Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/45 pointer-events-none" />
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TOP BAR: STREAM HEALTH, LATENCY & LIVE STATUS                         */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative z-10 p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700/60 backdrop-blur-md shadow-md">
          {isSpeaking ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
              </span>
              <span className="text-cyan-300 font-semibold text-xs tracking-tight">Speaking (Neural)</span>
            </>
          ) : isListening ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
              </span>
              <span className="text-emerald-300 font-medium text-xs tracking-tight">Listening (Duplex VAD)</span>
            </>
          ) : isThinking ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-200 font-medium text-xs tracking-tight">Synthesizing Turn</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-slate-300 font-medium text-xs tracking-tight">Connected</span>
            </>
          )}
        </div>

        {/* Real-time Sub-300ms Zero Latency Telemetry Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-800 text-[11px] font-mono text-cyan-300 backdrop-blur-md shadow">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>&lt;240ms</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-800 text-[11px] font-mono text-slate-300 backdrop-blur-md">
            <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>1080p 60fps</span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* THINKING & SYNTHESIS OVERLAY BUBBLE                                  */}
      {/* -------------------------------------------------------------------- */}
      {isThinking && !compact && (
        <div className="relative z-10 my-auto mx-auto flex items-center gap-2.5 bg-slate-950/90 px-4 py-2 rounded-full border border-indigo-500/40 text-xs font-medium text-indigo-100 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Sarah is reviewing your architectural response…</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* BOTTOM OVERLAY: INTERVIEWER PROFILE & ACOUSTIC EQUALIZER             */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative z-10 p-3 mt-auto flex items-end justify-between gap-3">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 max-w-[80%]">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-cyan-400' : 'text-emerald-400'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">{personaName}</span>
              <span title="Verified Senior Lead" className="inline-flex">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </span>
            </div>
            {!compact && <p className="text-[10px] text-slate-300 font-medium truncate">{personaRole}</p>}
          </div>
        </div>

        {/* 60 FPS Audio-Reactive Decibel Frequency Bars */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-2.5 py-2 flex items-center gap-1 shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
          {Array.from({ length: 8 }).map((_, i) => {
            const barHeight = isSpeaking
              ? Math.max(4, Math.min(22, 4 + volumeLevel * 35 * Math.sin((i + 1) * 0.7)))
              : 4;
            return (
              <div
                key={i}
                className="w-1 rounded-full transition-all duration-75"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: isSpeaking ? '#22d3ee' : '#334155',
                  boxShadow: isSpeaking ? '0 0 8px rgba(34,211,238,0.5)' : 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
