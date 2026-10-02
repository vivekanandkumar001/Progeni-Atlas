'use client';

import React, { useState, useEffect } from 'react';
import { PracticeDrillItem, MicroFeedbackReport, DrillTurnEvaluation } from '@/types/practice';
import { getApiUrl } from '@/lib/api';
import { AudioVoiceRecorder } from './AudioVoiceRecorder';
import { MicroFeedbackDossier } from './MicroFeedbackDossier';
import { X, Clock, Volume2, Sparkles, Send, MessageSquare } from 'lucide-react';

interface LiveDrillSessionModalProps {
  drill: PracticeDrillItem | null;
  onClose: () => void;
  onFinalizeSession?: (drillId: string, turns: DrillTurnEvaluation[]) => void;
}

export const LiveDrillSessionModal: React.FC<LiveDrillSessionModalProps> = ({
  drill,
  onClose,
  onFinalizeSession
}) => {
  if (!drill) return null;

  const [currentTurnIndex, setCurrentTurnIndex] = useState<number>(1);
  const [currentQuestion, setCurrentQuestion] = useState<string>(drill.sampleStarterQuestion);
  const [candidateAnswer, setCandidateAnswer] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [isSubmittingTurn, setIsSubmittingTurn] = useState<boolean>(false);
  const [isPlayingQuestionAudio, setIsPlayingQuestionAudio] = useState<boolean>(false);

  const [turns, setTurns] = useState<DrillTurnEvaluation[]>([]);
  const [finalReport, setFinalReport] = useState<MicroFeedbackReport | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(drill.estimatedMinutes * 60);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayQuestionAudio = () => {
    setIsPlayingQuestionAudio(true);
    setTimeout(() => setIsPlayingQuestionAudio(false), 2500);
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      if (!candidateAnswer) {
        if (currentTurnIndex === 1) {
          setCandidateAnswer(
            'I would utilize sticky partition assignors to maximize consumer batching efficiency and minimize rebalance latencies across consumer group members...'
          );
        } else {
          setCandidateAnswer(
            'To handle node failover, Patroni leverages Raft consensus to automatically promote a read-replica standby while preventing split-brain conditions...'
          );
        }
      }
    }
  };

  const handleSubmitTurn = async () => {
    if (!candidateAnswer.trim() || isSubmittingTurn) return;

    setIsSubmittingTurn(true);
    try {
      // Call turn evaluation backend API or simulated response
      const res = await fetch(getApiUrl('/api/v1/practice/sessions/evaluate-turn'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drillId: drill.id,
          turnIndex: currentTurnIndex,
          candidateAnswer: candidateAnswer,
          questionContext: currentQuestion
        })
      });

      let turnEval: DrillTurnEvaluation;
      if (res.ok) {
        const data = await res.json();
        turnEval = data.evaluation;
      } else {
        // Fallback multi-turn evaluation logic
        turnEval = {
          turnIndex: currentTurnIndex,
          question: currentQuestion,
          userAnswer: candidateAnswer,
          scores: { relevance: 9.0, depth: 8.8, correctness: 9.2 },
          feedback: 'Strong grasp of core concepts with clear structural reasoning.',
          followUpQuestion:
            currentTurnIndex < 2
              ? 'Good start. How would you handle node failover during this rebalance phase?'
              : undefined,
          isFinalTurn: currentTurnIndex >= 2
        };
      }

      const updatedTurns = [...turns, turnEval];
      setTurns(updatedTurns);
      setIsRecording(false);
      setCandidateAnswer('');

      if (turnEval.followUpQuestion && currentTurnIndex < 2) {
        setCurrentTurnIndex((prev) => prev + 1);
        setCurrentQuestion(turnEval.followUpQuestion);
      } else {
        // Finalize Drill & generate micro-feedback report
        const report: MicroFeedbackReport = {
          drillId: drill.id,
          score: 88,
          durationSeconds: (drill.estimatedMinutes * 60) - remainingSeconds,
          strengthsSummary: [
            'Sticky Partitioning: Accurately detailed consumer group batching efficiency.',
            'Failover Protocol: Demonstrated clear understanding of automated Patroni Raft consensus.'
          ],
          omissionsAndMistakes: [
            'Disaster Recovery: Could explicitly detail read-replica replication lag limits during cross-region failover.'
          ],
          modelAnswerOverview:
            'A senior response outlines StickyAssignor partition stability, highlights Raft consensus failover parameters, and explicitly details read-replica lag bounds.',
          suggestedFollowUpTopics: ['Kafka Rebalance Protocol', 'PostgreSQL Patroni Cluster']
        };
        setFinalReport(report);
        if (onFinalizeSession) {
          onFinalizeSession(drill.id, updatedTurns);
        }
      }
    } catch (err) {
      console.error('Turn evaluation error:', err);
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative z-10 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-body font-bold text-slate-100 text-base">{drill.title}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[10px]">
                Turn {currentTurnIndex} / 2
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-caption font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatTimer(remainingSeconds)}</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1 relative z-10">
          {finalReport ? (
            <MicroFeedbackDossier
              report={finalReport}
              onTryAgain={() => {
                setFinalReport(null);
                setCurrentTurnIndex(1);
                setCurrentQuestion(drill.sampleStarterQuestion);
                setTurns([]);
              }}
              onReturnToDrills={onClose}
            />
          ) : (
            <>
              {/* AI Question Prompt Card */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono uppercase tracking-wider">
                      AI Mock Evaluator (Turn #{currentTurnIndex})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handlePlayQuestionAudio}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-xs font-mono transition-colors cursor-pointer"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isPlayingQuestionAudio ? 'animate-pulse text-cyan-400' : ''}`} />
                    <span>{isPlayingQuestionAudio ? 'Speaking...' : 'Listen Audio'}</span>
                  </button>
                </div>

                <p className="text-xs text-slate-100 leading-relaxed font-medium">
                  &quot;{currentQuestion}&quot;
                </p>
              </div>

              {/* Audio & Text Input Interface */}
              <AudioVoiceRecorder
                isRecording={isRecording}
                onToggleRecording={handleToggleRecording}
                transcript={candidateAnswer}
                onTranscriptChange={setCandidateAnswer}
                mode={mode}
                onModeChange={setMode}
              />

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSubmitTurn}
                  disabled={!candidateAnswer.trim() || isSubmittingTurn}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSubmittingTurn ? (
                    <>
                      <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
                      <span>Evaluating Answer...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{currentTurnIndex < 2 ? 'Submit & Proceed to Turn 2 →' : 'Finalize & View Micro-Feedback'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
