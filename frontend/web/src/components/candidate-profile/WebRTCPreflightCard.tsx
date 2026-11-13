'use client';

import React from 'react';
import { Activity, Video, Mic, RefreshCw } from 'lucide-react';

interface WebRTCPreflightCardProps {
  camStatus: 'idle' | 'checking' | 'passed' | 'failed';
  micStatus: 'idle' | 'checking' | 'passed' | 'failed';
  latencyMs: number | null;
  audioLevel: number;
  diagRunning: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onRunDiagnostics: () => void;
}

export function WebRTCPreflightCard({
  camStatus,
  micStatus,
  latencyMs,
  audioLevel,
  diagRunning,
  videoRef,
  onRunDiagnostics,
}: WebRTCPreflightCardProps) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-lg font-bold text-ink">Live WebRTC Pre-Flight</h2>
        </div>
        <span className="text-xs text-ink-muted font-mono">AI Interview Check</span>
      </div>

      {/* Video Camera Live Preview Box */}
      <div className="relative w-full h-44 rounded-xl bg-inset border border-line overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {camStatus !== 'passed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-inset/90 text-ink-muted p-4 text-center space-y-2">
            <Video className="w-8 h-8 text-ink-faint animate-pulse" />
            <p className="text-xs font-medium text-ink">Camera Feed Idle</p>
            <p className="text-[11px] text-ink-muted">
              Run diagnostic check below to test webcam & microphone.
            </p>
          </div>
        )}

        {/* Status Overlay Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-inset/80 border border-line backdrop-blur-md text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              camStatus === 'passed' ? 'bg-emerald-400 animate-ping' : 'bg-surface-3'
            }`}
          ></span>
          <span className="text-ink">
            {camStatus === 'passed' ? '720p HD Feed Active' : 'Feed Standby'}
          </span>
        </div>
      </div>

      {/* Mic Level Visualizer Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink inline-flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Microphone Input Meter</span>
          </span>
          <span className="font-mono text-accent-cyan">{audioLevel}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-inset border border-line overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-75"
            style={{ width: `${audioLevel}%` }}
          ></div>
        </div>
      </div>

      {/* Diagnostic Metrics Matrix */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-inset space-y-1">
          <p className="text-[11px] text-ink-muted font-mono">Webcam Stream</p>
          <p
            className={`text-xs font-semibold ${
              camStatus === 'passed'
                ? 'text-accent-emerald'
                : camStatus === 'failed'
                  ? 'text-accent-rose'
                  : 'text-ink-muted'
            }`}
          >
            {camStatus === 'passed'
              ? '✓ Verified'
              : camStatus === 'failed'
                ? '✗ Permission Denied'
                : 'Pending Check'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-inset space-y-1">
          <p className="text-[11px] text-ink-muted font-mono">Microphone Audio</p>
          <p
            className={`text-xs font-semibold ${
              micStatus === 'passed'
                ? 'text-accent-emerald'
                : micStatus === 'failed'
                  ? 'text-accent-rose'
                  : 'text-ink-muted'
            }`}
          >
            {micStatus === 'passed'
              ? '✓ Clear Stream'
              : micStatus === 'failed'
                ? '✗ Muted / Blocked'
                : 'Pending Check'}
          </p>
        </div>

        <div className="col-span-2 p-3 rounded-xl bg-inset flex items-center justify-between">
          <span className="text-xs text-ink-muted font-mono">WebRTC Diagnostic Latency</span>
          <span className="text-xs font-mono font-bold text-accent-cyan">
            {latencyMs !== null ? `${latencyMs} ms (Excellent)` : '--'}
          </span>
        </div>
      </div>

      {/* Run Diagnostics CTA */}
      <button
        type="button"
        onClick={onRunDiagnostics}
        disabled={diagRunning}
        className="w-full py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-accent-cyan font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-line-strong"
      >
        {diagRunning ? (
          <RefreshCw className="w-4 h-4 animate-spin text-accent-cyan" />
        ) : (
          <Activity className="w-4 h-4 text-accent-cyan" />
        )}
        <span>{diagRunning ? 'Testing Hardware Connections...' : 'Run Pre-Flight Hardware Diagnostic'}</span>
      </button>
    </div>
  );
}