'use client';

import React, { useState } from 'react';
import { TurnReview } from '@/types/report';
import { FileText, ChevronDown, ChevronUp, Volume2, CheckCircle2, XCircle } from 'lucide-react';

interface TurnByTurnAccordionProps {
  turnReviews: TurnReview[];
}

export const TurnByTurnAccordion: React.FC<TurnByTurnAccordionProps> = ({ turnReviews }) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedTurn, setExpandedTurn] = useState<number | null>(3);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);

  const stageLabels: Record<string, string> = {
    introduction: 'Introduction',
    resume_probe: 'Resume Probe',
    technical_depth: 'Technical Depth',
    system_architecture: 'Architecture',
    wrap_up: 'Wrap-up'
  };

  const filteredTurns = turnReviews.filter((t) => {
    if (activeFilter === 'all') return true;
    return t.stage === activeFilter;
  });

  const playAudioClip = (turnIndex: number) => {
    setPlayingAudio(turnIndex);
    setTimeout(() => setPlayingAudio(null), 2500);
  };

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-6 backdrop-blur-md shadow-2xl">
      {/* HEADER & STAGE FILTER CHIPS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-100">Detailed Question-by-Question Evaluation</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect each question asked, key concepts demonstrated, and AI evaluator rubrics.
          </p>
        </div>

        {/* Stage Filter Chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({turnReviews.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('resume_probe')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeFilter === 'resume_probe'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Resume Probe (2)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('technical_depth')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeFilter === 'technical_depth'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Technical Depth (3)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('system_architecture')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeFilter === 'system_architecture'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Architecture (2)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('wrap_up')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeFilter === 'wrap_up'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Wrap-up (1)
          </button>
        </div>
      </div>

      {/* ACCORDION ITEMS LIST */}
      <div className="space-y-3">
        {filteredTurns.map((turn) => {
          const isExpanded = expandedTurn === turn.turnIndex;
          const avgScore = (
            (turn.scores.relevance + turn.scores.depth + turn.scores.correctness) / 3
          ).toFixed(1);

          return (
            <div
              key={turn.turnIndex}
              className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden transition-colors"
            >
              {/* ACCORDION HEADER BAR */}
              <button
                type="button"
                onClick={() => setExpandedTurn(isExpanded ? null : turn.turnIndex)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 pr-4 min-w-0">
                  <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs shrink-0">
                    Turn #{turn.turnIndex} • {stageLabels[turn.stage] || turn.stage}
                  </span>
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    &quot;{turn.questionAsked}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    {avgScore} / 10
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {/* EXPANDABLE ACCORDION BODY */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-slate-800/80 space-y-4 text-xs animate-fadeIn">
                  {/* Candidate Response Summary */}
                  <div className="pt-2">
                    <p className="text-[11px] font-mono text-slate-400">Candidate Response Summary:</p>
                    <p className="text-slate-200 mt-1 leading-relaxed">{turn.candidateAnswerSummary}</p>
                  </div>

                  {/* Audio Clip Playback Trigger */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                    <span className="text-slate-400 font-mono text-[11px]">Recorded Voice Audio snippet available:</span>
                    <button
                      type="button"
                      onClick={() => playAudioClip(turn.turnIndex)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${playingAudio === turn.turnIndex ? 'animate-pulse text-cyan-300' : ''}`} />
                      <span>{playingAudio === turn.turnIndex ? 'Playing Audio...' : 'Play Audio Clip'}</span>
                    </button>
                  </div>

                  {/* Concept Verification Tags */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-slate-400">Concept Verification & Coverage:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {turn.keyConceptsCovered.map((concept) => (
                        <span key={concept} className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]">
                          ✓ #{concept.replace(/\s+/g, '')}
                        </span>
                      ))}
                      {turn.missingConcepts.map((missing) => (
                        <span key={missing} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 font-mono text-[11px]">
                          ✕ #{missing.replace(/\s+/g, '')} (Omitted)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Evaluator Critique */}
                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20 space-y-1">
                    <p className="text-[11px] font-mono text-cyan-400 font-bold">AI Evaluator Rubric Critique:</p>
                    <p className="text-slate-300 leading-relaxed italic">{turn.evaluatorFeedback}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
