'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, Gauge, Loader2 } from 'lucide-react';
import { fetchCandidateAptitudeHistory, type AptitudeAttemptHistory } from '@/lib/api';

/**
 * Aptitude discovery card — surfaces the cognitive screening arena (AMCAT-style
 * 5-pillar track) on the dashboard so candidates do not miss it.
 */
export const AptitudeTeaserCard: React.FC = () => {
  const [attempts, setAttempts] = useState<AptitudeAttemptHistory[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchCandidateAptitudeHistory();
      if (!cancelled) setAttempts(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = (attempts ?? []).filter((a) => a.status === 'completed');
  const best = completed.reduce<number | null>((acc, a) => (acc === null || a.score > acc ? a.score : acc), null);

  return (
    <motion.div
      initial={{ opacity: 1, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="w-full p-5 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="p-2.5 rounded-xl bg-violet-500/10 text-accent-violet shrink-0">
          <Brain className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-ink">Aptitude & Critical Reasoning Arena</h2>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/30 text-accent-violet">
              AMCAT-Style
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1 leading-snug">
            {completed.length === 0
              ? 'Take a 15-minute cognitive baseline — recruiters shortlist on sectional percentiles.'
              : `Best: ${best}% across ${completed.length} attempt${completed.length === 1 ? '' : 's'}. Keep climbing.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {attempts === null ? (
          <Loader2 className="w-4 h-4 animate-spin text-ink-faint" />
        ) : (
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-mono uppercase text-ink-faint">Attempts</span>
            <span className="text-sm font-black text-ink tabular-nums">{completed.length}</span>
          </div>
        )}
        <Link
          href="/candidate/aptitude"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 transition-all cursor-pointer whitespace-nowrap"
        >
          <Gauge className="w-4 h-4" />
          Open Aptitude Arena

        </Link>
      </div>
    </motion.div>
  );
};
