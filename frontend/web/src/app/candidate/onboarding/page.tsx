'use client';

import React from 'react';
import Link from 'next/link';

export default function CandidateOnboardingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink p-8 flex flex-col items-center justify-center">
      <div className="max-w-md text-center p-8 rounded-2xl bg-surface border border-line shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#38bdf8]/20 text-accent-cyan flex items-center justify-center mx-auto text-xl font-bold">
          ✓
        </div>
        <h1 className="text-2xl font-bold">Candidate Account Ready!</h1>
        <p className="text-xs text-ink-muted">
          Your profile has been created successfully. You can now start your practice interview or join an invited role session.
        </p>
        <Link
          href="/candidate/dashboard"
          className="inline-block px-6 py-2.5 rounded-full btn-primary-gradient text-xs font-bold text-on-brand shadow-lg"
        >
          Start Practice Interview →
        </Link>
      </div>
    </div>
  );
}
