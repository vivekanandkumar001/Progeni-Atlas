import { Download } from 'lucide-react';
import { Card, Pill, Spinner } from '@/components/super-admin/ui';
import {
  formatCurrencyUsd,
  formatDateTime,
  type BillingAccount,
  type BillingLedgerEntry,
} from '@/lib/super-admin';
import { ledgerEntryTone } from '@/lib/superadmin-billing';

interface LedgerTabProps {
  ledgerTypeFilter: string;
  setLedgerTypeFilter: (value: string) => void;
  ledgerAccountFilter: string;
  setLedgerAccountFilter: (value: string) => void;
  ledgerServiceFilter: string;
  setLedgerServiceFilter: (value: string) => void;
  accounts: BillingAccount[];
  ledgerEntries: BillingLedgerEntry[];
  totalLedgerCount: number;
  loadingLedger: boolean;
  downloadStatementCsv: (accountId?: string) => Promise<void>;
}

export function LedgerTab({
  ledgerTypeFilter,
  setLedgerTypeFilter,
  ledgerAccountFilter,
  setLedgerAccountFilter,
  ledgerServiceFilter,
  setLedgerServiceFilter,
  accounts,
  ledgerEntries,
  totalLedgerCount,
  loadingLedger,
  downloadStatementCsv,
}: LedgerTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Entry Type Filter */}
            <select
              value={ledgerTypeFilter}
              onChange={(e) => setLedgerTypeFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink outline-none focus:border-cyan-500"
            >
              <option value="all">All Transaction Types</option>
              <option value="recharge_paid">Recharge (Paid)</option>
              <option value="credit_grant">Promotional Grant</option>
              <option value="service_debit">Service Consumption</option>
              <option value="refund">Refund</option>
              <option value="adjustment">Manual Adjustment</option>
              <option value="invoice_payment">Invoice Payment</option>
            </select>

            {/* Account Filter */}
            <select
              value={ledgerAccountFilter}
              onChange={(e) => setLedgerAccountFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink outline-none focus:border-cyan-500"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName || a.id.substring(0, 10)}
                </option>
              ))}
            </select>

            {/* Service Filter */}
            <select
              value={ledgerServiceFilter}
              onChange={(e) => setLedgerServiceFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink outline-none focus:border-cyan-500"
            >
              <option value="all">All Services</option>
              <option value="ai_interview">AI Interview</option>
              <option value="llm_chat">LLM Chat</option>
              <option value="voice_stt">Voice STT</option>
              <option value="voice_tts">Voice TTS</option>
              <option value="embeddings">Embeddings</option>
              <option value="code_execution">Code Run</option>
              <option value="dossier_report">Dossier Report</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              Total Entries: <span className="font-mono font-bold text-ink">{totalLedgerCount}</span>
            </span>
            <button
              onClick={() =>
                void downloadStatementCsv(
                  ledgerAccountFilter !== 'all' ? ledgerAccountFilter : undefined
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-accent-cyan hover:bg-surface-3 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download Filtered CSV
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="pb-3 font-semibold">Tx Reference</th>
                <th className="pb-3 font-semibold">Timestamp (UTC)</th>
                <th className="pb-3 font-semibold">Entry Type</th>
                <th className="pb-3 font-semibold">Service</th>
                <th className="pb-3 font-semibold text-right">Amount (₹ INR)</th>
                <th className="pb-3 font-semibold text-right">Balance After</th>
                <th className="pb-3 font-semibold text-right">Provider Cost</th>
                <th className="pb-3 font-semibold">Reason / Reference</th>
                <th className="pb-3 font-semibold">Actor</th>
                <th className="pb-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 font-mono">
              {loadingLedger ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-ink-muted font-sans">
                    No transactions recorded in immutable ledger yet.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-2/60 transition">
                    <td className="py-3 font-bold text-accent-cyan">{tx.txRef}</td>
                    <td className="py-3 text-[11px] text-ink-muted">
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td className="py-3 font-sans">
                      <Pill tone={ledgerEntryTone(tx.entryType)}>
                        {tx.entryType.replace('_', ' ')}
                      </Pill>
                    </td>
                    <td className="py-3 text-ink-muted font-sans">
                      {tx.serviceType || '—'}
                    </td>
                    <td
                      className={`py-3 text-right font-bold ${
                        tx.amountUsd >= 0 ? 'text-accent-emerald' : 'text-accent-rose'
                      }`}
                    >
                      {tx.amountFormatted}
                    </td>
                    <td className="py-3 text-right text-ink">
                      {formatCurrencyUsd(tx.balanceAfterUsd)}
                    </td>
                    <td className="py-3 text-right text-ink-faint">
                      {tx.providerCostUsd != null ? formatCurrencyUsd(tx.providerCostUsd) : '—'}
                    </td>
                    <td className="py-3 font-sans max-w-xs truncate text-[11px] text-ink-muted">
                      {tx.reason || tx.reference || '—'}
                    </td>
                    <td className="py-3 text-[11px] text-ink-faint font-sans">
                      {tx.createdBy === 'system' ? 'System' : 'Super Admin'}
                    </td>
                    <td className="py-3 text-center font-sans">
                      <Pill tone="emerald">{tx.status}</Pill>
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
