'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { apiFetch } from '@/lib/api';
import {
  Wallet,
  CreditCard,
  RefreshCw,
  Plus,
  ShieldCheck,
  Clock,
  Zap,
  Gift,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Building2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Search,
  ExternalLink,
  Receipt,
  FileText,
  Video,
  ChevronRight,
  Info
} from 'lucide-react';
import { openRazorpayCheckout } from '@/lib/razorpay';

interface WalletData {
  accountId: string;
  accountName: string;
  accountType: string;
  orgId: string | null;
  userId: string | null;
  currency: string;
  ratePerMinuteCredits: number;
  baseFeeCredits: number;
  availableCredits: number;
  paidCredits: number;
  promotionalCredits: number;
  consumedCredits: number;
  reservedCredits: number;
  lowBalanceThresholdCredits: number;
  isLowBalance: boolean;
  chargingEnabled: boolean;
  demoQuota: {
    totalAllowed: number;
    completed: number;
    remaining: number;
    maxDurationSeconds: number;
  };
}

interface WalletTransaction {
  id: string;
  txRef: string;
  entryType: string;
  category?: 'IN' | 'OUT' | 'DEMO';
  title?: string;
  reason?: string;
  amountCredits: number;
  amountInr?: number;
  balanceAfter?: number;
  status: string;
  createdAt: string;
  sessionId?: string;
  roleTitle?: string;
  interviewType?: string;
  durationMinutes?: number;
  ratePerMinute?: number;
  paymentId?: string;
  orderId?: string;
}

interface TransactionSummary {
  availableCredits: number;
  totalCredited: number;
  totalDebited: number;
  count: number;
}

const CANDIDATE_PACKS = [
  { credits: 100, inr: 100, minutes: 50, badge: 'Quick Practice' },
  { credits: 300, inr: 300, minutes: 150, badge: 'Standard Drill', popular: true },
  { credits: 600, inr: 600, minutes: 300, badge: 'Comprehensive Prep' },
];

