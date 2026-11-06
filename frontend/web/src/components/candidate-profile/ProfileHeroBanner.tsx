'use client';

import React from 'react';
import { Building2, Save, RefreshCw, ShieldCheck } from 'lucide-react';
import { initialsOf } from '@/lib/api';
import { LOADING_PROFILE } from '@/constants/ui_strings';
import type { CandidateProfileData } from '@/lib/hooks/useCandidateProfileData';

interface ProfileHeroBannerProps {
  profile: CandidateProfileData;
  loading: boolean;
  emailVerified: boolean;
  loadError: string | null;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
}

export function ProfileHeroBanner({
  profile,
  loading,
  emailVerified,
  loadError,
  saving,
  onSave,
}: ProfileHeroBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-surface via-surface to-indigo-950/40 border border-line p-6 sm:p-8 backdrop-blur-md shadow-2xl">
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
          {/* Avatar Circle */}
          <div className="relative group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 p-1 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-inset rounded-[14px] flex items-center justify-center font-bold text-ink text-2xl sm:text-3xl">
                {initialsOf(profile.fullName)}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-slate-950 p-1 rounded-full border-2 border-surface">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>

          {/* Title & Tag Details */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                {profile.fullName || 'Candidate Profile'}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan">
                {loading && !profile.email
                  ? LOADING_PROFILE
                  : profile.email
                    ? emailVerified
                      ? 'Verified Candidate'
                      : 'Unverified Candidate'
                    : loadError
                      ? 'Profile unavailable'
                      : 'Not signed in'}
              </span>
            </div>
            <p className="text-ink-muted text-sm mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-ink font-medium">
                {profile.course} • {profile.branch}
              </span>
              <span className="text-ink-faint">•</span>
              <span className="text-accent-cyan font-mono text-xs">{profile.academicYear}</span>
            </p>
            <p className="text-ink-muted text-xs mt-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-ink-muted" />
              <span>{profile.collegeName}</span>
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
