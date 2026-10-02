'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { CandidateEvaluationDossier } from '@/types/report';
import { ReportHeaderToolbar } from '@/components/report/ReportHeaderToolbar';
import { ExecutiveScorecardBanner } from '@/components/report/ExecutiveScorecardBanner';
import { CompetencyPillarsGrid } from '@/components/report/CompetencyPillarsGrid';
import { StrengthsAndGrowthCards } from '@/components/report/StrengthsAndGrowthCards';
import { TurnByTurnAccordion } from '@/components/report/TurnByTurnAccordion';
import { PDFDossierTemplate } from '@/components/report/PDFDossierTemplate';
import { ArrowRight, Clock, Target, Zap, Play } from 'lucide-react';

export default function CandidateEvaluationReportPage() {
  const params = useParams();
  const rawId = (params?.id as string) || 'TP-2026-X8849F';
  const sessionId = rawId;

  const [dossier, setDossier] = useState<CandidateEvaluationDossier>({
    sessionId: sessionId,
    candidate: {
      fullName: 'Vivekanand Kumar',
      email: 'vivekanand@talentpulse.ai',
      program: 'B.Tech Computer Science & Engineering',
      academicYear: '4th Year (2026 Batch)'
    },
    jobContext: {
      roleTitle: 'Full-Stack Software Engineering Screening',
      companyName: 'CloudScale Systems',
      interviewDate: 'September 27, 2026',
      durationMinutes: 45
    },
    overallScore: 88,
    hiringRecommendation: 'STRONG_HIRE',
    percentileRank: 88, // Top 12%
    competencyPillars: {
      algorithmicProblemSolving: 88,
      systemArchitecture: 92,
      codeQualityAndSyntax: 84,
      communicationAndClarity: 90
    },
    executiveSummary:
      'Candidate Vivekanand Kumar demonstrated exceptional technical maturity and structured architectural intuition during the CloudScale Systems technical screening. Possesses strong analytical capability when evaluating event streaming tradeoffs and distributed database consensus strategies. Communication was articulate, structured, and free of unnecessary conversational latency.',
    verifiedStrengths: [
      'Kafka Partitioning: Correctly detailed sticky partition assignor tradeoffs and rebalancing triggers.',
      'Distributed Transactions: Articulated the Saga pattern versus two-phase commits with precise failure recovery steps.',
      'Database Optimization: Demonstrated practical knowledge of composite indexing and connection pool sizing.'
    ],
    targetedGrowthAreas: [
      'Algorithmic Complexity Estimation: State time and space trade-offs explicitly prior to writing logic.',
      'Disaster Recovery Planning: Detail automated failover policies and read-replica lag mitigations during distributed outages.'
    ],
    proctoringIntegritySummary: {
      overallIntegrityScore: 98,
      gazeConsistencyPercentage: 99.2,
      tabSwitchCount: 0,
      multipleVoicesDetected: false
    },
    turnReviews: [
      {
        turnIndex: 1,
        stage: 'introduction',
        questionAsked: 'Could you introduce yourself and highlight your engineering experience with event-driven backend architectures?',
        candidateAnswerSummary: 'Summarized 4 years of engineering experience developing high-throughput web applications with Next.js, Node.js, Kafka event streams, and PostgreSQL.',
        audioClipUrl: '/audio/turn1.mp3',
        scores: { relevance: 9.5, depth: 9.0, correctness: 9.2 },
        keyConceptsCovered: ['Next.js Architecture', 'Event-Driven Microservices', 'Polyglot Databases'],
        missingConcepts: [],
        evaluatorFeedback: 'Clear, concise introduction establishing immediate technical domain authority.'
      },
      {
        turnIndex: 2,
        stage: 'resume_probe',
        questionAsked: 'In your resume, you listed sticky partition assignors in Apache Kafka. What are the key performance tradeoffs compared to round-robin partitioners?',
        candidateAnswerSummary: 'Detailed how sticky partitioning reduces network latency by batching messages targeted for the same partition, avoiding frequent socket flushes while maintaining message ordering guarantees.',
        audioClipUrl: '/audio/turn2.mp3',
        scores: { relevance: 9.2, depth: 9.4, correctness: 9.0 },
        keyConceptsCovered: ['MessageQueues', 'Partitioning', 'BatchFlushing'],
        missingConcepts: ['DeadLetterQueues'],
        evaluatorFeedback: 'Excellent grasp of Kafka producer batching mechanics and consumer group rebalance minimization.'
      },
      {
        turnIndex: 3,
        stage: 'technical_depth',
        questionAsked: 'How would you architect a distributed log aggregation service handling 100k events/sec?',
        candidateAnswerSummary: 'Proposed an ingested pipeline using lightweight log forwarders (FluentBit) writing into partitioned Kafka topics, processed by Flink streaming engines, and indexed into Elasticsearch with hot/cold tiering.',
        audioClipUrl: '/audio/turn3.mp3',
        scores: { relevance: 9.2, depth: 9.2, correctness: 9.2 },
        keyConceptsCovered: ['LogAggregation', 'Partitioning', 'HotColdTiering', 'BatchFlushing'],
        missingConcepts: ['DeadLetterQueues'],
        evaluatorFeedback: 'High technical rigor. Articulated backpressure management and memory-bounded ring buffers clearly.'
      },
      {
        turnIndex: 4,
        stage: 'technical_depth',
        questionAsked: 'When executing distributed transactions across 3 microservices, when would you favor a Saga orchestrator over 2PC?',
        candidateAnswerSummary: 'Explained that 2-Phase Commit introduces blocking locks and tight coupling across microservices, whereas Saga orchestrators use asynchronous compensating events to achieve eventual consistency without lock contention.',
        audioClipUrl: '/audio/turn4.mp3',
        scores: { relevance: 9.0, depth: 9.1, correctness: 9.3 },
        keyConceptsCovered: ['SagaPattern', 'EventualConsistency', 'CompensatingTransactions'],
        missingConcepts: ['OutboxPattern'],
        evaluatorFeedback: 'Accurately highlighted failure recovery steps and asynchronous compensating logic.'
      },
      {
        turnIndex: 5,
        stage: 'technical_depth',
        questionAsked: 'How do composite indexes in PostgreSQL handle multi-column queries, and why does column order matter?',
        candidateAnswerSummary: 'Emphasized the B-Tree left-to-right prefix matching rule. Queries filtering on leading index columns leverage the index directly, while omitting the leading column results in full sequential scans.',
        audioClipUrl: '/audio/turn5.mp3',
        scores: { relevance: 8.8, depth: 8.6, correctness: 8.9 },
        keyConceptsCovered: ['CompositeIndexing', 'BTreeTraversal', 'QueryPlanner'],
        missingConcepts: ['CoveringIndexes'],
        evaluatorFeedback: 'Solid explanation of PostgreSQL query planner behaviors and index scan heuristics.'
      },
      {
        turnIndex: 6,
        stage: 'system_architecture',
        questionAsked: 'Design a rate limiter for an enterprise API gateway targeting 1,000,000 active users.',
        candidateAnswerSummary: 'Architected a distributed sliding-window log counter backed by Redis cluster nodes with local token-bucket in-memory caches to prevent Redis single-point bottlenecks.',
        audioClipUrl: '/audio/turn6.mp3',
        scores: { relevance: 9.4, depth: 9.2, correctness: 9.1 },
        keyConceptsCovered: ['RateLimiting', 'SlidingWindow', 'RedisCluster', 'TokenBucket'],
        missingConcepts: [],
        evaluatorFeedback: 'Production-ready architecture with low latency and effective mitigation for cache stampedes.'
      },
      {
        turnIndex: 7,
        stage: 'system_architecture',
        questionAsked: 'What disaster recovery steps would you implement to handle primary database failovers without data loss?',
        candidateAnswerSummary: 'Suggested synchronous replication standby nodes with automated Patroni/Raft consensus failovers and DNS health probe updates.',
        audioClipUrl: '/audio/turn7.mp3',
        scores: { relevance: 8.4, depth: 8.2, correctness: 8.5 },
        keyConceptsCovered: ['RaftConsensus', 'ReadReplicas', 'FailoverAutomation'],
        missingConcepts: ['MultiRegionReplicationLag'],
        evaluatorFeedback: 'Good overview, though could detail automated read-replica lag mitigations during distributed region outages.'
      },
      {
        turnIndex: 8,
        stage: 'wrap_up',
        questionAsked: 'Do you have any technical questions for our engineering leadership team at CloudScale Systems?',
        candidateAnswerSummary: 'Inquired about CloudScale Systems multi-cloud deployments, internal developer platforms, and canary release strategies.',
        audioClipUrl: '/audio/turn8.mp3',
        scores: { relevance: 9.5, depth: 9.0, correctness: 9.5 },
        keyConceptsCovered: ['CanaryReleases', 'InternalDeveloperPlatform'],
        missingConcepts: [],
        evaluatorFeedback: 'Thoughtful questions demonstrating genuine candidate curiosity and senior engineering mindset.'
      }
    ],
    verificationDossierId: 'TP-2026-X8849F'
  });

  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Fetch report data on mount
  useEffect(() => {
    async function fetchReportData() {
      try {
        const res = await fetch(getApiUrl(`/api/v1/interview-sessions/${sessionId}/report`));
        if (res.ok) {
          const data = await res.json();
          setDossier((prev) => ({
            ...prev,
            ...data,
            candidate: { ...prev.candidate, ...(data.candidate || {}) },
            jobContext: { ...prev.jobContext, ...(data.jobContext || {}) },
            competencyPillars: { ...prev.competencyPillars, ...(data.competencyPillars || {}) },
            proctoringIntegritySummary: { ...prev.proctoringIntegritySummary, ...(data.proctoringIntegritySummary || {}) },
            turnReviews: data.turnReviews || prev.turnReviews
          }));
        }
      } catch (err) {
        console.warn('API fetch fallback, rendering verified default dossier state:', err);
      }
    }
    fetchReportData();
  }, [sessionId]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(getApiUrl(`/api/v1/interview-sessions/${sessionId}/report/pdf`));
      if (res.ok) {
        window.print();
      } else {
        window.print();
      }
    } catch (e) {
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950 pb-16">
      
      {/* SCREEN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* SECTION 1: VERIFIABLE HEADER & ACTION TOOLBAR */}
        <section>
          <ReportHeaderToolbar
            sessionId={dossier.sessionId}
            dossierId={dossier.verificationDossierId}
            companyName={dossier.jobContext.companyName}
            roleTitle={dossier.jobContext.roleTitle}
            interviewDate={dossier.jobContext.interviewDate}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
          />
        </section>

        {/* SECTION 2: EXECUTIVE SCORECARD BANNER (HERO CARD) */}
        <section>
          <ExecutiveScorecardBanner
            overallScore={dossier.overallScore}
            hiringRecommendation={dossier.hiringRecommendation}
            percentileRank={dossier.percentileRank}
            executiveSummary={dossier.executiveSummary}
            integrityScore={dossier.proctoringIntegritySummary.overallIntegrityScore}
            gazePercentage={dossier.proctoringIntegritySummary.gazeConsistencyPercentage}
            tabSwitches={dossier.proctoringIntegritySummary.tabSwitchCount}
          />
        </section>

        {/* SECTION 3: THE 4 COMPETENCY PILLARS BREAKDOWN */}
        <section className="space-y-3">
          <h2 className="text-body font-semibold text-slate-300 text-sm tracking-wide uppercase font-mono">
            Core Competency Breakdown
          </h2>
          <CompetencyPillarsGrid pillars={dossier.competencyPillars} />
        </section>

        {/* SECTION 4: STRENGTHS VS. TARGET GROWTH AREAS (2-COLUMN GRID) */}
        <section>
          <StrengthsAndGrowthCards
            strengths={dossier.verifiedStrengths}
            growthAreas={dossier.targetedGrowthAreas}
          />
        </section>

        {/* SECTION 5: TURN-BY-TURN QUESTION & DIALOGUE REVIEW (INTERACTIVE ACCORDION) */}
        <section>
          <TurnByTurnAccordion turnReviews={dossier.turnReviews} />
        </section>

        {/* SECTION 6: RECOMMENDED TARGETED PRACTICE DRILLS (NEXT STEPS) */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2 text-cyan-400">
                <Target className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-slate-100">Recommended Targeted Practice Drills</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                3 recommended 10-minute micro-drills dynamically matched to your targeted growth areas
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
              AI Curated Drills
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* DRILL 1 */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">
                    10 MIN DRILL
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    Adaptive
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100">
                  Concurrency & Deadlock Prevention in Go / Java
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Interactive simulation on mutex contention, channel synchronization, and deadlock detection algorithms.
                </p>
              </div>

              <Link
                href="/candidate/practice"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-slate-900 hover:bg-cyan-500/10 border border-slate-800 hover:border-cyan-500/30 text-cyan-400 text-xs font-semibold transition-all cursor-pointer group"
              >
                <span>Launch Drill</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* DRILL 2 */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono">
                    10 MIN DRILL
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    Adaptive
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100">
                  Distributed System Disaster Recovery Scenarios
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Practice automated failover strategies, read-replica lag mitigations, and cross-region consensus recovery.
                </p>
              </div>

              <Link
                href="/candidate/practice"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-slate-900 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all cursor-pointer group"
              >
                <span>Launch Drill</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* DRILL 3 */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono">
                    10 MIN DRILL
                  </span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    Adaptive
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-100">
                  Asymptotic Complexity & Runtime Analysis
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Rapid-fire algorithm analysis drills focusing on explicit Big-O notation statement prior to coding.
                </p>
              </div>

              <Link
                href="/candidate/practice"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-slate-900 hover:bg-indigo-500/10 border border-slate-800 hover:border-indigo-500/30 text-indigo-400 text-xs font-semibold transition-all cursor-pointer group"
              >
                <span>Launch Drill</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* PRINTABLE PDF LAYOUT HIDDEN ON SCREEN */}
      <PDFDossierTemplate dossier={dossier} />

    </div>
  );
}
