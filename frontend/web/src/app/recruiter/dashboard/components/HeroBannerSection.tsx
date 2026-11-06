import Link from 'next/link';
import { Building2, Plus, Send, ShieldCheck } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

export function HeroBannerSection({
  openInviteModal,
  setShowCreateJobModal,
}: {
  openInviteModal: (jobId?: string) => void;
  setShowCreateJobModal: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-surface via-surface to-indigo-950/60 border border-line p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/10 border border-indigo-500/30 text-accent-indigo flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-indigo" />
              Enterprise Hiring Command Center
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-accent-emerald">
              ● Autonomous AI Technical Interviewer Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-ink">
            Technical Interviews & Candidate Dossiers
          </h1>
          <p className="text-ink-muted text-xs sm:text-sm leading-relaxed">
            Automated multi-modal technical interviews, AI evaluation rubrics, and high-fidelity candidate dossiers for your engineering talent pipelines.
          </p>
        </div>

        {/* ACTION CTA BUTTONS */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => openInviteModal()}
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Invite Candidate</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateJobModal(true)}
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 text-ink border border-line-strong font-medium text-xs sm:text-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-accent-indigo" />
            <span>New Job Position</span>
          </button>

          <Link
            href="/recruiter/profile"
            className="inline-flex items-center justify-center p-2.5 rounded-xl bg-surface hover:bg-surface-2 text-ink border border-line-strong transition-colors"
            title="Manage Enterprise Profile & Team Seats"
          >
            <Building2 className="w-4 h-4 text-accent-indigo" />
          </Link>
        </div>
      </div>
    </section>
  );
}
