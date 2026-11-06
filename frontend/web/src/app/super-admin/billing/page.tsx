'use client';

import { useState } from 'react';
import { ErrorBanner } from '@/components/super-admin/ui';
import { useBillingData } from './hooks/useBillingData';
import { useBillingActions } from './hooks/useBillingActions';
import { BillingPageHeader } from './components/billing-page-header';
import { BillingTabs } from './components/billing-tabs';
import { OverviewTab } from './components/overview-tab';
import { AccountsTab } from './components/accounts-tab';
import { LedgerTab } from './components/ledger-tab';
import { InvoicesTab } from './components/invoices-tab';
import { RatesTab } from './components/rates-tab';
import { AccountModals } from './components/account-modals';
import { InvoiceModal } from './components/invoice-modal';
import { RateModal } from './components/rate-modal';
import { DossierDrawer } from './components/dossier-drawer';
import type { Tab } from './billing-types';

export default function SuperAdminBillingCenterPage() {
  // Navigation & View
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Filtering (page-scoped so it persists across tab switches)
  const [accountSearch, setAccountSearch] = useState('');

  // Read side: loading flags, datasets, ledger filters, open dossier
  const {
    loadingOverview,
    loadingAccounts,
    loadingLedger,
    loadingInvoices,
    loadingRates,
    error,
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
    ledgerTypeFilter,
    setLedgerTypeFilter,
    ledgerAccountFilter,
    setLedgerAccountFilter,
    ledgerServiceFilter,
    setLedgerServiceFilter,
    dossierAccount,
    setDossierAccount,
    loadInvoices,
    loadRateCards,
    setPricingPolicy,
    refreshAll,
  } = useBillingData({ activeTab });

  // Write side: mutation flags, modals, forms, handlers
  const {
    actionLoading,
    activeAccount,
    setActiveAccount,
    rechargeModalOpen,
    setRechargeModalOpen,
    grantModalOpen,
    setGrantModalOpen,
    refundModalOpen,
    setRefundModalOpen,
    budgetModalOpen,
    setBudgetModalOpen,
    invoiceModalOpen,
    setInvoiceModalOpen,
    rateModalOpen,
    setRateModalOpen,
    selectedRateCard,
    setSelectedRateCard,
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
    handleRecharge,
    handleGrant,
    handleRefund,
    handleReconcile,
    handleSaveBudget,
    handleCreateInvoice,
    handlePayInvoice,
    handleUpdateRateCard,
    handleUpdatePolicy,
    downloadStatementCsv,
  } = useBillingActions({ refreshAll, loadInvoices, loadRateCards, setPricingPolicy });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BillingPageHeader
        downloadStatementCsv={downloadStatementCsv}
        refreshAll={refreshAll}
        loadingOverview={loadingOverview}
        loadingAccounts={loadingAccounts}
      />

      {error && <ErrorBanner message={error} />}

      {/* Tabs */}
      <BillingTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        accounts={accounts}
        invoices={invoices}
      />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <OverviewTab
          loadingOverview={loadingOverview}
          overview={overview}
          demoAnalytics={demoAnalytics}
          servicesBreakdown={servicesBreakdown}
          trend={trend}
        />
      )}

      {/* TAB 2: TENANTS & WALLETS */}
      {activeTab === 'accounts' && (
        <AccountsTab
          accounts={accounts}
          accountSearch={accountSearch}
          setAccountSearch={setAccountSearch}
          loadingAccounts={loadingAccounts}
          setActiveAccount={setActiveAccount}
          setRechargeModalOpen={setRechargeModalOpen}
          setGrantModalOpen={setGrantModalOpen}
          setRefundModalOpen={setRefundModalOpen}
          handleReconcile={handleReconcile}
          setFormThreshold={setFormThreshold}
          setFormAutoRechargeEnabled={setFormAutoRechargeEnabled}
          setBudgetModalOpen={setBudgetModalOpen}
          setDossierAccount={setDossierAccount}
        />
      )}

      {/* TAB 3: IMMUTABLE FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <LedgerTab
          ledgerTypeFilter={ledgerTypeFilter}
          setLedgerTypeFilter={setLedgerTypeFilter}
          ledgerAccountFilter={ledgerAccountFilter}
          setLedgerAccountFilter={setLedgerAccountFilter}
          ledgerServiceFilter={ledgerServiceFilter}
          setLedgerServiceFilter={setLedgerServiceFilter}
          accounts={accounts}
          ledgerEntries={ledgerEntries}
          totalLedgerCount={totalLedgerCount}
          loadingLedger={loadingLedger}
          downloadStatementCsv={downloadStatementCsv}
        />
      )}

      {/* TAB 4: INVOICES */}
      {activeTab === 'invoices' && (
        <InvoicesTab
          loadingInvoices={loadingInvoices}
          invoices={invoices}
          accounts={accounts}
          setInvoiceModalOpen={setInvoiceModalOpen}
          handlePayInvoice={handlePayInvoice}
        />
      )}

      {/* TAB 5: RATE CARDS & PRICING RULES */}
      {activeTab === 'rates' && (
        <RatesTab
          pricingPolicy={pricingPolicy}
          savingPolicy={savingPolicy}
          handleUpdatePolicy={handleUpdatePolicy}
          rateCards={rateCards}
          loadingRates={loadingRates}
          setSelectedRateCard={setSelectedRateCard}
          setFormRateValues={setFormRateValues}
          setRateModalOpen={setRateModalOpen}
        />
      )}

      {/* ------------------------------------------------------------- MODALS */}

      {/* 1-4. RECHARGE / GRANT / REFUND / BUDGET MODALS */}
      <AccountModals
        rechargeModalOpen={rechargeModalOpen}
        setRechargeModalOpen={setRechargeModalOpen}
        grantModalOpen={grantModalOpen}
        setGrantModalOpen={setGrantModalOpen}
        refundModalOpen={refundModalOpen}
        setRefundModalOpen={setRefundModalOpen}
        budgetModalOpen={budgetModalOpen}
        setBudgetModalOpen={setBudgetModalOpen}
        activeAccount={activeAccount}
        formAmount={formAmount}
        setFormAmount={setFormAmount}
        formReference={formReference}
        setFormReference={setFormReference}
        formReason={formReason}
        setFormReason={setFormReason}
        formThreshold={formThreshold}
        setFormThreshold={setFormThreshold}
        formAutoRechargeEnabled={formAutoRechargeEnabled}
        setFormAutoRechargeEnabled={setFormAutoRechargeEnabled}
        formAutoRechargeAmount={formAutoRechargeAmount}
        setFormAutoRechargeAmount={setFormAutoRechargeAmount}
        actionLoading={actionLoading}
        handleRecharge={handleRecharge}
        handleGrant={handleGrant}
        handleRefund={handleRefund}
        handleSaveBudget={handleSaveBudget}
      />

      {/* 5. CREATE INVOICE MODAL */}
      <InvoiceModal
        invoiceModalOpen={invoiceModalOpen}
        setInvoiceModalOpen={setInvoiceModalOpen}
        accounts={accounts}
        formInvoiceOrgId={formInvoiceOrgId}
        setFormInvoiceOrgId={setFormInvoiceOrgId}
        formInvoiceTotal={formInvoiceTotal}
        setFormInvoiceTotal={setFormInvoiceTotal}
        formInvoiceDesc={formInvoiceDesc}
        setFormInvoiceDesc={setFormInvoiceDesc}
        actionLoading={actionLoading}
        handleCreateInvoice={handleCreateInvoice}
      />

      {/* 6. RATE CARD EDIT MODAL */}
      <RateModal
        rateModalOpen={rateModalOpen}
        setRateModalOpen={setRateModalOpen}
        selectedRateCard={selectedRateCard}
        formRateValues={formRateValues}
        setFormRateValues={setFormRateValues}
        actionLoading={actionLoading}
        handleUpdateRateCard={handleUpdateRateCard}
      />

      {/* 7. TENANT FINANCIAL DOSSIER DRAWER */}
      <DossierDrawer
        dossierAccount={dossierAccount}
        setDossierAccount={setDossierAccount}
        ledgerEntries={ledgerEntries}
        setActiveAccount={setActiveAccount}
        setRechargeModalOpen={setRechargeModalOpen}
        setGrantModalOpen={setGrantModalOpen}
        setRefundModalOpen={setRefundModalOpen}
        handleReconcile={handleReconcile}
        downloadStatementCsv={downloadStatementCsv}
      />
    </div>
  );
}
