'use client';

import React from 'react';
import { Mic, Volume2 } from 'lucide-react';

export type AIState = 'idle' | 'initializing' | 'speaking' | 'listening' | 'transcribing' | 'evaluating' | 'thinking';

interface AIAvatarViewportProps {
  aiState?: AIState;
  name?: string;
  role?: string;
  compact?: boolean;
  className?: string;
  /** Live WebRTC video stream (e.g. a future talking-head feed). */
  videoStream?: MediaStream | null;
}

/**
 * The interviewer viewport. One job: show that Sarah is present and whether
 * she is speaking, listening, or thinking — nothing else.
 *
 * Honesty notes:
 * - This is a still photograph, not a neural lip-sync. The equalizer bars
 *   animate while her audio is playing; they are not phoneme-accurate, and
 *   we do not pretend they are.
 * - No fake latency/FPS telemetry is rendered.
 * - No "verified human" badge: she is an AI, and the lobby says so.
 */
export const AIAvatarViewport: React.FC<AIAvatarViewportProps> = ({
  aiState = 'speaking',
  name: propName,
  role: propRole,
  compact = false,
  className = '',
  videoStream = null,
}) => {
  const personaName = propName || 'Sarah Chen';
  const personaRole = propRole || 'AI Interviewer';
  const avatarUrl = '/avatars/interviewer_female.jpg';

  const isSpeaking = aiState === 'speaking';
  const isListening = aiState === 'listening';
  const isThinking =
    aiState === 'thinking' ||
    aiState === 'evaluating' ||
    aiState === 'transcribing' ||
    aiState === 'initializing';

  const status = isSpeaking
    ? { text: 'Sarah is speaking', dot: 'bg-cyan-400', ping: true }
    : isListening
      ? { text: 'Listening — your turn', dot: 'bg-emerald-400', ping: true }
      : isThinking
        ? { text: 'Thinking about your answer…', dot: 'bg-indigo-400', ping: false }
        : { text: 'Connected', dot: 'bg-slate-400', ping: false };

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
      {/* PRESENTATION                                                         */}
      {/* -------------------------------------------------------------------- */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950 flex items-center justify-center" aria-hidden="true">
        {videoStream ? (
          <video
            ref={(el) => {
              if (el && el.srcObject !== videoStream) {
                el.srcObject = videoStream;
                el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div
            className="relative w-full h-full transition-transform duration-700 ease-out"
            style={{ transform: isSpeaking ? 'scale(1.03)' : 'scale(1.01)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt=""
              className={`w-full h-full object-cover object-center transition-all duration-700 ease-out interviewer-sway ${
                isSpeaking
                  ? 'brightness-105 contrast-[1.03]'
                  : isThinking
                    ? 'brightness-90 contrast-105'
                    : 'brightness-100 contrast-100'
              }`}
            />

            {/* Soft engagement glows — state-driven, not audio-driven theatre */}
            {isListening && (
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 via-transparent to-transparent pointer-events-none transition-opacity duration-500" />
            )}
            {isSpeaking && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                style={{
                  background: 'radial-gradient(circle at 50% 40%, rgba(6,182,212,0.12) 0%, transparent 75%)',
                }}
              />
            )}

            {/* Studio vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/45 pointer-events-none" />
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* STATUS STRIP                                                          */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative z-10 p-3 flex items-center justify-between gap-2">
        <div
          role="status"
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/85 border border-slate-700/60 backdrop-blur-md shadow-md"
        >
          <span className="relative flex h-2.5 w-2.5">
            {status.ping && (
              <span
                className={`animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full ${status.dot} opacity-75`}
              />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${status.dot}`} />
          </span>
          <span className="text-slate-100 font-medium text-xs tracking-tight">{status.text}</span>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* THINKING OVERLAY                                                      */}
      {/* -------------------------------------------------------------------- */}
      {isThinking && !compact && (
        <div className="relative z-10 my-auto mx-auto flex items-center gap-2.5 bg-slate-950/90 px-4 py-2 rounded-full border border-indigo-500/40 text-xs font-medium text-indigo-100 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="flex gap-1" aria-hidden="true">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce motion-reduce:animate-none" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce motion-reduce:animate-none" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce motion-reduce:animate-none" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Sarah is thinking about your answer…</span>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* BOTTOM: PERSONA + HONEST SPEAKING INDICATOR                           */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative z-10 p-3 mt-auto flex items-end justify-between gap-3">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 max-w-[80%]">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-cyan-400' : 'text-emerald-400'}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">{personaName}</span>
              <span className="text-[9px] uppercase tracking-widest text-slate-400 border border-slate-700 rounded-full px-1.5 py-0.5">AI</span>
            </div>
            {!compact && <p className="text-[10px] text-slate-300 font-medium truncate">{personaRole}</p>}
          </div>
        </div>

        {/* Speaking indicator: CSS-animated bars active only while her audio plays */}
        <div
          className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-2.5 py-2 flex items-center gap-1 shrink-0"
          aria-hidden="true"
        >
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full sara-eq-bar ${isSpeaking ? 'is-live' : ''}`}
              style={{ animationDelay: `${(i * 137) % 900}ms` }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .sara-eq-bar {
          height: 4px;
          width: 4px;
          background: #334155;
          transition: background 0.4s ease;
        }
        .sara-eq-bar.is-live {
          background: #22d3ee;
          box-shadow: 0 0 8px rgba(34,211,238,0.5);
          animation: sara-eq 0.9s ease-in-out infinite alternate;
        }
        @keyframes sara-eq {
          from { height: 4px; }
          to { height: 22px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sara-eq-bar.is-live { animation: none; height: 10px; }
        }
      `}</style>
    </div>
  );
};
