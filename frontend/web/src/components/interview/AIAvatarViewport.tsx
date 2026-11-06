'use client';

import React from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';

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
  const personaRole = propRole || 'Staff Technical Lead';
  const avatarUrl = '/avatars/interviewer_female.jpg';

  const isWorkingState = aiState === 'initializing' || aiState === 'transcribing' || aiState === 'evaluating' || aiState === 'thinking';

  return (
    <div
      className={`relative w-full h-full ${
        compact ? 'min-h-[140px]' : 'min-h-[220px]'
      } rounded-2xl border border-line bg-slate-950 overflow-hidden flex flex-col justify-between shadow-md backdrop-blur-md select-none ${className}`}
    >
      {/* HUMAN AVATAR CONTAINER */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- live interview viewport: the avatar is a static local asset rendered under strict latency constraints; next/image optimization is intentionally not used here. */}
        <img
          src={avatarUrl}
          alt={personaName}
          className={`w-full h-full object-cover object-center transition-all duration-300 ${
            isWorkingState ? 'brightness-90 contrast-105' : 'brightness-100 contrast-100'
          }`}
        />
        {/* Subtle overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />
      </div>

      {/* TOP HEADER: STATUS BADGE */}
      <div className="relative z-10 p-2.5 sm:p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950/85 border border-slate-800/90 text-xs font-mono shadow-sm">
          {aiState === 'speaking' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              <span className="text-cyan-300 font-semibold">Speaking...</span>
            </>
          ) : aiState === 'initializing' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span className="text-cyan-300 font-semibold">Connecting thoughts…</span>
            </>
          ) : aiState === 'transcribing' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-300 font-semibold">Catching that…</span>
            </>
          ) : aiState === 'evaluating' || aiState === 'thinking' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span className="text-indigo-300 font-semibold">Reviewing response…</span>
            </>
          ) : aiState === 'listening' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium">Listening closely</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-300 font-medium">Ready</span>
            </>
          )}
        </div>

        <span className="text-[11px] font-mono text-cyan-300 bg-slate-950/75 px-2.5 py-0.5 rounded-full border border-cyan-800/50">
          Interviewer (Host)
        </span>
      </div>

      {/* CENTER LOADING INDICATOR FOR EVALUATING / TRANSCRIBING STATE */}
      {isWorkingState && !compact && (
        <div className="relative z-10 my-auto mx-auto flex items-center gap-2 bg-slate-950/85 px-3 py-1.5 rounded-full border border-indigo-500/30 text-xs font-mono text-indigo-200">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>
            {aiState === 'initializing'
              ? 'Formulating next topic…'
              : aiState === 'transcribing'
              ? 'Processing speech…'
              : 'Reviewing your answer…'}
          </span>
        </div>
      )}

      {/* BOTTOM FOOTER: PERSONA NAME & AUDIO WAVEFORM */}
      <div className="relative z-10 p-2.5 sm:p-3 mt-auto bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex items-end justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">{personaName}</h3>
          {!compact && <p className="text-[11px] text-slate-300 font-medium">{personaRole}</p>}
        </div>

        {/* AUDIO WAVEFORM SPECTRUM */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="flex items-center gap-0.5 h-4 w-16 sm:w-20 justify-center">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`w-0.5 rounded-full transition-all ${
                  aiState === 'speaking' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700 h-1'
                }`}
                style={{
                  height: aiState === 'speaking' ? `${6 + (i % 3) * 4}px` : '4px',
                  animationDelay: `${i * 60}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
