import { FileText, PlusCircle, X } from 'lucide-react';
import { Spinner } from '@/components/super-admin/ui';
import type { BillingAccount } from '@/lib/super-admin';

interface InvoiceModalProps {
  invoiceModalOpen: boolean;
  setInvoiceModalOpen: (open: boolean) => void;
  accounts: BillingAccount[];
  formInvoiceOrgId: string;
  setFormInvoiceOrgId: (value: string) => void;
  formInvoiceTotal: string;
  setFormInvoiceTotal: (value: string) => void;
  formInvoiceDesc: string;
  setFormInvoiceDesc: (value: string) => void;
  actionLoading: boolean;
  handleCreateInvoice: () => Promise<void>;
}

export function InvoiceModal({
  invoiceModalOpen,
  setInvoiceModalOpen,
  accounts,
  formInvoiceOrgId,
  setFormInvoiceOrgId,
  formInvoiceTotal,
  setFormInvoiceTotal,
  formInvoiceDesc,
  setFormInvoiceDesc,
  actionLoading,
  handleCreateInvoice,
}: InvoiceModalProps) {
  if (!invoiceModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setInvoiceModalOpen(false);
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2 text-accent-cyan">
            <FileText className="h-5 w-5" />
            <h3 className="font-bold text-ink">Generate Enterprise Invoice</h3>
          </div>
          <button
            onClick={() => setInvoiceModalOpen(false)}
            className="text-ink-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block text-ink-muted mb-1">Select Organization *</label>
            <select
              value={formInvoiceOrgId}
              onChange={(e) => setFormInvoiceOrgId(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink outline-none"
            >
              <option value="">Choose tenant...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.orgId || ''}>
                  {a.accountName} ({a.tier || 'starter'})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-ink-muted mb-1">Total Amount (₹ INR) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formInvoiceTotal}
              onChange={(e) => setFormInvoiceTotal(e.target.value)}
              placeholder="250.00"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink font-mono font-bold focus:border-cyan-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-ink-muted mb-1">Invoice Description *</label>
            <input
              type="text"
              value={formInvoiceDesc}
              onChange={(e) => setFormInvoiceDesc(e.target.value)}
              placeholder="Enterprise AI Technical Screening SLA Annual Package Q4"
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-ink focus:border-cyan-500 outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => setInvoiceModalOpen(false)}
            className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleCreateInvoice()}
            disabled={actionLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-accent-cyan hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {actionLoading ? <Spinner /> : <PlusCircle className="h-3.5 w-3.5" />}
            Issue Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
