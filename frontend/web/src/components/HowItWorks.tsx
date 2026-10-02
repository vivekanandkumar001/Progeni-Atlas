'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Upload, Video, FileText } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Upload Role or Resume',
      description: 'Paste the job requirements or attach your CV to generate custom screening questions.',
      icon: Upload,
      color: 'text-[#38bdf8]',
      borderColor: 'border-[#38bdf8]/40',
    },
    {
      step: '02',
      title: 'Take 1-on-1 Video Interview',
      description: 'No scheduling conflicts; candidates take the natural video interview anytime from laptop or phone.',
      icon: Video,
      color: 'text-[#10b981]',
      borderColor: 'border-[#10b981]/40',
    },
    {
      step: '03',
      title: 'Instant Transparent Scorecard',
      description: 'Recruiters get a detailed competency report, direct video replays, and hiring verdicts within seconds.',
      icon: FileText,
      color: 'text-[#818cf8]',
      borderColor: 'border-[#818cf8]/40',
    },
  ];

  return (
    <section id="how-it-works" className="w-full py-16 px-6 bg-[#020617]/80 relative z-10 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-sans font-bold text-[#38bdf8] uppercase tracking-wider block mb-2">
            3-STEP VISUAL GUIDE
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            How TalentPulse AI Works
          </h2>
          <p className="text-sm text-[#94a3b8] mt-2 max-w-xl mx-auto font-normal">
            Streamline your technical screening from candidate invitation to final decision without extra overhead.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                viewport={{ once: true }}
                className={`p-6 rounded-2xl bg-[#091126] border ${item.borderColor} shadow-lg relative flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#020617] flex items-center justify-center border border-slate-700/50">
                      <IconComponent className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <span className="text-2xl font-extrabold text-slate-700 font-mono">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
