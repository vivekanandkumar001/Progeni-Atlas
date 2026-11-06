import { BarChart3, Building2, FileText, History, Scale } from 'lucide-react';
import type { BillingAccount, BillingInvoice } from '@/lib/super-admin';
import type { Tab } from '../billing-types';

interface BillingTabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  accounts: BillingAccount[];
  invoices: BillingInvoice[];
}

export function BillingTabs({ activeTab, setActiveTab, accounts, invoices }: BillingTabsProps) {
  return (
    <div className="flex items-center gap-2 border-b border-line pb-2">
      {[
        { key: 'overview', label: 'Financial Overview', icon: BarChart3 },
        { key: 'accounts', label: `Tenants & Wallets (${accounts.length})`, icon: Building2 },
        { key: 'ledger', label: 'Immutable Ledger', icon: History },
        { key: 'invoices', label: `Invoices (${invoices.length})`, icon: FileText },
        { key: 'rates', label: 'Rate Cards & Pricing', icon: Scale },
      ].map((t) => {
        const Icon = t.icon;
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as Tab)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              isActive
                ? 'border border-cyan-500/30 bg-cyan-500/10 text-accent-cyan shadow-sm'
                : 'text-ink-muted hover:bg-surface hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
