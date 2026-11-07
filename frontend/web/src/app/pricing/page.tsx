'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  Check,
  X,
  CreditCard,
  ShieldCheck,
  Zap,
  HelpCircle,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';

export default function PricingPage() {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [dbPackages, setDbPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPackages(true);
        const res = await fetch('/api/packages', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const pkgs = data.packages || data.items || [];
          if (!cancelled && Array.isArray(pkgs) && pkgs.length > 0) {
            setDbPackages(pkgs);
          }
        }
      } catch {
        // Fall back gracefully to static plans
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const plans = [
    {
      name: 'Starter Practice',
      badge: 'FOR CANDIDATES',
      price: '₹0',
      period: 'forever free',
      description: 'Ideal for job applicants preparing for technical video interviews and AI screening.',
      popular: false,
      buttonText: 'Start Practicing Free',
      buttonHref: '/candidate/practice',
      features: [
        '2 Complimentary AI Practice Interviews',
        'Standard Algorithm & Architecture Questions',
        'Basic Turn-by-Turn Audio Transcripts',
        'Instant Feedback Scorecard',
        'Browser Code Execution (Python, JS)',
      ],
      notIncluded: [
        'Custom Job Description Tailoring',
        'ATS Webhook Integrations',
        'Enterprise Anti-Cheating Telemetry',
        'PDF Committee Export',
      ],
    },
    {
      name: 'Candidate Pro',
      badge: 'CAREER ACCELERATOR',
      price: annualBilling ? '₹999' : '₹1,299',
      period: 'per month',
      description: 'Unlimited personalized interview practice tailored to your exact target job listings.',
      popular: true,
      buttonText: 'Upgrade to Pro',
      buttonAction: 'pro',
      features: [
        '20 In-Depth AI Practice Interviews / mo',
        'Upload Target JD + Resume Context Tuning',
        'Deep Vocal Feedback on Pauses & Tone',
        'System Architecture Whiteboard Drills',
        'Historical Scorecard Progress Analytics',
        'Priority AI Voice Response Latency',
      ],
      notIncluded: [
        'ATS Webhook Integrations',
        'Multi-Seat Team Governance',
      ],
    },
    {
      name: 'Hiring Team Growth',
      badge: 'FOR RECRUITERS',
      price: annualBilling ? '₹8,999' : '₹11,999',
      period: 'per month',
      description: 'For fast-moving startups and agencies interviewing up to 50 active engineering candidates/mo.',
      popular: false,
      buttonText: 'Start Team Trial',
      buttonAction: 'growth',
      features: [
        '50 AI Video Candidate Sessions / mo',
        'Automated Candidate Dossiers & PDF Reports',
        'Multi-Face & Tab-Switch Proctoring Telemetry',
        'Standard Role Rubric Templates',
        '3 Team Member Seats Included',
        'Email Support (12hr SLA)',
      ],
      notIncluded: [
        'Custom ATS Integration (Greenhouse/Lever)',
        'Custom Dedicated AI Persona',
      ],
    },
    {
      name: 'Enterprise Scale',
      badge: 'GLOBAL ORGANIZATIONS',
      price: 'Custom',
      period: 'annual contract',
      description: 'Unlimited volume, custom rubrics, and ATS synchronization for large engineering organizations.',
      popular: false,
      buttonText: 'Contact Enterprise Sales',
      buttonHref: '/contact',
      features: [
        'Unlimited Candidate Video Interviews',
        'Native Greenhouse, Lever, Workday Sync',
        'Custom Scoring Curves & Engineering Rubrics',
        'Dedicated AI Persona & Organization Branding',
        'SOC-2 Type II Audit & BAA Guarantee',
        'Dedicated Customer Success Manager',
      ],
      notIncluded: [],
    },
  ];

  const dynamicPlans = useMemo(() => {
    if (!dbPackages || dbPackages.length === 0) {
      return plans;
    }
    return dbPackages.map((pkg, idx) => {
      const isFree = Number(pkg.price ?? pkg.monthlyPrice ?? 0) === 0;
      const baseMonthly = Number(pkg.price ?? pkg.monthlyPrice ?? 0);
      const calculatedPrice = annualBilling ? Math.round(baseMonthly * 0.8) : baseMonthly;
      const formattedPrice = isFree
        ? '₹0'
        : `₹${calculatedPrice.toLocaleString('en-IN')}`;
      const period = isFree
        ? 'forever free'
        : (pkg.billing_period === 'yearly' ? 'per year' : 'per month');

      const isAudienceOrg = pkg.target_audience === 'organization';
      const badge = isAudienceOrg
        ? 'FOR ORGANIZATIONS'
        : (isFree ? 'FOR CANDIDATES' : 'CAREER ACCELERATOR');

      const popular = idx === 1 || String(pkg.tier || '').toLowerCase() === 'pro';

      const defaultFeatures = [
        `${pkg.included_interviews || pkg.interviewsIncluded || 25} AI Video Interviews included`,
        `${pkg.interview_duration_limit_minutes || 30} mins per session duration limit`,
        `${pkg.included_recruiter_seats || pkg.seatsIncluded || 1} team seats included`,
        'Instant Feedback Scorecard & Audio Transcripts',
        'Turn-by-Turn Telemetry & Evaluation',
      ];

      return {
        id: pkg.id || pkg.package_id || `pkg-${idx}`,
        name: pkg.name || 'Subscription Plan',
        badge,
        price: formattedPrice,
        period,
        description: pkg.description || 'Comprehensive AI interview practice and automated candidate screening.',
        popular,
        buttonText: isFree ? 'Start Practicing Free' : (isAudienceOrg ? 'Start Team Trial' : 'Upgrade to Plan'),
        buttonHref: isFree ? '/candidate/practice' : undefined,
        buttonAction: isFree ? undefined : (isAudienceOrg ? 'growth' : 'pro'),
        features: defaultFeatures,
        notIncluded: isFree ? ['Custom ATS Integrations', 'Multi-Seat Team Governance'] : [],
      };
    });
  }, [dbPackages, annualBilling, plans]);

  const handleSelectPlan = (planName: string, action?: string, href?: string) => {
    if (href) return;
    setSelectedPlan(planName);
    setCheckoutModalOpen(true);
    setPaymentSuccess(false);
  };

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSuccess(true);
    setTimeout(() => {
      setCheckoutModalOpen(false);
      setPaymentSuccess(false);
    }, 2000);
  };

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-cyan-500/20">
      <Navbar />

      {/* Pricing Header */}
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-surface via-surface to-surface-deep py-20 lg:py-24">
        <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-accent-emerald text-xs font-bold uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            Pay Us Now // Transparent Pricing
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-ink tracking-tight leading-[1.1]">
            Predictable Plans for Candidates &amp;{' '}
            <span className="bg-gradient-to-r from-[#185adb] via-cyan-500 to-indigo-600 bg-clip-text text-transparent">
              Hiring Teams
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-ink-muted">
            Whether you&apos;re an applicant preparing for technical rounds or an engineering leader screening hundreds of candidates, we have a plan built for you.
          </p>

          {/* Monthly / Annual Billing Switcher */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs font-bold ${!annualBilling ? 'text-ink' : 'text-ink-muted'}`}>
              Monthly Billing
            </span>
            <button
              type="button"
              onClick={() => setAnnualBilling(!annualBilling)}
              className="relative w-14 h-7 rounded-full bg-slate-300  p-1 cursor-pointer transition-colors focus:outline-none"
              aria-label="Toggle annual billing"
            >
              <div
                className={`w-5 h-5 rounded-full bg-[#072448]  transition-transform ${
                  annualBilling ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-bold flex items-center gap-1.5 ${annualBilling ? 'text-ink' : 'text-ink-muted'}`}>
              Annual Billing
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-accent-emerald border border-emerald-500/20 font-bold uppercase">
                Save 20%
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-3xl border ${
                  plan.popular
                    ? 'border-[#185adb]  bg-surface-deep shadow-2xl relative ring-2 ring-[#185adb]/20'
                    : 'border-line bg-surface-deep shadow-sm'
                } flex flex-col justify-between space-y-6`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#185adb] text-white text-[10px] font-bold uppercase tracking-wider shadow-md">
                    Most Popular Choice
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-cyan">
                      {plan.badge}
                    </span>
                    <h3 className="text-xl font-bold text-ink mt-1">{plan.name}</h3>
                    <p className="text-xs text-ink-muted mt-2 min-h-[36px]">{plan.description}</p>
                  </div>

                  <div className="pt-2 border-t border-line">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-ink">{plan.price}</span>
                      <span className="text-xs text-ink-muted">{plan.period}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-line text-xs">
                    <p className="font-bold text-ink uppercase text-[10px] tracking-wider">Features included:</p>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-ink-muted">
                        <Check className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                    {(plan.notIncluded || []).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-ink-faint opacity-50 line-through">
                        <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  {plan.buttonHref ? (
                    <Link
                      href={plan.buttonHref}
                      className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                        plan.popular
                          ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md hover:brightness-110'
                          : 'bg-surface-2 text-ink border border-line hover:bg-surface-3'
                      }`}
                    >
                      {plan.buttonText}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.name, plan.buttonAction)}
                      className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                        plan.popular
                          ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md hover:brightness-110'
                          : 'bg-[#072448]  text-white hover:brightness-110'
                      }`}
                    >
                      {plan.buttonText}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Strip */}
      <section className="py-16 border-t border-line bg-surface-deep">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-accent-cyan uppercase tracking-wider">
              PRICING &amp; BILLING FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-ink">
              Frequently Asked Billing Questions
            </h2>
          </div>

          <div className="space-y-4 text-sm">
            {[
              [
                'Can I cancel or change my plan anytime?',
                'Yes. You can cancel or change your plan at any time in your candidate or recruiter portal. There are no lock-in contracts for monthly subscriptions.',
              ],
              [
                'What payment methods do you accept?',
                'We accept all major credit and debit cards (Visa, Mastercard, American Express), as well as direct corporate invoicing for Enterprise accounts.',
              ],
              [
                'What happens if my team exceeds the candidate session limit?',
                'On the Growth tier, you can easily top up additional interview sessions at a low per-session rate (₹350/interview) without having to change plans.',
              ],
              [
                'Are practice interviews free for job applicants?',
                'Yes. Every new user receives 2 complimentary AI technical practice sessions to prepare for interviews and experience the live system.',
              ],
            ].map(([q, a], idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-surface border border-line space-y-2">
                <h4 className="font-bold text-ink flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-accent-cyan" />
                  {q}
                </h4>
                <p className="text-ink-muted text-xs leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simulated Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl bg-white  border border-slate-200  p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setCheckoutModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 "
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-[#072448] text-white flex items-center justify-center shadow-md">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 ">Secure Checkout</h3>
                <p className="text-xs text-slate-500">Plan: {selectedPlan}</p>
              </div>
            </div>

            {paymentSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center animate-bounce">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 ">Payment Successful!</h4>
                <p className="text-xs text-slate-500">
                  Your {selectedPlan} subscription is now active. Enjoy full platform access!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSimulatePayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700  mb-1">
                    Cardholder Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Please enter cardholder name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700  mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Please enter card number (4242 •••• •••• 4242)"
                    defaultValue="4242 4242 4242 4242"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb] font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700  mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Please enter expiry date (MM / YY)"
                      defaultValue="12/28"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700  mb-1">
                      CVC / CVV
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Please enter CVC / CVV"
                      defaultValue="789"
                      maxLength={4}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300  bg-slate-50  text-sm text-slate-900  focus:outline-none focus:ring-2 focus:ring-[#185adb] font-mono text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 mt-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Confirm &amp; Pay Now</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
