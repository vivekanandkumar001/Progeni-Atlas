'use client';

import React, { useMemo, useState } from 'react';
import type { SessionQuestion } from '@/lib/api';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
  Award,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Lightbulb,
} from 'lucide-react';

interface TurnByTurnAccordionProps {
  questions: SessionQuestion[];
}

const STAGE_LABELS: Record<string, string> = {
  intro: 'Introduction',
  resume_probe: 'Resume Probe',
  technical: 'Technical',
  technical_depth: 'Technical Depth',
  system_architecture: 'Architecture',
  wrap_up: 'Wrap-up',
};

function getScoreBadgeClass(score: number | null | undefined): { bg: string; text: string; border: string } {
  if (score === null || score === undefined) {
    return { bg: 'bg-accent-violet/10', text: 'text-ink-muted', border: 'border-accent-violet/20' };
  }
  if (score >= 7.0) {
    return { bg: 'bg-emerald-500/10', text: 'text-accent-emerald', border: 'border-emerald-500/30' };
  }
  if (score >= 4.0) {
    return { bg: 'bg-amber-500/10', text: 'text-accent-amber', border: 'border-amber-500/30' };
  }
  return { bg: 'bg-rose-500/10', text: 'text-accent-rose', border: 'border-rose-500/30' };
}

