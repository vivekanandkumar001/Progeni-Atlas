/**
 * Super Admin console — shared types, navigation and data helpers.
 *
 * Every value rendered by the console comes from the Flask backend
 * (`/api/super-admin/*`). Nothing here fabricates platform data.
 */
import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Coins,
  CreditCard,
  Database,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from './api';

/* --------------------------------------------------------------- navigation */

export type SuperAdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type SuperAdminNavGroup = {
  title: string;
  items: SuperAdminNavItem[];
};

export const SUPER_ADMIN_NAV: SuperAdminNavGroup[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Overview', href: '/super-admin', icon: LayoutDashboard, description: 'Platform aggregates and live service availability' },
      { label: 'Organizations', href: '/super-admin/organizations', icon: Building2, description: 'Tenants, provisioning and tenant status' },
      { label: 'Users & Accounts', href: '/super-admin/users', icon: Users, description: 'Candidate, recruiter and admin accounts' },
      { label: 'Roles & Permissions', href: '/super-admin/roles', icon: ShieldCheck, description: 'RBAC matrix, role hierarchy and action policy' },
      { label: 'Jobs & Interviews', href: '/super-admin/interviews', icon: Video, description: 'Platform-wide interview oversight' },
      { label: 'Company Careers', href: '/super-admin/careers', icon: Briefcase, description: 'Progeni Atlas internal job openings and candidate applications' },
    ],
  },
  {
    title: 'Packages',
    items: [
      { label: 'Packages', href: '/super-admin/packages', icon: CreditCard, description: 'Versioned packages with pricing, seat allocations and billing periods' },
      { label: 'Free Quota Policy', href: '/super-admin/free-quota', icon: ShieldCheck, description: 'Platform-wide free demo quota with deterministic precedence rules' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'AI Configuration', href: '/super-admin/ai-config', icon: Sparkles, description: 'Providers, models and rubric governance' },
      { label: 'Skills & Practice Catalog', href: '/super-admin/catalog', icon: BookOpen, description: 'Manage candidate skill taxonomy and practice drills without deployment' },
      { label: 'Billing & Usage Center', href: '/super-admin/billing', icon: CreditCard, description: 'Enterprise wallets, metering, ledger & invoices' },
      { label: 'Cost & Spend', href: '/super-admin/cost-insights', icon: Coins, description: 'Provider spend, LLM unit economics & rate card governance' },
      { label: 'Usage & Analytics', href: '/super-admin/usage', icon: BarChart3, description: 'Interview throughput and platform usage' },
      { label: 'System Health', href: '/super-admin/system-health', icon: Activity, description: 'Dependency availability and integrations' },
      { label: 'Platform Settings', href: '/super-admin/settings', icon: Settings, description: 'Feature flags, limits and security policy' },
    ],
  },
  {
    title: 'Governance',
    items: [
      { label: 'Security & Audit Logs', href: '/super-admin/audit-logs', icon: FileText, description: 'Tamper-resistant security audit trail' },
      { label: 'Data Governance', href: '/super-admin/data-governance', icon: Database, description: 'Retention, privacy workflows and access audits' },
      { label: 'Support & Incident', href: '/super-admin/support', icon: LifeBuoy, description: 'Controlled overrides and incident response' },
    ],
  },
];

export const SUPER_ADMIN_NAV_FLAT: SuperAdminNavItem[] = SUPER_ADMIN_NAV.flatMap((g) => g.items);

/* ------------------------------------------------------------------- types */

export type Overview = {
  stats: { organizations: number; candidates: number; interviews: number };
  organizations: Array<{
    id: string;
    name: string;
    candidates: number;
    interviews: number;
    completed: number;
    completionRate: number | null;
  }>;
  platformHealth: { database: string; api: string };
};

export type AuditLogItem = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  orgId: string | null;
  timestamp: string | null;
};

export type PlatformUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  orgId: string | null;
  organizationName: string | null;
  createdAt: string | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string | null;
  tier: string | null;
  status: string;
  companySize: string | null;
  billingEmail: string | null;
  candidateCount: number;
  interviewCount: number;
  createdAt: string | null;
};

