import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Pricing & Rate Cards',
  description:
    'Simple, transparent duration-based billing for AI technical interviews. ₹1 = 1 Credit, billed at 1 Credit per 3 minutes with 2 free trial demo screenings.',
  alternates: {
    canonical: 'https://atlas.progeni.live/pricing',
  },
  openGraph: {
    title: 'Pricing & Rate Cards — Progeni Atlas',
    description:
      'Simple, transparent duration-based billing for AI technical interviews. ₹1 = 1 Credit, billed at 1 Credit per 3 minutes with 2 free trial demo screenings.',
    url: 'https://atlas.progeni.live/pricing',
  },
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
