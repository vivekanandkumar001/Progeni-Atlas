import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Careers — Progeni Atlas',
  description:
    'Open roles and life at Progeni Atlas. Apply to build the future of autonomous technical interviewing.',
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function CareerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
