'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Video,
  Layers,
  FileText,
  Clock,
  ArrowRight,
  Brain,
  Target
} from 'lucide-react';
import { PracticeInterviewSetup } from '@/components/practice/PracticeInterviewSetup';
import { PracticeDrillBrowser } from '@/components/practice/PracticeDrillBrowser';

export function PracticeLabClient() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'drills' ? 'drills' : 'mock';
  const [activeTab, setActiveTab] = useState<'mock' | 'drills'>(initialMode);

  return (
    <div className="space-y-6">
      {/* Top Mode Segmented Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl bg-surface border border-line shadow-xs">
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-surface-2 border border-slate-200 dark:border-line">
          <button
            type="button"
            onClick={() => setActiveTab('mock')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'mock'
                ? 'bg-white dark:bg-surface text-blue-600 dark:text-accent-cyan shadow-xs border border-slate-200/80 dark:border-line/80'
                : 'text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>AI Mock Interview (10-Min)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drills')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'drills'
                ? 'bg-white dark:bg-surface text-blue-600 dark:text-accent-cyan shadow-xs border border-slate-200/80 dark:border-line/80'
                : 'text-slate-600 dark:text-ink-muted hover:text-slate-900 dark:hover:text-ink'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Drill Lab</span>
          </button>
        </div>

        {/* Shortcut to Practice Reports */}
        <Link
          href="/candidate/reports?tab=practice"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 border border-blue-200 dark:border-blue-500/30 text-xs font-bold text-blue-700 dark:text-accent-cyan transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>View Past Practice Reports &rarr;</span>
        </Link>
      </div>

      {/* Render Active View */}
      {activeTab === 'mock' ? (
        <PracticeInterviewSetup />
      ) : (
        <PracticeDrillBrowser embedded={true} />
      )}
    </div>
  );
}
