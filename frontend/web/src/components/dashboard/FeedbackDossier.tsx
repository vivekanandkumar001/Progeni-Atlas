'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileCheck, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export const FeedbackDossier: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col justify-between space-y-5"
    >
      <div>
        <div className="flex items-center space-x-2 mb-1">
          <FileCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-bold text-white tracking-tight">Verified Feedback Dossier</h3>
        </div>
        <p className="text-xs text-slate-400">Extracted automatically from your previous video interview responses.</p>
      </div>

      <div className="space-y-4">
        {/* Strengths Section */}
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider block">
            KEY STRENGTHS
          </span>
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-200 leading-normal">
                "Articulated database sharding tradeoffs with precise real-world examples."
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-200 leading-normal">
                "Clean mental model during async event-driven architecture questions."
              </p>
            </div>
          </div>
        </div>

        {/* Growth Recommendations */}
        <div className="space-y-2">
          <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider block">
            GROWTH OPPORTUNITIES
          </span>
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/20 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-normal">
                "Spend more time explaining time complexity before writing solution code."
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/20 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-normal">
                "Elaborate on disaster recovery failover steps in distributed scenarios."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Link */}
      <Link
        href="/candidate/interviews"
        className="inline-flex items-center space-x-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors pt-1 group"
      >
        <span>View Full Comprehensive Evaluation Report</span>
        <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
      </Link>
    </motion.div>
  );
};
