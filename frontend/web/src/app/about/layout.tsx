import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'About',
  description:
    'The team and mission behind Progeni Atlas: pioneering autonomous technical interviews and objective skills evaluation intelligence.',
  alternates: {
    canonical: 'https://atlas.progeni.live/about',
  },
  openGraph: {
    title: 'About — Progeni Atlas',
    description:
      'The team and mission behind Progeni Atlas: pioneering autonomous technical interviews and objective skills evaluation intelligence.',
    url: 'https://atlas.progeni.live/about',
  },
};

/**
 * Metadata-only layout. `/about` renders a Client Component page, and client
 * components cannot export `metadata`, so SEO fields live in this server
 * layout instead (Next 16 metadata docs).
 */
export default function AboutLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
