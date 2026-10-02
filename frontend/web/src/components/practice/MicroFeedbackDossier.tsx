'use client';

import React from 'react';
import { MicroFeedbackReport } from '@/types/practice';
import { CheckCircle2, AlertTriangle, BookOpen, RotateCcw, ArrowLeft, Award } from 'lucide-react';

interface MicroFeedbackDossierProps {
  report: MicroFeedbackReport;
  onTryAgain: () => void;
  onReturnToDrills: () => void;
}

export const MicroFeedbackDossier: React.FC<MicroFeedbackDossierProps> = ({
  report,
  onTryAgain,
  onReturnToDrills
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Circular Score Banner */}
      <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-1 shrink-0 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center">
              <span className="text-2xl font-black font-mono text-cyan-400">{report.score}</span>
              <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
            </div>
          </div>

          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold uppercase">
              {report.score >= 85 ? 'EXCELLENT ARTICULATION' : report.score >= 70 ? 'STRONG PASS' : 'NEEDS PRACTICE'}
            </span>
            <h3 className="text-base font-bold text-slate-100 mt-1">Evaluator Micro-Rubric Performance</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Drill Duration: {Math.floor(report.durationSeconds / 60)} mins {report.durationSeconds % 60} secs
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Grid: What You Did Well vs What Was Missing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* What You Did Well */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">What You Did Well</h4>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {report.strengthsSummary.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What Was Missing */}
        <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">What Was Missing</h4>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {report.omissionsAndMistakes.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-amber-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Model Answer Breakdown */}
      <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-cyan-400">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Model Answer Breakdown</h4>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed italic">
          {report.modelAnswerOverview}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={onTryAgain}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span>Try Again</span>
        </button>

        <button
          type="button"
          onClick={onReturnToDrills}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Save & Return to Drills</span>
        </button>
      </div>
    </div>
  );
};
