import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Verify email — Progeni Atlas',
  description: 'Enter the one-time code sent to your email address.',
  robots: { index: false, follow: false },
};

/** Metadata-only layout with noindex — auth pages should never be indexed. */
export default function VerifyOtpLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
