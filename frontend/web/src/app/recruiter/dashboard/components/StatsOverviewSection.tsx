import { Award, Briefcase, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { OverviewStats } from '../dashboard-types';

export function StatsOverviewSection({ overview }: { overview: OverviewStats }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* STAT CARD 1 */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Candidates Screened</span>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80 shadow-2xs">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview.totalCandidates}
          </span>
          <span className="text-xs font-mono font-semibold text-emerald-700 flex items-center gap-0.5">
            {overview.totalCandidates > 0 ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" /> Pipeline Active
              </>
            ) : (
              <span className="text-slate-400">0 Active</span>
            )}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Across all configured technical roles</p>
      </div>

      {/* STAT CARD 2 */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active Job Openings</span>
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <Briefcase className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview.activePositions}
          </span>
          <span className="text-xs font-mono text-blue-700 font-semibold">
            {overview.activePositions > 0 ? `${overview.activePositions} Active` : '0 Configured'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Active AI rubrics configured</p>
      </div>

      {/* STAT CARD 3 */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Avg AI Match Score</span>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview.avgMatchScore > 0 ? `${overview.avgMatchScore}%` : 'N/A'}
          </span>
          <span className="text-xs font-mono font-semibold text-emerald-700">
            {overview.avgMatchScore >= 80 ? 'High Benchmark' : overview.avgMatchScore > 0 ? 'Standard' : 'Awaiting Data'}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">Multi-factor technical rubric evaluation</p>
      </div>

      {/* STAT CARD 4: FREE DEMO ALLOWANCE & QUOTA */}
      <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 shadow-xs hover:border-slate-300 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Free Screening Quota</span>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80 shadow-2xs">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {overview.freeDemosRemaining ?? 2} <span className="text-xs font-normal text-slate-500">/ {overview.freeDemosTotal ?? 2} Left</span>
          </span>
          <span className="text-xs font-mono font-semibold text-blue-700">
            10-Min Limit
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          {overview.freeDemosRemaining === 0
            ? 'Trial allowance exhausted • Organization wallet active'
            : 'Complimentary screening trials for evaluation'}
        </p>
      </div>
    </section>
  );
}
