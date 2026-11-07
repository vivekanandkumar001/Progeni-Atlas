'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import {
  formatCurrencyUsd,
  saFetch,
  type BillingAccount,
  type BillingLedgerEntry,
  type RateCard,
  type ReconciliationResult,
} from '@/lib/super-admin';
import { apiFetch } from '@/lib/api';
import type { PricingPolicy } from '../billing-types';

interface UseBillingActionsOptions {
  refreshAll: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadRateCards: () => Promise<void>;
  setPricingPolicy: Dispatch<SetStateAction<PricingPolicy | null>>;
}

/**
 * Owns every write-side piece of the Billing Center: action/mutation loading
 * flags, modal + form state, and the handlers that call the billing mutation
 * endpoints (recharge, grant, refund, adjust, reconcile, budget, invoices,
 * rate cards, pricing policy, CSV export).
 */
export function useBillingActions({
  refreshAll,
  loadInvoices,
  loadRateCards,
  setPricingPolicy,
}: UseBillingActionsOptions) {
  const { toast } = useSuperAdmin();

  const [actionLoading, setActionLoading] = useState(false);

  // Modals & Drawers
  const [activeAccount, setActiveAccount] = useState<BillingAccount | null>(null);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<ReconciliationResult | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null);

  // Form Inputs
  const [formAmount, setFormAmount] = useState<string>('');
  const [formReference, setFormReference] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('');
  const [formThreshold, setFormThreshold] = useState<string>('10.0');
  const [formAutoRechargeEnabled, setFormAutoRechargeEnabled] = useState(false);
  const [formAutoRechargeAmount, setFormAutoRechargeAmount] = useState('50.0');
  const [formInvoiceOrgId, setFormInvoiceOrgId] = useState('');
  const [formInvoiceTotal, setFormInvoiceTotal] = useState('');
  const [formInvoiceDesc, setFormInvoiceDesc] = useState('');
  const [formRateValues, setFormRateValues] = useState<Record<string, string>>({});

  const [savingPolicy, setSavingPolicy] = useState(false);

  /* ------------------------------------------------------------- mutations */

  const handleRecharge = async () => {
    if (!activeAccount) return;
    const amountNum = parseFloat(formAmount);
    if (!amountNum || amountNum <= 0) {
      toast('Please enter a valid recharge amount.', 'error');
      return;
    }
    if (!formReference.trim()) {
      toast('Payment reference / transaction ID is required.', 'error');
      return;
    }
    if (formReason.trim().length < 10) {
      toast('Reason must be at least 10 characters explaining the recharge.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string; transaction: BillingLedgerEntry }>(
        `/api/super-admin/billing/accounts/${activeAccount.id}/recharge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountNum,
            paymentReference: formReference.trim(),
            notes: formReason.trim(),
            idempotencyKey: `rech-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Recharge deposited successfully!', 'success');
        setRechargeModalOpen(false);
        setFormAmount('');
        setFormReference('');
        setFormReason('');
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to execute recharge.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!activeAccount) return;
    const amountNum = parseFloat(formAmount);
    if (!amountNum || amountNum <= 0) {
      toast('Please enter a valid grant amount.', 'error');
      return;
    }
    if (formReason.trim().length < 10) {
      toast('Operational reason must be at least 10 characters.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/billing/accounts/${activeAccount.id}/grant`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountNum,
            notes: formReason.trim(),
            idempotencyKey: `grant-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Promotional credit granted!', 'success');
        setGrantModalOpen(false);
        setFormAmount('');
        setFormReason('');
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to grant promotional credits.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!activeAccount) return;
    const amountNum = parseFloat(formAmount);
    if (!amountNum || amountNum <= 0) {
      toast('Please enter a valid refund amount.', 'error');
      return;
    }
    if (!formReference.trim()) {
      toast('Original transaction reference is required for a refund.', 'error');
      return;
    }
    if (formReason.trim().length < 10) {
      toast('Reason must be at least 10 characters explaining the refund.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/billing/accounts/${activeAccount.id}/refund`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountNum,
            originalTxRef: formReference.trim(),
            notes: formReason.trim(),
            idempotencyKey: `rfnd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Refund issued successfully!', 'success');
        setRefundModalOpen(false);
        setFormAmount('');
        setFormReference('');
        setFormReason('');
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to issue refund.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjust = async () => {
    if (!activeAccount) return;
    const amountNum = parseFloat(formAmount);
    if (!amountNum || amountNum === 0) {
      toast('Adjustment amount cannot be zero.', 'error');
      return;
    }
    if (formReason.trim().length < 10) {
      toast('Reason must be at least 10 characters explaining the balance adjustment.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/billing/accounts/${activeAccount.id}/adjust`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountNum,
            notes: formReason.trim(),
            idempotencyKey: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Balance adjusted successfully!', 'success');
        setAdjustModalOpen(false);
        setFormAmount('');
        setFormReason('');
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to adjust balance.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconcile = async (account: BillingAccount) => {
    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; reconciliation: ReconciliationResult }>(
        `/api/super-admin/billing/accounts/${account.id}/reconcile`,
        { method: 'POST' }
      );
      if (res.success) {
        setReconcileResult(res.reconciliation);
        if (res.reconciliation.isReconciled) {
          toast(
            `Account perfectly reconciled! ${res.reconciliation.transactionCount} transactions matched.`,
            'success'
          );
        } else {
          const discUsd = (res.reconciliation.discrepancyNanoUsd || 0) / 1_000_000_000;
          toast(
            `Discrepancy detected and automatically corrected: ${formatCurrencyUsd(discUsd)}`,
            'error'
          );
        }
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to reconcile account.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!activeAccount) return;
    const threshNum = parseFloat(formThreshold);
    const autoAmountNum = parseFloat(formAutoRechargeAmount);

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/billing/accounts/${activeAccount.id}/budget`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lowBalanceThresholdUsd: threshNum || 10.0,
            autoRechargeEnabled: formAutoRechargeEnabled,
            autoRechargeAmountUsd: autoAmountNum || 50.0,
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Budget & threshold policy saved!', 'success');
        setBudgetModalOpen(false);
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update budget thresholds.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!formInvoiceOrgId.trim()) {
      toast('Please select an organization.', 'error');
      return;
    }
    const tot = parseFloat(formInvoiceTotal);
    if (!tot || tot <= 0) {
      toast('Please specify a positive invoice amount.', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        '/api/super-admin/billing/invoices',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgId: formInvoiceOrgId.trim(),
            total: tot,
            description: formInvoiceDesc.trim() || 'Enterprise AI Screening Platform Invoice',
            dueDays: 30,
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Invoice generated successfully!', 'success');
        setInvoiceModalOpen(false);
        setFormInvoiceOrgId('');
        setFormInvoiceTotal('');
        setFormInvoiceDesc('');
        await loadInvoices();
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create invoice.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    const paymentRef = window.prompt(
      'Enter bank transfer, check, or wire transaction reference:',
      `PAY-${Date.now()}`
    );
    if (!paymentRef || !paymentRef.trim()) return;

    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/billing/invoices/${invoiceId}/pay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentReference: paymentRef.trim(),
            notes: 'Super Admin marked invoice as settled via verified payment reference.',
          }),
        }
      );
      if (res.success) {
        toast(res.message || 'Invoice settled and ledger credited!', 'success');
        await loadInvoices();
        await refreshAll();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to mark invoice as paid.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRateCard = async () => {
    if (!selectedRateCard) return;
    setActionLoading(true);
    try {
      const res = await saFetch<{ success: boolean; message: string }>(
        `/api/super-admin/billing/rate-cards/${selectedRateCard.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rates: formRateValues }),
        }
      );
      if (res.success) {
        toast(res.message || 'Rate card updated successfully!', 'success');
        setRateModalOpen(false);
        await loadRateCards();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update rate card.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePolicy = async (updates: Partial<PricingPolicy>) => {
    setSavingPolicy(true);
    try {
      const res = await saFetch<{ success: boolean; message: string; pricingPolicy: PricingPolicy }>(
        '/api/super-admin/billing/pricing-policy',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (res.success && res.pricingPolicy) {
        toast(res.message || 'Pricing policy updated successfully!', 'success');
        setPricingPolicy(res.pricingPolicy);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update pricing policy.', 'error');
    } finally {
      setSavingPolicy(false);
    }
  };

  const downloadStatementCsv = async (accountId?: string) => {
    try {
      const url = accountId
        ? `/api/super-admin/billing/ledger/export?account_id=${accountId}`
        : '/api/super-admin/billing/ledger/export';
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('Failed to generate CSV statement.');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `progeni_atlas_financial_ledger_${accountId || 'all'}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Statement CSV generated and downloaded.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed.', 'error');
    }
  };

  return {
    actionLoading,

    // Modals & Drawers
    activeAccount,
    setActiveAccount,
    rechargeModalOpen,
    setRechargeModalOpen,
    grantModalOpen,
    setGrantModalOpen,
    refundModalOpen,
    setRefundModalOpen,
    adjustModalOpen,
    budgetModalOpen,
    setBudgetModalOpen,
    reconcileResult,
    invoiceModalOpen,
    setInvoiceModalOpen,
    rateModalOpen,
    setRateModalOpen,
    selectedRateCard,
    setSelectedRateCard,

    // Form Inputs
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
    formInvoiceOrgId,
    setFormInvoiceOrgId,
    formInvoiceTotal,
    setFormInvoiceTotal,
    formInvoiceDesc,
    setFormInvoiceDesc,
    formRateValues,
    setFormRateValues,

    savingPolicy,

    // Mutation handlers
    handleRecharge,
    handleGrant,
    handleRefund,
    handleAdjust,
    handleReconcile,
    handleSaveBudget,
    handleCreateInvoice,
    handlePayInvoice,
    handleUpdateRateCard,
    handleUpdatePolicy,
    downloadStatementCsv,
  };
}
