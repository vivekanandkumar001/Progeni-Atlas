'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Volume2, Sparkles, Radio } from 'lucide-react';

interface AiInterviewerFeedProps {
  isSpeaking?: boolean;
  name?: string;
  role?: string;
}

export const AiInterviewerFeed: React.FC<AiInterviewerFeedProps> = ({
  isSpeaking = true,
  name = 'Alex Vance (TalentPulse AI)',
  role = 'Lead Systems Evaluator'
}) => {
  const [waveHeights, setWaveHeights] = useState<number[]>([40, 75, 55, 90, 60, 80, 45, 70, 85, 50, 65, 95]);

  // Animate audio waveform when AI is speaking
  useEffect(() => {
    if (!isSpeaking) return;
    const interval = setInterval(() => {
      setWaveHeights((prev) =>
        prev.map(() => Math.floor(Math.random() * 65) + 30)
      );
    }, 120);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  return (
    <div className="relative w-full h-full min-h-[220px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl group">
      
      {/* Background Ambient Glow */}
      <div className={`absolute w-48 h-48 rounded-full blur-3xl transition-opacity duration-500 pointer-events-none ${
        isSpeaking ? 'bg-cyan-500/20 opacity-100 animate-pulse' : 'bg-indigo-500/10 opacity-50'
      }`}></div>

      {/* Top Bar Overlay */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 backdrop-blur-md text-xs font-mono">
          <span className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-ping' : 'bg-indigo-400'}`}></span>
          <span className="text-slate-200 font-medium">{isSpeaking ? 'AI Interviewer Speaking' : 'Listening...'}</span>
        </div>
        <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]">
          v3.2 Avatar Active
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
            <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center border-2 border-slate-900">
              <Bot className={`w-12 h-12 transition-colors ${isSpeaking ? 'text-cyan-300' : 'text-slate-400'}`} />
            </div>
          </div>
        </div>

        {/* Name & Title */}
        <div className="text-center space-y-0.5">
          <p className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1.5">
            <span>{name}</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </p>
          <p className="text-xs text-slate-400 font-mono">{role}</p>
        </div>

        {/* Real-Time Waveform Bar Indicator */}
        <div className="flex items-center gap-1 h-8 pt-1">
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-100 ${
                isSpeaking
                  ? 'bg-gradient-to-t from-cyan-500 to-indigo-400 shadow-sm shadow-cyan-400/50'
                  : 'bg-slate-800 h-2'
              }`}
              style={{ height: isSpeaking ? `${h}%` : '8px' }}
            ></div>
          ))}
        </div>
      </div>

    </div>
  );
};
