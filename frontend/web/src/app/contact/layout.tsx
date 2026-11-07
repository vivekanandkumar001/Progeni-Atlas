import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with the Progeni Atlas engineering & sales team for enterprise pilots, custom ATS integrations, or platform support.',
  alternates: {
    canonical: 'https://atlas.progeni.live/contact',
  },
  openGraph: {
    title: 'Contact Us — Progeni Atlas',
    description:
      'Get in touch with the Progeni Atlas engineering & sales team for enterprise pilots, custom ATS integrations, or platform support.',
    url: 'https://atlas.progeni.live/contact',
  },
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
