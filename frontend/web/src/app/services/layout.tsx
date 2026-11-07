import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Services & Technical Tracks',
  description:
    'AI-led interviews, automated multi-language coding evaluations, multi-signal anti-cheat proctoring, and calibrated recruiter dossiers.',
  alternates: {
    canonical: 'https://atlas.progeni.live/services',
  },
  openGraph: {
    title: 'Services & Technical Tracks — Progeni Atlas',
    description:
      'AI-led interviews, automated multi-language coding evaluations, multi-signal anti-cheat proctoring, and calibrated recruiter dossiers.',
    url: 'https://atlas.progeni.live/services',
  },
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function ServicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
