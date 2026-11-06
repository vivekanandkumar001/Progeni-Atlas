'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const TelemetryCard: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4 }}
    className="p-4 sm:p-5 rounded-xl bg-surface-deep border border-line flex flex-col justify-between h-full shadow-sm"
  >
    <div>
      <div className="flex items-center space-x-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-accent-cyan" />
        <span className="text-xs font-sans font-bold tracking-wider text-accent-cyan uppercase">
          Recruiter Scorecard
        </span>
      </div>
      <h3 className="text-sm sm:text-base font-bold text-ink mb-2">Live competency assessment</h3>
      <p className="text-xs leading-5 text-ink-muted">
        Competency scores and recommendations appear here after a completed interview. No placeholder candidate data is shown.
      </p>
    </div>
  </motion.div>
);
