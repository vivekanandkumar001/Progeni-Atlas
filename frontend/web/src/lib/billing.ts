/** The billing ledger treats one credit as one rupee. */
export const CREDIT_TO_INR = 1;

function trimFraction(value: number): string {
  return Number(value.toFixed(2)).toString();
}

/**
 * Human-readable rate from the wallet API, e.g. 0.5 credits/min becomes
 * "₹0.50 / min (0.5 credits/min · 2 min/₹1)".
 */
export function formatRatePerMinute(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 'Rate unavailable';
  const creditsPerMinute = Number(rate.toFixed(2));
  const rupeesPerMinute = creditsPerMinute * CREDIT_TO_INR;
  const minutesPerRupee = 1 / (creditsPerMinute / CREDIT_TO_INR);
  return `₹${rupeesPerMinute.toFixed(2)} / min (${trimFraction(creditsPerMinute)} credits/min · ${trimFraction(minutesPerRupee)} min/₹1)`;
}

/** Credits are billable whole units; fractional remnants are never advertised. */
export function formatCredits(amount: number, singular = 'credit', plural = 'credits'): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  return `${safe} ${safe === 1 ? singular : plural}`;
}

/** Wallet credits are rupees; only whole billable units are displayed. */
export function formatInrFromCredits(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  return `₹${safe.toLocaleString('en-IN')}`;
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking';
export type CheckoutProvider = 'upi-gateway' | 'razorpay';

/** One method-to-provider contract for the recharge modal and copy. */
export function checkoutProviderFor(method: string): CheckoutProvider {
  return method === 'upi' ? 'upi-gateway' : 'razorpay';
}

/** Packs may include bonus credits (₹49 → 50 credits); custom amounts do not. */
export function bonusCreditsForPack(credits: number, priceInr: number): number {
  if (!Number.isFinite(credits) || !Number.isFinite(priceInr)) return 0;
  return Math.max(0, Math.round((credits - priceInr) * 100) / 100);
}

/** Estimated practice minutes from the wallet's API rate, never a hardcoded rate. */
export function minutesForCredits(
  credits: number | null | undefined,
  ratePerMinuteCredits: number | null | undefined
): number | null {
  if (!Number.isFinite(credits) || !Number.isFinite(ratePerMinuteCredits)) return null;
  const rate = Number(ratePerMinuteCredits);
  const amount = Number(credits);
  if (rate <= 0 || amount < 0) return null;
  return Number((amount / rate).toFixed(1));
}
