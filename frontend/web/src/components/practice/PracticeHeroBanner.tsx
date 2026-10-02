'use client';

import React from 'react';
import { PracticeDrillItem } from '@/types/practice';
import { Sparkles, ArrowRight, Zap, Target } from 'lucide-react';

interface PracticeHeroBannerProps {
  recommendedDrill?: PracticeDrillItem;
  onLaunchWarmup: (drill: PracticeDrillItem) => void;
}

export const PracticeHeroBanner: React.FC<PracticeHeroBannerProps> = ({
  recommendedDrill,
  onLaunchWarmup
}) => {
  const fallbackDrill: PracticeDrillItem = recommendedDrill || {
    id: 'drill-kafka-sticky-assignors',
    title: 'Kafka Partition Rebalancing & Consumer Lag',
    category: 'DISTRIBUTED_SYSTEMS',
    difficulty: 'ADVANCED',
    estimatedMinutes: 10,
    coreSkillsTested: ['Sticky Assignors', 'Rebalance Protocol', 'Consumer Lag'],
    description: 'Evaluate network throughput and consumer rebalance latencies when configuring sticky partition assignors vs round-robin partitioners.',
    sampleStarterQuestion: 'How does the StickyAssignor algorithm in Apache Kafka minimize partition movement during a consumer group rebalance while maintaining balanced partition distribution?',
    totalAttempts: 14,
    userBestScore: 92,
    recommendedReason: 'Triggered by your recent interview growth area'
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/50 border border-slate-800 p-6 md:p-8 backdrop-blur-md shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      {/* LEFT HERO INFO (COL SPAN 7) */}
      <div className="lg:col-span-7 space-y-3 relative z-10">
        <p className="text-caption font-mono uppercase text-cyan-400 text-xs tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>SELF-PACED SKILL ACCELERATION</span>
        </p>
        <h1 className="text-heading font-bold text-slate-100 text-2xl sm:text-3xl tracking-tight">
          Interview Practice & Skill Drills
        </h1>
        <p className="text-body text-slate-300 text-sm leading-relaxed max-w-2xl">
          Sharpen your articulation with 5-to-15 minute targeted AI technical drills. Receive instant scoring and model answer breakdowns.
        </p>
      </div>

      {/* RIGHT QUICK-LAUNCH STRIP (COL SPAN 5) */}
      <div className="lg:col-span-5 relative z-10">
        <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-caption font-semibold px-2.5 py-0.5 rounded-full text-[11px] inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>AI Recommended For You</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">~{fallbackDrill.estimatedMinutes} Mins</span>
          </div>

          <h3 className="text-body font-bold text-slate-100 text-sm leading-snug">
            {fallbackDrill.title}
          </h3>

          <p className="text-caption text-slate-400 text-xs line-clamp-2">
            {fallbackDrill.description}
          </p>

          <button
            type="button"
            onClick={() => onLaunchWarmup(fallbackDrill)}
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer group"
          >
            <span>Launch 10-Min Warmup →</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
};
