'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, ShieldCheck, AlertTriangle, PhoneOff, Circle } from 'lucide-react';

interface InterviewRoomHeaderProps {
  sessionId: string;
  currentStageIndex: number;
  stages: string[];
  remainingSeconds: number;
  proctoringStatus: 'secure' | 'face_warning' | 'tab_warning';
  onEndSessionClick: () => void;
}

export const InterviewRoomHeader: React.FC<InterviewRoomHeaderProps> = ({
  sessionId,
  currentStageIndex,
  stages,
  remainingSeconds,
  proctoringStatus,
  onEndSessionClick
}) => {
  const [elapsedRecSeconds, setElapsedRecSeconds] = useState<number>(0);

  // Recording counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedRecSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowTime = remainingSeconds < 5 * 60;

  return (
    <header className="h-14 shrink-0 bg-slate-950/90 border-b border-slate-800 px-6 flex items-center justify-between z-30 backdrop-blur-md">
      
      {/* LEFT: BRAND & REC BEACON */}
      <div className="flex items-center gap-4">
        <Link href="/candidate/dashboard" className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-base tracking-tight">
            TalentPulse<span className="text-cyan-400">.AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[11px]">
          <Circle className="w-2.5 h-2.5 fill-rose-500 animate-pulse text-rose-500" />
          <span>REC {formatTimer(elapsedRecSeconds)}</span>
        </div>
      </div>

      {/* CENTER: BREADCRUMB STAGE INDICATOR */}
      <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
        {stages.map((stage, idx) => {
          const isActive = idx === currentStageIndex;
          const isPassed = idx < currentStageIndex;
          return (
            <div key={stage} className="flex items-center gap-1">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-medium font-mono transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : isPassed
                    ? 'text-slate-400 opacity-80'
                    : 'text-slate-600'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>}
                <span>{stage}</span>
              </span>
              {idx < stages.length - 1 && <span className="text-slate-700 text-xs">›</span>}
            </div>
          );
        })}
      </div>

      {/* RIGHT: PROCTORING PILL, TIMER & END SESSION BUTTON */}
      <div className="flex items-center gap-3">
        {/* Proctoring Integrity Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-mono text-[11px] transition-colors ${
            proctoringStatus === 'secure'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : proctoringStatus === 'face_warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse'
          }`}
        >
          {proctoringStatus === 'secure' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">● Environment Secure</span>
            </>
          ) : proctoringStatus === 'face_warning' ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>⚠ Face Out of Frame</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>⚠ Tab Focus Lost</span>
            </>
          )}
        </div>

        {/* Remaining Time Counter */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-mono font-bold transition-colors ${
            isLowTime
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 animate-pulse'
              : 'bg-slate-900 border-slate-800 text-cyan-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{formatTimer(remainingSeconds)} Remaining</span>
        </div>

        {/* Complete & Exit Session CTA */}
        <button
          type="button"
          onClick={onEndSessionClick}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Complete & Exit Session</span>
        </button>
      </div>

    </header>
  );
};
