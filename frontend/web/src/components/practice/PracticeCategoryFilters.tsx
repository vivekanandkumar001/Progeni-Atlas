'use client';

import React from 'react';
import { PracticeCategory, DrillDifficulty } from '@/types/practice';
import { Search, Filter, Layers, Cpu, Database, MessageSquare, Code2 } from 'lucide-react';

interface PracticeCategoryFiltersProps {
  selectedCategory: PracticeCategory;
  onSelectCategory: (category: PracticeCategory) => void;
  selectedDifficulty: string;
  onSelectDifficulty: (difficulty: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const PracticeCategoryFilters: React.FC<PracticeCategoryFiltersProps> = ({
  selectedCategory,
  onSelectCategory,
  selectedDifficulty,
  onSelectDifficulty,
  searchQuery,
  onSearchChange
}) => {
  const categories: { id: PracticeCategory; label: string; icon: React.ElementType }[] = [
    { id: 'ALL', label: 'All Categories', icon: Layers },
    { id: 'SYSTEM_DESIGN', label: 'System Design', icon: Layers },
    { id: 'DATA_STRUCTURES', label: 'Data Structures & Algorithms', icon: Code2 },
    { id: 'DISTRIBUTED_SYSTEMS', label: 'Distributed Systems & Kafka', icon: Cpu },
    { id: 'DATABASE_INTERNALS', label: 'Database Internals', icon: Database },
    { id: 'BEHAVIORAL', label: 'Behavioral & Leadership', icon: MessageSquare }
  ];

  return (
    <div className="space-y-4">
      {/* Search and Difficulty Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search drills by topic or keyword..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Difficulty Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedDifficulty}
            onChange={(e) => onSelectDifficulty(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="ALL">All Difficulties</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-md shadow-cyan-500/10'
                  : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
