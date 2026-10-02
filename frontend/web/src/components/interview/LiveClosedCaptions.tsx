'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronUp, ChevronDown, User, Bot, History } from 'lucide-react';

export interface CaptionEntry {
  id: string;
  speaker: 'AI Evaluator' | 'You';
  text: string;
  timestamp?: string;
}

interface LiveClosedCaptionsProps {
  subtitles: CaptionEntry[];
}

export const LiveClosedCaptions: React.FC<LiveClosedCaptionsProps> = ({ subtitles }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const activeSubtitle = subtitles[subtitles.length - 1] || {
    speaker: 'AI Evaluator',
    text: 'Welcome to the interview session. Please begin by explaining your approach to the sliding window rate limiter.'
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md overflow-hidden shadow-2xl transition-all">
      
      {/* HEADER / SINGLE LINE LIVE STRIP */}
      <div className="p-3 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Speaker Tag */}
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium shrink-0 flex items-center gap-1.5 ${
              activeSubtitle.speaker === 'AI Evaluator'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
            }`}
          >
            {activeSubtitle.speaker === 'AI Evaluator' ? (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <User className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>{activeSubtitle.speaker}</span>
          </span>

          {/* Subtitle Text */}
          <p className="text-xs text-slate-100 font-medium truncate flex-1 leading-tight">
            &quot;{activeSubtitle.text}&quot;
          </p>
        </div>

        {/* Expand / Collapse Transcript History Toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-colors cursor-pointer shrink-0"
        >
          <History className="w-3.5 h-3.5" />
          <span>{isExpanded ? 'Collapse' : 'Full Transcript'}</span>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* EXPANDED FULL TRANSCRIPT DRAWER */}
      {isExpanded && (
        <div className="border-t border-slate-800 p-4 bg-slate-950/80 max-h-48 overflow-y-auto space-y-2.5 animate-fadeIn">
          {subtitles.map((sub) => (
            <div key={sub.id} className="flex items-start gap-2.5 text-xs">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono shrink-0 font-medium ${
                  sub.speaker === 'AI Evaluator'
                    ? 'text-cyan-400 bg-cyan-500/10'
                    : 'text-indigo-400 bg-indigo-500/10'
                }`}
              >
                {sub.speaker}:
              </span>
              <p className="text-slate-300 flex-1 leading-relaxed">{sub.text}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
