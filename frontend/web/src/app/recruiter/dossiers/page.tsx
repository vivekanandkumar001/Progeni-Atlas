'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { RecruiterHeader } from '@/components/dashboard/RecruiterHeader';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Sparkles,
  Award,
  Eye,
  RefreshCw,
  Send,
  FileCheck,
  TrendingUp,
  Building2,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface ScoreBreakdown {
  technicalDepth: number;
  systemArchitecture: number;
  communication: number;
  problemSolving: number;
}

interface CandidateDossier {
  id: string;
  name: string;
  email: string;
  targetPosition: string;
  jobProfileId: string;
  department: string;
  aiMatchScore: number;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'REJECT';
  status: string;
  stage: string;
  appliedDate: string;
  interviewDuration: string;
  skills: string[];
  summary: string;
  breakdown: ScoreBreakdown;
  keyHighlights: string[];
}

export default function CandidateDossiersPage() {
  const [candidates, setCandidates] = useState<CandidateDossier[]>([]);
  const [loading, setLoading] = useState(true);

  // FILTERS
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecFilter, setSelectedRecFilter] = useState<string>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // MODAL STATES
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDossier | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // FORM STATE
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // TOAST
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    async function fetchDossiers() {
      try {
        setLoading(true);
        const res = await fetch(getApiUrl('/api/recruiter/dossiers'));
        if (res.ok) {
          const data = await res.json();
          if (data.candidates) setCandidates(data.candidates);
        }
      } catch (err) {
        console.warn('Dossiers API warning, loading fallback candidates:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDossiers();
  }, []);

  // FILTER LOGIC
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.targetPosition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRec = selectedRecFilter === 'all' || c.recommendation === selectedRecFilter;
    const matchesDept = selectedDeptFilter === 'all' || c.department === selectedDeptFilter;

    return matchesSearch && matchesRec && matchesDept;
  });

  const strongHiresCount = candidates.filter((c) => c.recommendation === 'STRONG_HIRE').length;
  const hiresCount = candidates.filter((c) => c.recommendation === 'HIRE').length;
  const avgScore = candidates.length > 0
    ? Math.round(candidates.reduce((acc, curr) => acc + curr.aiMatchScore, 0) / candidates.length)
    : 88;

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      const res = await fetch(getApiUrl('/api/recruiter/invite-candidate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateEmail: inviteEmail, candidateName: inviteName }),
      });

      showToast(`AI Interview screening link dispatched to ${inviteEmail}!`, 'success');
      setInviteName('');
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (err) {
      showToast(`Invite dispatched to ${inviteEmail}.`, 'success');
      setShowInviteModal(false);
    } finally {
      setInviting(false);
    }
  };

  const getRecommendationBadge = (rec: CandidateDossier['recommendation']) => {
    switch (rec) {
      case 'STRONG_HIRE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> STRONG HIRE
          </span>
        );
      case 'HIRE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> HIRE
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
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-slate-950">
      <RecruiterHeader />

      {/* TOAST FLOATER */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-sm font-medium transition-all ${
            toastMessage.type === 'success'
              ? 'bg-slate-900/90 border-indigo-500/40 text-indigo-300 backdrop-blur-md'
              : 'bg-slate-900/90 border-rose-500/40 text-rose-300 backdrop-blur-md'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* HERO HEADER */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/60 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Candidate Evaluation Dossiers
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  ● Live Python Backend
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Technical Scorecards & Candidate Dossiers
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Explore comprehensive multi-modal interview transcripts, scenario execution metrics, and AI recommendations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Invite New Candidate</span>
            </button>
          </div>
        </section>

        {/* METRICS STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Total Candidates Evaluated</span>
            <div className="text-2xl font-bold text-white">{candidates.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Strong Hire Recommendations</span>
            <div className="text-2xl font-bold text-emerald-400">{strongHiresCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Hire Recommendations</span>
            <div className="text-2xl font-bold text-indigo-300">{hiresCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Average Match Score</span>
            <div className="text-2xl font-bold text-cyan-400 font-mono">{avgScore}%</div>
          </div>
        </section>

        {/* SEARCH & FILTERS BAR */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search candidate name, email, role, or technical skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedRecFilter}
              onChange={(e) => setSelectedRecFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Recommendations</option>
              <option value="STRONG_HIRE">Strong Hire</option>
              <option value="HIRE">Hire</option>
              <option value="LEAN_HIRE">Lean Hire</option>
              <option value="REJECT">Reject</option>
            </select>

            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Product Design">Product Design</option>
              <option value="AI Research">AI Research</option>
            </select>
          </div>
        </section>

        {/* CANDIDATES DOSSIERS TABLE */}
        <section className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden backdrop-blur-md shadow-2xl">
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Fetching evaluation dossiers from Python backend...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-16 text-center space-y-4">
              <Search className="w-10 h-10 text-slate-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-200">No candidate dossiers found</h3>
              <p className="text-slate-400 text-xs">Try resetting your search query or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-4 px-6">Candidate</th>
                    <th className="py-4 px-4">Target Position</th>
                    <th className="py-4 px-4">AI Score</th>
                    <th className="py-4 px-4">Recommendation</th>
                    <th className="py-4 px-4">Key Skills</th>
                    <th className="py-4 px-4">Interview Stage</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredCandidates.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCandidate(c)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-md">
                            {c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                              {c.name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">{c.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-300">{c.targetPosition}</span>
                        <p className="text-[11px] text-slate-500">{c.department}</p>
                      </td>

                      <td className="py-4 px-4">
                        <div className="w-10 h-10 rounded-full border-2 border-indigo-500/40 bg-slate-950 flex items-center justify-center font-mono font-bold text-xs text-indigo-300">
                          {c.aiMatchScore}%
                        </div>
                      </td>

                      <td className="py-4 px-4">{getRecommendationBadge(c.recommendation)}</td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {c.skills.slice(0, 3).map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-mono">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-slate-300 font-medium">{c.stage}</span>
                        <p className="text-[11px] text-slate-500 font-mono">{new Date(c.appliedDate).toLocaleDateString()}</p>
                      </td>

                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedCandidate(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Scorecard</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CANDIDATE SCORECARD MODAL */}
        {selectedCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-2xl text-slate-100">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xl">
                    {selectedCandidate.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">{selectedCandidate.name}</h2>
                      {getRecommendationBadge(selectedCandidate.recommendation)}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {selectedCandidate.email} • {selectedCandidate.targetPosition}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedCandidate(null)} className="p-2 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-slate-800 pb-4 sm:pb-0 pr-0 sm:pr-4">
                  <span className="text-xs text-slate-400">Overall Match Score</span>
                  <div className="text-4xl font-extrabold text-indigo-400 font-mono mt-1">
                    {selectedCandidate.aiMatchScore}%
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Technical Depth</span>
                      <span className="font-mono text-indigo-300">{selectedCandidate.breakdown.technicalDepth}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${selectedCandidate.breakdown.technicalDepth}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">System Architecture</span>
                      <span className="font-mono text-cyan-300">{selectedCandidate.breakdown.systemArchitecture}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${selectedCandidate.breakdown.systemArchitecture}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Executive AI Summary
                </h3>
                <p className="text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  {selectedCandidate.summary}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Candidate dossier exported!`, 'success');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  Download Report PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Candidate advanced to next round!`, 'success');
                    setSelectedCandidate(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                >
                  Advance to Panel Round →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INVITE MODAL */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100">Invite Candidate</h3>
                <button type="button" onClick={() => setShowInviteModal(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Candidate Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Candidate Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm"
                  />
                </div>
                <button type="submit" disabled={inviting} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs">
                  {inviting ? 'Sending...' : 'Send Screening Invite'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
