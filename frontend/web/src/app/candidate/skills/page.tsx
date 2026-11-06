'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  fetchCandidateSkillInsights,
  fetchCandidateSkills,
  type CandidateSkillInsight,
  type CandidateSkillInsights,
  type CandidateSkill,
} from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  GraduationCap,
  Award,
  BookOpen,
  RefreshCw,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  FileText,
  ExternalLink,
} from 'lucide-react';

const SOURCE_LABELS: Record<string, string> = {
  interview: 'Real interview',
  practice: 'Practice drill',
};

/** Human-readable description of where a skill's mark came from. */
function sourceLabel(sources: string[] | undefined): string {
  const labels = (sources ?? []).map((s) => SOURCE_LABELS[s] ?? s);
  return labels.length > 0 ? labels.join(' + ') : 'Interview evidence';
}

export default function CandidateSkillsPage() {
  const [insights, setInsights] = useState<CandidateSkillInsights | null>(null);
  const [profileSkills, setProfileSkills] = useState<CandidateSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSkills() {
      setLoading(true);
      try {
        const [insightData, rawSkills] = await Promise.all([
          fetchCandidateSkillInsights(),
          fetchCandidateSkills(),
        ]);
        setInsights(insightData);
        const resolvedSkills =
          (insightData?.skills && insightData.skills.length > 0)
            ? insightData.skills
            : (rawSkills && rawSkills.length > 0)
              ? rawSkills
              : [];
        setProfileSkills(resolvedSkills);
      } catch (err) {
        console.error('Failed to fetch candidate skills data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSkills();
  }, []);

  // Only skills with real or practice interview evidence are listed in the competency matrix.
  const assessedSkills: CandidateSkillInsight[] = insights?.competencies ?? [];
  const hasAssessedSkills = assessedSkills.length > 0;
  const hasResumeSkills = profileSkills.length > 0;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <DashboardHeader />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* HERO HEADER */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-surface via-surface to-indigo-950/60 border border-line p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-accent-cyan" />
                  Technical Skill Matrix & Insights
                </span>
                {hasResumeSkills && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    {profileSkills.length} Resume Skills Linked
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                Technical Competency & Skill Benchmarks
              </h1>
              <p className="text-ink-muted text-xs sm:text-sm">
                Track your verified skills extracted from your resume and benchmark your competency through live AI interviews and practice drills.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-inset p-4 rounded-2xl border border-line">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-accent-cyan font-mono font-bold text-xl">
                {insights?.overallReadinessScore ?? '--'}
              </div>
              <div>
                <p className="text-xs text-ink-muted">Readiness Score</p>
                <p className="text-sm font-bold text-ink-muted">{insights?.readinessTier ?? 'Not evaluated'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: VERIFIED RESUME & PROFILE SKILLS */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent-cyan" />
                <span>Verified Resume & Profile Skills</span>
                {hasResumeSkills && (
                  <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan">
                    {profileSkills.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                Skills extracted directly from your uploaded resume and linked to your technical profile.
              </p>
            </div>
            <Link
              href="/candidate/profile"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-cyan hover:underline"
            >
              <span>Manage in Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-accent-cyan animate-spin mx-auto" />
              <p className="text-ink-muted text-xs">Loading verified skills...</p>
            </div>
          ) : hasResumeSkills ? (
            <div className="rounded-2xl bg-surface border border-line p-6 backdrop-blur-md space-y-4">
              <div className="flex flex-wrap gap-2.5">
                {profileSkills.map((skill, idx) => (
                  <div
                    key={`${skill.name}-${idx}`}
                    className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-inset border border-line hover:border-cyan-500/40 transition-all text-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent-cyan shrink-0" />
                    <span className="font-semibold text-ink">{skill.name}</span>
                    {skill.category && skill.category !== 'resume' && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-line text-ink-muted">
                        {skill.category}
                      </span>
                    )}
                    <Link
                      href="/candidate/practice"
                      className="hidden group-hover:inline-flex items-center gap-1 text-[11px] text-accent-cyan pl-1 font-medium hover:underline"
                      title={`Start practice drill for ${skill.name}`}
                    >
                      <span>Practice</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs text-ink-muted">
                <span>Tip: Hover over any skill to launch a targeted practice drill.</span>
                <Link
                  href="/candidate/practice"
                  className="inline-flex items-center gap-1 text-accent-cyan hover:underline font-semibold"
                >
                  <span>Practice all skills</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface border border-line p-8 text-center space-y-3">
              <FileText className="w-8 h-8 text-ink-faint mx-auto" />
              <p className="text-ink font-semibold text-sm">No resume skills detected</p>
              <p className="text-ink-muted text-xs max-w-md mx-auto">
                Upload your resume on the profile page to automatically parse, extract, and verify your technical skills.
              </p>
              <Link
                href="/candidate/profile"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-accent-cyan border border-cyan-500/30 text-xs font-semibold"
              >
                <span>Upload Resume in Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </section>

        {/* SECTION 2: INTERVIEW COMPETENCY MATRIX */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-ink flex items-center gap-2">
              <Award className="w-5 h-5 text-accent-cyan" />
              <span>Interview-Assessed Competency Matrix</span>
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Every skill below is scored 0–100 directly from your AI interview scorecards and completed practice drills.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-accent-cyan animate-spin mx-auto" />
              <p className="text-ink-muted text-sm">Fetching skill assessments...</p>
            </div>
          ) : hasAssessedSkills ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assessedSkills.map((item, idx) => {
                const score = typeof item.score === 'number' ? item.score : 0;
                const percent = Math.max(0, Math.min(100, score));
                return (
                  <div key={`${item.name}-${idx}`} className="rounded-2xl bg-surface border border-line p-6 space-y-3 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-ink">{item.name}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-accent-cyan border border-cyan-500/20">
                        {item.level || 'Assessed'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-muted">
                          Interview score • {sourceLabel(item.sources)}
                        </span>
                        <span className="font-mono text-accent-cyan font-bold">
                          {score} / 100
                        </span>
                      </div>

                      <div className="w-full h-2.5 rounded-full bg-inset border border-line overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-surface border border-line p-10 text-center space-y-3">
              <GraduationCap className="w-8 h-8 text-ink-faint mx-auto" />
              <p className="text-ink font-semibold text-sm">No benchmarked assessments yet</p>
              <p className="text-ink-muted text-xs max-w-md mx-auto">
                {hasResumeSkills
                  ? 'Your resume skills are verified and ready for evaluation. Complete a practice drill or live interview to benchmark your competency scores.'
                  : 'This matrix only lists skills you have been scored on. Complete a real interview or practice drill and each skill will appear with its mark.'}
              </p>
              <Link
                href="/candidate/practice"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-accent-cyan border border-cyan-500/30 text-xs font-semibold"
              >
                <span>Start a Practice Interview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </section>

        {/* SECTION 3: RECOMMENDED PRACTICE DRILLS */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent-indigo" />
            <span>Recommended Skill Improvement Drills</span>
          </h2>

          <div className="rounded-2xl bg-surface border border-line p-10 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-ink-faint mx-auto" />
            <p className="text-ink font-semibold text-sm">No recommendations available yet</p>
            <p className="text-ink-muted text-xs max-w-md mx-auto">
              Drill recommendations are generated automatically from your interview scorecard feedback. Complete an
              interview session and personalized recommendations will appear here.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
