'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RecruiterHeader } from '@/components/dashboard/RecruiterHeader';
import { apiFetch } from '@/lib/api';
import {
 Wallet,
 CreditCard,
 ArrowUpRight,
 ArrowDownLeft,
 RefreshCw,
 Plus,
 ShieldCheck,
 Clock,
 Sparkles,
 Zap,
 Gift,
 CheckCircle2,
 AlertCircle,
 HelpCircle,
 X
} from 'lucide-react';
import { createMayankUpiOrder, MayankUpiOrderResponse } from '@/lib/mayank_upi';
import { MayankUpiModal } from '@/components/billing/MayankUpiModal';

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
 amountCredits: number;
 amountNanoUsd: number;
 reason: string;
 serviceType: string | null;
 status: string;
 createdAt: string;
}

const RECHARGE_PACKS = [
 { credits: 500, inr: 500, minutes: 250, badge: 'Starter', popular: false },
 { credits: 2000, inr: 2000, minutes: 1000, badge: 'Most Popular', popular: true },
 { credits: 5000, inr: 5000, minutes: 2500, badge: 'Enterprise Scale', popular: false },
];

export default function RecruiterBillingPage() {
 const [wallet, setWallet] = useState<WalletData | null>(null);
 const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
 const [loading, setLoading] = useState(true);
 const [rechargeModalOpen, setRechargeModalOpen] = useState(false);
 const [selectedPack, setSelectedPack] = useState<number>(2000);
 const [customAmount, setCustomAmount] = useState<string>('');
 const [recharging, setRecharging] = useState(false);
 const [message, setMessage] = useState<{ text: string; type: 'success'|'error'} | null>(null);
 const [upiModalOpen, setUpiModalOpen] = useState(false);
 const [activeUpiOrder, setActiveUpiOrder] = useState<MayankUpiOrderResponse | null>(null);

 const loadWallet = useCallback(async () => {
 try {
 setLoading(true);
 let validTransactions: WalletTransaction[] = [];
 const txRes = await apiFetch('/api/billing/wallet/transactions?limit=50');
 if (txRes.ok) {
 const txData = (await txRes.json()) as { success: boolean; transactions: WalletTransaction[] };
 if (txData.success && Array.isArray(txData.transactions)) {
 // STRICT FILTER: Discard any fabricated welcome/bonus/promotional entries
 validTransactions = txData.transactions.filter((tx) => {
 const type = (tx.entryType || '').toLowerCase();
 const ref = (tx.txRef || '').toUpperCase();
 const reason = (tx.reason || '').toLowerCase();
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const title = ((tx as any).title || '').toLowerCase();
 if (type.includes('promotional') || type.includes('welcome')) return false;
 if (ref.includes('WELCOME') || ref.includes('ATLCOM')) return false;
 if (reason.includes('welcome') || reason.includes('bonus')) return false;
 if (title.includes('welcome') || title.includes('bonus')) return false;
 return true;
 });
 setTransactions(validTransactions);
 }
 }

 const res = await apiFetch('/api/billing/wallet');
 if (res.ok) {
 const data = (await res.json()) as { success: boolean; wallet: WalletData };
 if (data.success && data.wallet) {
 const rawWallet = data.wallet;
 const hasRealRecharge = validTransactions.some((t) => t.entryType === 'recharge_paid');
 // Only show credits if real verified recharge exists or real paid credits > 0
 const realAvailable = hasRealRecharge
 ? Math.max(0, (rawWallet.availableCredits ?? 0) - (rawWallet.promotionalCredits ?? 0) + (rawWallet.paidCredits ?? 0))
 : (rawWallet.paidCredits ?? 0);

 setWallet({
 ...rawWallet,
 availableCredits: realAvailable,
 promotionalCredits: 0,
 ratePerMinuteCredits: rawWallet.ratePerMinuteCredits || 2.0,
 // Only show trial banner if there is actual remaining allowance > 0 and user is within trial
 demoQuota: (rawWallet.demoQuota && rawWallet.demoQuota.remaining > 0 && rawWallet.demoQuota.completed > 0)
 ? rawWallet.demoQuota
 : {
 ...rawWallet.demoQuota,
 remaining: 0,
 totalAllowed: rawWallet.demoQuota?.totalAllowed || 0,
 completed: rawWallet.demoQuota?.completed || 0,
 maxDurationSeconds: 600,
 },
 });
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
 setMessage({ text: 'Please enter a valid recharge amount.', type: 'error'});
 return;
 }

 setRecharging(true);
 setMessage(null);

 try {
 const orderRes = await createMayankUpiOrder({
 amountCredits: amount,
 amountInr: amount,
 });
 setActiveUpiOrder(orderRes);
 setRechargeModalOpen(false);
 setUpiModalOpen(true);
 } catch (err) {
 setMessage({
 text: err instanceof Error ? err.message : 'Failed to launch UPI Gateway',
 type: 'error',
 });
 } finally {
 setRecharging(false);
 }
 };


   return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      <RecruiterHeader />

      <main className="max-w-7xl xl:max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 space-y-7">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 shadow-xs">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Organization Wallet & Billing</h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Prepaid credit accounting convention: <strong className="text-slate-700">₹1.00 = 1 Credit</strong>. Transparent, duration-based billing.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => void loadWallet()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              Refresh
            </button>
            <button
              onClick={() => setRechargeModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Credits
            </button>
          </div>
        </div>

        {/* Notifications & Banners */}
        {message && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between shadow-xs ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="p-1 hover:opacity-75 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Free Demo Trial Notice if applicable */}
        {wallet?.demoQuota && wallet.demoQuota.remaining > 0 && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                <Gift className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-xs sm:text-sm text-blue-900 block">
                  Complimentary AI Screening Trial Active
                </span>
                <p className="text-xs text-blue-700 mt-0.5">
                  Your organization has <strong className="font-bold text-blue-900">{wallet.demoQuota.remaining} free screening round(s)</strong> remaining (up to 10 minutes each) with zero wallet deduction.
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto px-2.5 py-1 rounded-md text-xs font-bold bg-white text-blue-700 border border-blue-200 shadow-2xs whitespace-nowrap">
              {wallet.demoQuota.remaining} of {wallet.demoQuota.totalAllowed} Left
            </span>
          </div>
        )}

        {/* Balance Overview Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Available Balance */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium uppercase tracking-wider text-[11px]">Available Balance</span>
                <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Active
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  ₹{wallet?.availableCredits?.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  ({wallet?.availableCredits?.toFixed(0) ?? 0} Credits)
                </span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>
                ≈ <strong className="text-slate-800 font-semibold">{Math.floor((wallet?.availableCredits ?? 0) / (wallet?.ratePerMinuteCredits || 2))} mins</strong> screening time
              </span>
            </div>
          </div>

          {/* Card 2: Reserved Holds */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium uppercase tracking-wider text-[11px]">Active Reserved Hold</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {wallet?.reservedCredits?.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-xs font-semibold text-slate-500">Credits</span>
              </div>
            </div>
            <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
              Atomic preflight hold during live interviews. Auto-releases on finish.
            </p>
          </div>

          {/* Card 3: Consumed Credits */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium uppercase tracking-wider text-[11px]">Total Consumed</span>
                <Zap className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  ₹{wallet?.consumedCredits?.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-xs font-semibold text-slate-500">Credits</span>
              </div>
            </div>
            <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
              Settled screening minutes across all completed candidate interviews.
            </p>
          </div>

          {/* Card 4: Active Rate Card */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium uppercase tracking-wider text-[11px]">Active Rate Card</span>
                <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  Standard
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-600">
                  {(wallet?.ratePerMinuteCredits ?? 2.0).toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-slate-500">Credits / min</span>
              </div>
            </div>
            <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
              ₹2.00 per minute with server ceiling-to-whole-minute rounding.
            </p>
          </div>
        </div>

        {/* Clean Process Strip: How Duration-Based Billing Works */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3 mb-5">
            <h2 className="text-base font-bold text-slate-900">How Duration-Based Billing Operates</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent, double-entry ledger calculation governed by server-authoritative timestamps.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="pt-4 md:pt-0 md:pr-6 space-y-1.5">
              <span className="text-xs font-mono font-bold text-blue-600 block">01 · Preflight Hold</span>
              <h3 className="text-xs font-bold text-slate-800">Atomic Reservation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                When live charging is active, the server reserves a temporary 10 Credit hold (5 mins @ 2 Credits/min) to prevent mid-answer disconnection.
              </p>
            </div>

            <div className="pt-4 md:pt-0 md:px-6 space-y-1.5">
              <span className="text-xs font-mono font-bold text-blue-600 block">02 · Authoritative Meter</span>
              <h3 className="text-xs font-bold text-slate-800">Precision Server Timing</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Duration is measured strictly by WebSocket server connection intervals with industry-standard ceiling-to-minute rounding (e.g. 18m 15s = 19 billable mins).
              </p>
            </div>

            <div className="pt-4 md:pt-0 md:pl-6 space-y-1.5">
              <span className="text-xs font-mono font-bold text-blue-600 block">03 · Instant Settlement</span>
              <h3 className="text-xs font-bold text-slate-800">Immediate Unused Refund</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upon interview completion, the exact consumed duration is deducted and any excess reserved hold is released back to your available balance in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Recent Transactions Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Transaction History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Immutable Double-Entry Accounting Ledger</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Currency: INR (₹)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Credits (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                      No billing transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {tx.txRef}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                            tx.entryType === 'recharge_paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.entryType === 'service_debit'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : tx.entryType === 'service_hold'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tx.entryType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                        {tx.reason || 'General ledger mutation'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap ${
                          tx.amountCredits >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {tx.amountCredits >= 0 ? `+${tx.amountCredits.toFixed(0)}` : `${tx.amountCredits.toFixed(0)}`} cr
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Recharge Modal */}
      {rechargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Wallet Credits</h3>
                  <p className="text-[11px] text-slate-500">Official UPI Instant Payment Gateway</p>
                </div>
              </div>
              <button
                onClick={() => setRechargeModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-slate-700 block">
                Select Credit Package (₹1.00 = 1 Credit)
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                {RECHARGE_PACKS.map((pack) => (
                  <div
                    key={pack.credits}
                    onClick={() => {
                      setSelectedPack(pack.credits);
                      setCustomAmount('');
                    }}
                    className={`cursor-pointer p-4 rounded-xl border text-center transition-all ${
                      selectedPack === pack.credits && !customAmount
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      {pack.badge}
                    </span>
                    <span className="text-xl font-extrabold text-slate-900 block mt-1">₹{pack.inr}</span>
                    <span className="text-xs text-slate-600 font-medium block mt-0.5">
                      {pack.credits} Credits
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-2">
                      ~{pack.minutes} mins screening
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Or Custom Amount (₹ / Credits)
                </label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  placeholder="e.g. 1500"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/15 transition"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Total Payable:</span>
                  <span className="text-base text-blue-700">
                    ₹{customAmount ? parseFloat(customAmount) || 0 : selectedPack}.00
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-blue-800 leading-relaxed">
                  Secured by <strong>Progeni Atlas UPI</strong> (Google Pay, PhonePe, Paytm, BHIM, QR). Instant credit top-up (₹1 = 1 Credit).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={recharging}
                onClick={() => setRechargeModalOpen(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recharging}
                onClick={() => void handleRecharge()}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {recharging ? 'Creating UPI Order...' : `Pay ₹${customAmount ? parseFloat(customAmount) || 0 : selectedPack} via UPI`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mayank Singh Multi-Merchant UPI Gateway Modal */}
      <MayankUpiModal
        isOpen={upiModalOpen}
        onClose={() => setUpiModalOpen(false)}
        orderData={activeUpiOrder}
        onSuccess={async (data) => {
          setMessage({ text: data.message, type: 'success' });
          setCustomAmount('');
          await loadWallet();
        }}
      />
    </div>
  );
}
