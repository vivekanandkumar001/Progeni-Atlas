import { Download } from 'lucide-react';
import { PageHeader, RefreshButton } from '@/components/super-admin/ui';

interface BillingPageHeaderProps {
  downloadStatementCsv: (accountId?: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  loadingOverview: boolean;
  loadingAccounts: boolean;
}

export function BillingPageHeader({
  downloadStatementCsv,
  refreshAll,
  loadingOverview,
  loadingAccounts,
}: BillingPageHeaderProps) {
  return (
    <PageHeader
      title="Enterprise Billing & Usage Management Center"
      description="Comprehensive platform finance oversight: organization wallets, service metering, versioned rate cards, immutable double-entry ledger, and verified reconciliation."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => void downloadStatementCsv()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-surface-3"
          >
            <Download className="h-3.5 w-3.5 text-accent-cyan" />
            Export Full Ledger CSV
          </button>
          <RefreshButton onClick={refreshAll} loading={loadingOverview || loadingAccounts} />
        </div>
      }
    />
  );
}
