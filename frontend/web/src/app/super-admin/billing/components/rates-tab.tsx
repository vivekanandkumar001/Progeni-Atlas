import { Edit2, Scale } from 'lucide-react';
import { Card, CardHeader, Pill, Spinner } from '@/components/super-admin/ui';
import { formatDateTime, type RateCard } from '@/lib/super-admin';
import type { PricingPolicy } from '../billing-types';

const LAUNCH_RATE_PER_MINUTE = 0.5; // 0.5 Credits/min (₹1 = 2 Minutes)

interface RatesTabProps {
  pricingPolicy: PricingPolicy | null;
  savingPolicy: boolean;
  handleUpdatePolicy: (updates: Partial<PricingPolicy>) => Promise<void>;
  rateCards: RateCard[];
  loadingRates: boolean;
  setSelectedRateCard: (card: RateCard) => void;
  setFormRateValues: (values: Record<string, string>) => void;
  setRateModalOpen: (open: boolean) => void;
}

export function RatesTab({
  pricingPolicy,
  savingPolicy,
  handleUpdatePolicy,
  rateCards,
  loadingRates,
  setSelectedRateCard,
  setFormRateValues,
  setRateModalOpen,
}: RatesTabProps) {
  return (
    <div className="space-y-6">
      {/* CUSTOMER PER-MINUTE BILLING & LIVE CHARGING POLICY */}
      <Card className="border border-cyan-500/30 bg-gradient-to-br from-surface to-surface-2 p-6 shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">
                Customer Interview Pricing Policy (₹1 = 1 Credit)
              </h3>
              <Pill tone={pricingPolicy?.charging_enabled ? 'rose' : 'emerald'}>
                {pricingPolicy?.charging_enabled ? 'LIVE CHARGING ACTIVE' : 'SHADOW MODE (Deductions Disabled)'}
              </Pill>
              {pricingPolicy?.version && (
                <Pill tone="cyan">v{pricingPolicy.version}</Pill>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Configure real-time per-minute customer rates, atomic preflight holds, and production deduction safety gates.
            </p>
          </div>

          {/* Safety Switch Toggle */}
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
            <div className="text-right">
              <span className="block text-xs font-bold text-ink">Production Charging</span>
              <span className="block text-[10px] text-ink-muted">
                {pricingPolicy?.charging_enabled ? 'Real Wallet Deductions' : 'Simulated Deductions'}
              </span>
            </div>
            <button
              type="button"
              disabled={savingPolicy}
              onClick={() =>
                void handleUpdatePolicy({
                  charging_enabled: !pricingPolicy?.charging_enabled,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                pricingPolicy?.charging_enabled ? 'bg-accent-emerald' : 'bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  pricingPolicy?.charging_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Rate Selection Cards */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {/* Option A: ₹1 per 3 minutes */}
          <div
            onClick={() => void handleUpdatePolicy({ rate_per_minute_credits: LAUNCH_RATE_PER_MINUTE, base_fee_credits: 0.0 })}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              Math.abs((pricingPolicy?.rate_per_minute_credits ?? 0) - LAUNCH_RATE_PER_MINUTE) < 0.000001 && pricingPolicy?.base_fee_credits === 0.0
                ? 'border-cyan-500 bg-cyan-500/10 shadow-sm ring-1 ring-cyan-500'
                : 'border-line bg-surface hover:border-cyan-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-accent-cyan">Launch Rate</span>
              {Math.abs((pricingPolicy?.rate_per_minute_credits ?? 0) - LAUNCH_RATE_PER_MINUTE) < 0.000001 && pricingPolicy?.base_fee_credits === 0.0 && (
                <Pill tone="cyan">Active</Pill>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-ink">0.5 Credit</span>
              <span className="text-xs text-ink-muted">/ min (₹1 / 2 min)</span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              ₹1 for every 2 billed interview minutes (50 paise/min). Time is rounded up to the next full minute.
            </p>
            <div className="mt-3 text-[11px] font-mono text-ink-faint">
              20-Min Session = 10 Credits (₹10.00)
            </div>
          </div>

          {/* Option B: 1 Credit / Min */}
          <div
            onClick={() => void handleUpdatePolicy({ rate_per_minute_credits: 1.0, base_fee_credits: 0.0 })}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              pricingPolicy?.rate_per_minute_credits === 1.0 && pricingPolicy?.base_fee_credits === 0.0
                ? 'border-cyan-500 bg-cyan-500/10 shadow-sm ring-1 ring-cyan-500'
                : 'border-line bg-surface hover:border-cyan-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-accent-emerald">Promotional / Enterprise</span>
              {pricingPolicy?.rate_per_minute_credits === 1.0 && pricingPolicy?.base_fee_credits === 0.0 && (
                <Pill tone="emerald">Active</Pill>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-ink">1 Credit</span>
              <span className="text-xs text-ink-muted">/ min (₹1.00)</span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              High-volume enterprise discount. Viable when optimized voice models (Deepgram Aura) are deployed.
            </p>
            <div className="mt-3 text-[11px] font-mono text-ink-faint">
              20-Min Session = 20 Credits (₹20.00)
            </div>
          </div>

          {/* Option C: ₹10 Base + 1 Credit / Min */}
          <div
            onClick={() => void handleUpdatePolicy({ rate_per_minute_credits: 1.0, base_fee_credits: 10.0 })}
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              pricingPolicy?.base_fee_credits === 10.0
                ? 'border-cyan-500 bg-cyan-500/10 shadow-sm ring-1 ring-cyan-500'
                : 'border-line bg-surface hover:border-cyan-500/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-accent-amber">Base + Minute</span>
              {pricingPolicy?.base_fee_credits === 10.0 && (
                <Pill tone="amber">Active</Pill>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black text-ink">₹10 + 1 Cr</span>
              <span className="text-xs text-ink-muted">/ min</span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Base setup fee covers fixed server overhead and dossier scorecard evaluation, then ₹1/min.
            </p>
            <div className="mt-3 text-[11px] font-mono text-ink-faint">
              20-Min Session = 30 Credits (₹30.00)
            </div>
          </div>
        </div>

        {/* Duration Rules Summary */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-line/60 pt-4 text-xs font-mono">
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <span className="block text-[10px] uppercase text-ink-faint">Preflight Reserve</span>
            <span className="font-bold text-ink">{pricingPolicy?.reserve_minutes ?? 15} Minutes</span>
            <span className="block text-[10px] text-ink-muted">
              ({((pricingPolicy?.reserve_minutes ?? 15) * (pricingPolicy?.rate_per_minute_credits ?? LAUNCH_RATE_PER_MINUTE)).toFixed(2)} Credits Hold)
            </span>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <span className="block text-[10px] uppercase text-ink-faint">Rounding Rule</span>
            <span className="font-bold text-accent-cyan">Ceiling Minute</span>
            <span className="block text-[10px] text-ink-muted">5m 10s → 6 Minutes</span>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <span className="block text-[10px] uppercase text-ink-faint">Min Billable Duration</span>
            <span className="font-bold text-ink">{pricingPolicy?.minimum_billable_seconds ?? 60} Seconds</span>
            <span className="block text-[10px] text-ink-muted">1 Minute Minimum</span>
          </div>
          <div className="rounded-xl border border-line bg-surface p-2.5">
            <span className="block text-[10px] uppercase text-ink-faint">Platform Currency</span>
            <span className="font-bold text-accent-emerald">INR (₹)</span>
            <span className="block text-[10px] text-ink-muted">₹1 = 1 Credit</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Active Rate Cards & Billable Unit Pricing"
          subtitle="Audited rate cards applied by the metering engine to compute customer debits"
          icon={Scale}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loadingRates ? (
            <div className="col-span-full py-8 text-center">
              <Spinner />
            </div>
          ) : (
            rateCards.map((rc) => (
              <div
                key={rc.id}
                className="flex flex-col justify-between rounded-2xl border border-line bg-surface-2 p-4 transition hover:border-cyan-500/30"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black uppercase tracking-wider text-accent-cyan">
                      {rc.serviceType.replace('_', ' ')}
                    </span>
                    <Pill tone="cyan">v{rc.version}</Pill>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">{rc.description}</p>
                  <div className="mt-4 space-y-1.5 rounded-xl border border-line/60 bg-surface p-3 font-mono text-xs">
                    <span className="block text-[10px] uppercase text-ink-faint">
                      Unit: {rc.unit}
                    </span>
                    {Object.entries(rc.rates || {}).map(([metric, rate]) => (
                      <div key={metric} className="flex justify-between">
                        <span className="text-ink-muted">{metric.replace(/_/g, ' ')}:</span>
                        <span className="font-bold text-accent-emerald">${rate}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-[11px] text-ink-faint">
                  <span>Effective: {formatDateTime(rc.effectiveFrom)}</span>
                  <button
                    onClick={() => {
                      setSelectedRateCard(rc);
                      setFormRateValues({ ...(rc.rates || {}) });
                      setRateModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-accent-cyan hover:underline"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit Rate
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
