'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Brain,
  Clock,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Flag,
  Bookmark,
  RotateCcw,
  Sparkles,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import {
  fetchAptitudeSession,
  submitAptitudeAnswer,
  logAptitudeViolation,
  submitAptitudeTest,
  type AptitudeSessionData,
  type AptitudeQuestionPublic,
  type AptitudeAnswerRecord,
} from '@/lib/api';

export default function AptitudeTestArenaPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Array.isArray(params.testId) ? params.testId[0] : (params.testId as string);

  const [session, setSession] = useState<AptitudeSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active question index (0-based)
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, AptitudeAnswerRecord>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);

  // Anti-cheating state
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);
  const [violationMsg, setViolationMsg] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Monotonic timer benchmark
  const targetEndTimeRef = useRef<number>(0);
  const questionStartTimeRef = useRef<number>(Date.now());

  // ---------------------------------------------------------------------------
  // 1. INITIAL SESSION DATA FETCH
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;
    async function initSession() {
      try {
        const data = await fetchAptitudeSession(sessionId);
        if (!data) throw new Error('Aptitude session not found or already completed.');
        if (data.status === 'completed') {
          router.replace(`/candidate/aptitude/test/${sessionId}/report`);
          return;
        }

        setSession(data);
        setAnswers(data.answers || {});

        const rem = data.remainingSeconds !== undefined ? data.remainingSeconds : data.durationSeconds;
        setRemainingSeconds(rem);
        targetEndTimeRef.current = performance.now() + rem * 1000;
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test session');
        setLoading(false);
      }
    }
    void initSession();
  }, [sessionId, router]);

  // ---------------------------------------------------------------------------
  // 2. MONOTONIC CLOCK COUNTDOWN TICKER (PREVENTS SYSTEM CLOCK MANIPULATION)
  // ---------------------------------------------------------------------------
  const handleAutoSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitAptitudeTest(sessionId);
      router.replace(`/candidate/aptitude/test/${sessionId}/report`);
    } catch {
      router.replace(`/candidate/aptitude/test/${sessionId}/report`);
    }
  }, [isSubmitting, sessionId, router]);

  useEffect(() => {
    if (loading || !session) return;

    const timer = setInterval(() => {
      const remainingMs = Math.max(0, targetEndTimeRef.current - performance.now());
      const secs = Math.ceil(remainingMs / 1000);
      setRemainingSeconds(secs);

      if (remainingMs <= 0) {
        clearInterval(timer);
        void handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, session, handleAutoSubmit]);

  // ---------------------------------------------------------------------------
  // 3. REVERSE-ENGINEERED ANTI-CHEATING LISTENERS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (loading || !session) return;

    // A. Page Visibility & Tab Switch detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          setViolationMsg(`Tab switch or window minimization detected! (Warning ${next}/5)`);
          setShowViolationModal(true);
          void logAptitudeViolation(sessionId, 'TAB_SWITCH', `Switched away from tab. Count: ${next}`);
          return next;
        });
      }
    };

    // B. Window Blur detection (Alt+Tab or external app click)
    const handleWindowBlur = () => {
      setTabSwitchCount((prev) => {
        const next = prev + 1;
        setViolationMsg(`Window lost focus! Please stay inside the assessment window. (Warning ${next}/5)`);
        setShowViolationModal(true);
        void logAptitudeViolation(sessionId, 'TAB_SWITCH', `Window lost focus. Count: ${next}`);
        return next;
      });
    };

    // C. Fullscreen Exit detection
    const handleFullscreenChange = () => {
      const inFull = Boolean(document.fullscreenElement);
      setIsFullscreen(inFull);
      if (!inFull) {
        void logAptitudeViolation(sessionId, 'FULLSCREEN_EXIT', 'Exited fullscreen mode.');
      }
    };

    // D. Context Menu & Copy-Paste prevention
    const blockAction = (e: Event) => {
      e.preventDefault();
      void logAptitudeViolation(sessionId, 'COPY_PASTE', 'Attempted clipboard or context menu action.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', blockAction);
    document.addEventListener('copy', blockAction);
    document.addEventListener('cut', blockAction);
    document.addEventListener('paste', blockAction);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', blockAction);
      document.removeEventListener('copy', blockAction);
      document.removeEventListener('cut', blockAction);
      document.removeEventListener('paste', blockAction);
    };
  }, [loading, session, sessionId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // 4. QUESTION NAVIGATION & ANSWER SUBMISSION
  // ---------------------------------------------------------------------------
  const questions = session?.questions || [];
  const currentQuestion: AptitudeQuestionPublic | undefined = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const selectedOptionIndex = currentAnswer?.selectedOptionIndex ?? null;

  const handleSelectOption = (idx: number) => {
    if (!currentQuestion) return;
    const now = Date.now();
    const timeSpent = (now - questionStartTimeRef.current) / 1000;

    const newRecord: AptitudeAnswerRecord = {
      selectedOptionIndex: idx,
      isMarkedForReview: currentAnswer?.isMarkedForReview || false,
      timeSpentSeconds: (currentAnswer?.timeSpentSeconds || 0) + timeSpent,
    };

    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: newRecord }));
    questionStartTimeRef.current = Date.now();

    // Sync answer to server immediately (Zero-Leak)
    void submitAptitudeAnswer(
      sessionId,
      currentQuestion.id,
      idx,
      newRecord.isMarkedForReview,
      newRecord.timeSpentSeconds
    );
  };

  const handleClearResponse = () => {
    if (!currentQuestion) return;
    const newRecord: AptitudeAnswerRecord = {
      selectedOptionIndex: null,
      isMarkedForReview: currentAnswer?.isMarkedForReview || false,
      timeSpentSeconds: currentAnswer?.timeSpentSeconds || 0,
    };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: newRecord }));
    void submitAptitudeAnswer(sessionId, currentQuestion.id, null, newRecord.isMarkedForReview, newRecord.timeSpentSeconds);
  };

  const handleToggleMarkReview = () => {
    if (!currentQuestion) return;
    const isMarked = !(currentAnswer?.isMarkedForReview || false);
    const newRecord: AptitudeAnswerRecord = {
      selectedOptionIndex: selectedOptionIndex,
      isMarkedForReview: isMarked,
      timeSpentSeconds: currentAnswer?.timeSpentSeconds || 0,
    };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: newRecord }));
    void submitAptitudeAnswer(sessionId, currentQuestion.id, selectedOptionIndex, isMarked, newRecord.timeSpentSeconds);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      questionStartTimeRef.current = Date.now();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      questionStartTimeRef.current = Date.now();
    }
  };

  const handleConfirmSubmit = async () => {
    setShowSubmitModal(false);
    setIsSubmitting(true);
    try {
      await submitAptitudeTest(sessionId);
      router.replace(`/candidate/aptitude/test/${sessionId}/report`);
    } catch {
      router.replace(`/candidate/aptitude/test/${sessionId}/report`);
    }
  };

  // Format MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const isTimeCritical = remainingSeconds <= 120; // < 2 mins

  // Palette status calculator
  const answeredCount = Object.values(answers).filter((a) => a.selectedOptionIndex !== null && a.selectedOptionIndex !== undefined).length;
  const reviewCount = Object.values(answers).filter((a) => a.isMarkedForReview).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-white">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-300">Loading Secure Assessment Arena…</p>
      </div>
    );
  }

  if (error || !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center space-y-4">
        <XCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold">Unable to Load Test Session</h2>
        <p className="text-sm text-slate-400 max-w-md">{error || 'Session is unavailable.'}</p>
        <button
          onClick={() => router.push('/candidate/aptitude')}
          className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
        >
          Return to Aptitude Hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* -------------------------------------------------------------------- */}
      {/* 1. TOP SECURE EXAM HEADER (FULLSCREEN & MONOTONIC CLOCK BAR)        */}
      {/* -------------------------------------------------------------------- */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-xs">
              {session?.template?.title || session?.templateTitle || 'Aptitude Assessment'}
            </h1>
            <p className="text-[10px] text-cyan-400 font-mono">
              Section: {currentQuestion.section} • {currentQuestion.topic}
            </p>
          </div>
        </div>

        {/* Center / Right: Live Countdown Timer & Anti-Cheat Status */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs sm:text-sm tracking-wider border shadow-md ${
              isTimeCritical
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse'
                : 'bg-slate-950 border-slate-700/80 text-cyan-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{timeFormatted}</span>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            Submit Test
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* 2. MAIN SPLIT ARENA: QUESTION AREA & QUESTION PALETTE               */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT COLUMN: ACTIVE QUESTION CARD & ACTIONS */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto max-w-4xl mx-auto w-full">
          <div className="space-y-6">
            {/* Question Header Pill Info */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-xs">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 uppercase">
                  {currentQuestion.difficulty}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Recommended: <strong className="text-slate-300">{currentQuestion.timeRecommendedSeconds}s</strong>
              </div>
            </div>

            {/* Question Prompt */}
            <div className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed whitespace-pre-line bg-surface/40 p-5 rounded-2xl border border-slate-800 shadow-sm">
              {currentQuestion.prompt}
            </div>

            {/* 4 Interactive Options */}
            <div className="space-y-3 pt-2">
              {currentQuestion.options.map((opt, oIdx) => {
                const isSelected = selectedOptionIndex === oIdx;
                const letter = String.fromCharCode(65 + oIdx); // A, B, C, D
                return (
                  <div
                    key={oIdx}
                    onClick={() => handleSelectOption(oIdx)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 select-none ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] text-white'
                        : 'bg-surface border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-900 border border-slate-700 text-slate-400'
                      }`}
                    >
                      {letter}
                    </div>
                    <div className="text-xs sm:text-sm font-medium leading-normal pt-0.5">{opt}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Navigation Footer */}
          <div className="pt-8 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 mt-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleMarkReview}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                  currentAnswer?.isMarkedForReview
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{currentAnswer?.isMarkedForReview ? 'Marked for Review' : 'Mark for Review'}</span>
              </button>

              {selectedOptionIndex !== null && (
                <button
                  type="button"
                  onClick={handleClearResponse}
                  className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 hover:border-rose-500/30 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1 transition-all shadow-md shadow-cyan-500/20 active:scale-95"
                >
                  <span>Save & Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
                >
                  <span>Review & Finish</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: QUESTION PALETTE & TEST PROGRESS (DESKTOP) */}
        <aside className="w-full lg:w-80 p-4 sm:p-6 bg-slate-900/60 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between shrink-0">
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Question Palette</span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  {answeredCount}/{questions.length} Answered
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 pt-1">Jump to any question directly</p>
            </div>

            {/* Question Grid Buttons 1 to N */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const isSelected = currentIndex === idx;
                const isAnswered = ans?.selectedOptionIndex !== null && ans?.selectedOptionIndex !== undefined;
                const isMarked = Boolean(ans?.isMarkedForReview);

                let btnClass = 'bg-slate-950 text-slate-400 border-slate-800';
                if (isAnswered && isMarked) {
                  btnClass = 'bg-purple-900/40 text-purple-300 border-purple-500/60 ring-1 ring-purple-500/50';
                } else if (isAnswered) {
                  btnClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold';
                } else if (isMarked) {
                  btnClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                }

                if (isSelected) {
                  btnClass += ' ring-2 ring-cyan-400 border-cyan-400 text-white font-bold scale-105';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      questionStartTimeRef.current = Date.now();
                    }}
                    className={`h-10 rounded-xl border text-xs flex items-center justify-center transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500/30 border border-emerald-500" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-purple-500/30 border border-purple-500" />
                <span>Marked for Review ({reviewCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-950 border border-slate-800" />
                <span>Unanswered ({questions.length - answeredCount})</span>
              </div>
            </div>
          </div>

          {/* Anti-Cheat Integrity Meter */}
          <div className="pt-6 border-t border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Proctoring Integrity
              </span>
              <span className={tabSwitchCount > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {Math.max(0, 100 - tabSwitchCount * 10)}%
              </span>
            </div>
            {tabSwitchCount > 0 && (
              <p className="text-[11px] text-amber-400 font-mono">
                ⚠ {tabSwitchCount} tab focus switch(es) recorded
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* VIOLATION WARNING MODAL                                              */}
      {/* -------------------------------------------------------------------- */}
      {showViolationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-rose-500/50 p-6 space-y-4 shadow-2xl text-center">
            <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto animate-bounce" />
            <h3 className="text-lg font-bold text-white tracking-tight">Integrity Violation Detected</h3>
            <p className="text-xs text-rose-300 font-medium leading-relaxed">{violationMsg}</p>
            <p className="text-[11px] text-slate-400">
              Exam guidelines strictly prohibit switching browser tabs or exiting fullscreen. Exceeding 5 warnings will terminate the assessment.
            </p>
            <button
              type="button"
              onClick={() => setShowViolationModal(false)}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
            >
              I Understand & Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* CONFIRM SUBMIT MODAL                                                 */}
      {/* -------------------------------------------------------------------- */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-slate-800 p-6 space-y-5 shadow-2xl text-center">
            <CheckCircle2 className="w-12 h-12 text-cyan-400 mx-auto" />
            <h3 className="text-lg font-bold text-white tracking-tight">Confirm Test Submission?</h3>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5 text-left">
              <div className="flex justify-between">
                <span>Total Questions:</span> <strong className="text-white">{questions.length}</strong>
              </div>
              <div className="flex justify-between">
                <span>Answered:</span> <strong className="text-emerald-400">{answeredCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Marked for Review:</span> <strong className="text-purple-400">{reviewCount}</strong>
              </div>
              <div className="flex justify-between">
                <span>Unanswered:</span> <strong className="text-amber-400">{questions.length - answeredCount}</strong>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Once submitted, your answers will be locked, graded server-side, and comprehensive step-by-step solutions will be generated.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
              >
                Finalize & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

