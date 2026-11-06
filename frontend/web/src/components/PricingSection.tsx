'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export const PricingSection: React.FC = () => {
  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      description: 'Perfect for candidates practicing and solo recruiters starting out.',
      features: [
        '2 Free Video Interview Sessions',
        'Standard Role Questions',
        'Instant Candidate Feedback Report',
        'Basic Audio & Video Replays',
      ],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Growth',
      price: '₹8,999',
      period: '/ month',
      description: 'Ideal for fast-growing hiring teams scaling screening rounds.',
      features: [
        'Unlimited AI Video Interviews',
        'Custom Job Description Parsing',
        'Advanced Competency Scorecards',
        'PDF Export & Team Dossier Sharing',
        'Priority Candidate Support',
      ],
      cta: 'Upgrade to Growth',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For enterprise orgs requiring ATS integrations and custom rubrics.',
      features: [
        'Dedicated AI Persona & Branding',
        'Greenhouse / Lever ATS Integration',
        'Custom Security & Compliance Rules',
        'Dedicated Success Manager',
        'SLA & Custom Security Audit',
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="w-full py-16 px-6 bg-surface-deep relative z-10 scroll-mt-20 border-t border-line">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-sans font-bold text-accent-emerald uppercase tracking-wider block mb-2">
            TRANSPARENT PLANS
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Simple, Predictable Pricing
          </h2>
          <p className="text-sm text-ink-muted mt-2 max-w-xl mx-auto font-normal">
            Choose the right plan to accelerate your technical hiring or practice your video interview skills.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 1, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`p-6 rounded-2xl bg-surface border ${
                plan.popular ? 'border-accent-cyan shadow-[0_0_30px_rgba(56,189,248,0.2)] relative' : 'border-line'
              } flex flex-col justify-between`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#38bdf8] text-[10px] font-bold text-slate-950 uppercase">
                  Most Popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold text-ink mb-1">{plan.name}</h3>
                <p className="text-xs text-ink-muted mb-4">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-3xl font-extrabold text-ink">{plan.price}</span>
                  {plan.period && <span className="text-xs text-ink-muted ml-1">{plan.period}</span>}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-xs text-ink-muted">
                      <Check className="w-4 h-4 text-accent-emerald shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/register"
                className={`w-full py-2.5 rounded-full text-xs font-bold transition-all text-center block ${
                  plan.popular
                    ? 'btn-primary-gradient text-on-brand shadow-lg'
                    : 'bg-surface-deep border border-line-strong text-ink hover:bg-surface-3'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
