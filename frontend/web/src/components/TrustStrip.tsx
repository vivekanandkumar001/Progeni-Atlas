'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, CheckCircle } from 'lucide-react';

export const TrustStrip: React.FC = () => {
  return (
    <footer className="w-full py-10 px-6 border-t border-[#1e293b]/50 bg-[#020617]">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 text-center"
      >
        <span className="text-xs font-sans font-bold tracking-wider text-[#475569] uppercase">
          ENTERPRISE TRUST & SECURITY:
        </span>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-sans text-[#94a3b8]">
          <span className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#0b1329] border border-[#334155]/60">
            <Shield className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span className="text-white font-medium">GDPR Compliant</span>
          </span>

          <span className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#0b1329] border border-[#334155]/60">
            <Lock className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="text-white font-medium">Bank-Grade Encryption</span>
          </span>

          <span className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#0b1329] border border-[#334155]/60">
            <CheckCircle className="w-3.5 h-3.5 text-[#818cf8]" />
            <span className="text-white font-medium">Fair AI Certified</span>
          </span>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto mt-6 pt-6 border-t border-[#1e293b]/30 text-center text-xs text-[#64748b]">
        © 2026 TalentPulse.AI. All rights reserved. Autonomous AI Video Interviewing Platform.
      </div>
    </footer>
  );
};
