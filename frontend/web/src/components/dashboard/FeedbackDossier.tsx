'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileCheck, CheckCircle2, AlertTriangle, Loader2, Play } from 'lucide-react';
import { fetchCandidateInterviews, fetchSessionScorecard, type InterviewSession, type SessionScorecard } from '@/lib/api';

export const FeedbackDossier: React.FC = () => {
  const [scorecard, setScorecard] = useState<SessionScorecard | null>(null);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const sessions = await fetchCandidateInterviews();
      if (cancelled) return;

      const sessionList: any[] = Array.isArray(sessions) ? sessions : Array.isArray((sessions as any)?.completed) ? (sessions as any).completed : [];
      const latest = sessionList
        .filter((s: any) => s.status === 'completed' || s.completedAt)
        .sort((a: any, b: any) => new Date(b.scheduled_at || b.completedAt || 0).getTime() - new Date(a.scheduled_at || a.completedAt || 0).getTime())[0];

      if (latest) {
        const card = await fetchSessionScorecard(latest.id);
        if (cancelled) return;
        setSession(latest);
        setScorecard(card);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const strengths = scorecard?.strengths ?? [];
  const concerns = scorecard?.concerns ?? [];
  const sessionDate = session ? new Date(session.scheduled_at).toLocaleDateString() : null;

  return (
    <motion.div
      initial={{ opacity: 1, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="p-6 rounded-2xl bg-surface border border-line shadow-2xl backdrop-blur-md flex flex-col justify-between space-y-5"
    >
      <div>
        <div className="flex items-center space-x-2 mb-1">
          <FileCheck className="w-5 h-5 text-accent-emerald" />
          <h3 className="text-lg font-bold text-ink tracking-tight">Verified Feedback Dossier</h3>
        </div>
        <p className="text-xs text-ink-muted">
          {sessionDate
            ? `From your interview on ${sessionDate}.`
            : 'Extracted automatically from your previous video interview responses.'}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-ink-muted">
          <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
          Loading your latest evaluation…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Strengths Section */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-semibold text-accent-emerald uppercase tracking-wider block">
              KEY STRENGTHS
            </span>
            <div className="space-y-2">
              {strengths.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  No strengths have been recorded yet.
                </p>
              ) : (
                strengths.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-inset/80 flex items-start space-x-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                    <p className="text-xs text-ink leading-normal">{item}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Growth Recommendations */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-semibold text-accent-amber uppercase tracking-wider block">
              GROWTH OPPORTUNITIES
            </span>
            <div className="space-y-2">
              {concerns.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  No growth areas have been recorded yet.
                </p>
              ) : (
                concerns.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-inset/80 flex items-start space-x-2.5"
                  >
                    <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
                    <p className="text-xs text-ink leading-normal">{item}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Link */}
      {!loading && strengths.length === 0 && concerns.length === 0 && (
        <div className="pt-2">
          <Link
            href="/candidate/practice"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Complete a practice interview to generate your dossier
          </Link>
        </div>
      )}
      {session ? (
        <Link
          href={`/candidate/interview/${session.id}/report`}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-accent-cyan transition-colors pt-1 group"
        >
          <span>View Full Comprehensive Evaluation Report</span>
          </Link>
      ) : (
        <Link
          href="/candidate/interviews"
          className="inline-flex items-center space-x-1 text-xs font-semibold text-accent-cyan transition-colors pt-1 group"
        >
          <span>View your interviews</span>
          </Link>
      )}
    </motion.div>
  );
};
