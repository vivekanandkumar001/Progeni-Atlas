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
    <section className="relative overflow-hidden rounded-xl bg-white border border-slate-200 p-6 sm:p-7 shadow-xs">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Enterprise Hiring Command Center
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
              ● Autonomous AI Technical Interviewer Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Technical Interviews &amp; Candidate Dossiers
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
            Automated multi-modal technical interviews, AI evaluation rubrics, and high-fidelity candidate dossiers for your engineering talent pipelines.
          </p>
        </div>

        {/* ACTION CTA BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => openInviteModal()}
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Invite Candidate</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateJobModal(true)}
            className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 text-slate-600" />
            <span>New Job Position</span>
          </button>

          <Link
            href="/recruiter/profile"
            className="inline-flex items-center justify-center p-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-xs"
            title="Manage Enterprise Profile & Team Seats"
          >
            <Building2 className="w-4 h-4 text-slate-600" />
          </Link>
        </div>
      </div>
    </section>
  );
}
