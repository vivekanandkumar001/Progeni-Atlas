'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { TrendingUp, Play, Award, Zap } from 'lucide-react';

export const ReadinessBanner: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full p-6 md:p-8 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800 shadow-2xl backdrop-blur-md relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
    >
      {/* Background Subtle Accent Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Left Content */}
      <div className="space-y-3 max-w-2xl z-10">
        <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider block">
          ACADEMIC YEAR 2026 • PLACEMENT PREPARATION
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
          Welcome back, Vivekanand!
        </h1>

        <p className="text-sm text-slate-300 leading-relaxed">
          You have 1 scheduled technical screening today. Your AI readiness profile is currently in the{' '}
          <span className="font-semibold text-cyan-400">top 12% of applicants</span> for Software Engineering roles.
        </p>

        <div className="pt-1 flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center text-emerald-400">
            <Award className="w-4 h-4 mr-1 text-emerald-400" />
            Verified Resume Context Ready
          </span>
          <span>•</span>
          <span className="flex items-center text-indigo-400">
            <Zap className="w-4 h-4 mr-1 text-indigo-400" />
            Adaptive AI Persona Pre-configured
          </span>
        </div>
      </div>

      {/* Right Readiness Score Card & CTA */}
      <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 z-10 shrink-0">
        {/* Score Ring / Display */}
        <div className="flex items-center space-x-4">
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.3)]">
            <div className="w-full h-full bg-slate-950 rounded-full flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-white leading-none">88</span>
              <span className="text-[9px] font-mono text-slate-400 uppercase mt-0.5">/ 100</span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">Interview Readiness Score</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center mt-1">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              +6% from last mock interview
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/candidate/practice"
          className="w-full sm:w-auto px-5 py-3 rounded-full text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 whitespace-nowrap cursor-pointer hover:scale-[1.02]"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start Quick 5-Min Warmup →</span>
        </Link>
      </div>
    </motion.div>
  );
};
