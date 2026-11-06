/**
 * Shared types for the Super Admin Billing Center route.
 * Colocated with page.tsx; imports no React so it can be used freely
 * from pages, hooks, and components without creating import cycles.
 */

export type Tab = 'overview' | 'accounts' | 'ledger' | 'invoices' | 'rates';

export interface PricingPolicy {
  rate_per_minute_credits: number;
  alternative_rate_credits: number;
  base_fee_credits: number;
  alternative_base_fee_credits: number;
  charging_enabled: boolean;
  billing_mode: string;
  reserve_minutes: number;
  minimum_billable_seconds: number;
  rounding_policy: string;
  usd_to_inr_rate: number;
  version: number;
  updated_at?: string;
  updated_by?: string;
}
