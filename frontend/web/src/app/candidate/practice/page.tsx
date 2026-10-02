'use client';

import React, { useState, useEffect } from 'react';
import { PracticeDrillItem, PracticeCategory } from '@/types/practice';
import { PracticeHeroBanner } from '@/components/practice/PracticeHeroBanner';
import { PracticeFilterBar } from '@/components/practice/PracticeFilterBar';
import { PracticeDrillCard } from '@/components/practice/PracticeDrillCard';
import { LiveDrillSessionModal } from '@/components/practice/LiveDrillSessionModal';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const DEFAULT_DRILLS: PracticeDrillItem[] = [
  {
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
  },
  {
    id: 'drill-postgres-locking',
    title: 'Optimistic Locking vs. Pessimistic Locking in PostgreSQL',
    category: 'DATABASE_INTERNALS',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 10,
    coreSkillsTested: ['Postgres', 'Concurrency', 'Deadlocks'],
    description: 'Analyze MVCC concurrency control, row-level locks, and deadlock resolution when updating high-contention bank balances.',
    sampleStarterQuestion: 'When would you favor optimistic concurrency control using version numbers over SELECT FOR UPDATE in PostgreSQL?',
    totalAttempts: 18,
    userBestScore: 86
  },
  {
    id: 'drill-disaster-recovery',
    title: 'Distributed System Disaster Recovery & Raft Consensus',
    category: 'SYSTEM_DESIGN',
    difficulty: 'ADVANCED',
    estimatedMinutes: 12,
    coreSkillsTested: ['Raft Consensus', 'Patroni Failover', 'Read-Replica Lag'],
    description: 'Design automated failover policies and read-replica lag mitigations during distributed multi-region database outages.',
    sampleStarterQuestion: 'Walk me through how you would configure Patroni and Raft consensus to prevent split-brain scenarios when a primary PostgreSQL node loses network connectivity.',
    totalAttempts: 8,
    userBestScore: 88,
    recommendedReason: 'Matched to growth recommendations'
  },
  {
    id: 'drill-asymptotic-complexity',
    title: 'Asymptotic Complexity & Runtime Analysis',
    category: 'DATA_STRUCTURES',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 8,
    coreSkillsTested: ['Big-O Bounds', 'Amortized Analysis', 'Space Tradeoffs'],
    description: 'Rapid-fire algorithm analysis drills focusing on explicit Big-O time and space complexity statement prior to logic execution.',
    sampleStarterQuestion: 'Explain the time and space complexity of inserting 1,000,000 elements into a dynamic array vs a balanced B-Tree, accounting for array reallocation overhead.',
    totalAttempts: 22,
    userBestScore: 95,
    recommendedReason: 'Matched to growth recommendations'
  },
  {
    id: 'drill-redis-rate-limiting',
    title: 'Distributed Rate Limiting with Redis & Sliding Window',
    category: 'SYSTEM_DESIGN',
    difficulty: 'INTERMEDIATE',
    estimatedMinutes: 10,
    coreSkillsTested: ['Sliding Window ZSET', 'Token Bucket', 'Atomic Lua Scripts'],
    description: 'Architect a low-latency rate limiter handling 100,000 requests/sec using atomic Redis Lua scripts and sorted sets.',
    sampleStarterQuestion: 'Why are Redis Lua scripts preferred over client-side multi-exec transactions when implementing sliding window rate limiting?',
    totalAttempts: 19,
    userBestScore: 90
  },
  {
    id: 'drill-saga-pattern',
    title: 'Saga Orchestration vs 2PC Transactions',
    category: 'DISTRIBUTED_SYSTEMS',
    difficulty: 'ADVANCED',
    estimatedMinutes: 15,
    coreSkillsTested: ['Compensating Transactions', 'Eventual Consistency', 'Outbox Pattern'],
    description: 'Formulate asynchronous compensating event workflows to resolve partial failures across microservices.',
    sampleStarterQuestion: 'How does the Saga pattern handle cascading rollbacks when payment succeeds but inventory reservation fails?',
    totalAttempts: 9,
    userBestScore: 89
  },
  {
    id: 'drill-behavioral-conflict',
    title: 'Architectural Disagreement & Stakeholder Alignment',
    category: 'BEHAVIORAL',
    difficulty: 'BEGINNER',
    estimatedMinutes: 5,
    coreSkillsTested: ['STAR Method', 'Data-Driven Consensus', 'Technical Diplomacy'],
    description: 'Structure articulate responses demonstrating how you resolve technical conflicts using trade-off matrices and data-backed spikes.',
    sampleStarterQuestion: 'Tell me about a time you strongly disagreed with a senior architect on technology selection and how you built consensus.',
    totalAttempts: 5,
    userBestScore: 94
  }
];

