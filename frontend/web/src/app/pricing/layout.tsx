import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Pricing — Progeni Atlas',
  description:
    'Simple, transparent pricing for AI technical interviews, recruiter workspaces and enterprise assessment volumes.',
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
