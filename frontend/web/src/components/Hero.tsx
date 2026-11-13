'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export const Hero: React.FC = () => {
  return (
    <section id="hero" className="relative pt-12 pb-14 px-6 text-center max-w-5xl mx-auto flex flex-col items-center z-10 scroll-mt-20">
      {/* Friendly Badge Pill */}
      <motion.div
        initial={{ opacity: 1, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-[#0ea5e9]/60 bg-surface-deep backdrop-blur-md mb-6 shadow-[0_0_15px_rgba(14,165,233,0.2)]"
      >
        <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]" />
        <span className="text-xs font-sans font-medium tracking-wide text-accent-cyan uppercase">
          ✨ 100% AUTOMATED, FAIR & CONVERSATIONAL VIDEO INTERVIEWS
        </span>
      </motion.div>

      {/* Main Heading */}
      <motion.h1
        initial={{ opacity: 1, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-ink tracking-tight leading-[1.15] max-w-4xl mb-5 font-sans"
      >
        Hire 10x Faster with AI-Led Video Interviews
      </motion.h1>

      {/* Subheadline */}
      <motion.p
        initial={{ opacity: 1, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-sm md:text-base text-ink-muted max-w-2xl leading-relaxed mb-8 font-normal"
      >
        Screen hundreds of candidates simultaneously through natural face-to-face AI conversations. Save countless hours of scheduling while giving every applicant an equal, unbiased chance.
      </motion.p>

      {/* Dual Action Buttons */}
      <motion.div
        initial={{ opacity: 1, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4"
      >
        {/* Primary CTA */}
        <Link
          href="/candidate/practice"
          prefetch={false}
          className="w-full sm:w-auto px-7 py-3.5 rounded-full text-sm font-bold text-on-brand btn-primary-gradient shadow-xl flex items-center justify-center space-x-2 group cursor-pointer"
        >
          <span>Try Candidate Mock Interview </span>
        </Link>

        {/* Secondary CTA */}
        <Link
          href="/recruiter/dashboard"
          prefetch={false}
          className="w-full sm:w-auto px-7 py-3.5 rounded-full text-sm font-semibold text-ink bg-surface border border-line-strong hover:border-[#0ea5e9]/50 hover:bg-surface-3 transition-all flex items-center justify-center space-x-2"
        >
          <span>Recruiter Portal & Dossiers </span>
        </Link>
      </motion.div>
    </section>
  );
};