export default function CandidatePracticePage() {
  const [drills, setDrills] = useState<PracticeDrillItem[]>(DEFAULT_DRILLS);
  const [selectedCategory, setSelectedCategory] = useState<PracticeCategory>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [activeDrill, setActiveDrill] = useState<PracticeDrillItem | null>(null);

  // Fetch API drills on mount
  useEffect(() => {
    async function loadDrills() {
      try {
        const res = await fetch(getApiUrl(`/api/v1/practice/drills?category=${selectedCategory}&difficulty=${selectedDifficulty}&search=${searchQuery}`));
        if (res.ok) {
          const data = await res.json();
          if (data.drills && data.drills.length > 0) {
            setDrills(data.drills);
          }
        }
      } catch (err) {
        console.warn('Backend API connection warning, using default practice drill inventory:', err);
      }
    }
    loadDrills();
  }, [selectedCategory, selectedDifficulty, searchQuery]);

  // Client-side filtering logic
  const filteredDrills = drills.filter((drill) => {
    const matchesCategory = selectedCategory === 'ALL' || drill.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'ALL' || drill.difficulty === selectedDifficulty;
    const matchesSearch =
      searchQuery === '' ||
      drill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      drill.coreSkillsTested.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesDifficulty && matchesSearch;
  });

  const recommendedDrill = drills.find((d) => d.recommendedReason !== undefined) || drills[0];

  const handleFinalizeSession = async (drillId: string, turns: any[]) => {
    try {
      await fetch(getApiUrl('/api/v1/practice/sessions/finalize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drillId, turns })
      });
    } catch (e) {
      console.warn('Session finalize API call fallback:', e);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 pb-16">
      
      {/* APP HEADER NAV */}
      <header className="sticky top-0 z-40 h-16 shrink-0 bg-slate-950/85 border-b border-slate-800 px-4 sm:px-8 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/candidate/dashboard" className="flex items-center gap-2">
            <span className="font-bold text-slate-100 text-lg tracking-tight">
              TalentPulse<span className="text-cyan-400">.AI</span>
            </span>
          </Link>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <span className="hidden sm:inline text-xs font-mono text-cyan-400">
            Practice Drills & Mock Lab
          </span>
        </div>

        <Link
          href="/candidate/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Candidate Dashboard</span>
        </Link>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* TIER 1: HERO & PERSONALIZED WARM-UP BANNER */}
        <section>
          <PracticeHeroBanner
            recommendedDrill={recommendedDrill}
            onLaunchWarmup={(drill) => setActiveDrill(drill)}
          />
        </section>

        {/* TIER 2: CATEGORY FILTERS, SEARCH & DIFFICULTY SELECTORS */}
        <section>
          <PracticeFilterBar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedDifficulty={selectedDifficulty}
            onSelectDifficulty={setSelectedDifficulty}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalFilteredCount={filteredDrills.length}
          />
        </section>

        {/* TIER 3: PRACTICE DRILLS RESPONSIVE GRID */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-body font-semibold text-slate-300 text-sm tracking-wide uppercase font-mono">
              Available Practice Drills ({filteredDrills.length})
            </h2>
            <span className="text-caption font-mono text-slate-500 text-xs">Self-Paced AI Micro-Mocks</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrills.map((drill) => (
              <PracticeDrillCard
                key={drill.id}
                drill={drill}
                onStartDrill={(d) => setActiveDrill(d)}
              />
            ))}
          </div>
        </section>

      </main>

      {/* IMMERSIVE LIVE DRILL SESSION MODAL / OVERLAY */}
      <LiveDrillSessionModal
        drill={activeDrill}
        onClose={() => setActiveDrill(null)}
        onFinalizeSession={handleFinalizeSession}
      />

    </div>
  );
}
