'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PracticeDrillItem, MicroFeedbackReport } from '@/types/practice';
import { X, Mic, MicOff, Send, Clock, Sparkles, AlertCircle, Play, Code2, MessageSquare } from 'lucide-react';

interface InteractivePracticeModalProps {
  drill: PracticeDrillItem | null;
  onClose: () => void;
  onSubmitAnswer: (drillId: string, answerText: string) => Promise<MicroFeedbackReport>;
}

import { useWebSpeechRecognition } from '@/lib/hooks/useWebSpeechRecognition';

export const InteractivePracticeModal: React.FC<InteractivePracticeModalProps> = ({
  drill,
  onClose,
  onSubmitAnswer
}) => {
  const [candidateAnswer, setCandidateAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const modalRef = useRef<HTMLDivElement>(null);

  const { isListening, isSupported, error: speechError, startListening, stopListening } = useWebSpeechRecognition({
    language: 'en-IN',
    onTranscriptUpdate: (text) => {
      setCandidateAnswer(text);
    },
  });

  // Focus trap: keep keyboard focus inside the modal when open
  useEffect(() => {
    if (!drill) return;
    const element = modalRef.current;
    if (!element) return;

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Trap focus: if Tab is pressed on the last focusable element, focus the first
      // If Shift+Tab on the first, focus the last
      if (e.key === 'Tab') {
        const focusableElements = element.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0] as HTMLElement | undefined;
        const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement | undefined;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable && lastFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable && firstFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    element.addEventListener('keydown', handleKeydown);
    return () => element.removeEventListener('keydown', handleKeydown);
  }, [drill, onClose]);

  // Timer countdown / elapsed tracker
  useEffect(() => {
    if (!drill) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [drill]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecording = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drill || !candidateAnswer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmitAnswer(drill.id, candidateAnswer);
    } catch (err) {
      console.error('Error evaluating drill answer:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!drill) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-surface border border-line p-6 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" ref={modalRef}>
        {/* Top Glow Accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line pb-4 relative z-10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan font-mono text-[10px] uppercase font-bold">
                {drill.category.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-ink-muted flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink">{drill.title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-inset hover:bg-surface-2 text-ink-muted hover:text-ink border border-line transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 relative z-10">
          {/* AI Evaluator Prompt Card */}
          <div className="p-4 rounded-xl bg-inset border border-line space-y-2">
            <div className="flex items-center gap-2 text-accent-cyan">
              <Sparkles className="w-4 h-4 text-accent-cyan" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider">AI Mock Evaluator Prompt</span>
            </div>
            <p className="text-xs text-ink leading-relaxed">
              {drill.sampleStarterQuestion}
            </p>
          </div>

          {/* Response Mode Selector & Mic Recording */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-accent-indigo" />
              <span>Your Articulation / Code Response:</span>
            </span>

            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={!isSupported}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                isListening
                  ? 'bg-rose-500/20 text-accent-rose border border-rose-500/40 animate-pulse'
                  : 'bg-inset hover:bg-surface-2 text-ink border border-line disabled:opacity-40'
              }`}
            >
              {isListening ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-accent-rose animate-bounce" />
                  <span>Recording Spoken Answer...</span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-ink-muted" />
                  <span>{isSupported ? 'Enable Voice Input' : 'Voice Input Unsupported'}</span>
                </>
              )}
            </button>
          </div>

          {!isSupported && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-accent-amber text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Speech recognition (Web Speech API) is not supported in this browser. Please type your response directly in the text box below.</span>
            </div>
          )}

          {speechError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-accent-rose text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{speechError}</span>
            </div>
          )}

          {/* Textarea Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              rows={6}
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Please type your response here or speak into your microphone... (Include architectural trade-offs, algorithms, or code logic)"
              className="w-full p-4 rounded-xl bg-inset border border-line text-xs text-ink placeholder-ink-muted font-sans focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-ink-muted font-mono">
                {candidateAnswer.trim().split(/\s+/).filter(Boolean).length} words entered
              </span>

              <button
                type="submit"
                disabled={!candidateAnswer.trim() || isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="w-4 h-4 text-accent-cyan animate-spin" />
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
