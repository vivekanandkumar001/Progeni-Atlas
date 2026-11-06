'use client';

import React, { useRef } from 'react';
import { FileText, Check, AlertCircle, UploadCloud } from 'lucide-react';
import type { ResumeData } from '@/lib/hooks/useCandidateProfileData';

interface ResumeStorageCardProps {
  resume: ResumeData | null;
  isUploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ResumeStorageCard({
  resume,
  isUploading,
  onFileSelect,
}: ResumeStorageCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-lg font-bold text-ink">Resume Cloud Storage</h2>
        </div>
        {resume ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md border ${
              resume.status === 'PARSED'
                ? 'text-accent-emerald bg-emerald-500/10 border-emerald-500/20'
                : 'text-accent-amber bg-amber-500/10 border-amber-500/20'
            }`}
          >
            {resume.status === 'PARSED' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {resume.status}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-muted bg-inset border border-line px-2 py-0.5 rounded-md">
            No resume
          </span>
        )}
      </div>

      {/* Active Resume Status Card */}
      {resume ? (
        <div className="p-4 rounded-xl bg-inset border border-line space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-accent-rose font-bold text-xs">
                PDF
              </div>
              <div>
                <p className="text-sm font-semibold text-ink truncate max-w-[180px]">
                  {resume.fileName}
                </p>
                <p className="text-xs text-ink-muted font-mono">
                  {resume.fileSizeFormatted}
                  {resume.uploadedAt
                    ? ` • ${new Date(resume.uploadedAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-line flex items-center justify-between text-xs">
            <span className="text-ink-muted font-mono">Cloud Bucket Sync</span>
            <a
              href={resume.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-cyan hover:underline font-medium"
            >
              Preview File
            </a>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-inset border border-line text-center space-y-1">
          <p className="text-xs font-medium text-ink">No resume uploaded yet</p>
          <p className="text-[11px] text-ink-muted">
            A parsed resume is required before you can join an interview session.
          </p>
        </div>
      )}

      {/* Upload Dropzone */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={onFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full py-4 px-4 rounded-xl border-2 border-dashed border-line hover:border-cyan-500/50 bg-inset hover:bg-surface transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
      >
        <UploadCloud className="w-6 h-6 text-ink-muted group-hover:text-accent-cyan transition-colors" />
        <div className="text-center">
          <p className="text-xs font-medium text-ink group-hover:text-accent-cyan">
            {isUploading ? 'Synchronizing File...' : 'Click to Upload & Replace Resume'}
          </p>
          <p className="text-[11px] text-ink-muted font-mono mt-0.5">PDF format up to 10MB</p>
        </div>
      </button>
    </div>
  );
}
