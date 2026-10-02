'use client';

import React from 'react';
import { AlertTriangle, PhoneOff } from 'lucide-react';

interface SessionExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExit: () => void;
}

export const SessionExitModal: React.FC<SessionExitModalProps> = ({
  isOpen,
  onClose,
  onConfirmExit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
        <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-lg font-bold text-slate-100">Complete & Exit Interview Session?</h3>
        </div>
        
        <p className="text-xs text-slate-300 leading-relaxed">
          Are you sure you want to end your evaluation session? Your audio transcript, code snapshots, and architectural diagram state will be saved into your candidate evaluation dossier for recruiter review.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel & Resume
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Complete & Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
