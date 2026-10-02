'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const TelemetryCard: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="p-4 sm:p-5 rounded-xl bg-[#0a1128]/95 border border-[#1e293b] flex flex-col justify-between h-full shadow-sm space-y-4"
    >
      <div>
        {/* Header */}
        <div className="flex items-center space-x-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs font-sans font-bold tracking-wider text-[#10b981] uppercase">
            RECRUITER INSTANT SCORECARD
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-bold text-white mb-3">Live Competency Assessment</h3>

        {/* Human Competency Scoring Bars */}
        <div className="space-y-3 mb-4">
          {/* Metric 1: Problem Solving */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-sans">
              <span className="text-[#94a3b8]">Problem Solving</span>
              <span className="text-[#38bdf8] font-bold">9.2 / 10</span>
            </div>
            <div className="w-full bg-[#1e293b] rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '92%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                className="bg-[#38bdf8] h-full rounded-full"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Clear step-by-step logic</span>
          </div>

          {/* Metric 2: Role Knowledge */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-sans">
              <span className="text-[#94a3b8]">Role Knowledge</span>
              <span className="text-[#10b981] font-bold">8.8 / 10</span>
            </div>
            <div className="w-full bg-[#1e293b] rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '88%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
                className="bg-[#10b981] h-full rounded-full"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Solid fundamentals</span>
          </div>

          {/* Metric 3: Communication Clarity */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1 font-sans">
              <span className="text-[#94a3b8]">Communication Clarity</span>
              <span className="text-[#818cf8] font-bold">9.0 / 10</span>
            </div>
            <div className="w-full bg-[#1e293b] rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '90%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                className="bg-[#818cf8] h-full rounded-full"
              />
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Concise and articulated</span>
          </div>
        </div>

        {/* Recommendation Badge */}
        <div className="p-3 rounded-lg bg-[#030712] border border-[#10b981]/40 mb-3 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
          <div className="text-xs font-sans flex items-center space-x-1.5">
            <span className="text-[#34d399] font-bold">✓ Candidate Recommended for Final Round</span>
          </div>
          <p className="text-[11px] font-sans text-slate-300 italic mt-1.5 leading-relaxed">
            "Candidate demonstrated solid indexing knowledge and explained query execution plans clearly."
          </p>
        </div>
      </div>
    </motion.div>
  );
};
