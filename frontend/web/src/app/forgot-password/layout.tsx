import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Reset password — Progeni Atlas',
  description: 'Reset the password for your Progeni Atlas account.',
  robots: { index: false, follow: false },
};

/** Metadata-only layout with noindex — auth pages should never be indexed. */
export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
