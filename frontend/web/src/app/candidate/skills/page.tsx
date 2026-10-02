'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  GraduationCap,
  Award,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  BookOpen,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers
} from 'lucide-react';

interface CompetencyItem {
  name: string;
  score: number;
  benchmark: number;
  level: string;
}

interface RecommendedDrill {
  title: string;
  category: string;
  estimatedTime: string;
  difficulty: string;
}

export default function CandidateSkillsPage() {
  const [readinessScore, setReadinessScore] = useState(88);
  const [readinessTier, setReadinessTier] = useState('Senior Level Ready');
  const [competencies, setCompetencies] = useState<CompetencyItem[]>([]);
  const [drills, setDrills] = useState<RecommendedDrill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSkills() {
      try {
        setLoading(true);
        const res = await fetch(getApiUrl('/api/candidate/skills'));
        if (res.ok) {
          const data = await res.json();
          if (data.overallReadinessScore) setReadinessScore(data.overallReadinessScore);
          if (data.readinessTier) setReadinessTier(data.readinessTier);
          if (data.competencies) setCompetencies(data.competencies);
          if (data.recommendedDrills) setDrills(data.recommendedDrills);
        }
      } catch (err) {
        console.warn('Skills API warning, using fallback skills matrix:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSkills();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <DashboardHeader />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* HERO HEADER */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/60 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
                  Technical Skill Matrix & Insights
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  ● Real-time AI Analysis
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Technical Competency & Skill Benchmarks
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                AI-driven analysis of your technical interview performance, system architecture readiness, and coding mastery.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-xl">
                {readinessScore}%
              </div>
              <div>
                <p className="text-xs text-slate-400">Readiness Score</p>
                <p className="text-sm font-bold text-emerald-400">{readinessTier}</p>
              </div>
            </div>
          </div>
        </section>

        {/* COMPETENCY MATRIX GRID */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" />
            <span>Technical Competency Matrix</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
              <div className="col-span-full p-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <p className="text-slate-400 text-sm">Fetching skill matrix from Python backend...</p>
              </div>
            ) : (
              competencies.map((item, idx) => (
                <div key={idx} className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-3 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">{item.name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {item.level}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Your Score vs Industry Benchmark ({item.benchmark}%)</span>
                      <span className="font-mono text-cyan-300 font-bold">{item.score}%</span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                        style={{ width: `${item.score}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RECOMMENDED PRACTICE DRILLS */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Recommended Skill Improvement Drills</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {drills.map((drill, idx) => (
              <div key={idx} className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3 backdrop-blur-md flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-indigo-400 font-medium">{drill.category}</span>
                  <h3 className="text-sm font-bold text-slate-100 mt-0.5">{drill.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Time: {drill.estimatedTime} • Difficulty: {drill.difficulty}
                  </p>
                </div>

                <Link
                  href="/candidate/practice"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold shrink-0"
                >
                  <span>Start</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
