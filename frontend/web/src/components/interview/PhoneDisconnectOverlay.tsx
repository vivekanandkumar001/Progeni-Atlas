'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PhonePairPanel } from '@/components/interview/PhonePairPanel';

export interface PhoneDisconnectOverlayProps {
  isPhoneDisconnected: boolean;
  isPhoneTerminalFailure: boolean;
  reconnectCountdown: number;
  onUseDesktopCamera: () => void;
}

export const PhoneDisconnectOverlay: React.FC<PhoneDisconnectOverlayProps> = ({
  isPhoneDisconnected,
  isPhoneTerminalFailure,
  reconnectCountdown,
  onUseDesktopCamera,
}) => {
  if (!isPhoneDisconnected) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-lg p-6 rounded-xl bg-slate-900 border border-rose-500/40 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {isPhoneTerminalFailure ? 'Phone Relay Unavailable' : 'Phone Disconnected'}
              </h3>
              <p className="text-xs text-rose-300 font-mono">
                {isPhoneTerminalFailure ? 'Connection limit exceeded' : `Reconnect within ${reconnectCountdown}s`}
              </p>
            </div>
          </div>
        </div>

        {isPhoneTerminalFailure ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 leading-relaxed">
              <p className="font-semibold text-rose-100 mb-1">Max re-pairing attempts reached.</p>
              <p>Phone relay unavailable - try again later or use your desktop camera.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onUseDesktopCamera}
                className="flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <span>Use Desktop Camera</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your phone camera &amp; mic stream was disconnected. Scan the fresh QR code below on your phone to resume immediately.
            </p>
            <PhonePairPanel forceOpen className="w-full" />
          </>
        )}
      </div>
    </div>
  );
};
