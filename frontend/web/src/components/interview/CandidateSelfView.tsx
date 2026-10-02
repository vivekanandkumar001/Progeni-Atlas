'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ShieldCheck, User } from 'lucide-react';

interface CandidateSelfViewProps {
  name?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  onToggleMic?: () => void;
  onToggleVideo?: () => void;
}

export const CandidateSelfView: React.FC<CandidateSelfViewProps> = ({
  name = 'Vivekanand Kumar',
  isMuted = false,
  isVideoOff = false,
  onToggleMic,
  onToggleVideo
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function startStream() {
      if (isVideoOff) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.warn('Candidate self view stream error:', e);
      }
    }
    startStream();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isVideoOff]);

  return (
    <div className="relative w-full h-full min-h-[200px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex items-center justify-center group">
      {!isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        <div className="flex flex-col items-center justify-center space-y-2 text-slate-500">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <p className="text-xs font-mono">Camera Paused</p>
        </div>
      )}

      {/* Face Mesh Active Indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-cyan-400 backdrop-blur-md">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Face Mesh Tracking Active</span>
      </div>

      {/* Candidate Name & Controls Footer */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
        <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-medium text-slate-200 backdrop-blur-md">
          {name} (Candidate)
        </span>

        <div className="flex items-center gap-2">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={onToggleMic}
            className={`p-2 rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-cyan-400'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            onClick={onToggleVideo}
            className={`p-2 rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
              isVideoOff
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-cyan-400'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
