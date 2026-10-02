'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ShieldCheck, User } from 'lucide-react';

interface CandidateVideoPreviewProps {
  name?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  onToggleMic?: () => void;
  onToggleVideo?: () => void;
  onVADActivityChange?: (isSpeaking: boolean) => void;
}

export const CandidateVideoPreview: React.FC<CandidateVideoPreviewProps> = ({
  name = 'Vivekanand Kumar',
  isMuted = false,
  isVideoOff = false,
  onToggleMic,
  onToggleVideo,
  onVADActivityChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [voiceLevel, setVoiceLevel] = useState<number>(0);

  useEffect(() => {
    async function startStream() {
      if (isVideoOff) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Web Audio API VAD Level
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVAD = () => {
          if (!streamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const lvl = Math.min(100, Math.round((avg / 128) * 100));
          setVoiceLevel(lvl);

          if (lvl > 15) {
            onVADActivityChange?.(true);
          } else {
            onVADActivityChange?.(false);
          }

          requestAnimationFrame(updateVAD);
        };
        updateVAD();

      } catch (e) {
        console.warn('Candidate video stream error:', e);
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
          <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
            <User className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-xs font-mono">Camera Off</p>
        </div>
      )}

      {/* Top-Right Badge: Resolution & FPS */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-emerald-400 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span>1080p • 30fps</span>
      </div>

      {/* Bottom-Left Badge: Real-Time Audio Visualizer Pill */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-800 backdrop-blur-md text-xs font-mono">
        <span className="text-slate-200 font-medium truncate max-w-[120px]">{name}</span>
        <div className="flex items-center gap-1 h-3">
          <div
            className={`w-1 rounded-full transition-all ${
              voiceLevel > 10 ? 'bg-cyan-400 h-3' : 'bg-slate-700 h-1.5'
            }`}
          ></div>
          <div
            className={`w-1 rounded-full transition-all ${
              voiceLevel > 25 ? 'bg-cyan-400 h-4' : 'bg-slate-700 h-1.5'
            }`}
          ></div>
          <div
            className={`w-1 rounded-full transition-all ${
              voiceLevel > 50 ? 'bg-indigo-400 h-3' : 'bg-slate-700 h-1.5'
            }`}
          ></div>
        </div>
      </div>

      {/* Bottom-Right Overlay Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-2 rounded-xl border backdrop-blur-md transition-colors cursor-pointer ${
            isMuted
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-cyan-400'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

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
  );
};
