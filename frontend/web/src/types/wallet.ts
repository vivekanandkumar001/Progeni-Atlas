export interface WalletData {
  accountId: string;
  accountName: string;
  accountType: string;
  orgId: string | null;
  userId: string | null;
  currency: string;
  ratePerMinuteCredits: number;
  baseFeeCredits: number;
  availableCredits: number;
  /** Ledger precision for audits; never advertised as spendable whole credits. */
  availableCreditsExact?: number;
  /** Billable whole-credit balance supplied by the API. */
  availableCreditsWhole?: number;
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

export interface WalletTransaction {
  id: string;
  txRef: string;
  entryType: string;
  category?: 'IN' | 'OUT' | 'DEMO';
  title?: string;
  reason?: string;
  amountCredits: number;
  amountInr?: number;
  amountNanoUsd?: number;
  balanceAfter?: number;
  serviceType?: string | null;
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
