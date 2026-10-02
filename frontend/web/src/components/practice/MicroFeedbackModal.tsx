'use client';

import React from 'react';
import { MicroFeedbackReport } from '@/types/practice';
import { X, CheckCircle2, AlertTriangle, Award, BookOpen, ArrowRight, Sparkles } from 'lucide-react';

interface MicroFeedbackModalProps {
  report: MicroFeedbackReport | null;
  onClose: () => void;
  onNextDrill: () => void;
}

export const MicroFeedbackModal: React.FC<MicroFeedbackModalProps> = ({
  report,
  onClose,
  onNextDrill
}) => {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Glow Accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">AI Micro-Feedback Scorecard</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="space-y-6 overflow-y-auto pr-1 flex-1 relative z-10">
          {/* Top Score Banner */}
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 p-1 shrink-0 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center">
                  <span className="text-2xl font-black font-mono text-cyan-400">{report.score}</span>
                  <span className="text-[10px] text-slate-500 font-mono">/ 100</span>
                </div>
              </div>

              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold">
                  {report.score >= 85 ? 'EXCELLENT ARTICULATION' : report.score >= 70 ? 'STRONG PASS' : 'NEEDS PRACTICE'}
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">Evaluator Micro-Rubric Performance</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drill Session Duration: {Math.floor(report.durationSeconds / 60)} mins {report.durationSeconds % 60} secs
                </p>
              </div>
            </div>
          </div>

          {/* 2-Column: Strengths & Omissions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Key Strengths Demonstrated</h4>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {report.strengthsSummary.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Omissions & Improvements */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Omissions & Growth Areas</h4>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {report.omissionsAndMistakes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Model Answer Overview */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Ideal Model Answer Structure</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              {report.modelAnswerOverview}
            </p>
          </div>

          {/* Suggested Follow-up Topics */}
          {report.suggestedFollowUpTopics.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-400">Suggested Follow-Up Topics for Master Class:</span>
              <div className="flex flex-wrap gap-2">
                {report.suggestedFollowUpTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 relative z-10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Back to Practice Lab
          </button>

          <button
            type="button"
            onClick={onNextDrill}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <span>Next Recommended Drill</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
