'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';

/**
 * Server-truth role gate for section trees (candidate / recruiter).
 * Renders NOTHING until /api/auth/me confirms the caller's role — the proxy's
 * edge redirect is only a UX hint, this is the authoritative client-side gate.
 * (The backend independently enforces role on every API request.)
 */
export default function RoleGate({ allow, children }: { allow: string[]; children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiJson<{ role?: string; user?: { role?: string } } | null>(
          '/api/auth/me',
          {},
          { skipCache: true },
        );
        const role = String(me?.user?.role || me?.role || '').toLowerCase().trim();
        if (cancelled) return;
        if (me && role && allow.includes(role)) {
          setState('allowed');
          return;
        }
        setState('denied');
      } catch {
        if (!cancelled) setState('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
    // allow is a static literal from the server layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== 'denied') return;
    void (async () => {
      const me = await apiJson<{ role?: string; user?: { role?: string } } | null>(
        '/api/auth/me',
        {},
        { skipCache: true },
      );
      const role = String(me?.user?.role || me?.role || '').toLowerCase().trim();
      const target =
        role === 'super_admin' ? '/super-admin'
        : role === 'recruiter' || role === 'admin' || role === 'hr' || role === 'employer' ? '/recruiter/dashboard'
        : role === 'candidate' ? '/candidate/dashboard'
        : '/login?error=session_expired';
      router.replace(target);
    })().catch(() => router.replace('/login?error=session_expired'));
  }, [state, router]);

  if (state !== 'allowed') {
    return <div className="min-h-screen bg-canvas" aria-busy="true" />;
  }
  return <>{children}</>;
}
