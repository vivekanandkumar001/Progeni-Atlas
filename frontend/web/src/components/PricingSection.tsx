'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Zap, ArrowRight } from 'lucide-react';

export const PricingSection: React.FC = () => {
  const plans = [
    {
      name: 'Free Starter',
      price: '₹0',
      credits: '10 Credits',
      period: 'on signup',
      description: 'Experience the AI mock interview with full voice, video & code execution.',
      features: [
        '1 Full AI Technical Mock Round',
        'Live Spoken Dialogue & Real-Time Voice',
        'Instant Performance Scorecard',
        'No Credit Card Required',
      ],
      cta: 'Start Free Mock',
      href: '/register',
      popular: false,
    },
    {
      name: 'Warm-up Pack',
      price: '₹49',
      credits: '30 Credits',
      period: 'one-time pack',
      description: 'Quick pre-interview brush-up right before your actual technical round.',
      features: [
        '30 AI Credits (~15-20 mins)',
        '1 Full DSA or Behavioral Round',
        'Turn-by-Turn Audio Transcripts',
        'Actionable Improvement Guidance',
      ],
      cta: 'Buy Pack (₹49)',
      href: '/candidate/wallet',
      popular: false,
    },
    {
      name: 'Placement Ready',
      price: '₹99',
      credits: '70 Credits',
      period: 'one-time pack (Save 30%)',
      description: 'Most chosen by engineering students preparing for placements & tech roles.',
      features: [
        '70 AI Credits (~35-40 mins)',
        '2-3 Full Technical & Design Rounds',
        'Resume Defense & Target JD Parsing',
        'Company Benchmarks (TCS, Google, Amazon)',
      ],
      cta: 'Get 70 Credits (₹99)',
      href: '/candidate/wallet',
      popular: true,
    },
    {
      name: 'Pro Mastery',
      price: '₹199',
      credits: '150 Credits',
      period: 'one-time pack (Best Value)',
      description: 'Complete end-to-end placement & FAANG interview preparation.',
      features: [
        '150 AI Credits (~75-80 mins)',
        '5+ Full Technical, DSA & HR Mock Rounds',
        'Company-Specific Question Banks',
        'Priority AI Voice & Video Latency',
      ],
      cta: 'Get 150 Credits (₹199)',
      href: '/candidate/wallet',
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="w-full py-16 px-6 bg-surface-deep relative z-10 scroll-mt-20 border-t border-line">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-sans font-bold text-accent-emerald uppercase tracking-wider block mb-2">
            POCKET-FRIENDLY PLANS
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Simple, Transparent Credit Packs
          </h2>
          <p className="text-sm text-ink-muted mt-2 max-w-xl mx-auto font-normal">
            No recurring monthly subscriptions. Start free with 10 credits, then buy affordable practice packs starting at ₹49.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 1, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`p-6 rounded-2xl bg-surface border ${
                plan.popular ? 'border-accent-cyan shadow-[0_0_30px_rgba(56,189,248,0.2)] relative ring-2 ring-cyan-400/30' : 'border-line'
              } flex flex-col justify-between`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#38bdf8] text-[10px] font-bold text-slate-950 uppercase tracking-wider">
                  Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold text-ink">{plan.name}</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
                    {plan.credits}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mb-4">{plan.description}</p>

                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-ink">{plan.price}</span>
                  <span className="text-xs text-ink-muted ml-1">/ {plan.period}</span>
                </div>

                <ul className="space-y-2.5 mb-6 pt-3 border-t border-line/60">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-xs text-ink-muted">
                      <Check className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={plan.href}
                className={`w-full py-2.5 rounded-xl text-center text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  plan.popular
                    ? 'btn-primary-gradient text-white shadow-md'
                    : 'border border-[#072448] text-[#072448] hover:bg-slate-100'
                }`}
              >
                <span>{plan.cta}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
