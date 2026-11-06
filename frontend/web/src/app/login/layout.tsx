import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Sign in — Progeni Atlas',
  description: 'Sign in to your Progeni Atlas account.',
  robots: { index: false, follow: false },
};

/** Metadata-only layout with noindex — auth pages should never be indexed. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
