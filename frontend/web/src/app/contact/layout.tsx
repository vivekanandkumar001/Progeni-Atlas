import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Contact — Progeni Atlas',
  description: 'Get in touch with the Progeni Atlas team about demos, partnerships or support.',
};

/** Metadata-only layout — see about/layout.tsx for rationale. */
export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
