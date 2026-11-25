import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Interview Report',
};

/**
 * Metadata-only layout for the client-rendered report page. The candidate
 * layout supplies the shared `| Progeni Atlas` suffix and noindex directive.
 */
export default function InterviewReportLayout({ children }: { children: ReactNode }) {
  return children;
}
