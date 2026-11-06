import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Create account — Progeni Atlas',
  description: 'Create a Progeni Atlas account as a candidate or recruiter.',
  robots: { index: false, follow: false },
};

/** Metadata-only layout with noindex — auth pages should never be indexed. */
export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