export const TurnByTurnAccordion: React.FC<TurnByTurnAccordionProps> = ({ questions }) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);

  const stages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      counts.set(q.stage, (counts.get(q.stage) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [questions]);

  const filtered = questions.filter((q) => activeFilter === 'all' || q.stage === activeFilter);

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl bg-surface border border-line p-8 backdrop-blur-md shadow-2xl text-center space-y-1">
        <p className="text-sm text-ink">No questions were recorded for this session</p>
        <p className="text-xs text-ink-muted">
          Questions are stored as the interview progresses, so an unfinished session has none yet.
        </p>
      </div>
    );
  }

  const chipClass = (value: string) =>
    `px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
      activeFilter === value
        ? 'bg-cyan-500/15 text-accent-cyan border border-cyan-500/30'
        : 'bg-inset border border-line text-ink-muted hover:text-ink'
    }`;

  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-6 backdrop-blur-md shadow-2xl">
      {/* HEADER & STAGE FILTER CHIPS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-lg font-bold text-ink">Question-by-Question Evaluation & Model Answers</h2>
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Detailed breakdown of what you answered, marks awarded per parameter, evaluator analysis, and exemplary ideal responses.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setActiveFilter('all')} className={chipClass('all')}>
            All ({questions.length})
          </button>
          {stages.map(([stage, count]) => (
            <button
              key={stage}
              type="button"
              onClick={() => setActiveFilter(stage)}
              className={chipClass(stage)}
            >
              {STAGE_LABELS[stage] || stage} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* ACCORDION ITEMS LIST */}
      <div className="space-y-4">
        {filtered.map((question) => {
          const isExpanded = expandedTurn === question.turn_index;
          const scoreBadge = getScoreBadgeClass(question.score);
          const hasAnswer = Boolean(question.candidate_answer && question.candidate_answer.trim().length > 0);

          return (
            <div
              key={question.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? 'bg-inset border-cyan-500/40 shadow-xl'
                  : 'bg-inset/70 border-line hover:border-line-strong'
              }`}
            >
              {/* ACCORDION HEADER BUTTON */}
              <button
                type="button"
                onClick={() => setExpandedTurn(isExpanded ? null : question.turn_index)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-surface/50 transition-colors cursor-pointer gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                  <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan font-mono text-xs shrink-0 font-medium">
                    Turn #{question.turn_index > 0 ? question.turn_index : 1} • {STAGE_LABELS[question.stage] || question.stage}
                  </span>
                  <p className="text-xs font-semibold text-ink truncate">
                    &quot;{question.prompt_text}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* QUESTION MARKS BADGE */}
                  {typeof question.score === 'number' ? (
                    <span
                      className={`px-3 py-1 rounded-lg border font-mono text-xs font-bold inline-flex items-center gap-1.5 ${scoreBadge.bg} ${scoreBadge.text} ${scoreBadge.border}`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{question.score} / 10 marks</span>
                      {typeof question.score_percentage === 'number' && (
                        <span className="text-[10px] opacity-80">({question.score_percentage}%)</span>
                      )}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg border border-line bg-surface text-ink-muted font-mono text-xs">
                      Marks pending
                    </span>
                  )}

                  <span className="hidden sm:inline-block text-[10px] font-mono text-ink-muted border border-line rounded-lg px-2 py-1 bg-surface">
                    {question.is_ai_generated ? 'AI Adaptive' : 'Rubric'}
                  </span>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-accent-cyan transition-transform" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-ink-muted transition-transform" />
                  )}
                </div>
              </button>

              {/* EXPANDED CONTENT DRAWER */}
              {isExpanded && (
                <div className="p-5 pt-2 border-t border-line space-y-6 text-xs animate-fadeIn">
                  {/* FULL QUESTION PROMPT */}
                  <div className="p-4 rounded-xl bg-surface/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-accent-cyan font-semibold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-accent-cyan" />
                        Question Asked by Interviewer:
                      </span>
                      <span className="text-[10px] font-mono text-ink-muted">
                        Stage: {STAGE_LABELS[question.stage] || question.stage}
                      </span>
                    </div>
                    <p className="text-ink text-sm font-medium leading-relaxed">
                      {question.prompt_text}
                    </p>
                    {question.expected_concepts.length > 0 && (
                      <div className="pt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-mono text-ink-muted mr-1">Target concepts:</span>
                        {question.expected_concepts.map((concept) => (
                          <span
                            key={concept}
                            className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-accent-cyan font-mono text-[10px]"
                          >
                            #{concept.replace(/\s+/g, '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 1. CANDIDATE'S ACTUAL ANSWER (USER NE KYA ANSWER KIYA) */}
                  <div className="p-4 rounded-xl bg-surface/60 space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-accent-indigo font-semibold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-accent-indigo" />
                        Candidate&apos;s Spoken Answer (Your Response):
                      </span>
                      {hasAnswer ? (
                        <span className="text-[10px] font-mono text-accent-emerald bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Recorded & Evaluated
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-accent-rose bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> No answer spoken
                        </span>
                      )}
                    </div>
                    {hasAnswer ? (
                      <div className="p-3.5 rounded-lg bg-inset/90 border border-line text-ink leading-relaxed font-sans text-xs italic">
                        &quot;{question.candidate_answer}&quot;
                      </div>
                    ) : (
                      <p className="text-ink-muted italic py-1">
                        No spoken answer was transcribed or recorded for this question turn.
                      </p>
                    )}
                  </div>

                  {/* 2. PARAMETER-WISE MARKS (KIS PARAMETER PE KITNE MARKS MILE) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-ink-muted font-semibold flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-accent-cyan" />
                        Parameter-Wise Marks Breakdown (Question Turn #{question.turn_index > 0 ? question.turn_index : 1}):
                      </span>
                      {typeof question.score === 'number' && (
                        <span className="text-xs font-mono font-bold text-ink">
                          Total Turn Marks:{' '}
                          <span className={scoreBadge.text}>{question.score} / 10</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(question.parameter_scores || [
                        {
                          name: 'Relevance',
                          score: question.scores?.relevance ?? null,
                          max_score: 10,
                          weight: 0.30,
                          percentage: question.scores?.relevance !== null && question.scores?.relevance !== undefined ? question.scores.relevance * 10 : null,
                          description: 'How directly and comprehensively your answer addressed the question.'
                        },
                        {
                          name: 'Technical Depth',
                          score: question.scores?.depth ?? null,
                          max_score: 10,
                          weight: 0.35,
                          percentage: question.scores?.depth !== null && question.scores?.depth !== undefined ? question.scores.depth * 10 : null,
                          description: 'Architecture, trade-offs, mechanics, and real-world edge cases.'
                        },
                        {
                          name: 'Correctness & Accuracy',
                          score: question.scores?.correctness ?? null,
                          max_score: 10,
                          weight: 0.35,
                          percentage: question.scores?.correctness !== null && question.scores?.correctness !== undefined ? question.scores.correctness * 10 : null,
                          description: 'Factual accuracy of technical syntax, tools, logic, and patterns.'
                        }
                      ]).map((param, pIdx) => {
                        const hasParamScore = typeof param.score === 'number';
                        const paramPct = hasParamScore ? Math.max(0, Math.min(100, (param.score as number) * 10)) : 0;
                        const pBadge = getScoreBadgeClass(param.score);
                        const colors = [
                          'from-cyan-500 to-blue-500',
                          'from-indigo-500 to-purple-500',
                          'from-emerald-500 to-teal-500',
                        ];

                        return (
                          <div
                            key={param.name || pIdx}
                            className="p-3.5 rounded-xl bg-surface hover:bg-surface-2 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-ink text-xs">{param.name}</span>
                              <span className={`font-mono font-bold text-xs ${pBadge.text}`}>
                                {hasParamScore ? `${param.score} / ${param.max_score || 10}` : '--'}
                              </span>
                            </div>

                            {/* PROGRESS METER */}
                            <div className="w-full h-2 rounded-full bg-inset border border-line overflow-hidden p-0.5">
                              {hasParamScore && (
                                <div
                                  className={`h-full rounded-full bg-gradient-to-r ${colors[pIdx % colors.length]} transition-all duration-500`}
                                  style={{ width: `${paramPct}%` }}
                                />
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted">
                              <span>Weight: {Math.round((param.weight || 0.33) * 100)}%</span>
                              <span>{hasParamScore ? `${Math.round(paramPct)}% marks` : 'pending'}</span>
                            </div>

                            {param.description && (
                              <p className="text-[10px] text-ink-muted leading-tight pt-1 border-t border-line/60">
                                {param.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* EVALUATOR FEEDBACK & MISSING CONCEPTS */}
                  {(question.evaluator_feedback || (question.missing_concepts && question.missing_concepts.length > 0)) && (
                    <div className="p-4 rounded-xl bg-surface/80 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-accent-amber font-semibold text-[11px] font-mono uppercase tracking-wider">
                        <AlertCircle className="w-3.5 h-3.5 text-accent-amber" />
                        Evaluator Feedback & Gap Analysis:
                      </div>

                      {question.evaluator_feedback && (
                        <p className="text-ink leading-relaxed font-normal text-xs">
                          {question.evaluator_feedback}
                        </p>
                      )}

                      {question.missing_concepts && question.missing_concepts.length > 0 && (
                        <div className="pt-2 space-y-1.5 border-t border-line/60">
                          <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">
                            Omitted Key Concepts (Marks Deducted):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {question.missing_concepts.map((concept) => (
                              <span
                                key={concept}
                                className="px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-accent-rose font-mono text-[11px] inline-flex items-center gap-1"
                              >
                                ✕ {concept}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. IDEAL MODEL ANSWER (KYA BEST ANSWER HONA CHAHIYE THA) */}
                  <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-950/20 via-surface to-cyan-950/20 border border-emerald-500/40 space-y-3 relative overflow-hidden shadow-lg">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-emerald-500/20 text-accent-emerald border border-emerald-500/30">
                          <Sparkles className="w-4 h-4 text-accent-emerald" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-ink uppercase font-mono tracking-wider">
                            ✨ Exemplary Model Answer (10 / 10 Benchmark)
                          </h4>
                          <p className="text-[11px] text-ink-muted">
                            Kya best answer hona chahiye tha — Production-grade response demonstrating deep engineering mastery:
                          </p>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-accent-emerald text-[10px] font-mono font-bold">
                        10/10 Target Response
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-inset/90 text-ink leading-relaxed font-sans text-xs space-y-2 whitespace-pre-line shadow-inner">
                      {question.ideal_answer || (
                        <span className="text-ink-muted italic">
                          Generating senior engineer benchmark answer for this question…
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2 pt-1 text-[11px] text-ink-muted font-mono">
                      <Lightbulb className="w-3.5 h-3.5 text-accent-amber shrink-0 mt-0.5" />
                      <span>
                        <strong>Coaching Takeaway:</strong> Notice how the model answer directly cites architectural decisions, quantified scale/performance impact, and explicit production trade-offs.
                      </span>
                    </div>
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
