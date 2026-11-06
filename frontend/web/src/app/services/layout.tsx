import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Services — Progeni Atlas',
  description:
    'AI-led interviews, automated coding evaluations, multi-signal proctoring and recruiter decision intelligence.',
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function ServicesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
