'use client';

import React from 'react';
import { Bot, Volume2, Sparkles, Radio } from 'lucide-react';

interface AiInterviewerFeedProps {
  isSpeaking?: boolean;
  name?: string;
  role?: string;
}

export const AiInterviewerFeed: React.FC<AiInterviewerFeedProps> = ({
  isSpeaking = true,
  name = 'Progeni Atlas Interviewer',
  role = 'Lead Systems Evaluator'
}) => {
  return (
    <div className="relative w-full h-full min-h-[220px] rounded-2xl border border-line bg-inset overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl group">
      
      {/* Background Ambient Glow */}
      <div className={`absolute w-48 h-48 rounded-full blur-3xl transition-opacity duration-500 pointer-events-none ${
        isSpeaking ? 'bg-cyan-500/20 opacity-100 animate-pulse' : 'bg-indigo-500/10 opacity-50'
      }`}></div>

      {/* Top Bar Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-inset/80 border border-line backdrop-blur-md text-xs font-mono">
          <span className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-indigo-400'}`}></span>
          <span className="text-ink font-medium">{isSpeaking ? 'Speaking...' : 'Listening...'}</span>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
          Live Host
        </span>
      </div>

      {/* Animated AI Core Avatar Circle */}
      <div className="relative z-10 flex flex-col items-center space-y-4 my-auto">
        <div className="relative">
          {/* Outer Pulsing Rings */}
          {isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping duration-1000"></div>
              <div className="absolute -inset-3 rounded-full bg-indigo-500/10 animate-pulse"></div>
            </>
          )}

          <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 p-1 shadow-2xl transition-transform ${
            isSpeaking ? 'scale-105 shadow-cyan-500/30' : 'scale-100'
          }`}>
            <div className="w-full h-full bg-inset rounded-full flex items-center justify-center border-2 border-line">
              <Bot className={`w-12 h-12 transition-colors ${isSpeaking ? 'text-accent-cyan' : 'text-ink-muted'}`} />
            </div>
          </div>
        </div>

        {/* Name & Title */}
        <div className="text-center space-y-0.5">
          <p className="text-sm font-bold text-ink flex items-center justify-center gap-1.5">
            <span>{name}</span>
            <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
          </p>
          <p className="text-xs text-ink-muted font-mono">{role}</p>
        </div>

        {/* Real-Time Waveform Bar Indicator */}
        <div className="flex items-center gap-1 h-8 pt-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full ${isSpeaking ? 'bg-gradient-to-t from-cyan-500 to-indigo-400 shadow-sm shadow-cyan-400/50 animate-pulse' : 'bg-surface-2 h-2'}`}
              style={{ height: isSpeaking ? `${8 + (i % 4) * 5}px` : '8px', animationDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
      </div>

    </div>
  );
};
