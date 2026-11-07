'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, CheckCircle } from 'lucide-react';

export const TrustStrip: React.FC = () => {
  return (
    <footer className="w-full py-10 px-6 border-t border-line bg-surface-deep">
      <motion.div
        initial={{ opacity: 1 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 text-center"
      >
        <span className="text-xs font-sans font-bold tracking-wider text-ink-2 uppercase">
          PLATFORM ARCHITECTURE &amp; DATA PRIVACY:
        </span>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-sans text-ink-muted">
          <span className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-surface border border-line-strong">
            <Shield className="w-3.5 h-3.5 text-accent-cyan" />
            <span className="text-ink font-medium">SSL / TLS 1.3 Transport</span>
          </span>

          <span className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-surface border border-line-strong">
            <Lock className="w-3.5 h-3.5 text-accent-emerald" />
            <span className="text-ink font-medium">Encrypted Live Audio</span>
          </span>

          <span className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-surface border border-line-strong">
            <CheckCircle className="w-3.5 h-3.5 text-accent-indigo" />
            <span className="text-ink font-medium">Objective Rubric Evaluation</span>
          </span>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto mt-6 pt-6 border-t border-line text-center text-xs text-ink-muted">
        © 2026 Progeni Atlas. All rights reserved. Autonomous AI Video Interviewing Platform.
      </div>
    </footer>
  );
};
