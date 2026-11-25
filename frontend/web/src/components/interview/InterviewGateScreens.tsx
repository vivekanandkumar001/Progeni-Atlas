'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Lock, LogIn } from 'lucide-react';
import type { ProctoringHealthState } from '@/lib/proctoring/proctoringHealth';

interface SessionExpiredScreenProps {
  redirectPath?: string;
  onReturnDashboard?: () => void;
}

export const SessionExpiredScreen: React.FC<SessionExpiredScreenProps> = ({
  redirectPath,
  onReturnDashboard,
}) => {
  const loginUrl = redirectPath
    ? `/login?redirect=${encodeURIComponent(redirectPath)}`
    : '/login';

  return (
    <div className="min-h-dvh w-full overflow-y-auto flex flex-col items-center justify-center bg-canvas text-ink p-8">
      <div className="max-w-xl text-center p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-4 backdrop-blur-xl">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-accent-amber flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-ink">Session Expired</h2>
        <p className="text-sm text-ink-muted">
          Your session has expired. Please <a href="/login" className="font-medium text-accent-cyan hoverunderline">log in</a> to continue your interview.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={loginUrl}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all text-center inline-flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Log In to Continue</span>
          </Link>
          {onReturnDashboard ? (
            <button
              onClick={onReturnDashboard}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink-muted hover:text-ink font-semibold text-xs transition-all text-center cursor-pointer"
            >
              Return to Dashboard
            </button>
          ) : (
            <Link
              href="/candidate/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface hover:bg-surface-raised border border-line text-ink-muted hover:text-ink font-semibold text-xs transition-all text-center"
            >
              Return to Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

interface SessionVoidedScreenProps {
  onReturnDashboard: () => void;
  message?: string;
}

export const SessionVoidedScreen: React.FC<SessionVoidedScreenProps> = ({ onReturnDashboard, message }) => (
  <div className="min-h-dvh w-full overflow-y-auto flex flex-col items-center justify-center bg-canvas text-ink p-8">
    <video className="hidden" aria-hidden="true" />
    <div className="max-w-xl text-center p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-4 backdrop-blur-xl">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-accent-amber flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-ink">Interview Not Scored</h2>
      <p className="text-sm text-ink-muted">
        {message ?? 'This interview session was closed before any questions were attempted. You were NOT charged and nothing has been submitted for evaluation.'}
      </p>
      <p className="text-xs font-mono text-ink-muted">No charge • No scorecard issued • No recruiter was notified</p>
      <button
        onClick={onReturnDashboard}
        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all text-center cursor-pointer"
      >
        Return to Candidate Dashboard
      </button>
    </div>
  </div>
);

interface InvalidSessionScreenProps {
  onReturnDashboard: () => void;
}

export const InvalidSessionScreen: React.FC<InvalidSessionScreenProps> = ({ onReturnDashboard }) => (
  <div className="min-h-dvh w-full overflow-y-auto flex flex-col items-center justify-center bg-canvas text-ink p-8">
    <div className="max-w-xl text-center p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-4 backdrop-blur-xl">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-accent-rose flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-ink">Invalid Interview Session</h2>
      <p className="text-sm text-ink-muted">
        The interview session ID provided in the URL is missing or invalid. Please check your interview invitations or return to your dashboard.
      </p>
      <button
        onClick={onReturnDashboard}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
      >
        Return to Candidate Dashboard
      </button>
    </div>
  </div>
);

interface MediaPreparingScreenProps {
  bindProctoringVideo: (video: HTMLVideoElement | null) => (() => void) | undefined;
  sessionMode: string;
  mediaStatus: string;
  onRetry: () => void;
}

export const MediaPreparingScreen: React.FC<MediaPreparingScreenProps> = ({
  bindProctoringVideo,
  sessionMode,
  mediaStatus,
  onRetry,
}) => (
  <div className="min-h-dvh w-full overflow-y-auto flex flex-col items-center justify-center bg-canvas text-ink p-8">
    <video ref={bindProctoringVideo} muted playsInline autoPlay className="hidden" aria-hidden="true" />
    <div className="max-w-xl text-center">
      <div className="text-lg font-black">Preparing your interview media…</div>
      {sessionMode === 'practice' ? (
        <p className="mt-3 text-sm text-ink-muted">Your camera and microphone are being prepared for this practice drill.</p>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          The realtime interview session must be connected through LiveKit before the interview can start. A local camera preview alone is not a connected interview.
        </p>
      )}
      {mediaStatus === 'error' && (
        <p className="mt-4 text-sm text-accent-rose">
          Media setup failed. Please check camera/microphone permissions and the LiveKit connection, then retry.
        </p>
      )}
      <p className="mt-5 text-xs text-ink-muted leading-relaxed">
        If this keeps failing, it may be on our side — not yours. Your slot is safe:{' '}
        <a href="/candidate/dashboard" className="text-accent-cyan hover:underline font-semibold">return to your dashboard</a>{' '}
        to reschedule, or <a href="/contact" className="text-accent-cyan hover:underline font-semibold">contact us</a> and we&apos;ll make it right.
      </p>
      <button onClick={onRetry} className="mt-5 rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">
        Retry media setup
      </button>
    </div>
  </div>
);

interface ProctoringWaitingScreenProps {
  bindProctoringVideo: (video: HTMLVideoElement | null) => (() => void) | undefined;
  proctoringHealthState: ProctoringHealthState;
  proctoringUnavailable: boolean;
  onRetry: () => void;
}

export const ProctoringWaitingScreen: React.FC<ProctoringWaitingScreenProps> = ({
  bindProctoringVideo,
  proctoringHealthState,
  proctoringUnavailable,
  onRetry,
}) => (
  <div className="min-h-dvh w-full overflow-y-auto flex flex-col items-center justify-center bg-canvas text-ink p-8">
    <video ref={bindProctoringVideo} muted playsInline autoPlay className="hidden" aria-hidden="true" />
    <div className="max-w-xl text-center">
      <div className="text-lg font-black">We couldn&apos;t set up your camera</div>
      <p className="mt-3 text-sm text-ink-muted">
        Nothing about your appearance or face is ever analysed. We only need the camera feed for the video call
        itself — please check camera/mic permissions, or contact your recruiter to reschedule.
      </p>
      {proctoringUnavailable && (
        <p className="mt-4 text-sm text-accent-rose">
          The camera or microphone could not be started. You can retry, or reach out and we&apos;ll help.
        </p>
      )}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button onClick={onRetry} className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950">
          Retry camera setup
        </button>
        <a href="/candidate/dashboard" className="text-xs text-ink-muted hover:text-ink font-semibold">
          Return to dashboard
        </a>
      </div>
    </div>
  </div>
);

interface FullscreenStartGateScreenProps {
  bindProctoringVideo: (video: HTMLVideoElement | null) => (() => void) | undefined;
  proctoringHealthState: ProctoringHealthState;
  facesObserved?: number;
  apiError: string | null;
  onBeginInterview: () => void;
}

export const FullscreenStartGateScreen: React.FC<FullscreenStartGateScreenProps> = ({
  bindProctoringVideo,
  apiError,
  onBeginInterview,
}) => (
  <div className="min-h-dvh w-full overflow-y-auto flex flex-col items-center justify-center bg-canvas text-ink p-8">
    <video ref={bindProctoringVideo} muted playsInline autoPlay className="hidden" aria-hidden="true" />
    <div className="max-w-xl text-center p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-4 backdrop-blur-xl">
      <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-ink">Ready when you are</h2>
      <p className="text-sm text-ink-muted">
        This is a live conversation with Sarah, our AI interviewer — your camera and microphone stay on for the
        session, just like a real video call. A human reviews the evidence afterwards; nothing you say is
        auto-scored and thrown away.
      </p>
      {apiError && <p className="text-sm text-accent-rose">{apiError}</p>}
      <button
        type="button"
        onClick={onBeginInterview}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg transition-all cursor-pointer"
      >
        Begin Interview
      </button>
    </div>
  </div>
);
