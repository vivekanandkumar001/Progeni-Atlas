import Link from 'next/link';
import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Send,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import type { UseInviteCandidateReturn } from '../hooks/useInviteCandidate';

export function InviteCandidateModal({
  showInviteModal,
  setShowInviteModal,
  inviteName,
  setInviteName,
  inviteEmail,
  setInviteEmail,
  inviteJobId,
  inviteRole,
  setInviteRole,
  inviteJd,
  setInviteJd,
  inviteDate,
  setInviteDate,
  inviteTime,
  setInviteTime,
  inviteDuration,
  setInviteDuration,
  inviting,
  isDraggingJd,
  parsingJd,
  uploadedJdFile,
  fileInputRef,
  jobProfiles,
  handleJobSelect,
  handleJdFile,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleInviteSubmit,
  isZeroBalance,
}: UseInviteCandidateReturn) {
  if (!showInviteModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 rounded-2xl bg-surface border border-line space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
              <Send className="w-5 h-5 text-accent-indigo" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">Schedule AI Technical Interview</h3>
              <p className="text-xs text-ink-muted">Conduct an in-depth autonomous AI technical interview with live real-time evaluation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInviteModal(false)}
            className="text-ink-muted hover:text-ink cursor-pointer p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isZeroBalance && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-accent-amber flex items-start gap-3 shadow-md shadow-amber-500/5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent-amber" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-ink">Zero Wallet Balance (0 Credits)</p>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-accent-amber border border-amber-500/30 font-bold">
                  0 Credits
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Your wallet balance is 0 credits. Recruiters cannot schedule interviews without available credits. Please recharge your account in Billing.
              </p>
              <div className="pt-1">
                <Link
                  href="/recruiter/billing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                  <span>Recharge in Billing</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleInviteSubmit} className="space-y-4">
          {/* 1 & 2: Candidate Name & Candidate Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Candidate Full Name</span>
                <span className="text-accent-rose">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Please enter candidate name (e.g. Jordan Miller)"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Candidate Email Address</span>
                <span className="text-accent-rose">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="Please enter candidate email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* 3: Role (For Hire) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Role (For Hire)</span>
                <span className="text-accent-rose">*</span>
              </label>
              {inviteJobId && inviteJobId !== 'custom' && (
                <span className="text-[11px] text-accent-indigo font-mono">Linked to interview rubric</span>
              )}
            </div>
            <select
              required
              value={inviteJobId}
              onChange={(e) => handleJobSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors"
            >
              <option value="">Select Target Position...</option>
              {jobProfiles.map((job, idx) => (
                <option key={`${job.id}-${idx}`} value={job.id}>
                  {job.title} ({job.department})
                </option>
              ))}
              <option value="custom">+ Specify Custom Role / New Opening</option>
            </select>
          </div>

          {/* Custom Role Title input if custom option selected */}
          {inviteJobId === 'custom' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-medium text-ink">
                Role Title (For Hire) <span className="text-accent-rose">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Please enter role title (e.g. Senior Machine Learning Engineer)"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* 4: JD (Job Description) WITH SMALL CORNER BUTTON & DIRECT DRAG-AND-DROP */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Job Description (JD)</span>
                <span className="text-accent-rose">*</span>
              </label>

              {/* Small button on corner of same line */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleJdFile(file);
                    e.target.value = '';
                  }}
                />

                {uploadedJdFile ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-accent-emerald text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[130px] sm:max-w-[180px]" title={uploadedJdFile}>
                      {uploadedJdFile}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-accent-emerald hover:underline text-[11px] font-bold ml-1 cursor-pointer"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingJd}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-accent-indigo border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Upload or Drag & Drop JD document (.pdf, .docx, .txt, .md)"
                  >
                    {parsingJd ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload / Drop JD</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Textarea with integrated Drag-and-Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative"
            >
              <textarea
                required
                rows={4}
                placeholder="Please paste or drag & drop Job Description file here (.pdf, .docx, .txt, .md)..."
                value={inviteJd}
                onChange={(e) => setInviteJd(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-inset border text-ink text-sm focus:outline-none resize-y min-h-[105px] transition-all ${
                  isDraggingJd
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/10'
                    : 'border-line focus:border-indigo-500'
                }`}
              />

              {/* Drag-over overlay */}
              {isDraggingJd && (
                <div className="absolute inset-0 rounded-xl bg-indigo-950/80 backdrop-blur-xs border-2 border-dashed border-indigo-400 flex flex-col items-center justify-center gap-1.5 pointer-events-none z-10 animate-fadeIn">
                  <UploadCloud className="w-6 h-6 text-indigo-400 animate-bounce" />
                  <span className="text-xs font-bold text-white">Drop JD file to extract (.pdf, .docx, .txt, .md)</span>
                </div>
              )}
            </div>
          </div>

          {/* 5 & 6: Date of Interview & Time of Interview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Date of Interview</span>
                <span className="text-accent-rose">*</span>
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={inviteDate}
                onChange={(e) => setInviteDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Time of Interview</span>
                <span className="text-accent-rose">*</span>
              </label>
              <input
                type="time"
                required
                value={inviteTime}
                onChange={(e) => setInviteTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 7: Interview Duration (Recruiter Configurable, Default 30 min) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent-indigo" />
                <span>Interview Duration</span>
                <span className="text-accent-rose">*</span>
              </label>
              <span className="text-[11px] text-ink-muted">Default: 30 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setInviteDuration(String(mins))}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer flex-1 text-center ${
                    Number(inviteDuration) === mins
                      ? 'bg-indigo-500/20 text-accent-indigo border-indigo-500/40 font-bold shadow-xs'
                      : 'bg-surface-2 text-ink-muted border-line hover:text-ink hover:bg-surface-3'
                  }`}
                >
                  {mins} min {mins === 30 && '(Def)'}
                </button>
              ))}
              <div className="relative w-24 shrink-0">
                <input
                  type="number"
                  min={5}
                  max={120}
                  required
                  value={inviteDuration}
                  onChange={(e) => setInviteDuration(e.target.value)}
                  placeholder="Custom"
                  className="w-full px-3 py-2 rounded-xl bg-inset border border-line text-ink text-xs focus:outline-none focus:border-indigo-500 text-right pr-7"
                />
                <span className="absolute right-2.5 top-2 text-[11px] text-ink-muted pointer-events-none">m</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting || parsingJd || isZeroBalance}
              className={`flex-1 py-2.5 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md ${
                isZeroBalance
                  ? 'bg-amber-600/80 cursor-not-allowed opacity-75'
                  : 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 shadow-indigo-500/20 cursor-pointer disabled:opacity-60'
              }`}
            >
              {inviting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scheduling Technical Interview...</span>
                </>
              ) : isZeroBalance ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-200" />
                  <span>Recharge Required (Balance: 0 Credits)</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Schedule &amp; Send Interview Invite</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
