'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Gift, KeyRound, ShieldCheck, UserCog, UserX, Users } from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  GhostButton,
  PageHeader,
  Pill,
  RefreshButton,
  SearchInput,
  TableSkeleton,
} from '@/components/super-admin/ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import { formatDateTime, initialsOf, saFetch, type BillingAccount, type PlatformUser } from '@/lib/super-admin';

type UsersResponse = { success: boolean; users?: PlatformUser[] };

type CreditMode = 'grant' | 'recharge';

type CreditAccountSummary = Pick<
  BillingAccount,
  | 'id'
  | 'orgId'
  | 'userId'
  | 'accountName'
  | 'currency'
  | 'availableBalanceUsd'
  | 'availableBalanceFormatted'
  | 'paidCreditsUsd'
  | 'promotionalCreditsUsd'
  | 'consumedCreditsUsd'
  | 'status'
  | 'tier'
>;

const roleTone: Record<string, 'cyan' | 'violet' | 'emerald' | 'neutral'> = {
  super_admin: 'violet',
  recruiter: 'cyan',
  candidate: 'emerald',
};

export default function SuperAdminUsersPage() {
  const { user: currentUser, toast } = useSuperAdmin();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Credit console (Option 2: inline grant/recharge from the users directory)
  const [creditUser, setCreditUser] = useState<PlatformUser | null>(null);
  const [creditMode, setCreditMode] = useState<CreditMode>('grant');
  const [creditAccount, setCreditAccount] = useState<CreditAccountSummary | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditAccountError, setCreditAccountError] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReference, setCreditReference] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditSaving, setCreditSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await saFetch<UsersResponse>('/api/super-admin/users?limit=500');
      setUsers(Array.isArray(body.users) ? body.users : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const role = params.get('role');
      if (role && ['candidate', 'recruiter', 'super_admin'].includes(role)) {
        setRoleFilter(role);
      }
    }
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!term) return true;
      return (
        (u.email || '').toLowerCase().includes(term) ||
        (u.fullName || '').toLowerCase().includes(term) ||
        (u.organizationName || '').toLowerCase().includes(term)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const mutate = async (target: PlatformUser, payload: { role?: string; status?: string }, label: string) => {
    setBusyId(target.id);
    try {
      await saFetch(`/api/super-admin/users/${target.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast(`${label} recorded and audited.`, 'success');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Update failed.';
      setError(message);
      toast(message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = (target: PlatformUser) => {
    if (target.role === 'super_admin') {
      toast('The primary Super Admin account cannot be suspended.', 'error');
      return;
    }
    const suspended = target.status === 'suspended';
    const next = suspended ? 'active' : 'suspended';
    if (!window.confirm(`Set ${target.email} to ${next}?`)) return;
    void mutate(target, { status: next }, `Account ${next}`);
  };

  // Resolve the billing account that belongs to the selected platform user.
  // Recruiter/candidate accounts are user-scoped, so we match on userId first
  // and fall back to the tenant account of the user's organization, auto-provisioning
  // if not yet linked.
  const loadCreditAccount = useCallback(async (target: PlatformUser) => {
    setCreditLoading(true);
    setCreditAccountError(null);
    setCreditAccount(null);
    try {
      const res = await saFetch<{
        success: boolean;
        accounts?: CreditAccountSummary[];
        account?: CreditAccountSummary;
      }>(`/api/super-admin/billing/accounts?user_id=${encodeURIComponent(target.id)}`);

      const accounts = Array.isArray(res.accounts) ? res.accounts : [];
      const match =
        res.account ||
        accounts.find((a) => a.userId && a.userId === target.id) ||
        (target.orgId ? accounts.find((a) => a.orgId && a.orgId === target.orgId) : undefined) ||
        accounts[0] ||
        null;

      setCreditAccount(match);
      if (!match) {
        setCreditAccountError(
          `No billing account could be resolved for ${target.fullName || target.email}.`
        );
      }
    } catch (e) {
      setCreditAccountError(e instanceof Error ? e.message : 'Unable to resolve the billing account.');
    } finally {
      setCreditLoading(false);
    }
  }, []);

  const openCreditConsole = (target: PlatformUser, mode: CreditMode = 'grant') => {
    setCreditUser(target);
    setCreditMode(mode);
    setCreditAmount('');
    setCreditReference('');
    setCreditReason('');
    setCreditAccountError(null);
    void loadCreditAccount(target);
  };

  const closeCreditConsole = () => {
    if (creditSaving) return;
    setCreditUser(null);
    setCreditAccount(null);
    setCreditAccountError(null);
  };

  const submitCredit = async () => {
    if (!creditUser || !creditAccount) return;
    const amountNum = parseFloat(creditAmount);
    if (!amountNum || amountNum <= 0) {
      toast('Enter a valid credit amount greater than zero.', 'error');
      return;
    }
    if (creditMode === 'recharge' && !creditReference.trim()) {
      toast('Payment reference / transaction ID is required for a paid recharge.', 'error');
      return;
    }
    if (creditReason.trim().length < 10) {
      toast('Reason must be at least 10 characters.', 'error');
      return;
    }

    setCreditSaving(true);
    try {
      const path =
        creditMode === 'recharge'
          ? `/api/super-admin/billing/accounts/${creditAccount.id}/recharge`
          : `/api/super-admin/billing/accounts/${creditAccount.id}/grant`;

      const res = await saFetch<{ success: boolean; message: string }>(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          ...(creditMode === 'recharge' ? { paymentReference: creditReference.trim() } : {}),
          notes: creditReason.trim(),
          idempotencyKey: `${creditMode === 'recharge' ? 'rech' : 'grant'}-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`,
        }),
      });

      if (res.success) {
        toast(res.message || 'Credits updated successfully.', 'success');
        setCreditAmount('');
        setCreditReference('');
        setCreditReason('');
        await loadCreditAccount(creditUser);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update credits.';
      toast(message, 'error');
    } finally {
      setCreditSaving(false);
    }
  };

  const counts = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const u of users) byRole[u.role] = (byRole[u.role] || 0) + 1;
    return byRole;
  }, [users]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Accounts"
        description="Manage candidate, recruiter and admin accounts. Super Admin can never view or set a user's password — only secure self-service recovery is permitted."
        actions={<RefreshButton onClick={load} loading={loading} />}
      />

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-ink-muted">Total accounts</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-ink">{users.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-muted">Recruiters / Admins</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-ink">
            {(counts.recruiter || 0) + (counts.admin || 0)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-ink-muted">Super Admins</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-accent-violet">{counts.super_admin || 0}</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Account directory" subtitle="Account status and lifecycle oversight" icon={Users} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or organization…" className="min-w-[240px] flex-1" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
          >
            <option value="all">All roles</option>
            <option value="candidate">Candidate</option>
            <option value="recruiter">Recruiter</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="pb-2 pr-4 font-bold">Account</th>
                <th className="pb-2 pr-4 font-bold">Organization</th>
                <th className="pb-2 pr-4 font-bold">Role</th>
                <th className="pb-2 pr-4 font-bold">Status</th>
                <th className="pb-2 pr-4 font-bold">Created</th>
                <th className="pb-2 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <TableSkeleton rows={8} cols={6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No accounts match" hint="Try a different search or filter." />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isSuperAdminAccount = u.role === 'super_admin';
                  const self = currentUser?.id && currentUser.id === u.id;
                  const suspended = u.status === 'suspended';
                  return (
                    <tr key={u.id} className="border-t border-line/60 align-middle">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-[11px] font-black text-white">
                            {initialsOf(u.fullName || u.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">
                              {u.fullName || u.email.split('@')[0]}
                              {self && <span className="ml-2 text-[10px] font-bold uppercase text-accent-cyan">You</span>}
                            </p>
                            <p className="truncate text-[11px] text-ink-faint">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-ink-muted">{u.organizationName || '—'}</td>
                      <td className="py-3 pr-4">
                        {isSuperAdminAccount ? (
                          <Pill tone="violet">
                            <ShieldCheck className="mr-1 inline-block h-3.5 w-3.5" />
                            Super Admin (Owner)
                          </Pill>
                        ) : (
                          <Pill tone={roleTone[u.role] || 'neutral'}>{u.role.replace(/_/g, ' ')}</Pill>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Pill tone={suspended ? 'rose' : 'emerald'}>
                          <span className={`h-1.5 w-1.5 rounded-full ${suspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {u.status || 'unknown'}
                        </Pill>
                      </td>
                      <td className="py-3 pr-4 text-xs text-ink-faint">{formatDateTime(u.createdAt)}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isSuperAdminAccount ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-accent-violet">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Protected Account
                            </span>
                          ) : (
                            <>
                              <GhostButton
                                icon={Coins}
                                disabled={busyId === u.id}
                                onClick={() => openCreditConsole(u, 'grant')}
                                className="border-cyan-500/30 text-accent-cyan hover:bg-cyan-500/10"
                              >
                                Credits
                              </GhostButton>
                              <GhostButton
                                icon={suspended ? ShieldCheck : UserX}
                                disabled={self || busyId === u.id}
                                onClick={() => toggleStatus(u)}
                                className={suspended
                                  ? 'border-emerald-500/30 text-accent-emerald hover:bg-emerald-500/10'
                                  : 'border-rose-500/30 text-accent-rose hover:bg-rose-500/10'}
                              >
                                {suspended ? 'Activate' : 'Suspend'}
                              </GhostButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Password policy" subtitle="Enforced platform-wide" icon={KeyRound} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li>• Super Admin cannot read or manually assign passwords.</li>
            <li>• Only secure, self-service recovery flows (OTP / email) reset credentials.</li>
            <li>• Password hashes are never exposed through any admin endpoint.</li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Account safeguards" subtitle="Enforced platform-wide" icon={UserCog} />
          <ul className="mt-4 space-y-2 text-xs text-ink-muted">
            <li>• You cannot suspend your own account — self-lockout is blocked server-side.</li>
            <li>• Primary Super Admin account is permanently protected and immutable.</li>
            <li>• Every action records actor, target, timestamp, and audit trail.</li>
          </ul>
        </Card>
      </div>

      {/* CREDIT CONSOLE — inline grant / paid recharge for any user */}
      {creditUser && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreditConsole();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                {creditMode === 'recharge' ? (
                  <Coins className="h-5 w-5 text-accent-emerald" />
                ) : (
                  <Gift className="h-5 w-5 text-accent-violet" />
                )}
                <div>
                  <h3 className="font-bold text-ink">Add credits</h3>
                  <p className="text-[11px] text-ink-muted">
                    {creditUser.fullName || creditUser.email}
                    {creditUser.organizationName ? ` · ${creditUser.organizationName}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreditConsole}
                className="rounded-lg border border-line p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Close credit console"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCreditMode('grant')}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  creditMode === 'grant'
                    ? 'border-violet-500/40 bg-violet-500/15 text-accent-violet'
                    : 'border-line bg-surface-2 text-ink-muted hover:text-ink'
                }`}
              >
                Grant promotional credits
              </button>
              <button
                type="button"
                onClick={() => setCreditMode('recharge')}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  creditMode === 'recharge'
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-accent-emerald'
                    : 'border-line bg-surface-2 text-ink-muted hover:text-ink'
                }`}
              >
                Record paid recharge
              </button>
            </div>

            {creditLoading ? (
              <p className="mt-5 text-xs text-ink-muted">Resolving billing account…</p>
            ) : creditAccountError ? (
              <div className="mt-5 space-y-3">
                <ErrorBanner message={creditAccountError} />
                {creditUser && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadCreditAccount(creditUser)}
                  >
                    Provision &amp; Retry
                  </Button>
                )}
              </div>
            ) : creditAccount ? (
              <>
                <div className="mt-5 grid gap-3 rounded-xl border border-line bg-surface-2 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="text-ink-faint">Account</p>
                    <p className="font-semibold text-ink">
                      {creditAccount.accountName || creditAccount.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Scope</p>
                    <p className="font-semibold text-ink">
                      {creditAccount.orgId ? creditAccount.tier || 'Organization' : 'User account'}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Available balance</p>
                    <p className="font-semibold text-ink">
                      {creditAccount.availableBalanceFormatted ||
                        `₹${(creditAccount.availableBalanceUsd ?? 0).toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Paid / Promo</p>
                    <p className="font-semibold text-ink">
                      ₹{(creditAccount.paidCreditsUsd ?? 0).toFixed(2)} / ₹
                      {(creditAccount.promotionalCreditsUsd ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <label className="mb-1 block text-ink-muted">
                      Credit amount (₹ INR) *
                    </label>
                    <Input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="500.00"
                    />
                  </div>
                  {creditMode === 'recharge' && (
                    <div>
                      <label className="mb-1 block text-ink-muted">
                        Payment reference (transaction ID / wire ref) *
                      </label>
                      <Input
                        value={creditReference}
                        onChange={(e) => setCreditReference(e.target.value)}
                        placeholder="pi_3MtwBwLkdIwHu7ix28a3tqZ0"
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-ink-muted">
                      Reason (min 10 characters) *
                    </label>
                    <textarea
                      rows={3}
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                      placeholder={
                        creditMode === 'recharge'
                          ? 'Enterprise monthly credit package recharge approved via verified bank wire…'
                          : 'Pilot evaluation credits granted by Super Admin…'
                      }
                      className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-ink outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeCreditConsole} disabled={creditSaving}>
                    Cancel
                  </Button>
                  <Button onClick={() => void submitCredit()} isLoading={creditSaving}>
                    {creditMode === 'recharge' ? 'Confirm recharge' : 'Grant credits'}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
