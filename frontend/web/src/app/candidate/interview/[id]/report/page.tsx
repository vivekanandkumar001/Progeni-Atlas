'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchCandidateInvitations,
  fetchSession,
  fetchSessionQuestions,
  fetchSessionScorecard,
  USER_KEY,
  type SessionQuestion,
  type SessionScorecard
} from '@/lib/api';
import { ReportHeaderToolbar } from '@/components/report/ReportHeaderToolbar';
import { ExecutiveScorecardBanner } from '@/components/report/ExecutiveScorecardBanner';
import { OverallParametersGrid } from '@/components/report/OverallParametersGrid';
import { CompetencyPillarsGrid } from '@/components/report/CompetencyPillarsGrid';
import { StrengthsAndGrowthCards } from '@/components/report/StrengthsAndGrowthCards';
import { TurnByTurnAccordion } from '@/components/report/TurnByTurnAccordion';
import { PDFDossierTemplate } from '@/components/report/PDFDossierTemplate';
import { ArrowRight, Loader2, AlertTriangle, FileText } from 'lucide-react';

/**
 * Real endpoints used by this page:
 *   GET /api/v1/interview-sessions/{id}          -> session record
 *   GET /api/v1/interview-sessions/{id}/scorecard-> overall score, recommendation,
 *                                             summary, strengths, concerns, competencies
 *   GET /api/v1/interview-sessions/{id}/questions-> the questions that were asked
 *   GET /api/candidate/invitations              -> job title / organisation name
 *
 * There is no `/report` endpoint and no candidate-visible record of the
 * candidate's own answers, per-turn scores, audio clips, percentile rank or
 * proctoring metrics. Those are simply not rendered here.
 */
export default function CandidateEvaluationReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || '';

  const [scorecard, setScorecard] = useState<SessionScorecard | null>(null);
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);

  // When report is generated, clicking browser "Back" redirects to dashboard
  // instead of re-entering the expired/completed interview room.
  useEffect(() => {
    const getDashboardPath = () => {
      try {
        const raw = localStorage.getItem(USER_KEY);
        if (raw) {
          const u = JSON.parse(raw);
          const r = (u.role || '').toLowerCase();
          if (r === 'super_admin') return '/super-admin';
          if (r === 'recruiter' || r === 'admin' || r === 'hr') return '/recruiter/dashboard';
        }
      } catch {}
      return '/candidate/dashboard';
    };

    const targetDashboard = getDashboardPath();

    // Push an extra history entry so browser Back triggers popstate
    window.history.pushState({ page: 'interview-report' }, '', window.location.href);

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      router.replace(targetDashboard);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [router]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    (async () => {
      const [card, session, sessionQuestions, invitations] = await Promise.all([
        fetchSessionScorecard(sessionId),
        fetchSession(sessionId),
        fetchSessionQuestions(sessionId),
        fetchCandidateInvitations()
      ]);
      if (cancelled) return;

      setScorecard(card);
      setQuestions(sessionQuestions ?? []);
      if (session?.scheduled_at) setScheduledAt(session.scheduled_at);

      const invitation = (invitations ?? []).find((inv) => inv.session_id === sessionId);
      setJobTitle(session?.job_title || session?.roleTitle || invitation?.job_title || null);
      setOrgName(session?.company_name || session?.companyName || invitation?.org_name || null);

      if (!card) {
        setLoadError(
          'No scorecard has been generated for this session. A scorecard is created after the interview is completed.'
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleDownloadPdf = () => {
    setIsPreparingPdf(true);
    // Printing is the only export the app actually performs; there is no
    // server-side PDF renderer for this report.
    window.print();
    setIsPreparingPdf(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink font-sans flex items-center justify-center gap-2 text-sm text-ink-muted">
        <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
        Loading your evaluation report…
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="min-h-screen bg-canvas text-ink font-sans pb-16">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-6">
          <ReportHeaderToolbar
            sessionId={sessionId}
            dossierId={sessionId}
            companyName={orgName || 'Organisation not specified'}
            roleTitle={jobTitle || 'Interview session'}
            interviewDate="Date unavailable"
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isPreparingPdf}
          />
          <div className="p-8 rounded-2xl bg-surface border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent-amber" />
              <h2 className="text-sm font-bold text-ink">Report not available yet</h2>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">{loadError}</p>
            <Link
              href="/candidate/interviews"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-cyan"
            >
              <span>Back to my interviews</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const interviewDate = scheduledAt ? new Date(scheduledAt).toLocaleDateString() : 'Date unavailable';

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans selection:bg-cyan-500 selection:text-slate-950 pb-16">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* SECTION 1: HEADER & ACTION TOOLBAR */}
        <section>
          <ReportHeaderToolbar
            sessionId={sessionId}
            dossierId={sessionId}
            companyName={orgName || 'Organisation not specified'}
            roleTitle={jobTitle || 'Interview session'}
            interviewDate={interviewDate}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isPreparingPdf}
          />
        </section>

        {/* SECTION 2: EXECUTIVE SCORECARD BANNER */}
        <section>
          <ExecutiveScorecardBanner
            overallScore={scorecard.overall_score}
            hiringRecommendation={scorecard.recommendation}
            executiveSummary={scorecard.executive_summary}
            hasScorecard
          />
        </section>

        {/* SECTION 2.5: OVERALL PARAMETER-WISE EVALUATION MARKS */}
        <section>
          <OverallParametersGrid
            overallParameters={scorecard.overall_parameter_scores ?? []}
            overallScore={scorecard.overall_score}
          />
        </section>

        {/* SECTION 3: COMPETENCY BREAKDOWN */}
        <section className="space-y-3">
          <h2 className="text-body font-semibold text-ink text-sm tracking-wide uppercase font-mono">
            Core Competency Breakdown
          </h2>
          <CompetencyPillarsGrid competencies={scorecard.competencies ?? []} />
        </section>

        {/* SECTION 4: STRENGTHS VS. TARGET GROWTH AREAS */}
        <section>
          <StrengthsAndGrowthCards
            strengths={scorecard.strengths ?? []}
            growthAreas={scorecard.concerns ?? []}
            strengthsEmptyNote="The evaluator did not record any strengths for this session."
            growthEmptyNote="The evaluator did not record any growth areas for this session."
          />
        </section>

        {/* SECTION 5: QUESTION-BY-QUESTION BREAKDOWN */}
        <section>
          <TurnByTurnAccordion questions={questions} />
        </section>

        {/* SECTION 6: NEXT STEPS */}
        <section className="bg-surface border border-line rounded-2xl p-6 md:p-8 space-y-6 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2 text-accent-cyan">
                <FileText className="w-5 h-5 text-accent-cyan" />
                <h2 className="text-lg font-bold text-ink">Practice Next Steps</h2>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                Drills matched to your growth areas are served live from the practice service.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-accent-indigo text-xs font-mono">
              Practice Drills
            </span>
          </div>

          <div className="flex items-center justify-center">
            <Link
              href="/candidate/practice"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-surface hover:bg-cyan-500/10 border border-line hover:border-cyan-500/30 text-accent-cyan text-xs font-semibold transition-all cursor-pointer group"
            >
              <span>Browse available practice drills</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      {/* PRINTABLE VIEW — contains only data stored on the scorecard */}
      <PDFDossierTemplate
        sessionId={sessionId}
        interviewDate={interviewDate}
        roleTitle={jobTitle || 'Interview session'}
        companyName={orgName || 'Organisation not specified'}
        scorecard={scorecard}
        questions={questions}
      />
    </div>
  );
}
