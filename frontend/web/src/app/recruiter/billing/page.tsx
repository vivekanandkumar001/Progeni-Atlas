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
 const txRes = await apiFetch('/api/billing/wallet/transactions?limit=20');
 if (txRes.ok) {
 const txData = (await txRes.json()) as { success: boolean; transactions: WalletTransaction[] };
 if (txData.success && Array.isArray(txData.transactions)) {
 setTransactions(txData.transactions);
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

 await openRazorpayCheckout({
 amountCredits: amount,
 onSuccess: async (data) => {
 setMessage({ text: data.message, type: 'success'});
 setRechargeModalOpen(false);
 setCustomAmount('');
 setRecharging(false);
 await loadWallet();
 },
 onError: (errMsg) => {
 setMessage({ text: errMsg, type: 'error'});
 setRecharging(false);
 },
 onDismiss: () => {
 setRecharging(false);
 },
 });
 };


 return (
 <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors">
 <RecruiterHeader />

 <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
 {/* Top Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-2xl bg-blue-500/10 text-[#185adb]">
 <Wallet className="h-6 w-6"/>
 </div>
 <div>
 <h1 className="text-2xl font-black tracking-tight">Organization Wallet & Billing</h1>
 <p className="text-sm text-slate-500">
 Prepaid credit accounting convention: <strong>₹1.00 = 1 Credit</strong>. Simple, duration-based per-minute billing.
 </p>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={() => void loadWallet()}
 disabled={loading}
 className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition"
 >
 <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin': ''}`} />
 Refresh
 </button>
 <button
 onClick={() => setRechargeModalOpen(true)}
 className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#185adb] hover:bg-blue-700 shadow-md transition"
 >
 <Plus className="h-4 w-4"/>
 Add Credits
 </button>
 </div>
 </div>

 {/* Notifications & Banners */}
 {message && (
 <div
 className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${
 message.type === 'success'
 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
 : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
 }`}
 >
 <span>{message.text}</span>
 <button onClick={() => setMessage(null)} className="p-1 hover:opacity-75">
 <X className="h-4 w-4"/>
 </button>
 </div>
 )}

 {/* Free Demo Trial Notice if applicable */}
 {wallet?.demoQuota && wallet.demoQuota.remaining > 0 && (
 <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Gift className="h-5 w-5 text-[#185adb] shrink-0"/>
 <div>
 <span className="font-bold text-sm text-slate-800">
 Complimentary AI Screening Trial Active
 </span>
 <p className="text-xs text-slate-500 mt-0.5">
 Your organization has <strong>{wallet.demoQuota.remaining} free demo screening(s)</strong> remaining (up to 10 minutes each) with zero wallet charge.
 </p>
 </div>
 </div>
 <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-[#185adb]">
 {wallet.demoQuota.remaining} / {wallet.demoQuota.totalAllowed} Left
 </span>
 </div>
 )}

 {/* Balance Overview Cards */}
 <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
 {/* Card 1: Available Balance */}
 <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm relative overflow-hidden">
 <div className="flex items-center justify-between text-xs text-slate-500">
 <span>Available Balance</span>
 <span className="font-mono text-[10px] uppercase font-bold text-emerald-500">Active</span>
 </div>
 <div className="mt-3 flex items-baseline gap-1.5">
 <span className="text-3xl font-black text-slate-900">
 {wallet?.availableCredits?.toFixed(2) ?? '0.00'}
 </span>
 <span className="text-sm font-semibold text-slate-500">Credits (₹)</span>
 </div>
 <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
 <Clock className="h-3.5 w-3.5 text-blue-500"/>
 <span>
 ≈{' '}
 <strong className="text-slate-700">
 {Math.floor((wallet?.availableCredits ?? 0) / (wallet?.ratePerMinuteCredits || (1 / 3)))} mins
 </strong>{' '}
                  interview time
 </span>
 </div>
 </div>

 {/* Card 2: Reserved Holds */}
 <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
 <div className="flex items-center justify-between text-xs text-slate-500">
 <span>Active Reserved Hold</span>
 <Clock className="h-4 w-4 text-amber-500"/>
 </div>
 <div className="mt-3 flex items-baseline gap-1.5">
 <span className="text-3xl font-black text-amber-600">
 {wallet?.reservedCredits?.toFixed(2) ?? '0.00'}
 </span>
 <span className="text-sm font-semibold text-slate-500">Credits</span>
 </div>
 <p className="mt-3 text-xs text-slate-500">
 Preflight holds on active sessions. Unused duration auto-releases on finish.
 </p>
 </div>

 {/* Card 3: Consumed Credits */}
 <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
 <div className="flex items-center justify-between text-xs text-slate-500">
 <span>Total Consumed</span>
 <Zap className="h-4 w-4 text-blue-500"/>
 </div>
 <div className="mt-3 flex items-baseline gap-1.5">
 <span className="text-3xl font-black text-slate-900">
 {wallet?.consumedCredits?.toFixed(2) ?? '0.00'}
 </span>
 <span className="text-sm font-semibold text-slate-500">Credits (₹)</span>
 </div>
 <p className="mt-3 text-xs text-slate-500">
 Settled screening minutes across all completed candidate interviews.
 </p>
 </div>

 {/* Card 4: Active Rate Card */}
 <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
 <div className="flex items-center justify-between text-xs text-slate-500">
 <span>Active Rate Card</span>
 <ShieldCheck className="h-4 w-4 text-emerald-500"/>
 </div>
 <div className="mt-3 flex items-baseline gap-1.5">
 <span className="text-3xl font-black text-[#185adb]">
 {(wallet?.ratePerMinuteCredits ?? (1 / 3)).toFixed(2)}
 </span>
 <span className="text-sm font-semibold text-slate-500">Credits / min</span>
 </div>
 <p className="mt-3 text-xs text-slate-500">
 ₹1 per 3 minutes with server ceiling-to-whole-minute rounding.
 </p>
 </div>
 </div>

 {/* Pricing Policy Card */}
 <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4">
 <h2 className="text-lg font-bold">How Per-Minute Billing Works</h2>
 <div className="grid gap-4 sm:grid-cols-3 text-xs">
 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
 <span className="font-bold text-slate-800 block mb-1">1. Preflight Reservation</span>
 <p className="text-slate-500">
 When live charging is enabled, the server atomically holds 5 Credits (15 mins @ ₹1 per 3 min) from your wallet to guarantee uninterrupted connectivity.
 </p>
 </div>
 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
 <span className="font-bold text-slate-800 block mb-1">2. Server-Authoritative Timing</span>
 <p className="text-slate-500">
 Duration is measured strictly by server timestamps with ceiling-to-minute rounding (e.g. 18m 24s is calculated as 19 billable minutes).
 </p>
 </div>
 <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
 <span className="font-bold text-slate-800 block mb-1">3. Instant Hold Release</span>
 <p className="text-slate-500">
 Upon interview completion, the exact charge is deducted and any remaining reserved hold is instantly credited back to your available balance.
 </p>
 </div>
 </div>
 </div>

 {/* Recent Transactions Table */}
 <div className="p-6 rounded-3xl border border-slate-200 bg-white space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-lg font-bold">Transaction History</h2>
 <span className="text-xs text-slate-500">Immutable Double-Entry Ledger</span>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full text-xs text-left">
 <thead>
 <tr className="border-b border-slate-200 text-slate-500 font-semibold">
 <th className="py-3 px-3">Date & Time</th>
 <th className="py-3 px-3">Transaction Ref</th>
 <th className="py-3 px-3">Type</th>
 <th className="py-3 px-3">Description</th>
 <th className="py-3 px-3 text-right">Credits (₹)</th>
 <th className="py-3 px-3 text-center">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {transactions.length === 0 ? (
 <tr>
 <td colSpan={6} className="py-8 text-center text-slate-400">
 No transactions recorded yet.
 </td>
 </tr>
 ) : (
 transactions.map((tx) => (
 <tr key={tx.id} className="hover:bg-slate-50/50 transition">
 <td className="py-3 px-3 text-slate-500 font-mono">
 {new Date(tx.createdAt).toLocaleString('en-IN', {
 day: 'numeric',
 month: 'short',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit',
 })}
 </td>
 <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
 {tx.txRef}
 </td>
 <td className="py-3 px-3">
 <span
 className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
 tx.entryType === 'recharge_paid'
 ? 'bg-emerald-500/10 text-emerald-600'
 : tx.entryType === 'service_debit'
 ? 'bg-blue-500/10 text-blue-600'
 : tx.entryType === 'service_hold'
 ? 'bg-amber-500/10 text-amber-600'
 : 'bg-slate-500/10 text-slate-600'
 }`}
 >
 {tx.entryType.replace('_', '')}
 </span>
 </td>
 <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
 {tx.reason ||'General ledger mutation'}
 </td>
 <td
 className={`py-3 px-3 text-right font-mono font-bold ${
 tx.amountCredits >= 0
 ? 'text-emerald-600'
 : 'text-rose-600'
 }`}
 >
 {tx.amountCredits >= 0 ?`+${tx.amountCredits.toFixed(0)}`:`${tx.amountCredits.toFixed(0)}`} cr
 </td>
 <td className="py-3 px-3 text-center">
 <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
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
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
 <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-6">
 <div className="flex items-center justify-between border-b border-slate-200 pb-4">
 <div className="flex items-center gap-2">
 <CreditCard className="h-5 w-5 text-[#185adb]"/>
 <h3 className="text-lg font-bold">Add Wallet Credits</h3>
 </div>
 <button
 onClick={() => setRechargeModalOpen(false)}
 className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
 >
 <X className="h-5 w-5"/>
 </button>
 </div>

 <div className="space-y-4">
 <label className="text-xs font-semibold text-slate-500 block">
 Select Credit Package (₹1 = 1 Credit)
 </label>

 <div className="grid gap-3 sm:grid-cols-3">
 {RECHARGE_PACKS.map((pack) => (
 <div
 key={pack.credits}
 onClick={() => {
 setSelectedPack(pack.credits);
 setCustomAmount('');
 }}
 className={`cursor-pointer p-4 rounded-2xl border text-center transition ${
 selectedPack === pack.credits && !customAmount
 ? 'border-blue-500 bg-blue-500/10 shadow-sm ring-1 ring-blue-500'
 : 'border-slate-200 hover:border-blue-500/40'
 }`}
 >
 <span className="block text-[10px] font-black uppercase text-blue-600">
 {pack.badge}
 </span>
 <span className="text-xl font-black block mt-1">₹{pack.inr}</span>
 <span className="text-xs text-slate-500 block mt-0.5">
 {pack.credits} Credits
 </span>
 <span className="text-[10px] text-slate-400 block mt-2">
 ~{pack.minutes} mins screening
 </span>
 </div>
 ))}
 </div>

 <div>
 <label className="text-xs font-semibold text-slate-500 block mb-1">
 Or Custom Amount (₹ / Credits)
 </label>
 <input
 type="number"
 min="10"
 step="10"
 placeholder="e.g. 1500"
 value={customAmount}
 onChange={(e) => setCustomAmount(e.target.value)}
 className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
 />
 </div>

 <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
 <div className="flex items-center justify-between font-bold">
 <span>Total Payable:</span>
 <span className="text-base">
 ₹{customAmount ? parseFloat(customAmount) || 0 : selectedPack}.00
 </span>
 </div>
 <p className="mt-1 text-[11px] text-blue-600">
 Secured by <strong>Razorpay</strong> (Cards, UPI, Netbanking). Instant credit addition (₹1 = 1 Credit).
 </p>
 </div>
 </div>

 <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
 <button
 type="button"
 disabled={recharging}
 onClick={() => setRechargeModalOpen(false)}
 className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 transition"
 >
 Cancel
 </button>
 <button
 type="button"
 disabled={recharging}
 onClick={() => void handleRecharge()}
 className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#185adb] hover:bg-blue-700 shadow-md transition disabled:opacity-50"
 >
 {recharging ? 'Launching Razorpay...':`Pay ₹${customAmount ? parseFloat(customAmount) || 0 : selectedPack} with Razorpay`}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
