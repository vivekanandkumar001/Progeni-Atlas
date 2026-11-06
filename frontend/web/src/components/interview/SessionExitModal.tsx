'use client';

import React from 'react';
import { AlertTriangle, PhoneOff } from 'lucide-react';

interface SessionExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
  isConcluding?: boolean;
  isPractice?: boolean;
}

export const SessionExitModal: React.FC<SessionExitModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit,
  isConcluding = false,
  isPractice = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md p-6 rounded-2xl bg-surface border border-line space-y-5 shadow-2xl">
        <div className="flex items-center gap-3 text-accent-rose border-b border-line pb-3">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-lg font-bold text-ink">
            {isPractice ? 'End Practice Drill?' : 'End Interview Session?'}
          </h3>
        </div>
        
        <p className="text-xs text-ink leading-relaxed">
          {isPractice
            ? 'Ending the drill will score your responses and generate your practice performance report.'
            : 'Ending the session will submit your interview responses and telemetry to the recruitment team and redirect you to your dashboard. You will not be able to resume once ended.'}
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isConcluding}
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel & Resume
          </button>
          <button
            type="button"
            disabled={isConcluding}
            onClick={onConfirmExit}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-on-brand text-xs font-semibold shadow-lg shadow-rose-600/20 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <PhoneOff className="w-4 h-4" />
            <span>{isConcluding ? 'Finalizing...' : 'End Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
