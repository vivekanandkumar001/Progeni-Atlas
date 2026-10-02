'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { InterviewRoomHeader } from '@/components/interview/InterviewRoomHeader';
import { AIAvatarViewport, AIState } from '@/components/interview/AIAvatarViewport';
import { CandidateVideoPreview } from '@/components/interview/CandidateVideoPreview';
import { CodeEditorPane } from '@/components/interview/CodeEditorPane';
import { ArchitectureWhiteboardPane } from '@/components/interview/ArchitectureWhiteboardPane';
import { LiveClosedCaptions, CaptionEntry } from '@/components/interview/LiveClosedCaptions';
import { SessionExitModal } from '@/components/interview/SessionExitModal';
import {
  Code2,
  Layers,
  FileText,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

const STAGES = [
  'Introduction',
  'Resume Deep-Dive',
  'Core Architecture',
  'Live Coding',
  'Candidate Q&A'
];

export default function LiveInterviewRoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || 'e1111111-1111-1111-1111-111111111111';

  // Session & Workspace State
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(3); // Live Coding
  const [activeTab, setActiveTab] = useState<'code' | 'whiteboard' | 'context'>('code');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(21 * 60 + 18);
  const [isConcluding, setIsConcluding] = useState<boolean>(false);
  const [concludingMessage, setConcludingMessage] = useState<string>('');

  // AI & Media State
  const [aiState, setAiState] = useState<AIState>('speaking');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  // Proctoring State
  const [proctoringStatus, setProctoringStatus] = useState<'secure' | 'face_warning' | 'tab_warning'>('secure');
  const [proctoringAlertBanner, setProctoringAlertBanner] = useState<string | null>(null);

  // Subtitles Stream State
  const [subtitles, setSubtitles] = useState<CaptionEntry[]>([
    { id: '1', speaker: 'AI Evaluator', text: 'Welcome to the Live Coding stage! Please review the sliding window rate limiter problem on your workspace.' },
    { id: '2', speaker: 'You', text: 'Thank you. I am reviewing the algorithm requirements now.' }
  ]);

  // Tab Focus & Proctoring Event Listener
  useEffect(() => {
    const handleBlur = () => {
      setProctoringStatus('tab_warning');
      setProctoringAlertBanner('⚠ Tab focus lost - Dual monitor or window switching detected.');
      setTimeout(() => {
        setProctoringStatus('secure');
        setProctoringAlertBanner(null);
      }, 5000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Remaining Seconds Countdown Timer & Auto-Conclusion
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerSessionConclusion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Trigger Finalizing Overlay & Redirection to /report
  const triggerSessionConclusion = () => {
    setIsConcluding(true);
    setConcludingMessage('AI Evaluator: "Thank you Vivekanand! That concludes our structured interview session. Generating final dossier..."');
    
    setTimeout(() => {
      router.push(`/candidate/interview/${sessionId}/report`);
    }, 3200);
  };

  const handleConfirmExit = () => {
    setShowExitModal(false);
    triggerSessionConclusion();
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* TOP NAVIGATION & STATUS BAR (ZONE 1) */}
      <InterviewRoomHeader
        sessionId={sessionId}
        currentStageIndex={currentStageIndex}
        stages={STAGES}
        remainingSeconds={remainingSeconds}
        proctoringStatus={proctoringStatus}
        onEndSessionClick={() => setShowExitModal(true)}
      />

      {/* PROCTORING ALERT BANNER (IF TRIGGERED) */}
      {proctoringAlertBanner && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs font-mono text-amber-300 animate-bounce z-40">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{proctoringAlertBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setProctoringAlertBanner(null)}
            className="text-amber-400 hover:text-slate-100 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN 2-PANE BODY WORKSPACE (NON-SCROLLABLE FULL-HEIGHT) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        
        {/* LEFT PANE: AI INTERVIEWER & CANDIDATE MEDIA STACK (ZONE 2) */}
        <section className="w-full lg:w-[420px] xl:w-[460px] shrink-0 flex flex-col gap-4">
          
          {/* Top Card: AI Interviewer Viewport */}
          <div className="flex-1 min-h-[220px]">
            <AIAvatarViewport
              aiState={aiState}
              name="TalentPulse Evaluator"
              role="AI Technical Specialist"
            />
          </div>

          {/* Bottom Card: Candidate Video Stream Viewport */}
          <div className="flex-1 min-h-[200px]">
            <CandidateVideoPreview
              name="Vivekanand Kumar"
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              onToggleMic={() => setIsMuted(!isMuted)}
              onToggleVideo={() => setIsVideoOff(!isVideoOff)}
              onVADActivityChange={(isSpeaking) => {
                if (isSpeaking && aiState === 'listening') {
                  // VAD speaking indicator
                }
              }}
            />
          </div>

        </section>

        {/* RIGHT PANE: INTERACTIVE WORKSPACE & CLOSED CAPTIONS (ZONE 3) */}
        <section className="flex-1 flex flex-col overflow-hidden gap-3">
          
          {/* Workspace Mode Switcher Tabs */}
          <div className="flex items-center justify-between bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Code2 className="w-4 h-4 text-cyan-400" />
                <span>Code Editor</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('whiteboard')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'whiteboard'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>System Architecture Whiteboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('context')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'context'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Question Context & Constraints</span>
              </button>
            </div>
          </div>

          {/* Active Workspace Viewport */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'code' && <CodeEditorPane sessionId={sessionId} />}
            {activeTab === 'whiteboard' && <ArchitectureWhiteboardPane />}
            {activeTab === 'context' && (
              <div className="w-full h-full p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5 overflow-auto shadow-2xl">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono text-cyan-400 uppercase">LIVE CODING TASK</span>
                  <h3 className="text-lg font-bold text-slate-100 mt-1">Distributed Sliding Window Rate Limiter</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs">
                    Difficulty: Hard
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <h4 className="font-semibold text-slate-100 text-sm">Problem Statement:</h4>
                  <p>
                    Implement a distributed rate limiter that tracks client request frequencies using a sliding window algorithm. The solution must handle high-concurrency request checks without race conditions.
                  </p>

                  <h4 className="font-semibold text-slate-100 text-sm pt-2">Technical Constraints:</h4>
                  <ul className="space-y-1.5 pl-4 list-disc text-slate-400">
                    <li>Time Complexity per request check must be <code className="text-cyan-400">O(1)</code>.</li>
                    <li>Support graceful fallback degradation when backend Redis cluster is unreachable.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Live Closed Captions Ticker (Docked at Bottom) */}
          <div className="shrink-0">
            <LiveClosedCaptions subtitles={subtitles} />
          </div>

        </section>

      </main>

      {/* SESSION EXIT CONFIRMATION MODAL */}
      <SessionExitModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirmExit={handleConfirmExit}
      />

      {/* SESSION OVERLAY ON CONCLUSION */}
      {isConcluding && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl space-y-6 text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/20 animate-pulse">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>

          <div className="space-y-2 max-w-lg">
            <h2 className="text-2xl font-bold text-slate-100">Finalizing Interview Dossier...</h2>
            <p className="text-xs font-mono text-cyan-300">
              Aggregating technical scores, code quality metrics, and performance analytics.
            </p>
            <p className="text-xs text-slate-400 pt-2 italic">
              {concludingMessage}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
