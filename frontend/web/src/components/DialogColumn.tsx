'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const DialogColumn: React.FC = () => {
  return (
    <div className="flex flex-col space-y-4 w-full">
      {/* 1. Interviewer Agent Bubble */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="p-4 rounded-xl bg-[#0a1128]/95 border border-[#1e293b] shadow-sm"
      >
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-xs font-mono font-bold tracking-wider text-[#38bdf8] uppercase">
            🤖 INTERVIEWER AGENT (LLAMA 3.3)
          </span>
        </div>
        <p className="text-xs sm:text-sm font-normal text-[#e2e8f0] leading-relaxed">
          "Explain how Kafka handles consumer partition rebalancing without causing full stop-the-world pipeline latency."
        </p>
      </motion.div>

      {/* 2. Candidate Audio Stream Bubble */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="p-4 rounded-xl bg-[#0a1128]/95 border border-[#1e293b] shadow-sm relative"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-bold tracking-wider text-[#38bdf8] uppercase">
            👤 CANDIDATE AUDIO STREAM [TRANSCRIPTION]
          </span>
        </div>

        <p className="text-xs sm:text-sm font-normal text-[#e2e8f0] leading-relaxed mb-3">
          "We use Cooperative Sticky Assignors to reassign only revoked partitions instead of eager global stops..."
        </p>

        {/* Audio Waveform & Latency Sub-badge */}
        <div className="flex items-center space-x-2 text-xs font-mono text-[#38bdf8]">
          <div className="flex items-center space-x-1 h-3.5">
            {[0.5, 1.2, 0.4, 1.5, 0.7, 1.1].map((scaleFactor, index) => (
              <motion.span
                key={index}
                animate={{
                  scaleY: [0.3, scaleFactor, 0.3],
                }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  delay: index * 0.1,
                }}
                className="w-1 bg-[#38bdf8] rounded-full h-full origin-bottom"
              />
            ))}
          </div>
          <span className="font-semibold text-[11px] tracking-wide">MIC ACTIVE • 18ms LATENCY</span>
        </div>
      </motion.div>

      {/* 3. Adaptive Follow-up Queued Box */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="p-4 rounded-xl bg-[#030712] border border-dashed border-[#0ea5e9]/70"
      >
        <div className="flex items-center space-x-2 mb-1.5">
          <span className="text-xs font-mono font-bold tracking-wider text-[#0ea5e9] uppercase">
            ⚡ ADAPTIVE FOLLOW-UP QUEUED
          </span>
        </div>
        <p className="text-xs font-mono text-[#94a3b8] leading-relaxed">
          "How do you safeguard against partition assignment split-brain?"
        </p>
      </motion.div>
    </div>
  );
};
