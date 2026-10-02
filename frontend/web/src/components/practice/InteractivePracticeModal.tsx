'use client';

import React, { useState, useEffect } from 'react';
import { PracticeDrillItem, MicroFeedbackReport } from '@/types/practice';
import { X, Mic, MicOff, Send, Clock, Sparkles, AlertCircle, Play, Code2, MessageSquare } from 'lucide-react';

interface InteractivePracticeModalProps {
  drill: PracticeDrillItem | null;
  onClose: () => void;
  onSubmitAnswer: (drillId: string, answerText: string) => Promise<MicroFeedbackReport>;
}

export const InteractivePracticeModal: React.FC<InteractivePracticeModalProps> = ({
  drill,
  onClose,
  onSubmitAnswer
}) => {
  if (!drill) return null;

  const [candidateAnswer, setCandidateAnswer] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Timer countdown / elapsed tracker
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      // Simulate live STT transcription insertion
      if (!candidateAnswer) {
        setCandidateAnswer(
          'For this scenario, I would implement sticky partition assignors to maximize consumer batching efficiency and minimize rebalance latencies across consumer group members...'
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateAnswer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmitAnswer(drill.id, candidateAnswer);
    } catch (err) {
      console.error('Error evaluating drill answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Glow Accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative z-10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] uppercase font-bold">
                {drill.category.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{drill.title}</h2>
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
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 relative z-10">
          {/* AI Evaluator Prompt Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider">AI Mock Evaluator Prompt</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {drill.sampleStarterQuestion}
            </p>
          </div>

          {/* Response Mode Selector & Mic Recording */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Your Articulation / Code Response:</span>
            </span>

            <button
              type="button"
              onClick={handleToggleRecording}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {isRecording ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                  <span>Recording Spoken Answer...</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Enable Voice Input</span>
                </>
              )}
            </button>
          </div>

          {/* Textarea Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              rows={6}
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Type your response here or speak into your microphone... (Include architectural trade-offs, algorithms, or code logic)"
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 font-sans focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                {candidateAnswer.trim().split(/\s+/).filter(Boolean).length} words entered
              </span>

              <button
                type="submit"
                disabled={!candidateAnswer.trim() || isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
                    <span>Evaluating Micro-Mock Rubric...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit & Get Micro-Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
