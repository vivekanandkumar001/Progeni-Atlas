'use client';

import React from 'react';
import Link from 'next/link';

export default function CandidateOnboardingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white p-8 flex flex-col items-center justify-center">
      <div className="max-w-md text-center p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center mx-auto text-xl font-bold">
          ✓
        </div>
        <h1 className="text-2xl font-bold">Candidate Account Ready!</h1>
        <p className="text-xs text-slate-400">
          Your profile has been created successfully. You can now start your practice interview or join an invited role session.
        </p>
        <Link
          href="/candidate/dashboard"
          className="inline-block px-6 py-2.5 rounded-full btn-primary-gradient text-xs font-bold text-white shadow-lg"
        >
          Start Practice Interview →
        </Link>
      </div>
    </div>
  );
}
