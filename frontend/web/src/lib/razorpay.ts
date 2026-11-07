/**
 * Progeni Atlas — Razorpay Payment Client (Staging & Production)
 * Connects Next.js Frontend to Razorpay Checkout modal with HMAC-SHA256
 * server-side signature verification.
 */
import { apiFetch } from './api';

export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  amount_credits: number;
  currency: string;
  key_id: string;
  account_name?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  notes?: Record<string, string>;
  error?: string;
}

export interface RazorpayVerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
  paymentId?: string;
  orderId?: string;
  rechargeAmountCredits?: number;
  transaction?: Record<string, unknown>;
}

let razorpayScriptPromise: Promise<boolean> | null = null;

/**
 * Dynamically injects the official Razorpay Checkout SDK script into DOM.
 */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error('Failed to load Razorpay Checkout SDK');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

/**
 * Initiates the complete Razorpay checkout flow:
 * 1. Creates verified order on backend (`/api/billing/wallet/create-order`)
 * 2. Opens official Razorpay modal for test/live card, UPI, netbanking
 * 3. On success, posts signature to backend (`/api/billing/wallet/verify-payment`)
 * 4. Triggers callbacks with transaction details
 */
export async function openRazorpayCheckout({
  amountCredits,
  onSuccess,
  onError,
  onDismiss,
}: {
  amountCredits: number;
  onSuccess: (data: { message: string; creditsAdded: number; paymentId: string }) => void;
  onError: (errorMsg: string) => void;
  onDismiss?: () => void;
}): Promise<void> {
  try {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      onError('Unable to load Razorpay payment gateway. Please check your internet connection.');
      return;
    }

    // Step 1: Create Order on backend
    const orderRes = await apiFetch('/api/billing/wallet/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_credits: amountCredits }),
    });

    const orderData = (await orderRes.json().catch(() => ({}))) as RazorpayOrderResponse;
    if (!orderRes.ok || !orderData.success || !orderData.order_id) {
      onError(orderData.error || 'Failed to initialize payment gateway order.');
      return;
    }

    // Step 2: Open Razorpay checkout modal
    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'Progeni Atlas',
      description: `Interview Credits Recharge (${amountCredits} Credits)`,
      order_id: orderData.order_id,
      prefill: {
        name: orderData.user_name || '',
        email: orderData.user_email || '',
        contact: orderData.user_phone || '',
      },
      notes: {
        amount_credits: String(amountCredits),
      },
      theme: {
        color: '#185adb', // Progeni Atlas Brand Blue
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
        },
      },
      handler: async (response: RazorpaySuccessResponse) => {
        // Step 3: Verify signature on server
        try {
          const verifyRes = await apiFetch('/api/billing/wallet/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = (await verifyRes.json().catch(() => ({}))) as RazorpayVerifyResponse;
          if (verifyRes.ok && verifyData.success) {
            onSuccess({
              message: verifyData.message || `Payment of ₹${amountCredits} successful! ${amountCredits} credits added.`,
              creditsAdded: amountCredits,
              paymentId: response.razorpay_payment_id,
            });
          } else {
            onError(verifyData.error || 'Payment signature verification failed. Please contact support.');
          }
        } catch (verifyErr) {
          onError(verifyErr instanceof Error ? verifyErr.message : 'Failed to verify payment with server.');
        }
      },
    };

    const razorpayInstance = new (window as unknown as {
      Razorpay: new (opts: typeof options) => {
        open: () => void;
        on: (event: string, handler: (data: { error?: { description?: string; reason?: string } }) => void) => void;
      };
    }).Razorpay(options);

    razorpayInstance.on('payment.failed', (failRes) => {
      const reason = failRes?.error?.description || failRes?.error?.reason || 'Payment was declined or failed.';
      onError(reason);
    });

    razorpayInstance.open();
  } catch (err) {
    onError(err instanceof Error ? err.message : 'An error occurred while launching payment.');
  }
}
