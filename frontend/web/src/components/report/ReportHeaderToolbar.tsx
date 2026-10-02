'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2, Download, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ReportHeaderToolbarProps {
  sessionId: string;
  dossierId: string;
  companyName: string;
  roleTitle: string;
  interviewDate: string;
  onDownloadPdf: () => void;
  isDownloadingPdf?: boolean;
}

export const ReportHeaderToolbar: React.FC<ReportHeaderToolbarProps> = ({
  sessionId,
  dossierId,
  companyName,
  roleTitle,
  interviewDate,
  onDownloadPdf,
  isDownloadingPdf = false
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareLink = () => {
    const publicUrl = `${window.location.origin}/candidate/interview/${sessionId}/report?auth_token=jwt_signed_credential`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Share Notification Toast */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href="/candidate/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Candidate Dashboard</span>
        </Link>

        {copiedLink && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Verifiable Link Copied to Clipboard!</span>
          </span>
        )}
      </div>

      {/* Main Header & Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-800/80">
        <div>
          <p className="text-caption font-mono uppercase text-cyan-400 text-xs tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>VERIFIED EVALUATION REPORT • SESSION ID: {dossierId}</span>
          </p>
          <h1 className="text-heading font-bold text-slate-100 text-2xl sm:text-3xl tracking-tight mt-0.5">
            Technical Performance Dossier
          </h1>
          <p className="text-body text-slate-400 text-sm mt-1">
            {companyName} • {roleTitle} • Conducted on {interviewDate}
          </p>
        </div>

        {/* Right Toolbar Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleShareLink}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span>Share Verifiable Link</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Official PDF Dossier ↓'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
