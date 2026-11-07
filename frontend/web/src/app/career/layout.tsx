import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Join Progeni Atlas to pioneer the future of autonomous AI technical interviewing and skills assessment intelligence.',
  alternates: {
    canonical: 'https://atlas.progeni.live/career',
  },
  openGraph: {
    title: 'Careers — Progeni Atlas',
    description:
      'Join Progeni Atlas to pioneer the future of autonomous AI technical interviewing and skills assessment intelligence.',
    url: 'https://atlas.progeni.live/career',
  },
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function CareerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
