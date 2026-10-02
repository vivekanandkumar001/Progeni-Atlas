'use client';

import React from 'react';
import { Cpu, Layers, Code2, MessageSquare } from 'lucide-react';

interface CompetencyPillarsGridProps {
  pillars: {
    algorithmicProblemSolving: number;
    systemArchitecture: number;
    codeQualityAndSyntax: number;
    communicationAndClarity: number;
  };
}

export const CompetencyPillarsGrid: React.FC<CompetencyPillarsGridProps> = ({ pillars }) => {
  const pillarList = [
    {
      name: 'Algorithmic Problem Solving',
      score: pillars.algorithmicProblemSolving || 88,
      barColor: 'from-cyan-500 to-indigo-400',
      textColor: 'text-cyan-400',
      icon: Cpu,
      subtext: 'Strong edge-case detection and asymptotic analysis.'
    },
    {
      name: 'System Architecture & Design',
      score: pillars.systemArchitecture || 92,
      barColor: 'from-emerald-500 to-cyan-400',
      textColor: 'text-emerald-400',
      icon: Layers,
      subtext: 'Exceptional understanding of event streaming and data caching.'
    },
    {
      name: 'Code Syntax & Best Practices',
      score: pillars.codeQualityAndSyntax || 84,
      barColor: 'from-indigo-500 to-purple-400',
      textColor: 'text-indigo-400',
      icon: Code2,
      subtext: 'Clean modularity, readable naming conventions, and error handling.'
    },
    {
      name: 'Communication & Articulation',
      score: pillars.communicationAndClarity || 90,
      barColor: 'from-sky-400 to-cyan-400',
      textColor: 'text-sky-400',
      icon: MessageSquare,
      subtext: 'Structured thought process with minimal conversational latency.'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {pillarList.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.name}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 backdrop-blur-md hover:border-slate-700 transition-all shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${item.textColor}`} />
                <span className="text-xs font-semibold text-slate-200">{item.name}</span>
              </div>
              <span className={`font-mono font-bold text-sm ${item.textColor}`}>{item.score}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800/80 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${item.barColor} transition-all duration-500`}
                style={{ width: `${item.score}%` }}
              ></div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
              {item.subtext}
            </p>
          </div>
        );
      })}
    </div>
  );
};
