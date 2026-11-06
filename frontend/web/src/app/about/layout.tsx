import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'About — Progeni Atlas',
  description:
    'The team and mission behind Progeni Atlas, the autonomous technical interviewing and skills assessment platform.',
};

/**
 * Metadata-only layout. `/about` renders a Client Component page, and client
 * components cannot export `metadata`, so SEO fields live in this server
 * layout instead (Next 16 metadata docs).
 */
export default function AboutLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
