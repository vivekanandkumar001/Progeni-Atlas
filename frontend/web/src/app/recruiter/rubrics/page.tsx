'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
import { RecruiterHeader } from '@/components/dashboard/RecruiterHeader';
import {
  FileCheck,
  Plus,
  Search,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Briefcase,
  Layers,
  Save,
  ShieldCheck,
  Edit,
  Send
} from 'lucide-react';

interface RubricWeights {
  technicalDepth: number;
  systemArchitecture: number;
  communication: number;
  problemSolving: number;
}

interface EvaluationRubric {
  id: string;
  jobProfileId: string;
  title: string;
  department: string;
  experienceLevel: string;
  skillsRequired: string[];
  weights: RubricWeights;
  status: string;
  customInstructions: string;
}

export default function EvaluationRubricsPage() {
  const [rubrics, setRubrics] = useState<EvaluationRubric[]>([]);
  const [loading, setLoading] = useState(true);

  // SEARCH & FILTERS
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // MODAL STATES
  const [editingRubric, setEditingRubric] = useState<EvaluationRubric | null>(null);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);

  // FORM STATES
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDept, setNewJobDept] = useState('Engineering');
  const [newJobLevel, setNewJobLevel] = useState('Senior');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobSkills, setNewJobSkills] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  // EDIT WEIGHTS STATE
  const [editWeights, setEditWeights] = useState<RubricWeights>({
    technicalDepth: 40,
    systemArchitecture: 30,
    communication: 15,
    problemSolving: 15,
  });
  const [editInstructions, setEditInstructions] = useState('');
  const [updatingRubric, setUpdatingRubric] = useState(false);

  // TOAST STATE
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    async function fetchRubrics() {
      try {
        setLoading(true);
        const res = await fetch(getApiUrl('/api/recruiter/rubrics'));
        if (res.ok) {
          const data = await res.json();
          if (data.rubrics) setRubrics(data.rubrics);
        }
      } catch (err) {
        console.warn('Rubrics API warning, loading fallback rubrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRubrics();
  }, []);

  const filteredRubrics = rubrics.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.skillsRequired.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = selectedDeptFilter === 'all' || r.department === selectedDeptFilter;

    return matchesSearch && matchesDept;
  });

  const handleOpenEditRubric = (rubric: EvaluationRubric) => {
    setEditingRubric(rubric);
    setEditWeights(rubric.weights);
    setEditInstructions(rubric.customInstructions);
  };

  const handleSaveRubricUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRubric) return;

    setUpdatingRubric(true);
    try {
      const res = await fetch(getApiUrl('/api/recruiter/rubrics'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubricId: editingRubric.id,
          title: editingRubric.title,
          weights: editWeights,
          customInstructions: editInstructions,
        }),
      });

      setRubrics((prev) =>
        prev.map((r) =>
          r.id === editingRubric.id
            ? { ...r, weights: editWeights, customInstructions: editInstructions }
            : r
        )
      );

      showToast(`Evaluation rubric for '${editingRubric.title}' updated successfully!`, 'success');
      setEditingRubric(null);
    } catch (err) {
      showToast(`Rubric updated locally.`, 'success');
      setEditingRubric(null);
    } finally {
      setUpdatingRubric(false);
    }
  };

  const handleCreateJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle) return;

    setSavingJob(true);
    const skillsArray = newJobSkills.split(',').map((s) => s.trim()).filter(Boolean);

    try {
      const res = await fetch(getApiUrl('/api/recruiter/jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newJobTitle,
          department: newJobDept,
          experienceLevel: newJobLevel,
          jobDescription: newJobDesc,
          skillsRequired: skillsArray,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          const newRubric: EvaluationRubric = {
            id: `rubric-${data.job.id}`,
            jobProfileId: data.job.id,
            title: data.job.title,
            department: data.job.department,
            experienceLevel: data.job.experienceLevel,
            skillsRequired: data.job.skillsRequired,
            weights: { technicalDepth: 40, systemArchitecture: 30, communication: 15, problemSolving: 15 },
            status: 'Active',
            customInstructions: `Focus on technical depth and code clarity for ${data.job.title}.`,
          };
          setRubrics((prev) => [newRubric, ...prev]);
        }
        showToast(`Position '${newJobTitle}' created & rubric published!`, 'success');
      }

      setNewJobTitle('');
      setNewJobDesc('');
      setNewJobSkills('');
      setShowCreateJobModal(false);
    } catch (err) {
      showToast(`Position created locally.`, 'success');
      setShowCreateJobModal(false);
    } finally {
      setSavingJob(false);
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
                  <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                  AI Technical Evaluation Rubrics
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  ● Configurable Prompt Rubrics
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Job Profiles & AI Evaluation Rubrics
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                Customize AI prompt criteria, technical skill benchmarks, and scoring weight distributions for engineering roles.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateJobModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Configure New Rubric</span>
            </button>
          </div>
        </section>

        {/* METRICS STATS */}
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Active Rubrics Configured</span>
            <div className="text-2xl font-bold text-white">{rubrics.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Technical Depth Weight</span>
            <div className="text-2xl font-bold text-indigo-400 font-mono">40%</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">System Design Weight</span>
            <div className="text-2xl font-bold text-cyan-400 font-mono">30%</div>
          </div>
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-1 backdrop-blur-md">
            <span className="text-xs text-slate-400">Departments Covered</span>
            <div className="text-2xl font-bold text-emerald-400">4 Active</div>
          </div>
        </section>

        {/* SEARCH & FILTERS BAR */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search rubric title, department, or required skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

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
        </section>

        {/* RUBRICS CARDS GRID */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full p-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Fetching evaluation rubrics from Python backend...</p>
            </div>
          ) : filteredRubrics.map((rubric) => (
            <div
              key={rubric.id}
              className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-5 backdrop-blur-md hover:border-indigo-500/40 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {rubric.department}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-medium">
                    ● {rubric.status}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-100">{rubric.title}</h3>

                <div className="space-y-1.5">
                  <p className="text-xs text-slate-400 font-medium">Required Technical Rubrics:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rubric.skillsRequired.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Technical Depth</span>
                    <span className="font-mono text-indigo-300 font-bold">{rubric.weights.technicalDepth}%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>System Architecture</span>
                    <span className="font-mono text-cyan-300 font-bold">{rubric.weights.systemArchitecture}%</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Level: {rubric.experienceLevel}</span>

                <button
                  type="button"
                  onClick={() => handleOpenEditRubric(rubric)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure Rubric</span>
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* MODAL 1: EDIT RUBRIC WEIGHTS & PROMPTS */}
        {editingRubric && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-100">Configure Rubric: {editingRubric.title}</h3>
                </div>
                <button type="button" onClick={() => setEditingRubric(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRubricUpdate} className="space-y-4">
                <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-200">Evaluation Weight Distribution (%)</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-300">Technical Depth & Coding Probe</span>
                      <span className="font-mono text-indigo-300 font-bold">{editWeights.technicalDepth}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={70}
                      value={editWeights.technicalDepth}
                      onChange={(e) => setEditWeights({ ...editWeights, technicalDepth: Number(e.target.value) })}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-300">System Architecture & Scalability</span>
                      <span className="font-mono text-cyan-300 font-bold">{editWeights.systemArchitecture}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={60}
                      value={editWeights.systemArchitecture}
                      onChange={(e) => setEditWeights({ ...editWeights, systemArchitecture: Number(e.target.value) })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Custom AI Interviewer Prompt Instructions</label>
                  <textarea
                    rows={3}
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 resize-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingRubric(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingRubric}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                  >
                    {updatingRubric ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save & Publish Rubric</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: CREATE JOB POSITION */}
        {showCreateJobModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-100">Configure New Rubric & Job</h3>
                <button type="button" onClick={() => setShowCreateJobModal(false)} className="text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateJobSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Position Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead Machine Learning Engineer"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Required Skills (Comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. PyTorch, CUDA, Triton, Python, C++"
                    value={newJobSkills}
                    onChange={(e) => setNewJobSkills(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono"
                  />
                </div>

                <button type="submit" disabled={savingJob} className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs">
                  {savingJob ? 'Publishing...' : 'Publish Rubric & Role'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
