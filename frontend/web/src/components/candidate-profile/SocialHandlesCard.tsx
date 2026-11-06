'use client';

import React from 'react';
import { Globe } from 'lucide-react';

export const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface SocialHandlesCardProps {
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SocialHandlesCard({
  githubUrl,
  linkedinUrl,
  portfolioUrl,
  onChange,
}: SocialHandlesCardProps) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-lg font-bold text-ink">Professional Handles & Portfolio</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* GitHub */}
        <div className="space-y-1.5">
          <label htmlFor="githubUrl" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <GithubIcon className="w-3.5 h-3.5 text-accent-cyan" />
            <span>GitHub Profile</span>
          </label>
          <input
            id="githubUrl"
            name="githubUrl"
            type="url"
            value={githubUrl}
            onChange={onChange}
            placeholder="Please enter your GitHub profile URL"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* LinkedIn */}
        <div className="space-y-1.5">
          <label htmlFor="linkedinUrl" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <LinkedinIcon className="w-3.5 h-3.5 text-accent-cyan" />
            <span>LinkedIn Profile</span>
          </label>
          <input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            value={linkedinUrl}
            onChange={onChange}
            placeholder="Please enter your LinkedIn profile URL"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Portfolio URL */}
        <div className="space-y-1.5">
          <label htmlFor="portfolioUrl" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <Globe className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Personal Website</span>
          </label>
          <input
            id="portfolioUrl"
            name="portfolioUrl"
            type="url"
            value={portfolioUrl}
            onChange={onChange}
            placeholder="Please enter your portfolio URL"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
