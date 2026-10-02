"use me";
import React from 'react';
import { FileText, CheckCircle2, Upload, Bell, Lock, RefreshCw } from 'lucide-react';

export const ResumeSyncFooter: React.FC = () => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Resume Status */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-body font-semibold text-slate-200">
              Vivekanand_Kumar_Resume_2026.pdf
            </span>
            <span className="text-caption text-xs text-slate-400 font-mono">
              (1.4 MB)
            </span>
            <span className="inline-flex items-center gap-1 text-caption text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle2 className="w-3 h-3" /> Synchronized
            </span>
          </div>
          <p className="text-caption text-slate-400 text-xs mt-0.5">
            Your profile background & project details are actively synced for upcoming interviewer prompts.
          </p>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-700/80 transition-all cursor-pointer hover:text-cyan-300 active:scale-95"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Re-upload Resume</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-700/80 transition-all cursor-pointer hover:text-cyan-300 active:scale-95"
        >
          <Bell className="w-3.5 h-3.5 text-indigo-400" />
          <span>Manage Notification Alerts</span>
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3.5 py-2 rounded-xl border border-slate-700/80 transition-all cursor-pointer hover:text-cyan-300 active:scale-95"
        >
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Review Privacy & Encryption Settings</span>
        </button>
      </div>
    </div>
  );
};
