import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'Recruiter Workspace',
    template: '%s — Progeni Atlas',
  },
  description:
    'Manage jobs, candidate dossiers, rubrics, live interviews and billing on Progeni Atlas.',
  robots: { index: false, follow: false },
};

/**
 * Recruiter section layout — metadata defaults for a tree of Client
 * Component pages that cannot export `metadata` themselves. See
 * candidate/layout.tsx for the same pattern.
 */
export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
