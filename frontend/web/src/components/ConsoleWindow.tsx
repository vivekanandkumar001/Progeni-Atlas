'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { VideoStreamMockup } from './VideoStreamMockup';
import { TelemetryCard } from './TelemetryCard';

export const ConsoleWindow: React.FC = () => {
  return (
    <section id="live-demo" className="w-full px-4 sm:px-6 py-6 flex justify-center z-10 scroll-mt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="w-full max-w-5xl rounded-2xl bg-[#080e21] border border-[#1e293b] shadow-[0_0_50px_rgba(56,189,248,0.12)] overflow-hidden"
      >
        {/* Window Header */}
        <div className="px-5 py-3 bg-[#050917] border-b border-[#1e293b] flex items-center justify-between">
          {/* MacOS Terminal Controls */}
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
          </div>

          {/* Centered Monospace Tag */}
          <div className="text-xs font-mono font-medium text-[#38bdf8] tracking-wider text-center">
            INTERACTIVE AI VIDEO INTERVIEW ROOM // LIVE PREVIEW
          </div>

          <div className="w-10" />
        </div>

        {/* Split-Screen Content Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 bg-[#060b1b]">
          {/* Left Column: Candidate Video Feed (~65% width) */}
          <div className="md:col-span-7 flex flex-col justify-center">
            <VideoStreamMockup />
          </div>

          {/* Right Column: Recruiter Instant Scorecard (~35% width) */}
          <div className="md:col-span-5">
            <TelemetryCard />
          </div>
        </div>
      </motion.div>
    </section>
  );
};
