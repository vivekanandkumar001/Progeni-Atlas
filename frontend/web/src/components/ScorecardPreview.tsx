'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Check, FileText } from 'lucide-react';

export const ScorecardPreview: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="scorecard" className="w-full py-16 px-6 bg-[#020617] relative z-10 scroll-mt-20 border-t border-[#1e293b]/40">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-sans font-bold text-[#818cf8] uppercase tracking-wider block mb-2">
            AUDIT-READY CANDIDATE DOSSIER
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Comprehensive Candidate Performance Reports
          </h2>
          <p className="text-sm text-[#94a3b8] mt-2 max-w-xl mx-auto font-normal">
            Clear, verifiable insights with exact candidate quotes, timestamps, and objective competency scoring.
          </p>
        </div>

        {/* Interactive Scorecard Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="p-6 sm:p-8 rounded-2xl bg-[#080e21] border border-[#1e293b] shadow-2xl space-y-6"
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1e293b] gap-4">
            <div>
              <span className="text-xs font-mono text-[#38bdf8] block">CANDIDATE ID: #TP-8842</span>
              <h3 className="text-xl font-bold text-white">Alex Rivera</h3>
              <p className="text-xs text-[#94a3b8]">Applied for Senior Systems Architect • Completed Today</p>
            </div>

            {/* Match Badge */}
            <div className="flex items-center space-x-3 bg-[#030712] px-4 py-2.5 rounded-xl border border-[#10b981]/40">
              <span className="text-2xl font-extrabold text-[#34d399]">91%</span>
              <div className="text-left">
                <span className="text-xs font-bold text-white block">Overall Match</span>
                <span className="text-[10px] text-[#34d399] font-medium">Strong Hire Recommendation</span>
              </div>
            </div>
          </div>

          {/* Quoted Answer with Timestamp */}
          <div className="p-4 rounded-xl bg-[#030712] border border-[#1e293b] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#64748b]">
              <span>QUESTION 2 VERBATIM TRANSCRIPT</span>
              <span className="text-[#38bdf8]">04:12 - 05:48</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-medium italic">
              "We analyzed the EXPLAIN query plan, added a composite B-tree index on high-cardinality columns, and reduced query latency from 2.4s to 45ms without downtime."
            </p>
            <div className="flex items-center space-x-2 pt-1 text-[11px] font-mono text-[#34d399]">
              <span>✓ Verified indexing depth</span>
              <span>•</span>
              <span>✓ Demonstrated execution plan knowledge</span>
            </div>
          </div>

          {/* Action Bar: Download PDF & Share Link */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-4">
            <div className="flex items-center space-x-2 text-xs text-[#94a3b8]">
              <FileText className="w-4 h-4 text-[#38bdf8]" />
              <span>Includes full audio replay & unbiased rubric breakdown</span>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-[#0b1329] hover:bg-[#131f3d] border border-[#334155] text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Share2 className="w-3.5 h-3.5 text-[#38bdf8]" />}
                <span>{copied ? 'Link Copied!' : 'Share Dossier'}</span>
              </button>

              <button className="flex-1 sm:flex-none px-5 py-2 rounded-full btn-primary-gradient text-xs font-bold text-white flex items-center justify-center space-x-1.5 shadow-md">
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Report</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
