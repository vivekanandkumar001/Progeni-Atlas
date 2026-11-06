import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Portfolio — Progeni Atlas',
  description: 'Showcase of assessment templates, interview blueprints and success stories from Progeni Atlas.',
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
