'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CameraMicPreview } from '@/components/interview/CameraMicPreview';
import { PhonePairPanel } from '@/components/interview/PhonePairPanel';
import { NetworkJitterGauge } from '@/components/interview/NetworkJitterGauge';
import { InterviewBriefingCard } from '@/components/interview/InterviewBriefingCard';
import { Radio, AlertCircle, Lock, LogIn } from 'lucide-react';
import { getInterviewState, isValidSessionId } from '@/lib/api';
import { BrandLogo } from '@/components/common/BrandLogo';

export default function CandidateLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id as string;
  const isValid = isValidSessionId(rawId);
  const sessionId = isValid ? rawId : '';

  // A direct/deep link can leave the public site behind this lobby in browser
  // history. Back should return candidates to their dashboard, not the landing
  // page or login hand-off that originally opened the interview.
  useEffect(() => {
    if (!sessionId) return;

    window.history.pushState({ page: 'candidate-interview-lobby', sessionId }, '', window.location.href);
    const handlePopState = () => router.replace('/candidate/dashboard');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router, sessionId]);

  // State tracked across hardware subcomponents
  const [isCameraPassed, setIsCameraPassed] = useState<boolean>(false);
  const [isMicPassed, setIsMicPassed] = useState<boolean>(false);
  const [isSpeakerPassed, setIsSpeakerPassed] = useState<boolean>(false);
  const [speakerStatus, setSpeakerStatus] = useState<'PENDING' | 'RUNNING' | 'PASSED' | 'NEEDS_CHANGE'>('PENDING');

  const [isNetworkPassed, setIsNetworkPassed] = useState<boolean>(false);
  const [networkStatus, setNetworkStatus] = useState<'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR'>('PENDING');
  const [networkMessage, setNetworkMessage] = useState<string>('');

  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('Integrated Webcam');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('Default Microphone');

  const [latencyMs, setLatencyMs] = useState<number>(28);
  const [jitterMs, setJitterMs] = useState<number>(4);

  // Server-authoritative interview mode. Defaults to 'real' (the strictest
  // gates) until the contract confirms otherwise, so a failed fetch never
  // weakens the lobby requirements.
  const [sessionMode, setSessionMode] = useState<string>('real');
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const state = await getInterviewState(sessionId);
        if (!cancelled && state && typeof state.mode === 'string' && state.mode) {
          setSessionMode(state.mode);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const errorObj = err as Error & { status_code?: number };
        const msg = errorObj?.message || '';
        const status = errorObj?.status_code;

        if (
          status === 401 ||
          msg.includes('Session expired') ||
          msg.includes('log in') ||
          msg.includes('Authentication required') ||
          msg.includes('credentials')
        ) {
          setIsSessionExpired(true);
        } else {
          console.warn('[CandidateLobbyPage] Failed to fetch interview state:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (isSessionExpired) {
    const returnUrl = `/candidate/interview/${encodeURIComponent(sessionId)}/lobby`;
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-header border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <BrandLogo href="/candidate/dashboard" />
          </div>
        </header>

        <main className="flex-grow max-w-3xl w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-accent-amber mb-6">
            <Lock className="w-10 h-10 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Session Expired</h1>
          <p className="text-ink-muted text-sm max-w-md mb-8">
            Your login session has expired or requires authentication. Please log in again to enter your interview pre-flight lobby.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xs sm:max-w-none">
            <Link
              href={`/login?redirect=${encodeURIComponent(returnUrl)}`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all inline-flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Log In to Continue</span>
            </Link>
            <Link
              href="/candidate/dashboard"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink-muted hover:text-ink font-semibold text-sm transition-all inline-flex items-center justify-center"
            >
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
        <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-header border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <BrandLogo href="/candidate/dashboard" />
          </div>
        </header>

        <main className="flex-grow max-w-3xl w-full mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-accent-amber mb-6">
            <AlertCircle className="w-10 h-10 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Invalid Interview Session</h1>
          <p className="text-ink-muted text-sm max-w-md mb-8">
            The interview session URL is invalid or missing a valid session ID. Please return to your candidate dashboard to select an active interview.
          </p>
          <Link
            href="/candidate/dashboard"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 transition-all"
          >
            Return to Candidate Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-header border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo href="/candidate/dashboard" />
            <span className="hidden sm:inline-block text-ink-faint">|</span>
            <span className="hidden sm:inline-block text-xs font-mono text-ink-muted">
              Checkpoint ID: <span className="text-accent-cyan">{sessionId.substring(0, 8)}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-line text-xs font-mono text-accent-cyan">
              <Radio className="w-3.5 h-3.5 text-accent-cyan animate-pulse" />
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
                setSpeakerStatus(passed ? 'PASSED' : 'NEEDS_CHANGE');
              }}
            />

            {/* Phone Pairing QR & Companion Helper */}
            <PhonePairPanel />

            {/* Network Latency & Jitter Monitor Subcomponent */}
            <NetworkJitterGauge
              autoStart
              onMetricsComplete={(metrics) => {
                setIsNetworkPassed(metrics.passed);
                setNetworkStatus(metrics.status);
                setNetworkMessage(metrics.message);
                setLatencyMs(metrics.latencyMs);
                setJitterMs(metrics.jitterMs);
              }}
            />
          </div>

          {/* COLUMN 2: BRIEFING & GATED LAUNCH GATE (DESKTOP: COL SPAN 5, MOBILE: ORDER 2) */}
          <div className="lg:col-span-5 order-2">
            <InterviewBriefingCard
              sessionId={sessionId}
              mode={sessionMode}
              isCameraPassed={isCameraPassed}
              isMicPassed={isMicPassed}
              isSpeakerPassed={isSpeakerPassed}
              speakerStatus={speakerStatus}
              isNetworkPassed={isNetworkPassed}
              networkStatus={networkStatus}
              networkMessage={networkMessage}
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