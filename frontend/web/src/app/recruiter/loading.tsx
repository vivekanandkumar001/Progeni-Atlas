export default function RecruiterSectionLoading() {
  return (
    <main
      className="mx-auto w-full max-w-7xl flex-1 animate-pulse space-y-6 p-4 sm:p-6 lg:p-8"
      role="status"
      aria-label="Loading recruiter workspace"
    >
      <div className="h-8 w-72 rounded-lg bg-surface-2" />
      <div className="h-4 w-full max-w-2xl rounded bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-2xl border border-line bg-surface" />
        <div className="h-32 rounded-2xl border border-line bg-surface" />
        <div className="h-32 rounded-2xl border border-line bg-surface" />
      </div>
      <div className="h-72 rounded-2xl border border-line bg-surface" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
