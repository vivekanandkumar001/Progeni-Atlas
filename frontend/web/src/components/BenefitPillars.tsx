'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ShieldCheck, TrendingUp, Users, Zap, Award } from 'lucide-react';

export const BenefitPillars: React.FC = () => {
  return (
    <section id="benefits" className="w-full py-16 px-6 bg-surface-deep relative z-10 border-t border-line scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-sans font-bold text-accent-emerald uppercase tracking-wider block mb-2">
            WHY TALENTPULSE AI
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Designed for Hiring Teams & Candidates
          </h2>
          <p className="text-sm text-ink-muted mt-2 max-w-xl mx-auto font-normal">
            Creating a seamless, anxiety-free experience for job seekers while eliminating hiring bottlenecks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* For Companies & Hiring Managers */}
          <motion.div
            initial={{ opacity: 1, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl bg-surface border border-[#10b981]/30 shadow-xl"
          >
            <div className="flex items-center space-x-3 mb-6 border-b border-line pb-4">
              <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center border border-[#10b981]/30">
                <Zap className="w-5 h-5 text-accent-emerald" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">For Companies & Hiring Managers</h3>
                <span className="text-xs text-accent-emerald font-medium">Faster hiring with zero compromise</span>
              </div>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-accent-emerald shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Cut Screening Time from 3 Weeks to 24 Hours</h4>
                  <p className="text-xs text-ink-muted mt-0.5">Move candidates from application to final decision in hours instead of weeks.</p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-accent-emerald shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Unbiased Evaluations</h4>
                  <p className="text-xs text-ink-muted mt-0.5">Evaluations focused purely on true technical competency and role performance.</p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <Award className="w-5 h-5 text-accent-emerald shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Non-Intrusive Anti-Cheating Verification</h4>
                  <p className="text-xs text-ink-muted mt-0.5">Built-in trust metrics without intrusive software installations.</p>
                </div>
              </li>
            </ul>
          </motion.div>

          {/* For Candidates & Job Seekers */}
          <motion.div
            initial={{ opacity: 1, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl bg-surface border border-[#38bdf8]/30 shadow-xl"
          >
            <div className="flex items-center space-x-3 mb-6 border-b border-line pb-4">
              <div className="w-10 h-10 rounded-full bg-[#38bdf8]/10 flex items-center justify-center border border-[#38bdf8]/30">
                <Users className="w-5 h-5 text-accent-cyan" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">For Candidates & Job Seekers</h3>
                <span className="text-xs text-accent-cyan font-medium">Convenient, fair, and growth-focused</span>
              </div>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Interview at Your Convenience</h4>
                  <p className="text-xs text-ink-muted mt-0.5">Complete your interview 24/7 without waiting weeks for an HR callback.</p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Safe, Anxiety-Free Environment</h4>
                  <p className="text-xs text-ink-muted mt-0.5">A natural, interactive setting designed to let your real skills shine.</p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <TrendingUp className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Actionable Feedback</h4>
                  <p className="text-xs text-ink-muted mt-0.5">Clear insights on your strengths and specific areas to grow your career.</p>
                </div>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
