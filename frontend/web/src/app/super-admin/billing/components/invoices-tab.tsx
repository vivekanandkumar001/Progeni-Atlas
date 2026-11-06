import { Check, PlusCircle } from 'lucide-react';
import { Card, Pill, Spinner } from '@/components/super-admin/ui';
import {
  formatCurrencyUsd,
  formatDateTime,
  type BillingAccount,
  type BillingInvoice,
} from '@/lib/super-admin';
import { invoiceStatusTone } from '@/lib/superadmin-billing';

interface InvoicesTabProps {
  loadingInvoices: boolean;
  invoices: BillingInvoice[];
  accounts: BillingAccount[];
  setInvoiceModalOpen: (open: boolean) => void;
  handlePayInvoice: (invoiceId: string) => Promise<void>;
}

export function InvoicesTab({
  loadingInvoices,
  invoices,
  accounts,
  setInvoiceModalOpen,
  handlePayInvoice,
}: InvoicesTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Enterprise Platform Invoices</h3>
            <p className="text-xs text-ink-muted">
              Issue, track, and reconcile customer invoices with immutable ledger deposits.
            </p>
          </div>
          <button
            onClick={() => setInvoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-accent-cyan hover:bg-cyan-500/20 transition"
          >
            <PlusCircle className="h-4 w-4" />
            Create New Invoice
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="pb-3 font-semibold">Invoice Number</th>
                <th className="pb-3 font-semibold">Organization</th>
                <th className="pb-3 font-semibold text-right">Total Amount</th>
                <th className="pb-3 font-semibold text-right">Amount Due</th>
                <th className="pb-3 font-semibold">Due Date</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {loadingInvoices ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-muted">
                    No enterprise invoices created yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2/60 transition">
                    <td className="py-3 font-mono font-bold text-accent-cyan">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 font-bold text-ink">
                      {accounts.find((a) => a.orgId === inv.orgId)?.accountName || inv.orgId}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-ink">
                      {formatCurrencyUsd(inv.totalUsd)}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-accent-amber">
                      {formatCurrencyUsd(inv.amountDueUsd)}
                    </td>
                    <td className="py-3 text-ink-muted">{formatDateTime(inv.dueDate)}</td>
                    <td className="py-3 text-center">
                      <Pill tone={invoiceStatusTone(inv.status)}>{inv.status}</Pill>
                    </td>
                    <td className="py-3 text-right">
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => void handlePayInvoice(inv.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-semibold text-accent-emerald hover:bg-emerald-500/10 transition"
                        >
                          <Check className="h-3 w-3" />
                          Mark Paid
                        </button>
                      )}
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
