'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Clock,
  Building2,
  RefreshCw,
  Info
} from 'lucide-react';

interface InterviewBriefingCardProps {
  sessionId: string;
  isCameraPassed: boolean;
  isMicPassed: boolean;
  isSpeakerPassed: boolean;
  isNetworkPassed: boolean;
  selectedAudioDevice?: string;
  selectedVideoDevice?: string;
  latencyMs?: number;
  jitterMs?: number;
}

export const InterviewBriefingCard: React.FC<InterviewBriefingCardProps> = ({
  sessionId,
  isCameraPassed,
  isMicPassed,
  isSpeakerPassed,
  isNetworkPassed,
  selectedAudioDevice = 'Default Microphone',
  selectedVideoDevice = 'Integrated Webcam',
  latencyMs = 28,
  jitterMs = 4
}) => {
  const router = useRouter();
  const [agreed, setAgreed] = useState<boolean>(false);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);

  const isAllHardwareReady = isCameraPassed && isMicPassed && isSpeakerPassed && isNetworkPassed;
  const isLaunchEnabled = isAllHardwareReady && agreed;

  const handleLaunchInterview = async () => {
    if (!isLaunchEnabled) return;

    setIsLaunching(true);
    try {
      // POST /api/v1/interview-sessions/:id/lobby-checkin
      const res = await fetch(getApiUrl(`/api/v1/interview-sessions/${sessionId}/lobby-checkin`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardwareDiagnostic: {
            cameraPassed: isCameraPassed,
            microphonePassed: isMicPassed,
            speakerPassed: isSpeakerPassed,
            latencyMs: latencyMs,
            jitterMs: jitterMs,
            selectedAudioDevice: selectedAudioDevice,
            selectedVideoDevice: selectedVideoDevice
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        router.push(data.targetUrl || `/candidate/interview/${sessionId}/room`);
      } else {
        router.push(`/candidate/interview/${sessionId}/room`);
      }
    } catch (e) {
      router.push(`/candidate/interview/${sessionId}/room`);
    } finally {
      setIsLaunching(false);
    }
  };

  const getPendingReason = () => {
    if (!isCameraPassed) return 'Webcam feed verification pending.';
    if (!isMicPassed) return 'Microphone audio calibration pending.';
    if (!isSpeakerPassed) return 'Speaker chime confirmation pending.';
    if (!isNetworkPassed) return 'Network ping measurement pending.';
    if (!agreed) return 'Please check the consent checkbox to proceed.';
    return '';
  };

  return (
    <div className="space-y-6">
      
      {/* METADATA HEADER */}
      <div className="space-y-1">
        <p className="text-caption font-mono uppercase text-cyan-400 tracking-wider">
          TECHNICAL SCREENING LOBBY
        </p>
        <h2 className="text-heading font-bold text-slate-100 text-2xl">
          Full-Stack & Systems Architecture Screening
        </h2>
        <p className="text-body text-slate-400 text-sm flex items-center gap-2 pt-0.5">
          <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-slate-200 font-medium">CloudScale Technologies</span>
          <span className="text-slate-600">•</span>
          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>45 Minutes scheduled</span>
        </p>
      </div>

      {/* RESUME SNAPSHOT CARD */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-4 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="text-body font-medium text-slate-200 text-sm">
              Vivekanand_Resume_2026.pdf
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px]">
            768-dim Vectorized & Synchronized
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-caption text-slate-400 text-xs font-mono">
            Extracted Discussion Anchors:
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
              • Distributed Task Scheduler in Go
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
              • Microservices Orchestration
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium">
              • WebRTC Real-Time Media Streams
            </span>
          </div>
        </div>

        <p className="text-caption text-slate-400 text-[11px] leading-tight">
          The AI interviewer will adapt technical questions according to these verified projects.
        </p>
      </div>

      {/* EVALUATION PROTOCOL & ANTI-CHEAT GROUND RULES */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-4 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100">Evaluation Protocol & Anti-Cheat Rules</h3>
        </div>

        <ul className="space-y-2.5 text-xs text-slate-300">
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Ensure you are in a quiet, well-lit private space.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Keep your gaze centered on the screen; dual-monitor switching will be flagged.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Live closed captions and whiteboard tools will be accessible inside the room.</span>
          </li>
        </ul>

        {/* CONSENT & VERIFICATION CHECKBOX */}
        <label className="flex items-start gap-3 pt-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
          />
          <span className="text-xs text-slate-200 leading-tight">
            I confirm that my camera and audio are functional, and I am ready to begin the structured evaluation.
            <span className="text-rose-500 font-bold ml-1">*</span>
          </span>
        </label>

        {/* PENDING TOOLTIP / REASON */}
        {!isLaunchEnabled && (
          <p className="text-[11px] font-mono text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Pending requirement: {getPendingReason()}</span>
          </p>
        )}

        {/* GATED LAUNCH ACTION CTA */}
        <button
          type="button"
          onClick={handleLaunchInterview}
          disabled={!isLaunchEnabled || isLaunching}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
            isLaunchEnabled
              ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white hover:scale-[1.01] shadow-lg shadow-cyan-500/25 active:scale-[0.99]'
              : 'bg-slate-950 border border-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
          }`}
        >
          {isLaunching ? (
            <RefreshCw className="w-4 h-4 animate-spin text-white" />
          ) : (
            <>
              <span>Enter Video Interview Room</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

    </div>
  );
};
