'use client';

import React from 'react';
import { PracticeCategory, DrillDifficulty } from '@/types/practice';
import { Search, Filter, Layers, Cpu, Database, MessageSquare, Code2 } from 'lucide-react';

interface PracticeFilterBarProps {
  selectedCategory: PracticeCategory;
  onSelectCategory: (cat: PracticeCategory) => void;
  selectedDifficulty: string;
  onSelectDifficulty: (diff: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalFilteredCount: number;
}

export const PracticeFilterBar: React.FC<PracticeFilterBarProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedDifficulty,
  onSelectDifficulty,
  searchQuery,
  onSearchChange,
  totalFilteredCount
}) => {
  const domains: { id: PracticeCategory; label: string }[] = [
    { id: 'ALL', label: 'All Topics' },
    { id: 'SYSTEM_DESIGN', label: 'System Architecture' },
    { id: 'DATA_STRUCTURES', label: 'Data Structures & Algorithms' },
    { id: 'DISTRIBUTED_SYSTEMS', label: 'Distributed Systems & Kafka' },
    { id: 'DATABASE_INTERNALS', label: 'Database Internals' },
    { id: 'BEHAVIORAL', label: 'Behavioral & Leadership' }
  ];

  const difficulties = [
    { id: 'ALL', label: 'All' },
    { id: 'BEGINNER', label: 'Beginner' },
    { id: 'INTERMEDIATE', label: 'Intermediate' },
    { id: 'ADVANCED', label: 'Advanced' }
  ];

  return (
    <div className="space-y-4">
      {/* Top Search & Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search drills by topic (e.g., B-Trees, Raft consensus, Saga Pattern)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Difficulty Segmented Pill & Active Count */}
        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            {difficulties.map((diff) => (
              <button
                key={diff.id}
                type="button"
                onClick={() => onSelectDifficulty(diff.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedDifficulty === diff.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {diff.label}
              </button>
            ))}
          </div>

          <span className="text-caption font-mono text-cyan-400 text-xs shrink-0">
            Showing {totalFilteredCount} active practice drills
          </span>
        </div>
      </div>

      {/* Domain Filter Pills (Horizontal Scrollable) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {domains.map((domain) => {
          const isActive = selectedCategory === domain.id;
          return (
            <button
              key={domain.id}
              type="button"
              onClick={() => onSelectCategory(domain.id)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              {domain.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
