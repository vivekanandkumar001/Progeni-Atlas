'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface AccountSecurityCardProps {
  email: string;
  emailVerified: boolean;
}

export function AccountSecurityCard({ email, emailVerified }: AccountSecurityCardProps) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-4 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-base font-bold text-ink">Account Security</h2>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-ink">Email Verification</p>
          <p className="text-[11px] text-ink-muted">{email || 'No account signed in'}</p>
        </div>
        <span
          className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
            emailVerified
              ? 'text-accent-emerald bg-emerald-500/10 border-emerald-500/20'
              : 'text-accent-amber bg-amber-500/10 border-amber-500/20'
          }`}
        >
          {emailVerified ? 'VERIFIED' : 'UNVERIFIED'}
        </span>
      </div>

      <p className="text-[11px] text-ink-muted border-t border-line pt-3">
        Two-factor authentication is not available yet.
      </p>
    </div>
  );
}
