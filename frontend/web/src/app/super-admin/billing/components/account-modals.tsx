import { Check, Gift, PlusCircle, RotateCcw, Sliders, X } from 'lucide-react';
import { Spinner } from '@/components/super-admin/ui';
import { formatCurrencyUsd, type BillingAccount } from '@/lib/super-admin';

interface AccountModalsProps {
  rechargeModalOpen: boolean;
  setRechargeModalOpen: (open: boolean) => void;
  grantModalOpen: boolean;
  setGrantModalOpen: (open: boolean) => void;
  refundModalOpen: boolean;
  setRefundModalOpen: (open: boolean) => void;
  budgetModalOpen: boolean;
  setBudgetModalOpen: (open: boolean) => void;
  activeAccount: BillingAccount | null;
  formAmount: string;
  setFormAmount: (value: string) => void;
  formReference: string;
  setFormReference: (value: string) => void;
  formReason: string;
  setFormReason: (value: string) => void;
  formThreshold: string;
  setFormThreshold: (value: string) => void;
  formAutoRechargeEnabled: boolean;
  setFormAutoRechargeEnabled: (enabled: boolean) => void;
  formAutoRechargeAmount: string;
  setFormAutoRechargeAmount: (value: string) => void;
  actionLoading: boolean;
  handleRecharge: () => Promise<void>;
  handleGrant: () => Promise<void>;
  handleRefund: () => Promise<void>;
  handleSaveBudget: () => Promise<void>;
}

export function AccountModals({
  rechargeModalOpen,
  setRechargeModalOpen,
  grantModalOpen,
  setGrantModalOpen,
  refundModalOpen,
  setRefundModalOpen,
  budgetModalOpen,
  setBudgetModalOpen,
  activeAccount,
  formAmount,
  setFormAmount,
  formReference,
  setFormReference,
  formReason,
  setFormReason,
  formThreshold,
  setFormThreshold,
  formAutoRechargeEnabled,
  setFormAutoRechargeEnabled,
  formAutoRechargeAmount,
  setFormAutoRechargeAmount,
  actionLoading,
  handleRecharge,
  handleGrant,
  handleRefund,
  handleSaveBudget,
}: AccountModalsProps) {
  if (!activeAccount) return null;

  return (
    <>
      {/* 1. RECHARGE MODAL */}
      {rechargeModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRechargeModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-accent-emerald">
                <PlusCircle className="h-5 w-5" />
                <h3 className="font-bold text-ink">Deposit Paid Recharge</h3>
              </div>
              <button
                onClick={() => setRechargeModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-ink-muted mb-1">Target Organization</label>
                <input
                  type="text"
                  disabled
                  value={activeAccount.accountName || activeAccount.id}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Recharge Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="50.00"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono font-bold focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">
                  Payment Reference (Stripe PI / Wire / Bank Ref) *
                </label>
                <input
                  type="text"
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="pi_3MtwBwLkdIwHu7ix28a3tqZ0"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Audit Reason / Contract Note *</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Enterprise monthly credit package recharge approved via verified bank wire..."
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setRechargeModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRecharge()}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs font-bold text-accent-emerald hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {actionLoading ? <Spinner /> : <PlusCircle className="h-3.5 w-3.5" />}
                Confirm Recharge Deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. GRANT MODAL */}
      {grantModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGrantModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-accent-violet">
                <Gift className="h-5 w-5" />
                <h3 className="font-bold text-ink">Grant Promotional Credits</h3>
              </div>
              <button
                onClick={() => setGrantModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-ink-muted mb-1">Target Organization</label>
                <input
                  type="text"
                  disabled
                  value={activeAccount.accountName || activeAccount.id}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Grant Credit Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="25.00"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono font-bold focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Operational Purpose / Reason *</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Pilot enterprise evaluation package grant approved by Super Admin..."
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setGrantModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleGrant()}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-xs font-bold text-accent-violet hover:bg-violet-500/30 disabled:opacity-50"
              >
                {actionLoading ? <Spinner /> : <Gift className="h-3.5 w-3.5" />}
                Post Credit Grant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REFUND MODAL */}
      {refundModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRefundModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-accent-rose">
                <RotateCcw className="h-5 w-5" />
                <h3 className="font-bold text-ink">Issue Customer Refund</h3>
              </div>
              <button
                onClick={() => setRefundModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-rose-500/10 p-3 text-accent-rose border border-rose-500/20">
                Refunds deduct from available wallet balance and record an immutable negative entry in
                the ledger. Maximum refundable balance:{' '}
                <span className="font-mono font-bold">
                  {formatCurrencyUsd(activeAccount.availableBalanceUsd)}
                </span>
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Refund Amount (₹ INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={activeAccount.availableBalanceUsd}
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="20.00"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono font-bold focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">
                  Original Transaction Ref / Wire Ref *
                </label>
                <input
                  type="text"
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="TX-20261017-9B85D7A6"
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono focus:border-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Refund Justification / Reason *</label>
                <textarea
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Customer requested refund of unused monthly credits as per SLA agreement..."
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setRefundModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRefund()}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-xs font-bold text-accent-rose hover:bg-rose-500/30 disabled:opacity-50"
              >
                {actionLoading ? <Spinner /> : <RotateCcw className="h-3.5 w-3.5" />}
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. BUDGET & ALERT MODAL */}
      {budgetModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBudgetModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-accent-amber">
                <Sliders className="h-5 w-5" />
                <h3 className="font-bold text-ink">Set Budget Thresholds</h3>
              </div>
              <button
                onClick={() => setBudgetModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-ink-muted mb-1">
                  Low-Balance Alert Threshold (₹ INR) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono font-bold focus:border-cyan-500 outline-none"
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  Alert is triggered when tenant wallet falls below this balance.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-surface-2 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Authorized Auto-Recharge</span>
                  <input
                    type="checkbox"
                    checked={formAutoRechargeEnabled}
                    onChange={(e) => setFormAutoRechargeEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-cyan-500 focus:ring-0"
                  />
                </div>
                {formAutoRechargeEnabled && (
                  <div>
                    <label className="block text-ink-muted mb-1">Recharge Amount (₹ INR)</label>
                    <input
                      type="number"
                      step="5"
                      min="10"
                      value={formAutoRechargeAmount}
                      onChange={(e) => setFormAutoRechargeAmount(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-ink font-mono font-bold outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setBudgetModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveBudget()}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-xs font-bold text-accent-amber hover:bg-amber-500/30 disabled:opacity-50"
              >
                {actionLoading ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
