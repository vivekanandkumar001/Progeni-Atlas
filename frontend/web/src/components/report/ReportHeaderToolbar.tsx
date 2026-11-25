'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Share2, Download, CheckCircle2, ShieldCheck } from 'lucide-react';
import { USER_KEY } from '@/lib/api';
import { DemoBadge } from '@/components/common/DemoBadge';
import { copyTextToClipboard } from '@/lib/clipboard';

interface ReportHeaderToolbarProps {
  sessionId: string;
  dossierId: string;
  companyName: string;
  roleTitle: string;
  interviewDate: string;
  durationMinutes?: number | null;
  onDownloadPdf: () => void;
  isDownloadingPdf?: boolean;
  isDemo?: boolean;
  demoNumber?: number | string | null;
}

type ShareStatus = 'idle' | 'copied' | 'failed';

export const ReportHeaderToolbar: React.FC<ReportHeaderToolbarProps> = ({
  sessionId,
  dossierId,
  companyName,
  roleTitle,
  interviewDate,
  durationMinutes,
  onDownloadPdf,
  isDownloadingPdf = false,
  isDemo = false,
  demoNumber = null,
}) => {
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [dashboardHref, setDashboardHref] = useState('/candidate/dashboard');

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        const r = (u.role || '').toLowerCase();
        if (r === 'super_admin') setDashboardHref('/super-admin');
        else if (r === 'recruiter' || r === 'admin' || r === 'hr') setDashboardHref('/recruiter/dashboard');
        else setDashboardHref('/candidate/dashboard');
      }
    } catch {}
  }, []);

  const handleShareLink = async () => {
    // Plain link only. The previous version appended a fake
    // `?auth_token=jwt_signed_credential`, which looked like a signed
    // credential but was not one and granted no access.
    const publicUrl = `${window.location.origin}/candidate/interview/${encodeURIComponent(sessionId)}/report`;
    setShareUrl(publicUrl);
    const copied = await copyTextToClipboard(publicUrl);
    setShareStatus(copied ? 'copied' : 'failed');
    window.setTimeout(() => setShareStatus('idle'), copied ? 3000 : 10000);
  };

  const durationLabel =
    typeof durationMinutes === 'number' && Number.isFinite(durationMinutes)
      ? `${durationMinutes} min`
      : 'Duration unavailable';

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Share Notification Toast */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface hover:bg-surface-2 border border-line text-xs font-medium text-ink-muted hover:text-accent-cyan transition-all group"
        >
          <span>Return to Dashboard</span>
        </Link>

        {shareStatus === 'copied' && (
          <span role="status" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-accent-cyan text-xs font-mono animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Link Copied to Clipboard</span>
          </span>
        )}
        {shareStatus === 'failed' && (
          <span role="alert" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-accent-amber text-xs font-mono">
            <Share2 className="w-3.5 h-3.5" />
            <span>Copy unavailable — use the link below</span>
          </span>
        )}
      </div>

      {shareStatus === 'failed' && shareUrl && (
        <div role="dialog" aria-label="Share report link" className="p-3 rounded-xl border border-line bg-surface space-y-1.5">
          <label htmlFor="report-share-url" className="text-[11px] font-medium text-ink-muted">
            Report link
          </label>
          <input
            id="report-share-url"
            readOnly
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-ink font-mono"
          />
        </div>
      )}

      {/* Main Header & Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-line">
        <div>
          <p className="text-caption font-mono uppercase text-accent-cyan text-xs tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Report for your {roleTitle} interview</span>
          </p>
          <p className="text-[10px] text-ink-muted uppercase tracking-wider hidden sm:flex items-center gap-1.5">
            <span>Reference: {dossierId}</span>
          </p>
          <h1 className="text-heading font-bold text-ink text-2xl sm:text-3xl tracking-tight mt-0.5">
            Technical Performance Dossier
          </h1>
          {isDemo && (
            <div className="mt-1.5">
              <DemoBadge demoNumber={demoNumber} />
              <span className="ml-2 text-[11px] text-ink-muted">
                Seeded practice data — not a verified recruiter assessment.
              </span>
            </div>
          )}
          <p className="text-body text-ink-muted text-sm mt-1">
            {companyName} • {roleTitle} • {durationLabel} • Conducted on {interviewDate}
          </p>
        </div>

        {/* Right Toolbar Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => void handleShareLink()}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-2 border border-line text-ink text-xs font-medium transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-accent-cyan" />
            <span>Share This Report</span>
          </button>

          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloadingPdf ? 'Preparing…' : 'Print / Save as PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
