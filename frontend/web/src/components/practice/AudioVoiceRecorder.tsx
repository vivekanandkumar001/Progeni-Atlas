'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, Sparkles, MessageSquare, Code2, AlertCircle } from 'lucide-react';
import { useWebSpeechRecognition } from '@/lib/hooks/useWebSpeechRecognition';

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

  const { isSupported, error: speechError, startListening, stopListening } = useWebSpeechRecognition({
    language: 'en-IN',
    onTranscriptUpdate: (text) => {
      onTranscriptChange(text);
    },
  });

  useEffect(() => {
    if (mode === 'voice' && isRecording) {
      startListening();
    } else {
      stopListening();
    }
  }, [mode, isRecording, startListening, stopListening]);


  return (
    <div className="space-y-4">
      {/* Mode Selector Row */}
      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 rounded-xl bg-inset border border-line text-xs font-mono">
          <button
            type="button"
            onClick={() => onModeChange('voice')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mode === 'voice'
                ? 'bg-cyan-500/20 text-accent-cyan border border-cyan-500/30'
                : 'text-ink-muted hover:text-ink'
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
                ? 'bg-cyan-500/20 text-accent-cyan border border-cyan-500/30'
                : 'text-ink-muted hover:text-ink'
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
                ? 'bg-rose-500/20 text-accent-rose border border-rose-500/40 animate-pulse shadow-lg shadow-rose-500/20'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-accent-cyan border border-cyan-500/30'
            }`}
          >
            {isRecording ? (
              <>
                <Mic className="w-4 h-4 text-accent-rose animate-bounce" />
                <span>Recording... (Tap to Pause)</span>
              </>
            ) : (
              <>
                <MicOff className="w-4 h-4 text-accent-cyan" />
                <span>Tap Microphone to Speak</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Voice Waveform Meter Visualizer (Mode A) */}
      {mode === 'voice' && isRecording && (
        <div className="p-4 rounded-xl bg-inset border border-line space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-accent-cyan">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 animate-pulse text-accent-cyan" />
              Voice capture active
            </span>
            <span>Live Micro-Stream</span>
          </div>

          <div className="flex items-end justify-center gap-1.5 h-12 py-1">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div
                key={idx}
                className="w-2 bg-gradient-to-t from-cyan-500 to-indigo-400 rounded-full animate-pulse"
                style={{ height: `${24 + (idx % 5) * 12}%`, animationDelay: `${idx * 55}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fallback & Error Alerts */}
      {!isSupported && mode === 'voice' && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-accent-amber text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Speech recognition (Web Speech API) is not supported in this browser. Please type your answer directly below.</span>
        </div>
      )}

      {speechError && mode === 'voice' && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-accent-rose text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Real-Time Transcript Preview Box */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono text-ink-muted flex items-center justify-between">
          <span>{mode === 'voice' ? 'Real-Time Speech-to-Text Preview:' : 'Technical Answer / Pseudocode:'}</span>
          <span className="text-[11px] text-ink-muted font-mono">
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
              : 'Please enter technical trade-offs, algorithms, code logic, or architectural diagrams...'
          }
          className="w-full p-4 rounded-xl bg-inset border border-line text-xs text-ink placeholder-ink-muted font-sans focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
        />
      </div>
    </div>
  );
};
