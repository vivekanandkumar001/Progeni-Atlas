'use client';

import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';

interface SubtitleItem {
  id: string;
  speaker: string;
  text: string;
}

interface SubtitlesTickerProps {
  subtitles: SubtitleItem[];
}

export const SubtitlesTicker: React.FC<SubtitlesTickerProps> = ({ subtitles }) => {
  const latestSubtitle = subtitles[subtitles.length - 1] || {
    speaker: 'AI Interviewer',
    text: 'Please review the sliding window rate limiter problem on your workspace.'
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex items-center gap-3">
      <div className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium shrink-0 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>{latestSubtitle.speaker}</span>
      </div>
      <p className="text-xs text-slate-200 font-medium truncate flex-1">
        &quot;{latestSubtitle.text}&quot;
      </p>
      <span className="text-[11px] font-mono text-slate-500 shrink-0 hidden sm:inline">
        Live Closed Captions
      </span>
    </div>
  );
};
