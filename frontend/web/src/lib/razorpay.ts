/**
 * Progeni Atlas — Razorpay Checkout Client
 * Creates server-side Razorpay orders and verifies payments via /verify-payment.
 * Razorpay handles hosted checkout (UPI, cards, netbanking, wallets).
 */

import { apiFetch } from './api';

export interface RazorpayCreateResponse {
  success: boolean;
  key_id?: string;
  razorpay_order_id?: string;
  order_id?: string;
  amount_paise?: number;
  currency?: string;
  amount_inr?: number;
  amount_credits?: number;
  name?: string;
  description?: string;
  error?: string;
}

export interface RazorpayVerifyResponse {
  success?: boolean;
  message?: string;
  error?: string;
  credits_added?: number;
  rechargeAmountCredits?: number;
}

let scriptPromise: Promise<boolean> | null = null;

/** Dynamically loads Razorpay checkout.js (only once). */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<boolean>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/** Creates a Razorpay order on the backend (server-side, secret-safe). */
export async function createRazorpayWalletOrder(amountInr: number): Promise<RazorpayCreateResponse> {
  const res = await apiFetch('/api/billing/wallet/razorpay/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_inr: amountInr, amount: amountInr }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !data.success) {
    return { success: false, error: String(data.error || 'Unable to start Razorpay checkout.') };
  }
  return {
    success: true,
    key_id: data.key_id,
    razorpay_order_id: data.razorpay_order_id,
    order_id: data.order_id,
    amount_paise: data.amount_paise,
    currency: data.currency,
    amount_inr: data.amount_inr,
    amount_credits: data.amount_credits,
    name: data.name,
    description: data.description,
  };
}

/** Verifies the Razorpay checkout signature server-side and credits the wallet. */
export async function verifyRazorpayPayment(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<RazorpayVerifyResponse> {
  const res = await apiFetch('/api/billing/wallet/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: params.orderId,
      razorpay_order_id: params.razorpayOrderId,
      razorpay_payment_id: params.razorpayPaymentId,
      razorpay_signature: params.razorpaySignature,
      utr: params.razorpayPaymentId,
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || !data.success) {
    return { success: false, error: String(data.error || 'Payment verification failed. Contact support.') };
  }
  return {
    success: true,
    message: data.message,
    credits_added: data.credits_added || data.rechargeAmountCredits,
  };
}
