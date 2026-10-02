'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CameraMicPreview } from '@/components/interview/CameraMicPreview';
import { NetworkJitterGauge } from '@/components/interview/NetworkJitterGauge';
import { InterviewBriefingCard } from '@/components/interview/InterviewBriefingCard';
import { Clock, ShieldCheck, Radio } from 'lucide-react';

export default function CandidateLobbyPage() {
  const params = useParams();
  const sessionId = (params?.id as string) || 'e1111111-1111-1111-1111-111111111111';

  // State tracked across hardware subcomponents
  const [isCameraPassed, setIsCameraPassed] = useState<boolean>(false);
  const [isMicPassed, setIsMicPassed] = useState<boolean>(false);
  const [isSpeakerPassed, setIsSpeakerPassed] = useState<boolean>(false);
  const [isNetworkPassed, setIsNetworkPassed] = useState<boolean>(false);

  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('Integrated Webcam');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('Default Microphone');

  const [latencyMs, setLatencyMs] = useState<number>(28);
  const [jitterMs, setJitterMs] = useState<number>(4);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-slate-950/85 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/candidate/dashboard" className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
              <span className="font-bold text-slate-100 text-base sm:text-lg tracking-tight">
                TalentPulse<span className="text-cyan-400">.AI</span>
              </span>
            </Link>
            <span className="hidden sm:inline-block text-slate-700">|</span>
            <span className="hidden sm:inline-block text-xs font-mono text-slate-400">
              Checkpoint ID: <span className="text-cyan-400">{sessionId.substring(0, 8)}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Pre-Flight Diagnostic Lobby</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER (FLEX MOBILE / 2-COLUMN DESKTOP SPLIT) */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
          
          {/* COLUMN 1: HARDWARE DIAGNOSTIC VIEWPORT (DESKTOP: COL SPAN 7, MOBILE: ORDER 1) */}
          <div className="lg:col-span-7 order-1 space-y-6">
            
            {/* Live Camera & Mic Preview Subcomponent */}
            <CameraMicPreview
              onCameraStateChange={(passed, dev) => {
                setIsCameraPassed(passed);
                if (dev) setSelectedVideoDevice(dev);
              }}
              onMicStateChange={(passed, dev) => {
                setIsMicPassed(passed);
                if (dev) setSelectedAudioDevice(dev);
              }}
              onSpeakerStateChange={(passed) => {
                setIsSpeakerPassed(passed);
              }}
            />

            {/* Network Latency & Jitter Monitor Subcomponent */}
            <NetworkJitterGauge
              onMetricsComplete={(metrics) => {
                setIsNetworkPassed(metrics.passed);
                setLatencyMs(metrics.latencyMs);
                setJitterMs(metrics.jitterMs);
              }}
            />

          </div>

          {/* COLUMN 2: BRIEFING & GATED LAUNCH GATE (DESKTOP: COL SPAN 5, MOBILE: ORDER 2) */}
          <div className="lg:col-span-5 order-2">
            <InterviewBriefingCard
              sessionId={sessionId}
              isCameraPassed={isCameraPassed}
              isMicPassed={isMicPassed}
              isSpeakerPassed={isSpeakerPassed}
              isNetworkPassed={isNetworkPassed}
              selectedAudioDevice={selectedAudioDevice}
              selectedVideoDevice={selectedVideoDevice}
              latencyMs={latencyMs}
              jitterMs={jitterMs}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
