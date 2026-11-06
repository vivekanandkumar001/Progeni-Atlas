'use client';

import React from 'react';
import { Mic, Volume2, ShieldCheck, Video } from 'lucide-react';

export type AIState = 'idle' | 'initializing' | 'speaking' | 'listening' | 'transcribing' | 'evaluating' | 'thinking';

interface AIAvatarViewportProps {
  aiState?: AIState;
  name?: string;
  role?: string;
  compact?: boolean;
  className?: string;
}

export const AIAvatarViewport: React.FC<AIAvatarViewportProps> = ({
  aiState = 'speaking',
  name: propName,
  role: propRole,
  compact = false,
  className = '',
}) => {
  const personaName = propName || 'Sarah Chen';
  const personaRole = propRole || 'Staff Systems Engineer';
  const avatarUrl = '/avatars/interviewer_female.jpg';

  const isSpeaking = aiState === 'speaking';
  const isListening = aiState === 'listening';
  const isThinking = aiState === 'thinking' || aiState === 'evaluating' || aiState === 'transcribing' || aiState === 'initializing';

  return (
    <div
      className={`relative w-full h-full ${
        compact ? 'min-h-[140px]' : 'min-h-[230px]'
      } rounded-2xl border transition-all duration-500 overflow-hidden flex flex-col justify-between shadow-2xl select-none ${
        isSpeaking
          ? 'border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.25)] ring-2 ring-cyan-400/40'
          : isListening
          ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
          : 'border-slate-800 shadow-xl'
      } bg-slate-950 ${className}`}
    >
      {/* REALISTIC LIVE VIDEO STREAM CONTAINER */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element -- Real-time live interview video feed rendering */}
        <img
          src={avatarUrl}
          alt={personaName}
          className={`w-full h-full object-cover object-center transition-all duration-700 ease-out ${
            isSpeaking
              ? 'scale-105 brightness-105 contrast-[1.02]'
              : isThinking
              ? 'scale-100 brightness-90 contrast-105 blur-[0.3px]'
              : 'scale-[1.02] brightness-100 contrast-100'
          }`}
          style={{
            animation: isSpeaking
              ? 'speakingMicroDynamics 3s ease-in-out infinite alternate'
              : 'humanPresence 6s ease-in-out infinite alternate',
          }}
        />

        {/* Ambient video vignette & lighting overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/40 pointer-events-none" />

        {/* Active Speaker Ambient Audio Halo */}
        {isSpeaking && (
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-indigo-500/10 pointer-events-none animate-pulse" />
        )}
      </div>

      {/* TOP BAR: STREAM HEALTH & LIVE STATUS (ZOOM / MEET STYLE) */}
      <div className="relative z-10 p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700/60 backdrop-blur-md shadow-md">
          {isSpeaking ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
              <span className="text-cyan-300 font-semibold text-xs tracking-tight">Speaking</span>
            </>
          ) : isListening ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span className="text-emerald-300 font-medium text-xs tracking-tight">Listening Attentively</span>
            </>
          ) : isThinking ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-200 font-medium text-xs tracking-tight">Reviewing Your Response</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-slate-300 font-medium text-xs tracking-tight">Connected</span>
            </>
          )}
        </div>

        {/* Live HD Video Stream Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-slate-300 backdrop-blur-md">
          <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>HD 1080p</span>
        </div>
      </div>

      {/* CENTER STATUS BUBBLE WHEN REVIEWING / EVALUATING */}
      {isThinking && !compact && (
        <div className="relative z-10 my-auto mx-auto flex items-center gap-2.5 bg-slate-950/90 px-4 py-2 rounded-full border border-indigo-500/30 text-xs font-medium text-indigo-100 shadow-xl backdrop-blur-md animate-fadeIn">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Sarah is reviewing your architectural response…</span>
        </div>
      )}

      {/* BOTTOM OVERLAY: INTERVIEWER NAME TAG WITH LIVE AUDIO METER (GOOGLE MEET STYLE) */}
      <div className="relative z-10 p-3 mt-auto flex items-end justify-between gap-3">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 max-w-[80%]">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-cyan-400' : 'text-emerald-400'}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">{personaName}</span>
              <span title="Verified Host" className="inline-flex">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </span>
            </div>
            {!compact && <p className="text-[10px] text-slate-300 font-medium truncate">{personaRole}</p>}
          </div>
        </div>

        {/* Dynamic Speaking Audio Equalizer */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/90 rounded-xl px-2.5 py-2 flex items-center gap-1 shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all duration-150 ${
                isSpeaking
                  ? 'bg-gradient-to-t from-cyan-500 to-indigo-400 animate-pulse'
                  : 'bg-slate-700 h-1.5'
              }`}
              style={{
                height: isSpeaking ? `${6 + (i % 3) * 6}px` : '4px',
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
