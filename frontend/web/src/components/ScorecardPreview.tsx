'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Check, FileText } from 'lucide-react';

export const ScorecardPreview: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Progeni Atlas Candidate Dossier', url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // User cancelled native share; keep the UI stable.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <section id="scorecard" className="w-full py-16 px-6 bg-surface-deep relative z-10 scroll-mt-20 border-t border-line">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-sans font-bold text-accent-indigo uppercase tracking-wider block mb-2">
            AUDIT-READY CANDIDATE DOSSIER
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Comprehensive Candidate Performance Reports
          </h2>
          <p className="text-sm text-ink-muted mt-2 max-w-xl mx-auto font-normal">
            Clear, verifiable insights with exact candidate quotes, timestamps, and objective competency scoring.
          </p>
        </div>

        {/* Interactive Scorecard Preview Card */}
        <motion.div
          initial={{ opacity: 1, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="p-6 sm:p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-6"
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-line gap-4">
            <div>
              <span className="text-xs font-mono text-accent-cyan block">REPORT PREVIEW</span>
              <h3 className="text-xl font-bold text-ink">Evidence-linked candidate dossier</h3>
              <p className="text-xs text-ink-muted">Candidate, role and completion data are loaded from the real interview record.</p>
            </div>

            {/* Match Badge */}
            <div className="flex items-center space-x-3 bg-surface-deep px-4 py-2.5 rounded-xl border border-[#10b981]/40">
              <span className="text-sm font-extrabold text-accent-cyan">Generated after interview</span>
              <div className="text-left">
                <span className="text-xs font-bold text-ink block">Server-authoritative score</span>
                <span className="text-[10px] text-ink-muted font-medium">Recommendation follows the approved rubric</span>
              </div>
            </div>
          </div>

          {/* Quoted Answer with Timestamp */}
          <div className="p-4 rounded-xl bg-surface-deep border border-line space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
              <span>VERBATIM TRANSCRIPT</span>
              <span className="text-accent-cyan">From completed interview</span>
            </div>
            <p className="text-xs sm:text-sm text-ink font-medium italic">
              {"Actual candidate answer is displayed here after the interview is completed and persisted."}
            </p>
            <div className="flex items-center space-x-2 pt-1 text-[11px] font-mono text-accent-emerald">
              <span>✓ Evidence-linked</span>
              <span>•</span>
              <span>✓ Rubric-linked</span>
            </div>
          </div>

          {/* Action Bar: Download PDF & Share Link */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-4">
            <div className="flex items-center space-x-2 text-xs text-ink-muted">
              <FileText className="w-4 h-4 text-accent-cyan" />
              <span>Includes full audio replay & unbiased rubric breakdown</span>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleCopyLink}
                className="flex-1 sm:flex-none px-4 py-2 rounded-full bg-surface hover:bg-surface-3 border border-line-strong text-xs font-semibold text-ink flex items-center justify-center space-x-1.5 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-accent-emerald" /> : <Share2 className="w-3.5 h-3.5 text-accent-cyan" />}
                <span>{copied ? 'Link Copied!' : 'Share Dossier'}</span>
              </button>

              <button onClick={handleDownloadPdf} className="flex-1 sm:flex-none px-5 py-2 rounded-full btn-primary-gradient text-xs font-bold text-on-brand flex items-center justify-center space-x-1.5 shadow-md">
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
