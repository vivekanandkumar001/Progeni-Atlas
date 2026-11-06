'use client';

import React from 'react';
import { Mic, Volume2, ShieldCheck, Video } from 'lucide-react';

interface AiInterviewerFeedProps {
  isSpeaking?: boolean;
  name?: string;
  role?: string;
}

export const AiInterviewerFeed: React.FC<AiInterviewerFeedProps> = ({
  isSpeaking = true,
  name = 'Sarah Chen',
  role = 'Staff Systems Engineer & Technical Lead'
}) => {
  return (
    <div className={`relative w-full h-full min-h-[220px] rounded-2xl border transition-all duration-500 overflow-hidden flex flex-col justify-between p-4 shadow-2xl group bg-slate-950 ${
      isSpeaking
        ? 'border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-2 ring-cyan-400/40'
        : 'border-slate-800'
    }`}>
      {/* Background Live Portrait Video */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/avatars/interviewer_female.jpg"
          alt={name}
          className={`w-full h-full object-cover object-center transition-all duration-700 ease-out ${
            isSpeaking ? 'scale-105 brightness-105 contrast-[1.02]' : 'scale-[1.02] brightness-100'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/40 pointer-events-none" />
        {isSpeaking && (
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-indigo-500/10 pointer-events-none animate-pulse" />
        )}
      </div>

      {/* Top Bar Overlay */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-700/60 backdrop-blur-md text-xs font-mono">
          <span className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}`}></span>
          <span className="text-white font-medium">{isSpeaking ? 'Speaking...' : 'Listening...'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 backdrop-blur-md">
          <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>HD 1080p</span>
        </div>
      </div>

      {/* Bottom Name Overlay */}
      <div className="relative z-10 mt-auto flex items-end justify-between gap-2">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-cyan-400' : 'text-emerald-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">{name}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            </div>
            <p className="text-[10px] text-slate-300 font-medium">{role}</p>
          </div>
        </div>

        {/* Real-Time Waveform */}
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-2 flex items-center gap-1 shrink-0">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mr-1" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all ${isSpeaking ? 'bg-gradient-to-t from-cyan-500 to-indigo-400 animate-pulse' : 'bg-slate-700 h-1.5'}`}
              style={{ height: isSpeaking ? `${6 + (i % 3) * 6}px` : '4px', animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
