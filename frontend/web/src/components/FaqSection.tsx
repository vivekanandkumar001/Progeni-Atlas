'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'Is the AI evaluation unbiased?',
      answer: 'Yes, 100%. Every candidate receives standardized scoring based strictly on merit and technical competency rubrics. The system removes subconscious human biases regarding accents, background, or timing.',
    },
    {
      question: 'Can candidates use a smartphone?',
      answer: 'Absolutely. Candidates can complete their video interviews on any modern smartphone, tablet, or laptop browser without installing any software or extensions.',
    },
    {
      question: 'How does anti-cheating work?',
      answer: 'TalentPulse AI uses non-intrusive trust indicators including gaze alignment verification, single-voice detection, and tab-focus monitoring to ensure authentic performance without spyware.',
    },
    {
      question: 'Can we customize the questions?',
      answer: 'Yes. Hiring teams can upload their own job descriptions, select specific tech stacks, or define exact question sets and passing rubrics.',
    },
  ];

  return (
    <section id="faq" className="w-full py-16 px-6 bg-[#020617] relative z-10 scroll-mt-20 border-t border-[#1e293b]/40">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-sans font-bold text-[#38bdf8] uppercase tracking-wider block mb-2">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Got Questions? We Have Answers
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-xl bg-[#080e21] border border-[#1e293b] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-4 text-left flex items-center justify-between font-semibold text-white text-sm hover:text-[#38bdf8] transition-colors"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#38bdf8] transition-transform duration-300 ${
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
                      className="px-4 pb-4 text-xs text-[#94a3b8] leading-relaxed font-normal"
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
