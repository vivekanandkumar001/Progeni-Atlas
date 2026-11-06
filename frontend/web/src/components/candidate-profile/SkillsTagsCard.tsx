'use client';

import React, { useState } from 'react';
import { Sparkles, Plus, X } from 'lucide-react';

interface SkillsTagsCardProps {
  skills: string[];
  suggestedSkills: string[];
  saving: boolean;
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
}

export function SkillsTagsCard({
  skills,
  suggestedSkills,
  saving,
  onAddSkill,
  onRemoveSkill,
}: SkillsTagsCardProps) {
  const [newSkillInput, setNewSkillInput] = useState('');

  const validSkills = Array.isArray(skills)
    ? Array.from(
        new Set(
          skills
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter((s): s is string => s.length > 0)
        )
      )
    : [];

  const handleAdd = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    onAddSkill(trimmed);
    setNewSkillInput('');
  };

  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-lg font-bold text-ink">Verified Technical Skills & Tags</h2>
        </div>
        <span className="text-xs text-accent-cyan font-mono">
          {validSkills.length} Active Skills
        </span>
      </div>

      {/* Active Skill Pills */}
      {validSkills.length === 0 ? (
        <p className="text-xs text-ink-muted">
          No skills saved yet. Add your technical skills below — they are stored on your
          candidate record and power the competency matrix.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {validSkills.map((skill, index) => (
            <span
              key={`${skill}-${index}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan text-xs font-medium shadow-sm transition-all hover:bg-cyan-500/20"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => onRemoveSkill(skill)}
                className="text-accent-cyan hover:text-accent-rose transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add Custom Skill Input */}
      <div className="flex items-center gap-2 pt-2">
        <input
          type="text"
          placeholder="Please enter a new skill (e.g. GraphQL, TailwindCSS)..."
          value={newSkillInput}
          onChange={(e) => setNewSkillInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd(newSkillInput);
            }
          }}
          className="flex-1 px-3.5 py-2 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
        />
        <button
          type="button"
          onClick={() => handleAdd(newSkillInput)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Add Skill</span>
        </button>
      </div>

      {/* Resume-derived skill suggestions */}
      {suggestedSkills && suggestedSkills.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs text-ink-muted font-mono">Suggested from your parsed resume:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedSkills
              .map((s) => (typeof s === 'string' ? s.trim() : ''))
              .filter(
                (s): s is string =>
                  s.length > 0 &&
                  !validSkills.some((existing) => existing.toLowerCase() === s.toLowerCase())
              )
              .map((suggestion, index) => (
                <button
                  key={`suggestion-${suggestion}-${index}`}
                  type="button"
                  onClick={() => handleAdd(suggestion)}
                  className="px-2.5 py-1 rounded-lg bg-inset/80 border border-line text-ink-muted hover:text-accent-cyan hover:border-line-strong text-xs transition-colors cursor-pointer"
                >
                  + {suggestion}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
