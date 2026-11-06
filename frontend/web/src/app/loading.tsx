'use client';

/**
 * Root loading state shown while a route segment streams in.
 * Renders inside the root layout, so Tailwind theme tokens are available.
 */
export default function RootLoading() {
  return (
    <main
      className="flex min-h-[70vh] w-full flex-1 items-center justify-center px-4 py-16"
      role="status"
      aria-label="Loading page"
    >
      <div className="w-full max-w-3xl animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-surface-2" />
        <div className="h-4 w-full max-w-xl rounded bg-surface-2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-32 rounded-2xl border border-line bg-surface" />
          <div className="h-32 rounded-2xl border border-line bg-surface" />
          <div className="h-32 rounded-2xl border border-line bg-surface" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </main>
  );
}
