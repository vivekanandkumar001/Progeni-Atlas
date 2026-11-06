import { CheckCircle2, Download, Gift, PlusCircle, RotateCcw, X } from 'lucide-react';
import { Pill } from '@/components/super-admin/ui';
import {
  formatCurrencyUsd,
  formatDateTime,
  type BillingAccount,
  type BillingLedgerEntry,
} from '@/lib/super-admin';
import { entriesForAccount, orgInitials } from '@/lib/superadmin-billing';

interface DossierDrawerProps {
  dossierAccount: BillingAccount | null;
  setDossierAccount: (account: BillingAccount | null) => void;
  ledgerEntries: BillingLedgerEntry[];
  setActiveAccount: (account: BillingAccount) => void;
  setRechargeModalOpen: (open: boolean) => void;
  setGrantModalOpen: (open: boolean) => void;
  setRefundModalOpen: (open: boolean) => void;
  handleReconcile: (account: BillingAccount) => Promise<void>;
  downloadStatementCsv: (accountId?: string) => Promise<void>;
}

export function DossierDrawer({
  dossierAccount,
  setDossierAccount,
  ledgerEntries,
  setActiveAccount,
  setRechargeModalOpen,
  setGrantModalOpen,
  setRefundModalOpen,
  handleReconcile,
  downloadStatementCsv,
}: DossierDrawerProps) {
  if (!dossierAccount) return null;

  const tenantEntries = entriesForAccount(ledgerEntries, dossierAccount.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setDossierAccount(null);
      }}
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-accent-cyan font-bold">
              {orgInitials(dossierAccount.accountName)}
            </span>
            <div>
              <h2 className="text-lg font-black text-ink">
                {dossierAccount.accountName || 'Organization Dossier'}
              </h2>
              <p className="font-mono text-xs text-ink-muted">
                Account ID: {dossierAccount.id}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDossierAccount(null)}
            className="rounded-xl border border-line p-2 text-ink-muted hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Financial Snapshot */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <span className="block text-[10px] uppercase text-ink-muted">Available</span>
              <span className="text-base font-bold text-accent-emerald">
                {dossierAccount.availableBalanceFormatted}
              </span>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <span className="block text-[10px] uppercase text-ink-muted">Paid Recharges</span>
              <span className="text-base font-bold text-ink">
                {formatCurrencyUsd(dossierAccount.paidCreditsUsd)}
              </span>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <span className="block text-[10px] uppercase text-ink-muted">Promotional</span>
              <span className="text-base font-bold text-accent-violet">
                {formatCurrencyUsd(dossierAccount.promotionalCreditsUsd)}
              </span>
            </div>
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <span className="block text-[10px] uppercase text-ink-muted">Consumed</span>
              <span className="text-base font-bold text-accent-cyan">
                {formatCurrencyUsd(dossierAccount.consumedCreditsUsd)}
              </span>
            </div>
          </div>

          {/* Actions toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setActiveAccount(dossierAccount);
                setRechargeModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-accent-emerald hover:bg-emerald-500/20"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Recharge
            </button>
            <button
              onClick={() => {
                setActiveAccount(dossierAccount);
                setGrantModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-accent-violet hover:bg-violet-500/20"
            >
              <Gift className="h-3.5 w-3.5" />
              Grant Promo
            </button>
            <button
              onClick={() => {
                setActiveAccount(dossierAccount);
                setRefundModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-accent-rose hover:bg-rose-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refund
            </button>
            <button
              onClick={() => void handleReconcile(dossierAccount)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-accent-cyan hover:bg-cyan-500/20"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reconcile Ledger
            </button>
            <button
              onClick={() => void downloadStatementCsv(dossierAccount.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-bold text-ink hover:bg-surface-3"
            >
              <Download className="h-3.5 w-3.5 text-accent-cyan" />
              Statement CSV
            </button>
          </div>

          {/* Immutable Transactions List for this tenant */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Tenant Transaction Stream
            </h4>
            <div className="divide-y divide-line/40 rounded-xl border border-line bg-surface-2 p-2 max-h-96 overflow-y-auto">
              {tenantEntries.length === 0 ? (
                <p className="py-6 text-center text-xs text-ink-muted">
                  No transactions recorded yet for this organization.
                </p>
              ) : (
                tenantEntries.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-accent-cyan">{tx.txRef}</span>
                        <Pill tone="neutral">{tx.entryType.replace('_', ' ')}</Pill>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {formatDateTime(tx.createdAt)} • {tx.reason || tx.reference || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span
                        className={`font-bold ${
                          tx.amountUsd >= 0 ? 'text-accent-emerald' : 'text-accent-rose'
                        }`}
                      >
                        {tx.amountFormatted}
                      </span>
                      <span className="block text-[10px] text-ink-faint">
                        Bal: {formatCurrencyUsd(tx.balanceAfterUsd)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
