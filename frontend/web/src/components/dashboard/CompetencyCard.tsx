'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Lightbulb } from 'lucide-react';

export const CompetencyCard: React.FC = () => {
  const competencies = [
    { name: 'Algorithmic Problem Solving', score: 8.8, percent: 88, color: 'bg-cyan-400' },
    { name: 'System & Architecture Design', score: 9.2, percent: 92, color: 'bg-emerald-400' },
    { name: 'Code Quality & Debugging', score: 8.4, percent: 84, color: 'bg-indigo-400' },
    { name: 'Communication & Articulation', score: 9.0, percent: 90, color: 'bg-sky-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col justify-between space-y-6"
    >
      <div>
        <div className="flex items-center space-x-2 mb-1">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Verified Technical Competency</h3>
        </div>
        <p className="text-xs text-slate-400">Aggregated across previous AI video interviews.</p>
      </div>

      <div className="space-y-4">
        {competencies.map((item) => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">{item.name}</span>
              <span className="font-mono font-bold text-white">{item.score} / 10</span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.percent}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={`h-full rounded-full ${item.color}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start space-x-3">
        <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-normal">
          <span className="font-semibold text-amber-400">Strongest Skill:</span> Explaining data partitioning tradeoffs and concurrency edge cases during live coding.
        </p>
      </div>
    </motion.div>
  );
};
