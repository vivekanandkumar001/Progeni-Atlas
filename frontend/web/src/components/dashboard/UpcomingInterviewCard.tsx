'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Video, Clock, CheckCircle2, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

interface UpcomingInterviewCardProps {
  sessionId?: string;
}

export const UpcomingInterviewCard: React.FC<UpcomingInterviewCardProps> = ({
  sessionId = 'sess-live-8801'
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/40 shadow-xl backdrop-blur-md relative overflow-hidden flex flex-col justify-between space-y-6"
    >
      {/* Top Header Tag */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Video className="w-5 h-5" />
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
            UPCOMING AI VIDEO SESSION
          </span>
        </div>

        <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-semibold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2 shadow-[0_0_8px_#10b981]" />
          SCHEDULED TODAY • 3:30 PM
        </span>
      </div>

      {/* Title & Organization */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Full-Stack & Systems Architecture Screening
        </h2>
        <p className="text-sm font-medium text-slate-400">
          CloudScale Systems (Campus Placement Drive)
        </p>
      </div>

      {/* 3-Column Mini Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
        <div>
          <span className="text-[11px] font-mono text-slate-400 block">Duration</span>
          <span className="text-xs font-semibold text-white mt-0.5 block flex items-center">
            <Clock className="w-3.5 h-3.5 text-cyan-400 mr-1" />
            30 Minutes
          </span>
        </div>

        <div>
          <span className="text-[11px] font-mono text-slate-400 block">Format</span>
          <span className="text-xs font-semibold text-white mt-0.5 block truncate">
            Face-to-Face AI Video
          </span>
        </div>

        <div>
          <span className="text-[11px] font-mono text-slate-400 block">Focus Areas</span>
          <span className="text-xs font-semibold text-cyan-400 mt-0.5 block truncate">
            System Design, Distributed
          </span>
        </div>
      </div>

      {/* System Pre-Flight Checklist */}
      <div className="space-y-2">
        <span className="text-xs font-mono text-slate-400 block">System Diagnostics Status</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-medium">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Cam & Mic Passed</span>
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Resume Synced</span>
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Lighting Optimal</span>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <Link
        href={`/candidate/interview/${sessionId}/lobby`}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer hover:scale-[1.01]"
      >
        <span>Enter Video Interview Room →</span>
      </Link>
    </motion.div>
  );
};
