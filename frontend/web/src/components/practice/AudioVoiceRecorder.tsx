'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, MessageSquare, Code2 } from 'lucide-react';

interface AudioVoiceRecorderProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  transcript: string;
  onTranscriptChange: (text: string) => void;
  mode: 'voice' | 'text';
  onModeChange: (mode: 'voice' | 'text') => void;
}

export const AudioVoiceRecorder: React.FC<AudioVoiceRecorderProps> = ({
  isRecording,
  onToggleRecording,
  transcript,
  onTranscriptChange,
  mode,
  onModeChange
}) => {
  const [meterBars, setMeterBars] = useState<number[]>([15, 30, 45, 60, 80, 50, 30, 70, 90, 40, 20, 60]);

  // Simulate dynamic Web Audio API AnalyserNode waveform movement when recording
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setMeterBars(Array.from({ length: 12 }, () => Math.floor(Math.random() * 85) + 15));
    }, 150);
    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <div className="space-y-4">
      {/* Mode Selector Row */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => onModeChange('voice')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === 'voice'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Mode A: Spoken Answer</span>
          </button>

          <button
            type="button"
            onClick={() => onModeChange('text')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === 'text'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Mode B: Text / Code Snippet</span>
          </button>
        </div>

        {mode === 'voice' && (
          <button
            type="button"
            onClick={onToggleRecording}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
              isRecording
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse shadow-lg shadow-rose-500/20'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
            }`}
          >
            {isRecording ? (
              <>
                <Mic className="w-4 h-4 text-rose-400 animate-bounce" />
                <span>Recording... (Tap to Pause)</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-cyan-400" />
                <span>Tap Microphone to Speak</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Voice Waveform Meter Visualizer (Mode A) */}
      {mode === 'voice' && isRecording && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              Web Audio API Voice Waveform Active
            </span>
            <span>Live Micro-Stream</span>
          </div>

          <div className="flex items-end justify-center gap-1.5 h-12 py-1">
            {meterBars.map((height, idx) => (
              <div
                key={idx}
                className="w-2 bg-gradient-to-t from-cyan-500 to-indigo-400 rounded-full transition-all duration-150"
                style={{ height: `${height}%` }}
              ></div>
            ))}
          </div>
        </div>
      )}

      {/* Real-Time Transcript Preview Box */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
          <span>{mode === 'voice' ? 'Real-Time Speech-to-Text Preview:' : 'Technical Answer / Pseudocode:'}</span>
          <span className="text-[11px] text-slate-500 font-mono">
            {transcript.trim().split(/\s+/).filter(Boolean).length} words
          </span>
        </label>

        <textarea
          rows={6}
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          placeholder={
            mode === 'voice'
              ? 'Transcribed thoughts will appear here in real time as you speak into your microphone...'
              : 'Enter technical trade-offs, algorithms, code logic, or architectural diagrams...'
          }
          className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 font-sans focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
        />
      </div>
    </div>
  );
};
