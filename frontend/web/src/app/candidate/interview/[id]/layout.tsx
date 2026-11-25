import type { ReactNode } from 'react';

/**
 * Interview media must only be provisioned by the lobby and live room. Keeping
 * the provider here would also mount it on the passive report page and mint a
 * LiveKit token for a completed session.
 */
export default function CandidateInterviewLayout({ children }: { children: ReactNode }) {
  return children;
}
