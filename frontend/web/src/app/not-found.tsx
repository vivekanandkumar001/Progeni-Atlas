import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  description: 'The page you are looking for does not exist.',
};

/**
 * Root 404 boundary. Handles both `notFound()` throws and any URL that does
 * not match a route. Renders inside the root layout, so Tailwind/theme
 * tokens from globals.css are available.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] w-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-lg backdrop-blur-md sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent-cyan/10">
          <svg className="h-8 w-8 text-accent-cyan" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.59l2.11-3.16L8 5.59l2.11 3.16L12 15.59zM8 5.59l4.06-6L16 5.59l-4.06 6H8zM12 3l4 6h-8l4-6z" />
          </svg>
        </div>

        <p className="font-mono text-xs font-bold uppercase tracking-widest text-accent-cyan">404</p>
        <h1 className="mt-2 text-xl font-bold text-ink sm:text-2xl">Page not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          The page you are looking for doesn't exist or may have been moved.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-from to-brand-to px-5 py-2.5 text-xs font-bold text-on-brand shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110 sm:text-sm"
          >
            Go home
          </Link>
          <Link
            href="/candidate/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 py-2.5 text-xs font-bold text-ink transition-all hover:bg-surface-2 sm:text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}