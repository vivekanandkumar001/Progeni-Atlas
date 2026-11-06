'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/**
 * Root App Router error boundary.
 *
 * Catches render/runtime errors in any route below the root layout so a single
 * failure does not blank the whole application. It intentionally does NOT
 * render `error.message` (which can contain internal details) — only a stable,
 * user-facing message is shown, and the raw error is left for server logs.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-canvas px-4 py-16">
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
          <AlertTriangle className="h-8 w-8 text-rose-400" aria-hidden="true" />
        </div>

        <h1 className="text-xl font-bold text-ink sm:text-2xl">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          We hit an unexpected problem while loading this page. Your session is
          safe — please try again, or return to the dashboard.
        </p>

        {error?.digest ? (
          <p className="mt-4 text-[11px] uppercase tracking-wide text-ink-muted/70">
            Reference: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
            Try again
          </Button>
          <Link href="/" className={buttonClass('outline', 'md', 'rounded', 'w-full sm:w-auto')}>
            <span className="inline-flex items-center justify-center gap-2">
              <Home className="h-4 w-4" aria-hidden="true" /> Go home
            </span>
          </Link>
        </div>
      </Card>
    </main>
  );
}
