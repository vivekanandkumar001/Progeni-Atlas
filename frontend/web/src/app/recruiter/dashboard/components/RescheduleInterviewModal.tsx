import { AlertCircle, Calendar, Clock, FileText, RefreshCw, Send, X } from 'lucide-react';
import Link from 'next/link';
import { formatInterviewDateTime } from '@/lib/recruiter-dashboard';
import type { UseRescheduleInterviewReturn } from '../hooks/useRescheduleInterview';

export function RescheduleInterviewModal({
  rescheduleCandidate,
  setRescheduleCandidate,
  rescheduleDate,
  setRescheduleDate,
  rescheduleTime,
  setRescheduleTime,
  rescheduleMessage,
  setRescheduleMessage,
  rescheduleNotify,
  setRescheduleNotify,
  rescheduling,
  isZeroBalance,
  handleConfirmReschedule,
}: UseRescheduleInterviewReturn) {
  if (!rescheduleCandidate) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-surface border border-line rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">Reschedule Interview</h2>
                <p className="text-xs text-ink-muted">
                  Update interview slot and send instant notification to candidate
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRescheduleCandidate(null)}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CANDIDATE SUMMARY CARD */}
        <div className="p-4 rounded-2xl bg-inset border border-line space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-md">
              {rescheduleCandidate.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm text-ink">{rescheduleCandidate.name}</p>
              <p className="text-xs text-ink-muted font-mono">{rescheduleCandidate.email}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs font-mono">
            <span className="text-ink-muted">Target Position:</span>
            <span className="text-ink font-semibold">{rescheduleCandidate.targetPosition}</span>
          </div>
          {(() => {
            const curSlot = formatInterviewDateTime(
              rescheduleCandidate.scheduledAt,
              rescheduleCandidate.scheduledDate,
              rescheduleCandidate.scheduledTime
            );
            if (!curSlot.isScheduled) return null;
            return (
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-ink-muted">Current Slot:</span>
                <span className="text-accent-indigo font-medium">
                  {curSlot.date} {curSlot.time ? `at ${curSlot.time}` : ''}
                </span>
              </div>
            );
          })()}
        </div>

        {/* RESCHEDULE FORM */}
        <form onSubmit={handleConfirmReschedule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent-indigo" />
                <span>New Date</span>
                <span className="text-accent-rose">*</span>
              </label>
              <input
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent-cyan" />
                <span>New Time (UTC)</span>
                <span className="text-accent-rose">*</span>
              </label>
              <input
                type="time"
                required
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-ink-muted" />
              <span>Note / Reason for Candidate (Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Please enter a note for candidate (e.g., Rescheduled due to hiring team schedule adjustment)..."
              value={rescheduleMessage}
              onChange={(e) => setRescheduleMessage(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-inset border border-line text-ink text-xs focus:outline-none focus:border-indigo-500 resize-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
            <input
              type="checkbox"
              id="notifyCandidateCheckbox"
              checked={rescheduleNotify}
              onChange={(e) => setRescheduleNotify(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-line bg-inset cursor-pointer"
            />
            <label htmlFor="notifyCandidateCheckbox" className="text-xs text-ink cursor-pointer select-none">
              <span className="font-semibold">Notify Candidate</span> (Sends in-app notification & official email)
            </label>
          </div>

          {isZeroBalance && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">Insufficient Wallet Balance (0 Credits)</p>
                <p className="text-ink-muted">
                  Your balance is zero. You cannot reschedule interviews until credits are added to your wallet.
                </p>
                <Link
                  href="/recruiter/billing"
                  className="inline-flex items-center gap-1 font-semibold text-accent-cyan hover:underline mt-1"
                >
                  Recharge Credits in Billing &rarr;
                </Link>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setRescheduleCandidate(null)}
              disabled={rescheduling}
              className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rescheduling || isZeroBalance}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rescheduling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating & Notifying...</span>
                </>
              ) : isZeroBalance ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Recharge Required (0 Credits)</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Confirm & Notify Candidate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
