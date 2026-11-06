import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'Candidate Portal',
    template: '%s — Progeni Atlas',
  },
  description:
    'Take AI-led technical interviews, run practice drills and review your skill reports on Progeni Atlas.',
  robots: { index: false, follow: false },
};

/**
 * Candidate section layout. The pages in this tree are Client Components and
 * cannot export `metadata`, so the section-level SEO defaults live here
 * (per the Next 16 metadata docs, `metadata` is exported from server
 * layouts). Individual pages that need their own title add a sibling
 * metadata-only layout deeper in the tree.
 */
export default function CandidateLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
