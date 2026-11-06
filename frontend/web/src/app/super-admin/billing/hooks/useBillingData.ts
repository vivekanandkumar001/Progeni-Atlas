'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  saFetch,
  type BillingAccount,
  type BillingInvoice,
  type BillingLedgerEntry,
  type BillingOverview,
  type DailyBillingTrend,
  type DemoAnalyticsSummary,
  type RateCard,
  type ServiceUsageMetric,
} from '@/lib/super-admin';
import type { PricingPolicy, Tab } from '../billing-types';

interface UseBillingDataOptions {
  /** Active billing tab — drives which secondary datasets load. */
  activeTab: Tab;
}

/**
 * Owns every read-side piece of the Billing Center: loading flags, fetched
 * datasets, ledger filters, the open dossier account, and the loaders /
 * refresh orchestration that keep them in sync.
 */
export function useBillingData({ activeTab }: UseBillingDataOptions) {
  // Loading states
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [demoAnalytics, setDemoAnalytics] = useState<DemoAnalyticsSummary | null>(null);
  const [servicesBreakdown, setServicesBreakdown] = useState<Record<string, ServiceUsageMetric>>({});
  const [trend, setTrend] = useState<DailyBillingTrend[]>([]);
  const [accounts, setAccounts] = useState<BillingAccount[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<BillingLedgerEntry[]>([]);
  const [totalLedgerCount, setTotalLedgerCount] = useState(0);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [rateCards, setRateCards] = useState<RateCard[]>([]);

  // Filtering & Pagination
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('all');
  const [ledgerAccountFilter, setLedgerAccountFilter] = useState('all');
  const [ledgerServiceFilter, setLedgerServiceFilter] = useState('all');

  // Dossier drawer (kept here so refreshed accounts re-sync it)
  const [dossierAccount, setDossierAccount] = useState<BillingAccount | null>(null);

  const [pricingPolicy, setPricingPolicy] = useState<PricingPolicy | null>(null);

  /* ------------------------------------------------------------- loaders */

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await saFetch<{
        success: boolean;
        overview: BillingOverview;
        services: Record<string, ServiceUsageMetric>;
        demoAnalytics?: DemoAnalyticsSummary;
        trend: DailyBillingTrend[];
      }>('/api/super-admin/billing/overview');
      if (res.success) {
        setOverview(res.overview);
        setDemoAnalytics(res.demoAnalytics || null);
        setServicesBreakdown(res.services || {});
        setTrend(res.trend || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing overview.');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await saFetch<{ success: boolean; accounts: BillingAccount[] }>(
        '/api/super-admin/billing/accounts'
      );
      if (res.success && Array.isArray(res.accounts)) {
        setAccounts(res.accounts);
        setDossierAccount((curr) => {
          if (!curr) return null;
          return res.accounts.find((a) => a.id === curr.id) || curr;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const params = new URLSearchParams();
      if (ledgerTypeFilter !== 'all') params.set('entry_type', ledgerTypeFilter);
      if (ledgerAccountFilter !== 'all') params.set('account_id', ledgerAccountFilter);
      if (ledgerServiceFilter !== 'all') params.set('service_type', ledgerServiceFilter);
      params.set('limit', '100');

      const res = await saFetch<{
        success: boolean;
        entries?: BillingLedgerEntry[];
        transactions?: BillingLedgerEntry[];
        total: number;
      }>(`/api/super-admin/billing/ledger?${params.toString()}`);
      if (res.success) {
        setLedgerEntries(res.entries || res.transactions || []);
        setTotalLedgerCount(res.total || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transaction ledger.');
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerTypeFilter, ledgerAccountFilter, ledgerServiceFilter]);

  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const res = await saFetch<{ success: boolean; invoices: BillingInvoice[] }>(
        '/api/super-admin/billing/invoices'
      );
      if (res.success) {
        setInvoices(res.invoices || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load platform invoices.');
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  const loadRateCards = useCallback(async () => {
    setLoadingRates(true);
    try {
      const res = await saFetch<{ success: boolean; rateCards: RateCard[] }>(
        '/api/super-admin/billing/rate-cards'
      );
      if (res.success) {
        setRateCards(res.rateCards || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rate cards.');
    } finally {
      setLoadingRates(false);
    }
  }, []);

  const loadPricingPolicy = useCallback(async () => {
    try {
      const res = await saFetch<{ success: boolean; pricingPolicy: PricingPolicy }>(
        '/api/super-admin/billing/pricing-policy'
      );
      if (res.success && res.pricingPolicy) {
        setPricingPolicy(res.pricingPolicy);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([loadOverview(), loadAccounts(), loadPricingPolicy()]);
    if (activeTab === 'ledger' || dossierAccount) void loadLedger();
    if (activeTab === 'invoices') void loadInvoices();
    if (activeTab === 'rates') {
      void loadRateCards();
      void loadPricingPolicy();
    }
  }, [loadOverview, loadAccounts, loadPricingPolicy, loadLedger, loadInvoices, loadRateCards, activeTab, dossierAccount]);

  useEffect(() => {
    void loadOverview();
    void loadAccounts();
    void loadPricingPolicy();
  }, [loadOverview, loadAccounts, loadPricingPolicy]);

  useEffect(() => {
    if (activeTab === 'ledger' || dossierAccount) void loadLedger();
    if (activeTab === 'invoices') void loadInvoices();
    if (activeTab === 'rates') {
      void loadRateCards();
      void loadPricingPolicy();
    }
  }, [activeTab, dossierAccount, loadLedger, loadInvoices, loadRateCards, loadPricingPolicy]);

  return {
    // Loading states
    loadingOverview,
    loadingAccounts,
    loadingLedger,
    loadingInvoices,
    loadingRates,
    error,

    // Data states
    overview,
    demoAnalytics,
    servicesBreakdown,
    trend,
    accounts,
    ledgerEntries,
    totalLedgerCount,
    invoices,
    rateCards,
    pricingPolicy,

    // Ledger filters
    ledgerTypeFilter,
    setLedgerTypeFilter,
    ledgerAccountFilter,
    setLedgerAccountFilter,
    ledgerServiceFilter,
    setLedgerServiceFilter,

    // Dossier drawer
    dossierAccount,
    setDossierAccount,

    // Loaders used by mutation flows
    loadInvoices,
    loadRateCards,
    setPricingPolicy,
    refreshAll,
  };
}
