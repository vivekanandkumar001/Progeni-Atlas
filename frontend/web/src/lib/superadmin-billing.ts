/**
 * Pure business logic for the Super Admin Billing Center.
 * No React, no DOM, no network — every function here is unit-testable.
 */

import type { BillingAccount, BillingLedgerEntry } from './super-admin';

/** Pill tone for immutable ledger entry types. */
export type LedgerEntryTone = 'emerald' | 'violet' | 'rose' | 'amber' | 'cyan';

/** Pill tone for platform invoice statuses. */
export type InvoiceStatusTone = 'emerald' | 'rose' | 'amber';

/** Pill tone for billing account statuses. */
export type AccountStatusTone = 'emerald' | 'rose';

/**
 * Filter billing accounts by organization name, account id, org id,
 * or billing email. An empty/whitespace search returns the list unchanged.
 */
export function filterBillingAccounts(
  accounts: BillingAccount[],
  search: string
): BillingAccount[] {
  const q = search.trim().toLowerCase();
  if (!q) return accounts;
  return accounts.filter(
    (a) =>
      (a.accountName || '').toLowerCase().includes(q) ||
      (a.id || '').toLowerCase().includes(q) ||
      (a.orgId || '').toLowerCase().includes(q) ||
      (a.billingEmail || '').toLowerCase().includes(q)
  );
}

/** Map a ledger entry type to its display pill tone. */
export function ledgerEntryTone(entryType: string): LedgerEntryTone {
  return entryType === 'recharge_paid' || entryType === 'invoice_payment'
    ? 'emerald'
    : entryType === 'credit_grant'
    ? 'violet'
    : entryType === 'service_debit'
    ? 'rose'
    : entryType === 'refund'
    ? 'amber'
    : 'cyan';
}

/** Map an invoice status to its display pill tone. */
export function invoiceStatusTone(status: string): InvoiceStatusTone {
  return status === 'paid' ? 'emerald' : status === 'overdue' ? 'rose' : 'amber';
}

/** Map a billing account status to its display pill tone. */
export function accountStatusTone(status: string): AccountStatusTone {
  return status === 'active' ? 'emerald' : 'rose';
}

/** Ledger entries belonging to a single tenant account. */
export function entriesForAccount(
  entries: BillingLedgerEntry[],
  accountId: string
): BillingLedgerEntry[] {
  return entries.filter((l) => l.accountId === accountId);
}

/**
 * Convert a nano-USD threshold to its USD string form, defaulting to
 * the $10.00 safety threshold when unset.
 */
export function nanoUsdToUsdString(nanoUsd?: number | null): string {
  return ((nanoUsd || 10_000_000_000) / 1_000_000_000).toString();
}

/** Two-letter uppercase initials badge for an organization name. */
export function orgInitials(name?: string | null): string {
  return (name || 'ORG').slice(0, 2).toUpperCase();
}
