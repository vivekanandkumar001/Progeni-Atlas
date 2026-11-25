'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Skeleton } from '@/components/ui';
import { apiJson } from '@/lib/api';
import {
  Check,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Zap,
  Users,
  Building2,
  Lock } from 'lucide-react';

interface PlanCard {
  name: string;
  badge: string;
  price: string;
  priceNum: number;
  credits: string;
  period: string;
  description: string;
  popular: boolean;
  buttonText: string;
  buttonHref: string;
  features: string[];
  notIncluded?: string[];
}

export default function PricingPage() {
  const [audience, setAudience] = useState<'candidate' | 'recruiter'>('candidate');
  // Never seed live pricing UI with invented plans. The API is authoritative.
  const [candidatePlans, setCandidatePlans] = useState<PlanCard[]>([]);
  const [recruiterPlans, setRecruiterPlans] = useState<PlanCard[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadPackages() {
      setPackagesLoading(true);
      setPackagesError(null);
      try {
        const data = await apiJson<{ success: boolean; packages: any[] }>('/api/packages');
        if (!isMounted) return;
        if (!data?.success || !Array.isArray(data.packages) || data.packages.length === 0) {
          setPackagesError('Pricing could not be loaded right now. Please try again shortly.');
          return;
        }

        const allPkgs = data.packages;

        // 1. Candidate plans from Super Admin
        const candPkgs = allPkgs.filter(
          (p: any) => p.target_audience === 'individual' || p.target_audience === 'both'
        );
        if (candPkgs.length > 0) {
          const mappedCand: PlanCard[] = candPkgs.map((pkg: any) => {
            const priceNum = Number(pkg.price ?? pkg.monthlyPrice ?? 0);
            const priceStr = priceNum === 0 ? '₹0' : `₹${priceNum.toLocaleString('en-IN')}`;
            const periodStr =
              priceNum === 0
                ? 'Free trial'
                : pkg.billing_period === 'monthly'
                ? 'month'
                : pkg.billing_period === 'yearly'
                ? 'year'
                : 'one-time pack';

            const creditsStr = pkg.credits
              ? `${pkg.credits} Credits`
              : `${pkg.included_interviews || 1} Mock Trial${(pkg.included_interviews || 1) > 1 ? 's' : ''}`;

            const defaultFeats = [
              `${pkg.included_interviews || 1} Full AI Technical Mock Round${(pkg.included_interviews || 1) > 1 ? 's' : ''}`,
              'Live Spoken Dialogue & Adaptive Follow-ups',
              'Browser Code Execution (Python, C++, JS)',
              'Instant Performance Scorecard & Dossier',
            ];

            const isPopular = Boolean(
              pkg.popular ||
              String(pkg.name || '').toLowerCase().includes('popular') ||
              String(pkg.name || '').toLowerCase().includes('placement')
            );

            return {
              name: pkg.name || 'Candidate Plan',
              badge: priceNum === 0 ? 'INSTANT TRIAL' : isPopular ? 'TOP PICK' : 'PRACTICE PACK',
              price: priceStr,
              priceNum,
              credits: creditsStr,
              period: periodStr,
              description: pkg.description || 'Targeted interview practice for engineering roles.',
              popular: isPopular,
              buttonText: priceNum === 0 ? 'Start Free Mock' : `Buy ${pkg.name} (${priceStr})`,
              buttonHref: priceNum === 0 ? '/register' : '/candidate/wallet',
              features: Array.isArray(pkg.features) && pkg.features.length > 0 ? pkg.features : defaultFeats,
              notIncluded: [],
            };
          });
          setCandidatePlans(mappedCand);
        }

        // 2. Recruiter plans from Super Admin
        const recPkgs = allPkgs.filter(
          (p: any) => p.target_audience === 'organization' || p.target_audience === 'both'
        );
        if (recPkgs.length > 0) {
          const mappedRec: PlanCard[] = recPkgs.map((pkg: any) => {
            const priceNum = Number(pkg.price ?? pkg.monthlyPrice ?? 0);
            const priceStr = `₹${priceNum.toLocaleString('en-IN')}`;
            const periodStr =
              pkg.billing_period === 'monthly'
                ? 'month'
                : pkg.billing_period === 'yearly'
                ? 'year'
                : '₹1.00 = 1 Credit';

            const creditsStr = pkg.credits
              ? `${pkg.credits.toLocaleString('en-IN')} Credits`
              : `${pkg.included_interviews || 20} Candidate Screenings`;

            const defaultFeats = [
              `${creditsStr} (~${Math.round((pkg.credits || 500) / 2)} mins)`,
              `Up to ${pkg.included_interviews || 20} Candidate Interview Sessions`,
              'Automated Candidate Dossiers & PDF Reports',
              'Custom Role Rubric Templates & Weights',
              `${pkg.included_recruiter_seats || 3} Team Member Seats`,
            ];

            const isPopular = Boolean(
              pkg.popular ||
              String(pkg.name || '').toLowerCase().includes('popular') ||
              String(pkg.name || '').toLowerCase().includes('growth')
            );

            return {
              name: pkg.name || 'Recruiter Pack',
              badge: isPopular ? 'GROWTH SCALE' : (pkg.tier === 'enterprise' ? 'ENTERPRISE' : 'FOR TEAMS'),
              price: priceStr,
              priceNum,
              credits: creditsStr,
              period: periodStr,
              description: pkg.description || 'Automated AI technical screening for hiring teams.',
              popular: isPopular,
              buttonText: `Choose Plan (${priceStr})`,
              buttonHref: '/recruiter/billing',
              features: Array.isArray(pkg.features) && pkg.features.length > 0 ? pkg.features : defaultFeats,
              notIncluded: [],
            };
          });
          setRecruiterPlans(mappedRec);
        }
      } catch {
        if (isMounted) {
          setPackagesError('Pricing could not be loaded right now. Please try again shortly.');
        }
      } finally {
        if (isMounted) setPackagesLoading(false);
      }
    }
    void loadPackages();
    return () => {
      isMounted = false;
    };
  }, []);

  const activePlans = audience === 'candidate' ? candidatePlans : recruiterPlans;

  // Cheapest paid candidate pack — keeps the tab label and hero copy in sync
  // with whatever prices are actually set in Super Admin (no hard-coded ₹49).
  const paidPrices = candidatePlans.map((p) => p.priceNum).filter((n) => n > 0);
  const minCandidatePrice = paidPrices.length > 0 ? Math.min(...paidPrices) : null;
  const hasPaidCandidatePack = minCandidatePrice !== null;
  const freePlan = candidatePlans.find((p) => p.priceNum === 0) || null;
  const candidateTabLabel =
    minCandidatePrice !== null
      ? `Candidate Practice Packs · from ₹${minCandidatePrice.toLocaleString('en-IN')}`
      : 'Candidate Practice Packs';

  // Card count decides the grid so 1-2 packs don't stretch full-width and
  // 4 packs always sit in one clean row on desktop.
  const gridClassesFor = (count: number): string => {
    if (count <= 1) return 'grid-cols-1 max-w-md mx-auto';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
  };

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-cyan-500/20">
      <Navbar />

      {/* Pricing Header */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface via-surface to-surface-deep py-16 lg:py-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-accent-emerald text-xs font-bold uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            Transparent Pricing // No Subscriptions, Pay Only As You Practice
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight leading-[1.1]">
            Pocket-Friendly Practice Packs for{' '}
            <span className="bg-gradient-to-r from-accent-blue via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Every Candidate
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-ink-muted">
            {packagesLoading
              ? 'Loading the latest practice packs…'
              : packagesError
              ? 'Pricing is temporarily unavailable. Please try again shortly.'
              : `Start free${freePlan ? ` with ${freePlan.credits.toLowerCase()}` : ''}. When you're ready to level up, choose simple one-time packs${hasPaidCandidatePack ? ` starting at just ₹${minCandidatePrice?.toLocaleString('en-IN')}` : ''}.`}
          </p>

          {/* Candidate vs Recruiter Tab Switcher */}
          <div className="pt-2 flex items-center justify-center">
            <div className="inline-flex p-1 rounded-2xl bg-surface-2 border border-line shadow-xs">
              <button
                type="button"
                onClick={() => setAudience('candidate')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  audience === 'candidate'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Sparkles className="w-4 h-4 text-accent-cyan" />
                <span>{candidateTabLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setAudience('recruiter')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  audience === 'recruiter'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Building2 className="w-4 h-4 text-accent-indigo" />
                <span>Recruiter &amp; Team Packs</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="py-16 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {packagesLoading ? (
            <div className={`grid gap-6 ${gridClassesFor(3)}`} aria-label="Loading pricing plans">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="card-panel p-6 space-y-5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ))}
            </div>
          ) : packagesError || activePlans.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface-deep p-10 text-center text-sm text-ink-muted">
              {packagesError || 'No plans are configured for this audience right now.'}
            </div>
          ) : (
            <div className={`grid gap-6 ${gridClassesFor(activePlans.length)}`}>
              {activePlans.map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-xl border ${
                  plan.popular
                    ? 'border-blue-600 bg-surface-deep shadow-2xl relative ring-2 ring-accent-blue/30'
                    : 'border-line bg-surface-deep shadow-sm'
                } flex flex-col justify-between space-y-6 transition hover:translate-y-[-4px] hover:shadow-lg`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                    Most Popular Choice
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">
                      {plan.badge}
                    </span>
                    <h2 className="text-xl font-bold text-ink mt-1">{plan.name}</h2>
                    <p className="text-xs text-ink-muted mt-2 min-h-[36px] leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="pt-2 border-t border-line/60">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-ink">{plan.price}</span>
                      <span className="text-xs font-medium text-ink-muted"> / {plan.period}</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-accent-cyan text-xs font-mono font-bold">
                      <Zap className="w-3.5 h-3.5 fill-cyan-400 text-accent-cyan" />
                      <span>{plan.credits}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-line/60">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      What&apos;s Included:
                    </p>
                    <ul className="space-y-2.5">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-ink-muted">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Link
                  href={plan.buttonHref}
                  className={`w-full py-3 rounded-xl text-center text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                    plan.popular
                      ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-cyan-500/20 hover:brightness-110'
                      : 'border border-accent-blue text-accent-blue hover:bg-surface-2'
                  }`}
                >
                  <span>{plan.buttonText}</span>
                  </Link>
              </div>
              ))}
            </div>
          )}

          {/* Guarantee / Free Trial Banner */}
          <div className="mt-14 p-6 sm:p-8 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-surface to-surface-deep shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent-cyan">
                <ShieldCheck className="w-4 h-4 text-cyan-500" />
                <span>100% Student Friendly · No Hidden Charges</span>
              </div>
              <h2 className="text-xl font-bold text-ink">
                {packagesLoading
                  ? 'Loading free trial details…'
                  : freePlan
                  ? `Start with ${freePlan.credits} upon Signup`
                  : 'Start your free trial upon Signup'}
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted max-w-xl">
                {packagesLoading
                  ? 'Checking the current free trial included with registration.'
                  : freePlan
                  ? `New users receive ${freePlan.credits.toLowerCase()} after OTP verification. Practice your first live AI interview without entering any payment card.`
                  : 'Practice your first live AI interview without entering any payment card.'}
              </p>
            </div>
            <Link
              href="/register"
              className="px-6 py-3.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-blue-700 transition shrink-0 whitespace-nowrap"
            >
              Claim Free Trial
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
