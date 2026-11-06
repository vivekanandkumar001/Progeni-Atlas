'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, ShieldCheck, User } from 'lucide-react';
import { useMediaSource } from '@/lib/media/MediaSourceProvider';

interface CandidateSelfViewProps {
  name?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  onToggleMic?: () => void;
  onToggleVideo?: () => void;
  onVADActivityChange?: (isSpeaking: boolean) => void;
}

export const CandidateSelfView: React.FC<CandidateSelfViewProps> = ({
  name = 'Candidate',
  isMuted = false,
  isVideoOff = false,
  onToggleMic,
  onToggleVideo,
  onVADActivityChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, source, toggleMic, toggleCamera } = useMediaSource();
  const [voiceLevel, setVoiceLevel] = useState<number>(0);

  // Attach provider stream to video element (no getUserMedia)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = isVideoOff ? null : stream;
    }
  }, [stream, isVideoOff]);

  // Web Audio API VAD Level on provider stream
  useEffect(() => {
    if (!stream || isMuted) {
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    let isCancelled = false;
    let animationFrameId: number;
    let audioCtx: AudioContext | null = null;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioCtx();
      const audioSource = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioSource.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVAD = () => {
        if (isCancelled) return;
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

        animationFrameId = requestAnimationFrame(updateVAD);
      };
      updateVAD();
    } catch (e) {
      console.warn('Candidate self view VAD error:', e);
    }

    return () => {
      isCancelled = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      setVoiceLevel(0);
      onVADActivityChange?.(false);
    };
  }, [stream, isMuted, onVADActivityChange]);

  const handleToggleMic = () => {
    toggleMic();
    onToggleMic?.();
  };

  const handleToggleVideo = () => {
    toggleCamera();
    onToggleVideo?.();
  };

  return (
    <div className="relative w-full h-full min-h-[200px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex items-center justify-center group">
      {!isVideoOff && stream ? (
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
          <p className="text-xs font-mono">{!stream ? 'No Video Stream' : 'Camera Paused'}</p>
        </div>
      )}

      {/* Face Mesh Active Indicator & Source Badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-cyan-400 backdrop-blur-md">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>{source === 'phone' ? 'Phone Feed Active' : 'Face Mesh Tracking Active'}</span>
      </div>

      {/* Candidate Name & Controls Footer */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-medium text-slate-200 backdrop-blur-md">
            {name} (Candidate)
          </span>
          {voiceLevel > 15 && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mic Toggle */}
          <button
            type="button"
            onClick={handleToggleMic}
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
            onClick={handleToggleVideo}
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
