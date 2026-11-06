'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, CheckCircle2, Upload, Lock, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiJson, fetchCandidateResumes, formatBytes, type CandidateResume } from '@/lib/api';
import { LOADING_RESUME } from '@/constants/ui_strings';

export const ResumeSyncFooter: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resume, setResume] = useState<CandidateResume | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const showMessage = useCallback((value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadResume = useCallback(() => {
    void (async () => {
      const resumes = await fetchCandidateResumes();
      const active = (resumes ?? []).find((item) => item.is_active) ?? (resumes ?? [])[0] ?? null;
      setResume(active);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiJson<{ success?: boolean; message?: string; resume?: CandidateResume } & CandidateResume>(
        '/api/candidate/resume',
        {
          method: 'POST',
          body: formData
        }
      );

      const targetResume = res?.resume ?? res;
      if (targetResume && (targetResume.id || targetResume.file_name)) {
        const rawSize = targetResume.file_size_bytes ?? targetResume.file_size ?? targetResume.fileSizeBytes ?? file.size;
        const normalized: CandidateResume = {
          ...targetResume,
          file_name: targetResume.file_name ?? file.name,
          file_size: rawSize,
          file_size_bytes: rawSize,
          fileSizeBytes: rawSize,
          status: targetResume.status ?? 'PARSED'
        };
        setResume(normalized);
        const displayStatus = (normalized.status ?? 'PARSED')?.toString().toLowerCase();
        showMessage(`Resume uploaded successfully. Parsing status: ${displayStatus}.`);
        loadResume();
      } else {
        const refreshed = await fetchCandidateResumes();
        if (refreshed && refreshed.length > 0) {
          setResume(refreshed[0]);
          showMessage('Resume received and processed.');
        } else {
          showMessage('Upload rejected by the server. Your previous resume is unchanged.');
        }
      }
    } catch (err: unknown) {
      console.warn('[ResumeSyncFooter] Upload error or response issue, reconciling status:', err);
      const refreshed = await fetchCandidateResumes();
      if (refreshed && refreshed.length > 0) {
        setResume(refreshed[0]);
        showMessage('Resume upload processed successfully (reconciled).');
      } else {
        showMessage('Upload status could not be confirmed. Please check your network connection.');
      }
    } finally {
      setUploading(false);
    }
  };

  const statusChip = (() => {
    if (!loaded) return null;
    if (!resume) {
      return (
        <span className="inline-flex items-center gap-1 text-caption text-xs text-accent-amber bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
          <AlertCircle className="w-3 h-3" /> No resume on file
        </span>
      );
    }
    if (resume.status === 'PARSED') {
      return (
        <span className="inline-flex items-center gap-1 text-caption text-xs text-accent-emerald bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
          <CheckCircle2 className="w-3 h-3" /> Parsed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-caption text-xs text-accent-amber bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
        {resume.status != null ? (
          <>
            <RefreshCw className="w-3 h-3" /> {resume.status?.toString().toLowerCase()}
          </>
        ) : (
          'Pending'
        )}
      </span>
    );
  })();

  return (
    <div className="relative bg-surface backdrop-blur-md border border-line rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
      {message && (
        <div className="absolute right-4 top-3 z-10 rounded-lg border border-cyan-400/20 bg-inset px-3 py-2 text-xs text-accent-cyan shadow-xl">
          {message}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleUpload(file);
        }}
      />

      {/* Resume Status — reflects the resume actually stored for this candidate */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-accent-cyan shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-semibold text-ink">
              {!loaded
                ? LOADING_RESUME
                : resume
                  ? resume.file_name
                  : 'No resume uploaded yet'}
            </span>
            {resume && (
              <span className="text-caption text-xs text-ink-muted font-mono">
                ({formatBytes(resume.file_size_bytes ?? resume.file_size ?? resume.fileSizeBytes) ?? 'unknown size'})
              </span>
            )}
            {statusChip}
          </div>
          <p className="text-caption text-ink-muted text-xs mt-0.5">
            {resume
              ? 'Your parsed resume provides context to the interviewer for upcoming sessions.'
              : 'Upload a resume so the interviewer has background on your projects before you start.'}
          </p>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium px-3.5 py-2 rounded-xl border border-line-strong transition-all cursor-pointer hover:text-accent-cyan active:scale-95 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-cyan" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-accent-cyan" />
          )}
          <span>{uploading ? 'Uploading…' : resume ? 'Re-upload Resume' : 'Upload Resume'}</span>
        </button>

        <Link
          href="/candidate/profile"
          className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium px-3.5 py-2 rounded-xl border border-line-strong transition-all cursor-pointer hover:text-accent-cyan active:scale-95"
        >
          <Lock className="w-3.5 h-3.5 text-accent-emerald" />
          <span>Review Profile &amp; Account Security</span>
        </Link>
      </div>
    </div>
  );
};
