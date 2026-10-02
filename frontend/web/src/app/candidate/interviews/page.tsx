'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  Video,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  FileText,
  Award,
  ChevronRight,
  RefreshCw,
  Building2,
  ShieldCheck,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

interface UpcomingInterview {
  sessionId: string;
  roleTitle: string;
  companyName: string;
  sessionType: 'mock' | 'live';
  scheduledTime: string;
  interviewerName: string;
  stage: string;
  durationMinutes: number;
  status: string;
  lobbyUrl: string;
}

interface CompletedInterview {
  sessionId: string;
  roleTitle: string;
  companyName: string;
  sessionType: 'mock' | 'live';
  completedAt: string;
  score: number;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'REJECT';
  duration: string;
  reportUrl: string;
  recordingUrl: string;
  keyHighlights: string[];
}

export default function CandidateInterviewsPage() {
  const [upcoming, setUpcoming] = useState<UpcomingInterview[]>([]);
  const [completed, setCompleted] = useState<CompletedInterview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidateInterviews() {
      try {
        setLoading(true);
        const res = await fetch(getApiUrl('/api/candidate/interviews'));
        if (res.ok) {
          const data = await res.json();
          if (data.upcoming) setUpcoming(data.upcoming);
          if (data.completed) setCompleted(data.completed);
        }
      } catch (err) {
        console.warn('Candidate Interviews API warning, using fallback data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCandidateInterviews();
  }, []);

  const getRecommendationBadge = (rec: CompletedInterview['recommendation']) => {
    switch (rec) {
      case 'STRONG_HIRE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> STRONG HIRE
          </span>
        );
      case 'HIRE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> HIRE
          </span>
        );
      case 'LEAN_HIRE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> LEAN HIRE
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> REJECT
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <DashboardHeader />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* HERO HEADER */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-cyan-950/50 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-cyan-400" />
                  My AI Interview Sessions
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  ● Connected Python Backend
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Technical Interview Sessions & AI Reports
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                View upcoming AI screening invites, enter pre-flight interview lobbies, and inspect past performance dossiers.
              </p>
            </div>

            <Link
              href="/candidate/practice"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Practice Drill</span>
            </Link>
          </div>
        </section>

        {/* METRICS STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Upcoming Live Interviews</span>
            <div className="text-2xl font-bold text-cyan-400 font-mono">{upcoming.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Completed Sessions</span>
            <div className="text-2xl font-bold text-white font-mono">{completed.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Highest Score Achieved</span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">88%</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Overall Readiness Tier</span>
            <div className="text-2xl font-bold text-indigo-300">Senior Level</div>
          </div>
        </section>

        {/* UPCOMING INTERVIEWS SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <span>Upcoming Scheduled AI Interviews</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {upcoming.map((session) => (
              <div
                key={session.sessionId}
                className="rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/40 border border-slate-800 p-6 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-cyan-500/40 transition-all shadow-xl"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Video className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-slate-100">{session.roleTitle}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        ● Live AI Screener
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{session.companyName}</span>
                      <span>•</span>
                      <span>{session.stage}</span>
                    </p>

                    <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{new Date(session.scheduledTime).toLocaleString()} ({session.durationMinutes} min)</span>
                    </p>
                  </div>
                </div>

                <Link
                  href={session.lobbyUrl}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Enter Pre-flight Lobby →</span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* COMPLETED INTERVIEWS & REPORTS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              <span>Completed Interview History & Reports</span>
            </h2>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-md shadow-2xl">
            {loading ? (
              <div className="p-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <p className="text-slate-400 text-sm">Fetching interview sessions from Python backend...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Role & Company</th>
                      <th className="py-4 px-4">Score</th>
                      <th className="py-4 px-4">Recommendation</th>
                      <th className="py-4 px-4">Duration & Date</th>
                      <th className="py-4 px-4">Key Highlights</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {completed.map((session) => (
                      <tr key={session.sessionId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-100">{session.roleTitle}</p>
                          <p className="text-[11px] text-slate-400">{session.companyName}</p>
                        </td>

                        <td className="py-4 px-4">
                          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/40 bg-slate-950 flex items-center justify-center font-mono font-bold text-xs text-cyan-300">
                            {session.score}%
                          </div>
                        </td>

                        <td className="py-4 px-4">{getRecommendationBadge(session.recommendation)}</td>

                        <td className="py-4 px-4">
                          <span className="text-slate-300 font-medium">{session.duration}</span>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {new Date(session.completedAt).toLocaleDateString()}
                          </p>
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          <p className="text-[11px] text-slate-300 truncate">
                            {session.keyHighlights[0] || 'Technical scenario completed successfully.'}
                          </p>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Link
                            href={session.reportUrl}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>View Full Report</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
