import { Award, Briefcase, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { OverviewStats } from '../dashboard-types';

export function StatsOverviewSection({ overview }: { overview: OverviewStats }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* STAT CARD 1 */}
      <div className="rounded-2xl bg-surface border border-line p-5 space-y-3 backdrop-blur-md relative overflow-hidden group hover:border-line-strong transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">Total Candidates Screened</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-accent-indigo border border-indigo-500/20">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            {overview.totalCandidates}
          </span>
          <span className="text-xs font-mono font-semibold text-accent-emerald flex items-center gap-0.5">
            {overview.totalCandidates > 0 ? (
              <>
                <TrendingUp className="w-3.5 h-3.5" /> Pipeline Active
              </>
            ) : (
              <span className="text-ink-muted">0 Active</span>
            )}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted">Across all configured technical roles</p>
      </div>

      {/* STAT CARD 2 */}
      <div className="rounded-2xl bg-surface border border-line p-5 space-y-3 backdrop-blur-md relative overflow-hidden group hover:border-line-strong transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">Active Job Openings</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-accent-cyan border border-cyan-500/20">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            {overview.activePositions}
          </span>
          <span className="text-xs font-mono text-accent-cyan font-medium">
            {overview.activePositions > 0 ? `${overview.activePositions} Active` : '0 Configured'}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted">Active AI rubrics configured</p>
      </div>

      {/* STAT CARD 3 */}
      <div className="rounded-2xl bg-surface border border-line p-5 space-y-3 backdrop-blur-md relative overflow-hidden group hover:border-line-strong transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">Avg AI Match Score</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-accent-emerald border border-emerald-500/20">
            <Award className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold text-accent-emerald tracking-tight">
            {overview.avgMatchScore > 0 ? `${overview.avgMatchScore}%` : 'N/A'}
          </span>
          <span className="text-xs font-mono font-semibold text-accent-emerald">
            {overview.avgMatchScore >= 80 ? 'High Benchmark' : overview.avgMatchScore > 0 ? 'Standard' : 'Awaiting Data'}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted">Multi-factor technical rubric evaluation</p>
      </div>

      {/* STAT CARD 4: FREE DEMO ALLOWANCE & QUOTA */}
      <div className="rounded-2xl bg-surface border border-line p-5 space-y-3 backdrop-blur-md relative overflow-hidden group hover:border-line-strong transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">Free Demo Screenings</span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-accent-cyan border border-cyan-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            {overview.freeDemosRemaining ?? 2} <span className="text-xs font-normal text-ink-muted">/ {overview.freeDemosTotal ?? 2} Available</span>
          </span>
          <span className="text-xs font-mono font-semibold text-accent-cyan">
            10-Min Limit
          </span>
        </div>
        <p className="text-[11px] text-ink-muted">
          {overview.freeDemosRemaining === 0
            ? 'Trial allowance exhausted • Organization wallet active'
            : 'Free screening trials for recruiter evaluation'}
        </p>
      </div>
    </section>
  );
}