export type InterviewItem = {
  id: string;
  orgId: string | null;
  candidateId: string | null;
  recruiterId: string | null;
  status: string | null;
  sessionType: string | null;
  mode: string | null;
  durationMinutes: number | null;
  jobTitle: string | null;
  companyName: string | null;
  organizationName?: string | null;
  createdAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type Verdict = 'allow' | 'conditional' | 'deny';

export type MatrixCell = { verdict: Verdict; text: string };

export type PermissionMatrixRow = {
  feature: string;
  candidate: MatrixCell;
  recruiter: MatrixCell;
  super_admin: MatrixCell;
};

export type RoleHierarchyEntry = { id: string; label: string; scope: string };

export type GovernedModule = {
  id: string;
  title: string;
  summary: string;
  capabilities: string[];
  guardrails: string[];
};

export type ActionPolicyEntry = { action: string; policy: string; verdict: Verdict };

export type PermissionPayload = {
  roleHierarchy: RoleHierarchyEntry[];
  permissionMatrix: PermissionMatrixRow[];
  superAdminModules: GovernedModule[];
  actionPolicy: ActionPolicyEntry[];
  principles: string[];
  enforcement: Record<string, boolean>;
};

export type ServiceHealth = {
  key: string;
  label: string;
  status: 'operational' | 'degraded';
  detail: string | null;
};

export type SystemHealth = {
  overall: 'operational' | 'degraded';
  operationalCount: number;
  totalCount: number;
  services: ServiceHealth[];
  checkedAt: string | null;
};

export type UsageAnalytics = {
  days: number;
  totals: { interviews: number; completed: number; aiEvaluations: number; users: number };
  statusBreakdown: Array<{ status: string; count: number }>;
  roleBreakdown: Array<{ role: string; count: number }>;
  daily: Array<{ date: string; count: number }>;
  topOrganizations: Array<{ orgId: string; name: string; interviews: number; completed: number }>;
  aptitude?: {
    sessions: number;
    completed: number;
    avgScore: number | null;
    avgAccuracy: number | null;
    events: Array<{ name: string; count: number }>;
  };
};

export type DataGovernance = {
  objects: Array<{ key: string; label: string; count: number }>;
  retention: Array<{ key: string; label: string; policy: string }>;
  deletionNote: string;
};

/* ------------------------------------------------------------ ai / llm config */

export type AiModelEntry = {
  id: string;
  label: string;
  kind: string;
  baseUrl: string;
  model: string;
  apiVersion: string | null;
  preset: string | null;
  enabled: boolean;
  priority: number;
  /** True when a credential is stored. The credential itself is never returned. */
  hasKey: boolean;
  /** A short, non-reversible digest shown in place of the credential. */
  keyFingerprint: string | null;
  keyUpdatedAt: string | null;
  lastTest: {
    ok: boolean;
    at: string | null;
    latencyMs: number | null;
    model: string | null;
    error: string | null;
  } | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AiProviderPreset = {
  id: string;
  label: string;
  kind: string;
  base_url: string;
  model_hint: string;
};

export type AiActiveChainEntry = {
  id: string;
  label: string;
  kind: string;
  model: string;
  source: string;
  configured: boolean;
};

export type AiConfigPayload = {
  configuration: {
    maxEnabled: number;
    enabledCount: number;
    registryEmpty: boolean;
    usingEnvironmentFallback: boolean;
    environmentFallbackAppended?: boolean;
    environmentFallbackCount?: number;
    encryptionAvailable: boolean;
  };
  models: AiModelEntry[];
  activeChain: AiActiveChainEntry[];
  presets: AiProviderPreset[];
  kinds: string[];
  recentChanges: Array<{
    action: string;
    actorId: string | null;
    detail: Record<string, unknown> | null;
    createdAt: string | null;
  }>;
};

export type AiTestResult = {
  ok: boolean;
  latencyMs: number;
  kind: string;
  model: string;
  error: string | null;
};

export type AiModelPayload = {
  label?: string;
  kind?: string;
  baseUrl?: string;
  model?: string;
  apiVersion?: string | null;
  preset?: string | null;
  enabled?: boolean;
  /** Write-only. An empty string clears the stored credential. */
  apiKey?: string;
};

/* --------------------------------------------------------------- fetching */

export class SuperAdminApiError extends Error {}

/**
 * Authenticated JSON fetch for the console. Throws a readable error so each
 * page can render an honest failure state instead of silently showing nothing.
 */
export async function saFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && (body.error || body.message)) ||
      `Request failed (HTTP ${res.status}).`;
    throw new SuperAdminApiError(String(message));
  }
  return body as T;
}

/* ----------------------------------------------------------------- helpers */

export function initialsOf(name: string | null | undefined, fallback = 'SA'): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || fallback;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString();
}

