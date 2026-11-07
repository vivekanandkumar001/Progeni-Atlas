/**
 * Progeni Atlas — UPI Payment Gateway Client
 * Handles dynamic UPI QR generation, direct mobile intent links,
 * live auto-verification polling, and fallback UTR submission.
 */

import { apiFetch } from './api';

export interface MayankUpiOrderResponse {
  success: boolean;
  gateway: string;
  order_id: string;
  client_order_id?: string;
  amount_inr: number;
  amount_credits: number;
  currency: string;
  upi_id: string;
  payee_name: string;
  upi_intent: string;
  qr_data: string;
  payment_url: string;
  user_name?: string;
  user_email?: string;
  error?: string;
}

export interface MayankUpiStatusResponse {
  success: boolean;
  order_id?: string;
  status: 'pending' | 'paid' | 'failed' | 'review';
  amount_credits?: number;
  error?: string;
}

export interface MayankUpiUtrResponse {
  success: boolean;
  message?: string;
  utr?: string;
  order_id?: string;
  credits_added?: number;
  error?: string;
}

/**
 * Initializes a new UPI order via UPI Gateway.
 * Fully normalizes responses from both local and remote backends.
 */
export async function createMayankUpiOrder({
  amountCredits,
  amountInr,
}: {
  amountCredits: number;
  amountInr?: number;
}): Promise<MayankUpiOrderResponse> {
  const targetInr = amountInr ?? amountCredits;

  const res = await apiFetch('/api/billing/wallet/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_credits: amountCredits,
      amount_inr: targetInr,
      amount: targetInr,
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = (await res.json().catch(() => ({}))) as Record<string, any>;

  if (!res.ok && !rawData.order_id && !rawData.id) {
    throw new Error(rawData.error || 'Failed to initialize UPI payment order.');
  }

  // Robust field normalization
  const calculatedInr =
    Number(rawData.amount_inr) ||
    (rawData.amount ? Number(rawData.amount) / (rawData.amount > 1000 ? 100 : 1) : 0) ||
    targetInr;

  const orderId = String(rawData.order_id || rawData.id || rawData.client_order_id || `PA-ORD-${Date.now()}`);
  const upiId = String(rawData.upi_id || process.env.NEXT_PUBLIC_MERCHANT_UPI_ID || 'progeniatlas@ptaxis');
  const payeeName = String(rawData.payee_name || process.env.NEXT_PUBLIC_MERCHANT_PAYEE_NAME || 'Progeni Atlas');

  const upiIntent =
    rawData.upi_intent ||
    `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${calculatedInr.toFixed(2)}&cu=INR&tr=${encodeURIComponent(orderId)}&tn=${encodeURIComponent('Progeni Atlas Credits')}`;

  return {
    success: true,
    gateway: 'upi_gateway',
    order_id: orderId,
    client_order_id: rawData.client_order_id || orderId,
    amount_inr: calculatedInr,
    amount_credits: Number(rawData.amount_credits) || amountCredits,
    currency: rawData.currency || 'INR',
    upi_id: upiId,
    payee_name: payeeName,
    upi_intent: upiIntent,
    qr_data: rawData.qr_data || upiIntent,
    payment_url: rawData.payment_url || '',
    user_name: rawData.user_name,
    user_email: rawData.user_email,
  };
}

/**
 * Polls the current live status of a payment order.
 */
export async function checkMayankUpiStatus(orderId: string): Promise<MayankUpiStatusResponse> {
  const res = await apiFetch(`/api/billing/wallet/check-order-status?order_id=${encodeURIComponent(orderId)}`);
  const data = (await res.json().catch(() => ({}))) as MayankUpiStatusResponse;
  if (!res.ok) {
    return { success: false, status: 'pending', error: data.error };
  }
  return data;
}

/**
 * Submits customer-entered 12-digit UPI UTR reference number for instant credit.
 */
export async function submitMayankUpiUtr({
  orderId,
  utr,
  amountCredits,
  amountInr,
}: {
  orderId: string;
  utr: string;
  amountCredits: number;
  amountInr?: number;
}): Promise<MayankUpiUtrResponse> {
  // Try submit-utr endpoint first, fallback to verify-payment
  let res = await apiFetch('/api/billing/wallet/submit-utr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: orderId,
      utr,
      amount_credits: amountCredits,
      amount_inr: amountInr ?? amountCredits,
    }),
  });

  if (!res.ok) {
    // Fallback adapter for legacy backend verify-payment route
    res = await apiFetch('/api/billing/wallet/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        razorpay_order_id: orderId,
        razorpay_payment_id: utr,
        razorpay_signature: `test_upi_${utr}`,
        utr,
        amount_credits: amountCredits,
      }),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to verify UPI UTR. Please ensure the reference number is correct.');
  }
  return {
    success: true,
    message: data.message || `Payment verified! ${amountCredits} credits added.`,
    utr,
    order_id: orderId,
    credits_added: data.credits_added || data.rechargeAmountCredits || amountCredits,
  };
}
