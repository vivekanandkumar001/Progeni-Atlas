/**
 * Progeni Atlas — Mayank Singh Multi-Merchant UPI Payment Gateway Client
 * Repository: mynkdev-21/upi-gateway
 * Connects Next.js Frontend with dynamic UPI QR generation, direct mobile intent links,
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
 * Initializes a new UPI order via Mayank Singh's Multi-Merchant UPI Gateway.
 */
export async function createMayankUpiOrder({
  amountCredits,
  amountInr,
}: {
  amountCredits: number;
  amountInr?: number;
}): Promise<MayankUpiOrderResponse> {
  const res = await apiFetch('/api/billing/wallet/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_credits: amountCredits,
      amount_inr: amountInr ?? amountCredits,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as MayankUpiOrderResponse;
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to initialize UPI payment order.');
  }
  return data;
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
  const res = await apiFetch('/api/billing/wallet/submit-utr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id: orderId,
      utr,
      amount_credits: amountCredits,
      amount_inr: amountInr ?? amountCredits,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as MayankUpiUtrResponse;
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to verify UPI UTR. Please ensure the reference number is correct.');
  }
  return data;
}
