'use client';

import React from 'react';
import type { SessionScorecard, SessionQuestion } from '@/lib/api';

interface PDFDossierTemplateProps {
  sessionId: string;
  interviewDate: string;
  roleTitle: string;
  companyName: string;
  scorecard: SessionScorecard;
  questions?: SessionQuestion[];
}

export const PDFDossierTemplate: React.FC<PDFDossierTemplateProps> = ({
  sessionId,
  interviewDate,
  roleTitle,
  companyName,
  scorecard,
  questions = [],
}) => {
  const strengths = scorecard.strengths ?? [];
  const concerns = scorecard.concerns ?? [];
  const competencies = scorecard.competencies ?? [];
  const overallParams = scorecard.overall_parameter_scores ?? [];

  return (
    <div
      id="pdf-printable-dossier"
      className="hidden print:block p-8 bg-white text-slate-900 font-sans space-y-6"
    >
      {/* OFFICIAL HEADER */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Progeni Atlas</h1>
          <p className="text-xs text-slate-500 font-mono">Candidate Verified Evaluation Dossier</p>
        </div>
        <div className="text-right font-mono text-xs text-slate-500">
          <p className="font-bold text-slate-900">SESSION ID: {sessionId}</p>
          <p>Issued: {interviewDate}</p>
        </div>
      </div>

      {/* SESSION CONTEXT */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{roleTitle}</h2>
          <p className="text-xs text-slate-500">{companyName}</p>
        </div>
        <div className="text-right">
          {scorecard.recommendation ? (
            <span className="inline-block mt-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
              {scorecard.recommendation.replace(/_/g, ' ')} (
              {typeof scorecard.overall_score === 'number' ? `${scorecard.overall_score} / 100` : 'score unavailable'})
            </span>
          ) : (
            <span className="inline-block mt-1 px-3 py-1 bg-slate-200 text-slate-700 rounded-full font-bold text-xs">
              No recommendation recorded
            </span>
          )}
        </div>
      </div>

      {/* EXECUTIVE SUMMARY */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 border-b pb-1">Executive Summary</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {scorecard.executive_summary || 'No executive summary was recorded for this session.'}
        </p>
      </div>

      {/* OVERALL PARAMETER-WISE MARKS */}
      {overallParams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 border-b pb-1">
            Overall Parameter-Wise Evaluation Marks
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {overallParams.map((param) => (
              <div key={param.name} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="font-semibold text-slate-800">{param.name}</p>
                <p className="text-sm font-bold text-slate-900 font-mono">
                  {typeof param.score === 'number' ? `${param.score} / ${param.max_score || 10}` : '--'}
                  {typeof param.percentage === 'number' && (
                    <span className="text-xs font-normal text-slate-500 ml-1">({param.percentage}%)</span>
                  )}
                </p>
                <p className="text-[10px] text-slate-500 leading-tight">{param.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMPETENCY BREAKDOWN */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 border-b pb-1">Competency Breakdown</h3>
        {competencies.length === 0 ? (
          <p className="text-xs text-slate-500">No competency scores were recorded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-xs">
            {competencies.map((item, idx) => (
              <div key={`${item.competency}-${idx}`}>
                <p className="font-medium">
                  {item.competency}:{' '}
                  <strong>{typeof item.score === 'number' ? `${item.score}%` : 'not scored'}</strong>
                </p>
                {item.evaluator_comment && (
                  <p className="text-slate-500">{item.evaluator_comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STRENGTHS AND GROWTH */}
      <div className="grid grid-cols-2 gap-6 text-xs">
        <div>
          <h4 className="font-bold text-slate-900 border-b pb-1">Verified Strengths</h4>
          {strengths.length === 0 ? (
            <p className="text-slate-500 mt-2">None recorded.</p>
          ) : (
            <ul className="list-disc pl-4 space-y-1 text-slate-600 mt-2">
              {strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 border-b pb-1">Targeted Growth Areas</h4>
          {concerns.length === 0 ? (
            <p className="text-slate-500 mt-2">None recorded.</p>
          ) : (
            <ul className="list-disc pl-4 space-y-1 text-slate-600 mt-2">
              {concerns.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* QUESTION-BY-QUESTION BREAKDOWN WITH USER ANSWERS, MARKS, PARAMETERS & IDEAL ANSWERS */}
      {questions.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 border-b pb-1">
            Question-by-Question Evaluation & Model Benchmark Answers
          </h3>
          <div className="space-y-4 text-xs">
            {questions.map((q) => (
              <div key={q.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-slate-900">
                    Turn #{q.turn_index > 0 ? q.turn_index : 1} [{q.stage.toUpperCase()}]
                  </span>
                  <span className="font-bold text-blue-800">
                    {typeof q.score === 'number' ? `Marks: ${q.score} / 10` : 'Score Pending'}
                  </span>
                </div>

                <div>
                  <p className="font-semibold text-slate-800">Question:</p>
                  <p className="text-slate-700 italic">&quot;{q.prompt_text}&quot;</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800">Candidate&apos;s Answer:</p>
                  <p className="text-slate-600 bg-white p-2 border border-slate-200 rounded">
                    {q.candidate_answer ? `"${q.candidate_answer}"` : 'No spoken answer recorded.'}
                  </p>
                </div>

                {q.scores && (
                  <div className="flex gap-4 font-mono text-[11px] text-slate-700">
                    <span>Relevance: <strong>{q.scores.relevance ?? '--'} / 10</strong></span>
                    <span>Technical Depth: <strong>{q.scores.depth ?? '--'} / 10</strong></span>
                    <span>Correctness: <strong>{q.scores.correctness ?? '--'} / 10</strong></span>
                  </div>
                )}

                {q.evaluator_feedback && (
                  <div>
                    <p className="font-semibold text-slate-800">Evaluator Feedback:</p>
                    <p className="text-slate-600">{q.evaluator_feedback}</p>
                  </div>
                )}

                {q.ideal_answer && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2.5 space-y-1">
                    <p className="font-bold text-emerald-900 font-mono text-[11px]">
                      ✨ Ideal Model Answer (10/10 Benchmark):
                    </p>
                    <p className="text-emerald-950 text-[11px] leading-relaxed whitespace-pre-line">
                      {q.ideal_answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
