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
  apiFetch,
  type SessionQuestion,
  type SessionScorecard
} from '@/lib/api';
import { ReportHeaderToolbar } from '@/components/report/ReportHeaderToolbar';
import { StrengthsAndGrowthCards } from '@/components/report/StrengthsAndGrowthCards';
import { TurnByTurnAccordion } from '@/components/report/TurnByTurnAccordion';
import { PDFDossierTemplate } from '@/components/report/PDFDossierTemplate';
import { Loader2, AlertTriangle, FileText, ShieldCheck, RefreshCw } from 'lucide-react';
import { formatInterviewDate } from '@/lib/dateTime';
import { buildReportReference } from '@/lib/reportReference';

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
  const [interviewDate, setInterviewDate] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoNumber, setDemoNumber] = useState<number | string | null>(null);
  const [reportReference, setReportReference] = useState(() => buildReportReference(null, null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const pollAttemptRef = React.useRef(0);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [npsComment, setNpsComment] = useState('');
  const [npsSubmitting, setNpsSubmitting] = useState(false);
  const [npsSubmitted, setNpsSubmitted] = useState<boolean>(false);
  const [npsError, setNpsError] = useState<string | null>(null);

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
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const [card, session, sessionQuestions, invitations] = await Promise.all([
        fetchSessionScorecard(sessionId),
        fetchSession(sessionId),
        fetchSessionQuestions(sessionId),
        fetchCandidateInvitations()
      ]);
      if (cancelled) return;

      setScorecard(card);
      setQuestions(sessionQuestions ?? []);

      // One authoritative metadata source: the session record, with completion
      // time preferred over the scheduled time and invitation labels preferred
      // over any denormalised copy on the session.
      const lifecycle = session as {
        finished_at?: string | null;
        created_at?: string | null;
      } | null;
      const authoritativeDate =
        session?.ended_at || lifecycle?.finished_at || session?.started_at || session?.scheduled_at || null;
      const invitation = (invitations ?? []).find((inv) => inv.session_id === sessionId);
      const role = invitation?.job_title || session?.job_title || session?.roleTitle || null;

      setInterviewDate(authoritativeDate);
      setDurationMinutes(session?.duration_minutes ?? null);
      setIsDemo(Boolean(session?.isDemo));
      setDemoNumber(session?.demoNumber ?? null);
      setJobTitle(role);
      setOrgName(invitation?.org_name || session?.company_name || session?.companyName || null);
      setReportReference(buildReportReference(authoritativeDate, role));

      if (!card) {
        setLoadError('Your scorecard is still being assembled — this usually takes under a minute after the interview ends.');
        // Auto-retry with gentle backoff (up to ~30s of polling).
        pollAttemptRef.current += 1;
        if (pollAttemptRef.current <= 6 && !cancelled) {
          retryTimer = setTimeout(load, 4000);
        }
      } else {
        setLoadError(null);
      }
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
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
            dossierId={reportReference}
            companyName={orgName || 'Organisation not specified'}
            roleTitle={jobTitle || 'Interview session'}
            interviewDate={formatInterviewDate(interviewDate)}
            durationMinutes={durationMinutes}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isPreparingPdf}
            isDemo={isDemo}
            demoNumber={demoNumber}
          />
          <div className="p-8 rounded-2xl bg-surface border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent-amber" />
              <h2 className="text-sm font-bold text-ink">Report is being assembled</h2>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">{loadError}</p>
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-cyan hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh now
              </button>
              <Link
                href="/candidate/interviews"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
              >
                <span>Back to my interviews</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const formattedInterviewDate = formatInterviewDate(interviewDate);

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans selection:bg-cyan-500 selection:text-slate-950 pb-16">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* SECTION 1: HEADER & ACTION TOOLBAR */}
        <section>
          <ReportHeaderToolbar
            sessionId={sessionId}
            dossierId={reportReference}
            companyName={orgName || 'Organisation not specified'}
            roleTitle={jobTitle || 'Interview session'}
            interviewDate={formattedInterviewDate}
            durationMinutes={durationMinutes}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isPreparingPdf}
            isDemo={isDemo}
            demoNumber={demoNumber}
          />
        </section>

        {/* SECTION 2: HOW THIS CONVERSATION WENT — no verdict, ever */}
        <section>
          <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/5 via-surface to-indigo-500/5 p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                <ShieldCheck className="w-5 h-5 text-accent-cyan" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">How this conversation went</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  A human reviews every interview before any decision is made. Here is what stood out — whatever the outcome.
                </p>
              </div>
            </div>
            <div className="text-xs text-ink-muted leading-relaxed border-t border-line/60 pt-4">
              Your answers below are quoted exactly as you spoke them. Scores reflect the role rubric, not a final verdict —
              the hiring team makes that call and will reach out with next steps.
            </div>
          </div>
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

        {/* SECTION 5.5: NPS — one question, no verdict */}
        <section className="bg-surface border border-line rounded-2xl p-6 md:p-8 space-y-4">
          <div>
            <h2 className="text-base font-bold text-ink">Quick feedback — one question</h2>
            <p className="text-xs text-ink-muted mt-1">
              How likely are you to recommend a Progeni Atlas interview to a friend? 0 = not at all, 10 = definitely.
            </p>
          </div>
          {npsSubmitted ? (
            <p className="text-sm font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 rounded-xl px-4 py-3">
              Thank you — your feedback helps us make the interview fairer and kinder.
            </p>
          ) : (
            <>
              {npsError && <p className="text-xs text-accent-rose">{npsError}</p>}
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setNpsScore(score)}
                    disabled={npsSubmitting}
                    aria-pressed={npsScore === score}
                    className={`h-10 w-10 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      npsScore === score
                        ? 'bg-cyan-500/20 border-cyan-500/60 text-accent-cyan ring-2 ring-cyan-500/40'
                        : 'bg-surface border-line text-ink-muted hover:border-cyan-500/40 hover:text-ink'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              {npsScore !== null && (
                <div className="space-y-2">
                  <label className="text-xs text-ink-muted" htmlFor="nps-comment">
                    Anything you&apos;d like us to know (optional)
                  </label>
                  <textarea
                    id="nps-comment"
                    value={npsComment}
                    onChange={(e) => setNpsComment(e.target.value)}
                    rows={2}
                    maxLength={600}
                    placeholder="What went well? What would you change?"
                    className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    disabled={npsSubmitting}
                    onClick={async () => {
                      if (npsScore === null || npsSubmitting) return;
                      setNpsSubmitting(true);
                      setNpsError(null);
                      try {
                        const res = await apiFetch('/api/candidate/nps', {
                          method: 'POST',
                          body: JSON.stringify({ score: npsScore, comment: npsComment || undefined, session_id: sessionId }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}) as Record<string, unknown>);
                          throw new Error((typeof body.error === 'string' && body.error) || 'Could not save your feedback. Please try again.');
                        }
                        setNpsSubmitted(true);
                      } catch (err) {
                        setNpsError(err instanceof Error ? err.message : 'Could not save your feedback. Please try again.');
                      } finally {
                        setNpsSubmitting(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-accent-cyan text-xs font-semibold hover:bg-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {npsSubmitting ? 'Saving…' : 'Send feedback'}
                  </button>
                </div>
              )}
            </>
          )}
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
              </Link>
          </div>
        </section>
      </main>

      {/* PRINTABLE VIEW — contains only data stored on the scorecard */}
      <PDFDossierTemplate
        reportReference={reportReference}
        interviewDate={formattedInterviewDate}
        roleTitle={jobTitle || 'Interview session'}
        companyName={orgName || 'Organisation not specified'}
        scorecard={scorecard}
        questions={questions}
      />
    </div>
  );
}