export default function CandidateWalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number>(300);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [recharging, setRecharging] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Paytm-style filter and search state
  const [activeTab, setActiveTab] = useState<'ALL' | 'OUT' | 'IN' | 'DEMO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/billing/wallet');
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; wallet: WalletData };
        if (data.success && data.wallet) {
          setWallet(data.wallet);
        }
      }
      const txRes = await apiFetch('/api/billing/wallet/transactions?limit=50');
      if (txRes.ok) {
        const txData = (await txRes.json()) as {
          success: boolean;
          transactions: WalletTransaction[];
          summary?: TransactionSummary;
        };
        if (txData.success && Array.isArray(txData.transactions)) {
          setTransactions(txData.transactions);
          if (txData.summary) {
            setSummary(txData.summary);
          }
        }
      }
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : 'Failed to load wallet data.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const handleRecharge = async () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedPack;
    if (!amount || amount <= 0) {
      setMessage({ text: 'Please enter a valid credit amount.', type: 'error' });
      return;
    }

    setRecharging(true);
    setMessage(null);

    await openRazorpayCheckout({
      amountCredits: amount,
      onSuccess: async (data) => {
        setMessage({ text: data.message, type: 'success' });
        setRechargeModalOpen(false);
        setCustomAmount('');
        setRecharging(false);
        await loadWallet();
      },
      onError: (errMsg) => {
        setMessage({ text: errMsg, type: 'error' });
        setRecharging(false);
      },
      onDismiss: () => {
        setRecharging(false);
      },
    });
  };

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Tab filter
      if (activeTab === 'OUT' && (tx.category !== 'OUT' && tx.amountCredits >= 0)) return false;
      if (activeTab === 'IN' && (tx.category !== 'IN' && tx.amountCredits <= 0)) return false;
      if (activeTab === 'DEMO' && (tx.category !== 'DEMO' && tx.entryType !== 'free_demo')) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (tx.title || '').toLowerCase().includes(q);
        const reasonMatch = (tx.reason || '').toLowerCase().includes(q);
        const refMatch = (tx.txRef || '').toLowerCase().includes(q);
        const roleMatch = (tx.roleTitle || '').toLowerCase().includes(q);
        const sessionMatch = (tx.sessionId || '').toLowerCase().includes(q);
        if (!titleMatch && !reasonMatch && !refMatch && !roleMatch && !sessionMatch) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, activeTab, searchQuery]);

  // Tab counts
  const counts = useMemo(() => {
    const all = transactions.length;
    const debits = transactions.filter((t) => t.category === 'OUT' || t.amountCredits < 0).length;
    const credits = transactions.filter((t) => t.category === 'IN' || t.amountCredits > 0).length;
    const demos = transactions.filter((t) => t.category === 'DEMO' || t.entryType === 'free_demo').length;
    return { all, debits, credits, demos };
  }, [transactions]);

  // Overall sums
  const availableBal = Math.max(0, wallet?.availableCredits ?? summary?.availableCredits ?? 0);
  const totalCredited = Math.max(0, summary?.totalCredited ?? 0);
  const totalDebited = Math.max(0, wallet?.consumedCredits ?? summary?.totalDebited ?? 0);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <DashboardHeader />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-accent-cyan">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight">Interview Credits & Passbook</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-accent-emerald border border-emerald-500/20">
                    Live Balance
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  Paytm-style transparent credit statement. Track exact interview deductions, practice durations, and recharge top-ups.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadWallet()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-line bg-surface hover:bg-surface-2 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setRechargeModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Credits
            </button>
          </div>
        </div>

        {/* Notifications & Banners */}
        {message && (
          <div
            className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="p-1 hover:opacity-80">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Paytm-Style Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Available Balance */}
          <div className="p-6 rounded-3xl border border-line bg-surface shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition" />
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider">Available Balance</span>
              <div className="p-1.5 rounded-lg bg-cyan-500/10 text-accent-cyan">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-ink">
                ₹{availableBal.toFixed(2)}
              </span>
              <span className="text-sm font-bold text-accent-cyan">
                ({availableBal.toFixed(0)} Credits)
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-ink-muted">₹1.00 = 1 Credit</span>
              <button
                onClick={() => setRechargeModalOpen(true)}
                className="text-accent-cyan hover:underline font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
              >
                + Top Up <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Card 2: Total Credits Added / Recharged */}
          <div className="p-6 rounded-3xl border border-line bg-surface shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition" />
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider">Total Added (Recharges)</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-accent-emerald">
                <ArrowDownLeft className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-accent-emerald">
                +₹{totalCredited.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-ink-muted">credited</span>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Includes welcome bonus + Razorpay online recharges.
            </p>
          </div>

          {/* Card 3: Total Spent on Practice & Technical Interviews */}
          <div className="p-6 rounded-3xl border border-line bg-surface shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition" />
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider">Spent on Interviews</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-accent-rose">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-accent-rose">
                -₹{totalDebited.toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-ink-muted">({totalDebited.toFixed(0)} Credits)</span>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Deducted across completed practice & technical screenings.
            </p>
          </div>

          {/* Card 4: Free Demo Quota */}
          <div className="p-6 rounded-3xl border border-line bg-surface shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition" />
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider">Free Demo Quota</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-ink">
                {wallet?.demoQuota?.remaining ?? 2}
              </span>
              <span className="text-sm font-semibold text-ink-muted">
                of {wallet?.demoQuota?.totalAllowed ?? 3} Free Demos Left
              </span>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Rate: ₹2.00 / min (2 cr/min) applied after free demo rounds.
            </p>
          </div>
        </div>

        {/* Paytm-Style Passbook & History Section */}
        <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-5 shadow-sm">
          {/* Header & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent-cyan" />
                <h2 className="text-lg font-black text-ink">Paytm Passbook & Credit History</h2>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Every interview practice debit and recharge credit with closing balances.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                placeholder="Search by role, session ID, or Ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-canvas border border-line text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Paytm-Style Segmented Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <span>All Transactions</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-surface-2 text-ink-muted'
                }`}
              >
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('OUT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'OUT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5 text-accent-rose" />
              <span>Spent on Interviews (-)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'OUT' ? 'bg-white/20 text-white' : 'bg-rose-500/10 text-accent-rose'
                }`}
              >
                {counts.debits}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('IN')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'IN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5 text-accent-emerald" />
              <span>Added / Recharges (+)</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'IN' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-accent-emerald'
                }`}
              >
                {counts.credits}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('DEMO')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'DEMO'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Free Demos</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'DEMO' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-400'
                }`}
              >
                {counts.demos}
              </span>
            </button>
          </div>

          {/* Transactions List (Paytm Passbook Style) */}
          <div className="space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-line rounded-2xl bg-canvas">
                <Receipt className="h-8 w-8 text-ink-muted mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-ink">No transactions found</p>
                <p className="text-xs text-ink-muted mt-1">
                  {searchQuery
                    ? `No transactions matching "${searchQuery}"`
                    : 'Your wallet transaction statement is clean.'}
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isCredit = tx.category === 'IN' || tx.amountCredits > 0;
                const isDemo = tx.category === 'DEMO' || tx.entryType === 'free_demo' || tx.amountCredits === 0;
                const isDebit = !isCredit && !isDemo;

                return (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="p-4 rounded-2xl border border-line bg-canvas hover:bg-surface-2 hover:border-cyan-500/30 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    {/* Left: Direction Icon + Title + Details */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`p-3 rounded-2xl shrink-0 mt-0.5 transition ${
                          isCredit
                            ? 'bg-emerald-500/10 text-accent-emerald group-hover:scale-105'
                            : isDebit
                            ? 'bg-rose-500/10 text-accent-rose group-hover:scale-105'
                            : 'bg-indigo-500/10 text-indigo-400 group-hover:scale-105'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : isDebit ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <Sparkles className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-ink truncate group-hover:text-accent-cyan transition">
                            {tx.title || (isCredit ? 'Money Added to Wallet' : 'Practice Interview Settlement')}
                          </h4>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isCredit
                                ? 'bg-emerald-500/10 text-accent-emerald'
                                : isDebit
                                ? 'bg-rose-500/10 text-accent-rose'
                                : 'bg-indigo-500/10 text-indigo-400'
                            }`}
                          >
                            {isCredit ? 'Credit In' : isDebit ? 'Debit Out' : 'Free Demo'}
                          </span>
                        </div>

                        {/* Subtext description / reason */}
                        <p className="text-xs text-ink-muted">
                          {tx.reason || (isCredit ? 'Recharge credit' : 'AI Technical Screening')}
                        </p>

                        {/* Metadata chips */}
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-muted pt-0.5">
                          <span className="font-mono">
                            {new Date(tx.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span className="font-mono bg-surface px-1.5 py-0.5 rounded border border-line/60 text-[10px]">
                            {tx.txRef}
                          </span>
                          {tx.sessionId && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-accent-cyan">
                                Session: {tx.sessionId.slice(0, 8)}...
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Paytm Closing Balance */}
                    <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-line/60 pt-2 md:pt-0 shrink-0">
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-lg font-black font-mono tracking-tight ${
                            isCredit
                              ? 'text-accent-emerald'
                              : isDebit
                              ? 'text-accent-rose'
                              : 'text-indigo-400'
                          }`}
                        >
                          {isCredit
                            ? `+ ₹${Math.abs(tx.amountCredits).toFixed(2)}`
                            : isDebit
                            ? `- ₹${Math.abs(tx.amountCredits).toFixed(2)}`
                            : `₹0.00`}
                        </span>
                        <span className="text-[11px] font-semibold text-ink-muted">
                          {isCredit
                            ? `(+${Math.abs(tx.amountCredits).toFixed(0)} cr)`
                            : isDebit
                            ? `(-${Math.abs(tx.amountCredits).toFixed(0)} cr)`
                            : '(Free Demo)'}
                        </span>
                      </div>

                      {/* Signature Paytm Passbook closing balance */}
                      {typeof tx.balanceAfter === 'number' && (
                        <div className="mt-1 text-[11px] font-medium text-ink-muted">
                          Closing Balance:{' '}
                          <strong className="text-ink font-mono font-bold">
                            ₹{tx.balanceAfter.toFixed(2)}
                          </strong>{' '}
                          <span className="text-[10px]">({tx.balanceAfter.toFixed(0)} cr)</span>
                        </div>
                      )}

                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-accent-emerald">
                        <CheckCircle2 className="h-3 w-3" />
                        {tx.status || 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Paytm-Style Transaction Receipt Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent-cyan" />
                <h3 className="text-lg font-bold text-ink">Transaction Details</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg hover:bg-surface-2 text-ink-muted cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Verified Green Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
              <div className="inline-flex p-2 rounded-full bg-emerald-500/20 text-accent-emerald mb-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="text-xs font-bold text-accent-emerald tracking-wide uppercase">
                Payment Settled & Verified
              </div>
              <div className="text-2xl font-black font-mono text-ink">
                {selectedTx.amountCredits >= 0
                  ? `+ ₹${selectedTx.amountCredits.toFixed(2)}`
                  : `- ₹${Math.abs(selectedTx.amountCredits).toFixed(2)}`}
              </div>
              <div className="text-xs text-ink-muted">
                {selectedTx.amountCredits >= 0
                  ? `Credited to your primary candidate wallet`
                  : `Deducted for AI technical screening session`}
              </div>
            </div>

            {/* Statement Fields Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-line/60">
                <span className="text-ink-muted">Transaction Reference</span>
                <span className="font-mono font-bold text-ink">{selectedTx.txRef}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-line/60">
                <span className="text-ink-muted">Title / Purpose</span>
                <span className="font-semibold text-ink text-right max-w-xs">{selectedTx.title}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-line/60">
                <span className="text-ink-muted">Detailed Reason</span>
                <span className="text-ink-muted text-right max-w-xs">{selectedTx.reason}</span>
              </div>

              {selectedTx.durationMinutes && (
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="text-ink-muted">Interview Duration</span>
                  <span className="font-bold text-ink">{selectedTx.durationMinutes} minutes</span>
                </div>
              )}

              {selectedTx.ratePerMinute !== undefined && (
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="text-ink-muted">Billing Rate</span>
                  <span className="font-mono text-ink">
                    {selectedTx.ratePerMinute > 0
                      ? `₹${selectedTx.ratePerMinute.toFixed(2)} / min (${selectedTx.ratePerMinute} cr/min)`
                      : 'Free Demo (₹0.00)'}
                  </span>
                </div>
              )}

              {selectedTx.sessionId && (
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="text-ink-muted">Interview Session ID</span>
                  <span className="font-mono text-accent-cyan">{selectedTx.sessionId}</span>
                </div>
              )}

              {selectedTx.balanceAfter !== undefined && (
                <div className="flex justify-between py-1.5 border-b border-line/60">
                  <span className="text-ink-muted">Closing Wallet Balance</span>
                  <span className="font-mono font-black text-ink">
                    ₹{selectedTx.balanceAfter.toFixed(2)} ({selectedTx.balanceAfter.toFixed(0)} Credits)
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1.5 border-b border-line/60">
                <span className="text-ink-muted">Date & Time</span>
                <span className="font-mono text-ink">
                  {new Date(selectedTx.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="flex justify-between py-1.5">
                <span className="text-ink-muted">Settlement Engine</span>
                <span className="font-semibold text-accent-emerald flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Progeni Atlas Ledger
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              {selectedTx.sessionId ? (
                <Link
                  href={`/candidate/interview/${selectedTx.sessionId}/report`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-accent-cyan border border-cyan-500/30 hover:bg-cyan-500/10 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Interview Scorecard
                </Link>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      {rechargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent-cyan" />
                <h3 className="text-lg font-bold text-ink">Add Interview Credits</h3>
              </div>
              <button
                onClick={() => setRechargeModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-2 text-ink-muted cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-ink-muted block">
                Select Credit Package (₹1 = 1 Credit)
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                {CANDIDATE_PACKS.map((pack) => (
                  <div
                    key={pack.credits}
                    onClick={() => {
                      setSelectedPack(pack.credits);
                      setCustomAmount('');
                    }}
                    className={`cursor-pointer p-4 rounded-2xl border text-center transition ${
                      selectedPack === pack.credits && !customAmount
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-sm ring-1 ring-cyan-500'
                        : 'border-line bg-surface hover:border-cyan-500/40'
                    }`}
                  >
                    <span className="block text-[10px] font-black uppercase text-accent-cyan">
                      {pack.badge}
                    </span>
                    <span className="text-xl font-black block mt-1 text-ink">₹{pack.inr}</span>
                    <span className="text-xs text-ink-muted block mt-0.5">
                      {pack.credits} Credits
                    </span>
                    <span className="text-[10px] text-ink-faint block mt-2">
                      ~{pack.minutes} mins practice
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-muted block mb-1">
                  Or Custom Amount (₹ / Credits)
                </label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  placeholder="e.g. 200"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-inset text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-ink-muted block mb-1.5">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'upi', name: 'UPI / QR', icon: Smartphone },
                    { id: 'card', name: 'Cards', icon: CreditCard },
                    { id: 'netbanking', name: 'Net Banking', icon: Building2 },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as 'upi' | 'card' | 'netbanking')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          paymentMethod === m.id
                            ? 'border-cyan-500 bg-cyan-500/10 text-accent-cyan shadow-sm ring-1 ring-cyan-500'
                            : 'border-line bg-surface text-ink-muted hover:border-cyan-500/30'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{m.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-ink">
                <div className="flex items-center justify-between font-bold">
                  <span>Total Payable:</span>
                  <span className="text-base text-accent-cyan">
                    ₹{customAmount ? parseFloat(customAmount) || 0 : selectedPack}.00
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Secured by <strong>Razorpay</strong> (Cards, UPI, Netbanking). Instant credit addition (₹1 = 1 Credit).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
              <button
                type="button"
                disabled={recharging}
                onClick={() => setRechargeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-line hover:bg-surface-2 transition text-ink cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recharging}
                onClick={() => void handleRecharge()}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {recharging ? 'Launching Razorpay...' : `Pay ₹${customAmount ? parseFloat(customAmount) || 0 : selectedPack} with Razorpay`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
