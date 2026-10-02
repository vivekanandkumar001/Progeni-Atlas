"use me";
import React from 'react';
import { Target, Play, Clock, Sparkles } from 'lucide-react';

interface PracticeDrill {
  id: string;
  title: string;
  tag: string;
  difficulty: string;
  duration: string;
}

const drills: PracticeDrill[] = [
  {
    id: '1',
    title: 'Kafka Partitioning & Rebalance Protocol',
    tag: 'Intermediate',
    difficulty: 'Tech Stack Focus',
    duration: '12 mins',
  },
  {
    id: '2',
    title: 'Concurrency & Thread-Safety in High-Throughput APIs',
    tag: 'Advanced',
    difficulty: 'Backend Systems',
    duration: '10 mins',
  },
  {
    id: '3',
    title: 'Behavioral: Handling Conflicting Project Priorities',
    tag: 'Soft Skills',
    difficulty: 'Leadership & Comms',
    duration: '8 mins',
  },
];

export const PracticeDrillList: React.FC = () => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-heading text-xl text-slate-100 font-bold">
                Targeted Practice Sessions
              </h3>
              <p className="text-body text-xs text-slate-400">
                10-minute micro-interviews to strengthen weak spots
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-caption text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> AI Tailored
          </span>
        </div>

        <div className="space-y-3 mt-4">
          {drills.map((drill) => (
            <div
              key={drill.id}
              className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-caption text-xs font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                    {drill.duration} • {drill.tag}
                  </span>
                </div>
                <h4 className="text-body font-medium text-slate-200 group-hover:text-cyan-300 transition-colors truncate">
                  {drill.title}
                </h4>
              </div>

              <button
                type="button"
                className="shrink-0 inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
                <span>Practice Topic</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800/60 text-center">
        <p className="text-caption text-slate-400 text-xs">
          New micro-drills generated daily based on your interview speech and code patterns.
        </p>
      </div>
    </div>
  );
};