export function formatCurrencyInr(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const formatCurrencyUsd = formatCurrencyInr;

export type DemoAnalyticsSummary = {
  totalRegisteredTrials: number;
  totalDemosStarted: number;
  totalDemosCompleted: number;
  abandonedDemos: number;
  conversionCount: number;
  conversionRatePercent: number;
  totalTrialCostNanoUsd: number;
  totalTrialCostUsd: number;
  avgDemoDurationSeconds: number;
  avgDemoDurationMinutes: number;
  demoAllowancePerAccount: number;
  demoMaxDurationMinutes: number;
};

export type BillingOverview = {
  totalPaidRevenueUsd: number;
  totalPromotionalCreditsUsd: number;
  totalCustomerConsumptionUsd: number;
  totalProviderCostUsd: number | null;
  totalProviderCostStatus?: string;
  grossMarginUsd: number | null;
  grossMarginPercent: number | null;
  totalAvailableBalanceUsd: number;
  totalOutstandingDueUsd: number;
  activeAccountsCount: number;
  lowBalanceAccountsCount: number;
};

export type ServiceUsageMetric = {
  serviceType: string;
  count: number;
  customerChargeNanoUsd: number;
  customerChargeUsd: number;
  providerCostNanoUsd: number | null;
  providerCostUsd: number | null;
  providerCostStatus?: string;
  marginNanoUsd: number | null;
  marginUsd: number | null;
};

export type DailyBillingTrend = {
  date: string;
  rechargesUsd: number;
  debitsUsd: number;
  txCount: number;
};

export type BillingAccount = {
  id: string;
  orgId: string | null;
  userId: string | null;
  accountName: string | null;
  accountType: string;
  currency: string;
  openingBalanceNanoUsd: number;
  paidCreditsNanoUsd: number;
  paidCreditsUsd: number;
  promotionalCreditsNanoUsd: number;
  promotionalCreditsUsd: number;
  consumedCreditsNanoUsd: number;
  consumedCreditsUsd: number;
  providerCostNanoUsd: number;
  providerCostUsd: number;
  grossMarginNanoUsd: number;
  grossMarginUsd: number;
  reservedCreditsNanoUsd: number;
  refundedCreditsNanoUsd: number;
  adjustmentsNanoUsd: number;
  availableBalanceNanoUsd: number;
  availableBalanceUsd: number;
  availableBalanceFormatted: string;
  outstandingDueNanoUsd: number;
  outstandingDueUsd: number;
  creditLimitNanoUsd: number;
  lowBalanceThresholdNanoUsd: number;
  isLowBalance: boolean;
  autoRecharge: {
    enabled?: boolean;
    thresholdNanoUsd?: number;
    rechargeAmountNanoUsd?: number;
    paymentMethodRef?: string | null;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
  tier?: string;
  billingEmail?: string | null;
};

export type BillingLedgerEntry = {
  id: string;
  txRef: string;
  accountId: string;
  orgId: string | null;
  userId: string | null;
  sessionId: string | null;
  entryType: 'opening_balance' | 'recharge_paid' | 'credit_grant' | 'service_debit' | 'service_hold' | 'service_release' | 'refund' | 'adjustment' | 'invoice_charge' | 'invoice_payment';
  amountNanoUsd: number;
  amountUsd: number;
  amountFormatted: string;
  balanceAfterNanoUsd: number;
  balanceAfterUsd: number;
  providerCostNanoUsd: number | null;
  providerCostUsd: number | null;
  currency: string;
  serviceType: string | null;
  serviceDetails?: Record<string, unknown>;
  reference: string | null;
  reason: string | null;
  createdBy: string;
  status: string;
  createdAt: string;
};

export type RateCard = {
  id: string;
  serviceType: string;
  unit: string;
  rates: Record<string, string>;
  version: number;
  description: string;
  currency: string;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  updatedAt: string;
  updatedBy?: string | null;
};

export type BillingInvoice = {
  id: string;
  invoiceNumber: string;
  accountId: string;
  orgId: string;
  totalUsd: number;
  amountDueUsd: number;
  amountPaidUsd: number;
  status: 'draft' | 'issued' | 'paid' | 'void' | 'overdue';
  dueDate: string;
  createdAt: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceUsd: number;
    totalUsd: number;
    serviceType: string;
  }>;
};

export type ReconciliationResult = {
  accountId: string;
  orgId: string | null;
  accountName: string | null;
  cachedBalanceNanoUsd: number;
  ledgerSumNanoUsd: number;
  discrepancyNanoUsd: number;
  isReconciled: boolean;
  transactionCount: number;
  checkedAt: string;
};



export type CompanyCareer = {
  id: string;
  title: string;
  dept: string;
  location: string;
  type: string;
  experience: string;
  description: string;
  requirements?: string;
  status: 'published' | 'draft' | 'archived';
  application_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type CareerApplication = {
  id: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
  applicantEmail: string;
  applicantLinkedIn?: string;
  applicantNote?: string;
  status: string;
  appliedAt: string;
};
