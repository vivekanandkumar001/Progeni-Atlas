'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Play, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { PracticeDrillItem } from '@/types/practice';

interface DrillsResponse {
  success?: boolean;
  drills?: PracticeDrillItem[];
  error?: string;
}

export const PracticeDrillList: React.FC = () => {
  const router = useRouter();
  const [drills, setDrills] = useState<PracticeDrillItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch('/api/v1/practice/drills');
        const data = (await res.json().catch(() => null)) as DrillsResponse | null;
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || `Could not load drills (HTTP ${res.status}).`);
          setDrills([]);
          return;
        }
        setDrills(data?.drills ?? []);
      } catch {
        if (!cancelled) {
          setError('Could not reach the drills service.');
          setDrills([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Recommended first, then whatever order the service returned.
  const featured = (drills ?? [])
    .slice()
    .sort((a, b) => Number(Boolean(b.recommendedReason)) - Number(Boolean(a.recommendedReason)))
    .slice(0, 3);

  return (
    <div className="bg-surface backdrop-blur-md border border-line rounded-2xl p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-accent-indigo">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-heading text-xl text-ink font-bold">
                Targeted Practice Sessions
              </h3>
              <p className="text-body text-xs text-ink-muted">
                10-minute micro-interviews to strengthen weak spots
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-caption text-accent-indigo bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> AI Tailored
          </span>
        </div>

        <div className="space-y-3 mt-4">
          {drills === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-ink-muted">
              <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
              LOADING_DRILLS
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 py-4 text-xs text-ink-muted">
              <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : featured.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-ink-muted mb-4">
                No practice drills are available right now.
              </p>
              <button
                type="button"
                onClick={() => router.push('/candidate/practice')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 font-semibold text-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Browse Available Drills
              </button>
            </div>
          ) : (
            featured.map((drill, idx) => (
              <div
                key={`${drill.id}-${idx}`}
                className="p-4 rounded-xl bg-inset border border-line hover:border-line-strong transition-all flex items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-caption text-xs font-mono text-accent-cyan bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                      {drill.estimatedMinutes} mins • {drill.difficulty}
                    </span>
                    {drill.recommendedReason && (
                      <span className="text-caption text-xs font-mono text-accent-indigo bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  <h4 className="text-body font-medium text-ink group-hover:text-accent-cyan transition-colors truncate">
                    {drill.title}
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/candidate/practice?drill=${encodeURIComponent(drill.id)}`)}
                  className="shrink-0 inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-ink hover:text-ink px-3 py-2 rounded-lg text-xs font-medium border border-line-strong transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 text-accent-cyan fill-cyan-400/20" />
                  <span>Practice Topic</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line text-center">
        <p className="text-caption text-ink-muted text-xs">
          {featured.length > 0
            ? 'Drills are generated from your interview speech and code patterns.'
            : 'Drills are generated from your interview speech and code patterns once a session is scored.'}
        </p>
      </div>
    </div>
  );
};
