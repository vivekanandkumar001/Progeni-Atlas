import { Skeleton } from '@/components/ui';

export default function RecruiterSectionLoading() {
  return (
    <main
      className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8 xl:max-w-screen-2xl 2xl:px-10"
      role="status"
      aria-busy="true"
      aria-label="Loading recruiter workspace"
    >
      <Skeleton className="h-8 w-72 rounded-lg" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl border border-line bg-surface p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-5 h-56 w-full" />
      </div>
      <span className="sr-only">Loading…</span>
    </main>
  );
}
