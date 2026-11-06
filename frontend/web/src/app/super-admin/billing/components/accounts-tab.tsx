'use client';

import { useMemo } from 'react';
import { CheckCircle2, Eye, Gift, PlusCircle, RotateCcw, Sliders } from 'lucide-react';
import { Card, Pill, SearchInput, Spinner } from '@/components/super-admin/ui';
import {
  formatCurrencyUsd,
  type BillingAccount,
} from '@/lib/super-admin';
import {
  accountStatusTone,
  filterBillingAccounts,
  nanoUsdToUsdString,
  orgInitials,
} from '@/lib/superadmin-billing';

interface AccountsTabProps {
  accounts: BillingAccount[];
  accountSearch: string;
  setAccountSearch: (value: string) => void;
  loadingAccounts: boolean;
  setActiveAccount: (account: BillingAccount) => void;
  setRechargeModalOpen: (open: boolean) => void;
  setGrantModalOpen: (open: boolean) => void;
  setRefundModalOpen: (open: boolean) => void;
  handleReconcile: (account: BillingAccount) => Promise<void>;
  setFormThreshold: (value: string) => void;
  setFormAutoRechargeEnabled: (enabled: boolean) => void;
  setBudgetModalOpen: (open: boolean) => void;
  setDossierAccount: (account: BillingAccount | null) => void;
}

export function AccountsTab({
  accounts,
  accountSearch,
  setAccountSearch,
  loadingAccounts,
  setActiveAccount,
  setRechargeModalOpen,
  setGrantModalOpen,
  setRefundModalOpen,
  handleReconcile,
  setFormThreshold,
  setFormAutoRechargeEnabled,
  setBudgetModalOpen,
  setDossierAccount,
}: AccountsTabProps) {
  const filteredAccounts = useMemo(
    () => filterBillingAccounts(accounts, accountSearch),
    [accounts, accountSearch]
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={accountSearch}
            onChange={setAccountSearch}
            placeholder="Search organization, account ID, or billing email..."
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              Showing {filteredAccounts.length} of {accounts.length} accounts
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="pb-3 font-semibold">Organization / Account</th>
                <th className="pb-3 font-semibold">Tier</th>
                <th className="pb-3 font-semibold text-right">Available Balance</th>
                <th className="pb-3 font-semibold text-right">Paid Recharges</th>
                <th className="pb-3 font-semibold text-right">Promotional</th>
                <th className="pb-3 font-semibold text-right">Consumed</th>
                <th className="pb-3 font-semibold text-right">Outstanding Due</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {loadingAccounts && accounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-ink-muted">
                    No billing accounts match search.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-surface-2/60 transition">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 font-mono text-[11px] font-bold text-accent-cyan">
                          {orgInitials(acc.accountName)}
                        </span>
                        <div>
                          <p className="font-bold text-ink">{acc.accountName || 'Unnamed Org'}</p>
                          <p className="font-mono text-[10px] text-ink-faint">
                            {acc.id.substring(0, 13)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <Pill tone="violet">{acc.tier || 'starter'}</Pill>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`font-mono font-bold ${
                          acc.availableBalanceUsd > 10
                            ? 'text-accent-emerald'
                            : acc.availableBalanceUsd > 0
                            ? 'text-accent-amber'
                            : 'text-accent-rose'
                        }`}
                      >
                        {acc.availableBalanceFormatted || formatCurrencyUsd(acc.availableBalanceUsd)}
                      </span>
                      {acc.isLowBalance && (
                        <span className="block text-[10px] text-accent-rose font-medium">
                          Low Balance
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono text-ink">
                      {formatCurrencyUsd(acc.paidCreditsUsd)}
                    </td>
                    <td className="py-3 text-right font-mono text-ink-muted">
                      {formatCurrencyUsd(acc.promotionalCreditsUsd)}
                    </td>
                    <td className="py-3 text-right font-mono text-accent-cyan">
                      {formatCurrencyUsd(acc.consumedCreditsUsd)}
                    </td>
                    <td className="py-3 text-right font-mono text-accent-amber">
                      {formatCurrencyUsd(acc.outstandingDueUsd)}
                    </td>
                    <td className="py-3 text-center">
                      <Pill tone={accountStatusTone(acc.status)}>{acc.status}</Pill>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Recharge */}
                        <button
                          onClick={() => {
                            setActiveAccount(acc);
                            setRechargeModalOpen(true);
                          }}
                          title="Record Paid Recharge"
                          className="rounded-lg border border-line bg-surface-2 p-1.5 text-accent-emerald hover:bg-emerald-500/10 transition"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                        </button>
                        {/* Grant Promo */}
                        <button
                          onClick={() => {
                            setActiveAccount(acc);
                            setGrantModalOpen(true);
                          }}
                          title="Grant Promotional Credits"
                          className="rounded-lg border border-line bg-surface-2 p-1.5 text-accent-violet hover:bg-violet-500/10 transition"
                        >
                          <Gift className="h-3.5 w-3.5" />
                        </button>
                        {/* Refund */}
                        <button
                          onClick={() => {
                            setActiveAccount(acc);
                            setRefundModalOpen(true);
                          }}
                          title="Issue Refund"
                          className="rounded-lg border border-line bg-surface-2 p-1.5 text-accent-rose hover:bg-rose-500/10 transition"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        {/* Reconcile */}
                        <button
                          onClick={() => void handleReconcile(acc)}
                          title="Verify Immutable Ledger Reconciliation"
                          className="rounded-lg border border-line bg-surface-2 p-1.5 text-accent-cyan hover:bg-cyan-500/10 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        {/* Budget Policy */}
                        <button
                          onClick={() => {
                            setActiveAccount(acc);
                            setFormThreshold(nanoUsdToUsdString(acc.lowBalanceThresholdNanoUsd));
                            setFormAutoRechargeEnabled(acc.autoRecharge?.enabled || false);
                            setBudgetModalOpen(true);
                          }}
                          title="Budget Threshold & Auto-Recharge"
                          className="rounded-lg border border-line bg-surface-2 p-1.5 text-accent-amber hover:bg-amber-500/10 transition"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                        </button>
                        {/* Full Dossier */}
                        <button
                          onClick={() => setDossierAccount(acc)}
                          title="View Complete Financial Dossier"
                          className="rounded-lg border border-line bg-surface-2 p-1.5 text-ink-muted hover:bg-surface-3 hover:text-ink transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
