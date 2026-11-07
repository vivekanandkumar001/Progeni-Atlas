'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'What is Progeni Atlas?',
      answer: 'Progeni Atlas is an enterprise-grade autonomous AI technical interview and skills assessment platform. It conducts live two-way voice interviews, multi-language coding assessments in a secure browser sandbox, enforces anti-cheat proctoring, and automatically generates calibrated recruiter scoring dossiers.',
    },
    {
      question: 'How does autonomous AI technical interviewing work?',
      answer: 'Candidates join through a web link with zero software installation. An autonomous AI interviewer engages the candidate in live adaptive dialogue, poses real-world coding problems, executes code in a secure cloud sandbox, and generates an evidence-linked evaluation report across technical depth, problem-solving, and architecture.',
    },
    {
      question: 'How does Progeni Atlas prevent AI cheating and unauthorized assistance?',
      answer: 'Progeni Atlas utilizes a multi-layered anti-cheat framework including companion smartphone camera pairing for 360-degree room proctoring, gaze alignment verification, single-voice biometric tracking, and copy-paste telemetry without requiring intrusive surveillance software.',
    },
    {
      question: 'What is the pricing model for Progeni Atlas technical interviews?',
      answer: 'Progeni Atlas uses a transparent duration-based billing convention where ₹1.00 equals 1 Credit. Screening is billed strictly at 1 Credit per 3 minutes of interview time (₹0.33 per minute). Every newly registered organization receives 2 complimentary demo screenings of up to 10 minutes each.',
    },
    {
      question: 'Which engineering roles and technical tracks are supported?',
      answer: 'Progeni Atlas supports Full-Stack Development, Backend Systems Engineering, Frontend Architecture, DevOps & Site Reliability Engineering (SRE), Machine Learning Engineering, System Design, and Data Structures & Algorithms.',
    },
    {
      question: 'Can recruiters integrate Progeni Atlas with enterprise ATS platforms?',
      answer: 'Yes. Progeni Atlas provides native webhook and API integrations with enterprise Applicant Tracking Systems (ATS) including Greenhouse, Workday, and Lever, automatically synchronizing candidate invites and hiring dossiers.',
    },
  ];

  return (
    <section id="faq" className="w-full py-16 px-6 bg-surface-deep relative z-10 scroll-mt-20 border-t border-line">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-sans font-bold text-accent-cyan uppercase tracking-wider block mb-2">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Got Questions? We Have Answers
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-xl bg-surface border border-line overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between font-semibold text-ink text-sm hover:text-accent-cyan transition-colors"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-accent-cyan transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-4 pb-4 text-xs text-ink-muted leading-relaxed font-normal"
                    >
                      {faq.answer}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
