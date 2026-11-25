'use client';

import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-surface-2/90 ${className}`.trim()}
    />
  );
}

export function SkeletonRows({
  rows = 4,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`divide-y divide-line border-t border-line ${className}`.trim()}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <Skeleton className="h-3.5 w-3/5 max-w-[200px]" />
              <Skeleton className="h-2.5 w-2/5 max-w-[140px]" />
            </div>
          </div>
          <Skeleton className="h-5 w-14 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards({
  count = 4,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={className}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="card-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div aria-hidden="true" className="divide-y divide-line">
      <div className="px-4 py-3 flex items-center gap-4 bg-surface-2/40">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-3 flex-1 max-w-[140px]" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3.5 flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 flex-1 ${c === 0 ? 'max-w-[180px]' : 'max-w-[120px]'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
