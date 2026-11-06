import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Team invitation — Progeni Atlas',
  description: 'Accept an invitation to join an organization on Progeni Atlas.',
  robots: { index: false, follow: false },
};

/** Metadata-only layout with noindex — invitation tokens must not be indexed. */
export default function TeamInviteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
