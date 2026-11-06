'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CreditCard,
  Plus,
  ShieldCheck,
  Users,
  Video,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';
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
import { useSuperAdmin } from '@/components/super-admin/SuperAdminShell';
import { formatNumber, saFetch } from '@/lib/super-admin';

type PackageResponse = { success: boolean; packages?: any[]; total?: number };

type NewPackageForm = {
  name: string;
  description: string;
  target_audience: 'individual' | 'organization' | 'both';
  billing_period: 'monthly' | 'yearly' | 'lifetime';
  price: string;
  included_interviews: string;
  included_recruiter_seats: string;
  included_candidate_seats: string;
  interview_duration_limit_minutes: string;
  notes: string;
};

const DEFAULT_PACKAGE_FORM: NewPackageForm = {
  name: '',
  description: '',
  target_audience: 'organization',
  billing_period: 'monthly',
  price: '999',
  included_interviews: '25',
  included_recruiter_seats: '3',
  included_candidate_seats: '50',
  interview_duration_limit_minutes: '30',
  notes: '',
};

export default function SuperAdminPackagesPage() {
  const router = useRouter();
  const { toast } = useSuperAdmin();
  const [packages, setPackages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Create Package Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [packageForm, setPackageForm] = useState<NewPackageForm>(DEFAULT_PACKAGE_FORM);

  // Edit Package Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editPackageForm, setEditPackageForm] = useState<NewPackageForm>(DEFAULT_PACKAGE_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await saFetch<PackageResponse>('/api/super-admin/packages?limit=50');
      setPackages(Array.isArray(body.packages) ? body.packages : []);
      setTotal(Number(body.total) || (Array.isArray(body.packages) ? body.packages.length : 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load packages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePublish = async (packageId: string) => {
    if (!packageId || packageId === 'undefined') {
      toast('Cannot publish package: missing or invalid package ID.', 'error');
      return;
    }
    if (!window.confirm('Publish this package? This will increment the version and make it active.')) return;
    setActionId(packageId);
    try {
      await saFetch(`/api/super-admin/packages/${packageId}/publish`, {
        method: 'POST',
      });
      toast('Package published successfully.', 'success');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Publish failed.';
      setError(message);
      toast(message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleArchive = async (packageId: string) => {
    if (!packageId || packageId === 'undefined') {
      toast('Cannot archive package: missing or invalid package ID.', 'error');
      return;
    }
    if (!window.confirm('Archive this package? This will mark it as archived.')) return;
    setActionId(packageId);
    try {
      await saFetch(`/api/super-admin/packages/${packageId}/archive`, {
        method: 'POST',
      });
      toast('Package archived successfully.', 'success');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Archive failed.';
      setError(message);
      toast(message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleOpenEdit = (pkg: any) => {
    setEditingPackageId(pkg.package_id || pkg.id);
    const pInr = Number(pkg.price ?? pkg.monthlyPrice ?? ((Number(pkg.price_nanousd) || 0) / 1_000_000_000)) || 0;
    setEditPackageForm({
      name: pkg.name || '',
      description: pkg.description || '',
      target_audience: (pkg.target_audience || 'organization') as 'individual' | 'organization' | 'both',
      billing_period: (pkg.billing_period || 'monthly') as 'monthly' | 'yearly' | 'lifetime',
      price: String(pInr),
      included_interviews: String(pkg.included_interviews ?? pkg.interviewsIncluded ?? 25),
      included_recruiter_seats: String(pkg.included_recruiter_seats ?? pkg.seatsIncluded ?? 3),
      included_candidate_seats: String(pkg.included_candidate_seats ?? 50),
      interview_duration_limit_minutes: String(pkg.interview_duration_limit_minutes ?? 30),
      notes: pkg.notes || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackageId) return;
    const name = editPackageForm.name.trim();
    if (!name) {
      toast('Package name is required.', 'error');
      return;
    }
    const priceNum = parseFloat(editPackageForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast('Please enter a valid price.', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      await saFetch(`/api/super-admin/packages/${editingPackageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: editPackageForm.description.trim(),
          target_audience: editPackageForm.target_audience,
          billing_period: editPackageForm.billing_period,
          price: priceNum,
          included_interviews: parseInt(editPackageForm.included_interviews, 10) || 0,
          included_recruiter_seats: parseInt(editPackageForm.included_recruiter_seats, 10) || 0,
          included_candidate_seats: parseInt(editPackageForm.included_candidate_seats, 10) || 0,
          interview_duration_limit_minutes: parseInt(editPackageForm.interview_duration_limit_minutes, 10) || 30,
          notes: editPackageForm.notes.trim(),
        }),
      });
      toast(`Package "${name}" updated successfully.`, 'success');
      setEditModalOpen(false);
      setEditingPackageId(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update package.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (packageId: string, name: string) => {
    if (!packageId || packageId === 'undefined') {
      toast('Cannot delete package: missing or invalid package ID.', 'error');
      return;
    }
    if (!window.confirm(`Permanently delete package "${name}"? This action cannot be undone.`)) return;
    setActionId(packageId);
    try {
      await saFetch(`/api/super-admin/packages/${packageId}`, {
        method: 'DELETE',
      });
      toast(`Package "${name}" deleted successfully.`, 'success');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed.';
      toast(message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = packageForm.name.trim();
    if (!name) {
      toast('Package name is required.', 'error');
      return;
    }
    const priceNum = parseFloat(packageForm.price);
    if (isNaN(priceNum) || priceNum < 0) {
      toast('Please enter a valid price.', 'error');
      return;
    }

    setCreating(true);
    try {
      await saFetch('/api/super-admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: packageForm.description.trim(),
          target_audience: packageForm.target_audience,
          billing_period: packageForm.billing_period,
          price: priceNum,
          included_interviews: parseInt(packageForm.included_interviews, 10) || 0,
          included_recruiter_seats: parseInt(packageForm.included_recruiter_seats, 10) || 0,
          included_candidate_seats: parseInt(packageForm.included_candidate_seats, 10) || 0,
          interview_duration_limit_minutes: parseInt(packageForm.interview_duration_limit_minutes, 10) || 30,
          notes: packageForm.notes.trim(),
        }),
      });
      toast(`Package "${name}" created successfully as draft.`, 'success');
      setCreateModalOpen(false);
      setPackageForm(DEFAULT_PACKAGE_FORM);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create package.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const publishedCount = useMemo(() => {
    return packages.filter((p) => String(p.status || '').toLowerCase() === 'published').length;
  }, [packages]);

  const filteredPackages = useMemo(() => {
    const searchLower = q.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (audienceFilter !== 'all' && String(pkg.target_audience || '').toLowerCase() !== audienceFilter) return false;
      if (statusFilter !== 'all' && String(pkg.status || '').toLowerCase() !== statusFilter) return false;
      if (!searchLower) return true;
      return (
        (pkg.name || '').toLowerCase().includes(searchLower) ||
        (pkg.description || '').toLowerCase().includes(searchLower) ||
        (pkg.target_audience || '').toLowerCase().includes(searchLower) ||
        (pkg.billing_period || '').toLowerCase().includes(searchLower)
      );
    });
  }, [packages, q, audienceFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Package Management"
        description="Versioned packages with pricing, seat allocations and billing periods. All package subscriptions and pricing are managed in Indian Rupees (₹ INR)."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-500/40 bg-accent-cyan/15 px-3 py-1.5 text-xs font-semibold text-accent-cyan transition-all hover:bg-accent-cyan/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Package
            </button>
            <RefreshButton onClick={load} loading={loading} />
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardHeader
          title="Subscription Packages"
          subtitle="Tiered pricing, seat allocations, and active billing rules"
          icon={CreditCard}
          action={
            <div className="flex items-center gap-2">
              <Pill tone="emerald">{publishedCount} published</Pill>
              <Pill tone="neutral">{formatNumber(total)} total</Pill>
            </div>
          }
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search by plan name, audience, or billing period…"
            className="min-w-[240px] flex-1"
          />
          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            aria-label="Filter by target audience"
            className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
          >
            <option value="all">All Audiences</option>
            <option value="organization">Organization</option>
            <option value="individual">Individual</option>
            <option value="both">Both</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="cursor-pointer rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="pb-2 pr-4 font-bold">Name</th>
                <th className="pb-2 pr-4 font-bold">Target Audience</th>
                <th className="pb-2 pr-4 font-bold">Billing Period</th>
                <th className="pb-2 pr-4 font-bold">Price (₹ INR)</th>
                <th className="pb-2 pr-4 font-bold">Version</th>
                <th className="pb-2 font-bold">Status</th>
                <th className="pb-2 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && packages.length === 0 ? (
                <TableSkeleton rows={6} cols={7} />
              ) : filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No packages found"
                      hint="Create a new package or adjust search to get started."
                      icon={CreditCard}
                    />
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg, idx) => {
                  const pkgId = String(pkg.package_id || pkg.id || pkg._id || '');
                  const isPublished = String(pkg.status).toLowerCase() === 'published';
                  const priceInr = Number(pkg.price ?? pkg.monthlyPrice ?? ((Number(pkg.price_nanousd) || 0) / 1_000_000_000)) || 0;
                  return (
                    <tr
                      key={pkg._id ? String(pkg._id) : `${pkg.package_id || 'pkg'}-v${pkg.version || 1}-${idx}`}
                      className="border-t border-line/60 align-middle transition-colors hover:bg-surface-2/70"
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 transition-colors">
                            <Building2 className="h-4 w-4 text-accent-cyan" />
                          </span>
                          <div className="min-w-0">
                            <span className="flex items-center gap-1.5 truncate font-semibold text-ink">
                              {pkg.name}
                            </span>
                            <p className="text-[11px] text-ink-faint">v{pkg.version || 1}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 tabular-nums text-ink-muted">
                          {pkg.target_audience === 'both' ? 'Individual & Organization' : pkg.target_audience === 'individual' ? 'Individual' : 'Organization'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 tabular-nums text-ink-muted capitalize">
                          {pkg.billing_period || 'monthly'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs font-bold text-accent-cyan">
                          ₹{priceInr.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 tabular-nums text-ink-muted">{pkg.version || 1}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <Pill tone={isPublished ? 'emerald' : 'rose'}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {isPublished ? 'Published' : (pkg.status || 'Draft')}
                        </Pill>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <GhostButton
                            icon={Pencil}
                            onClick={() => handleOpenEdit(pkg)}
                            className="border-cyan-500/30 text-accent-cyan hover:bg-cyan-500/10"
                          >
                            Edit
                          </GhostButton>
                          {isPublished ? (
                            <GhostButton
                              icon={ShieldCheck}
                              disabled={actionId === pkgId}
                              onClick={() => handleArchive(pkgId)}
                              className="border-rose-500/30 text-accent-rose hover:bg-rose-500/10"
                            >
                              Archive
                            </GhostButton>
                          ) : (
                            <GhostButton
                              icon={ShieldCheck}
                              disabled={actionId === pkgId}
                              onClick={() => handlePublish(pkgId)}
                              className="border-emerald-500/30 text-accent-emerald hover:bg-emerald-500/10"
                            >
                              Publish
                            </GhostButton>
                          )}
                          {!isPublished && (
                            <GhostButton
                              icon={Trash2}
                              disabled={actionId === pkgId}
                              onClick={() => handleDelete(pkgId, pkg.name)}
                              className="border-rose-500/30 text-accent-rose hover:bg-rose-500/10"
                            >
                              Delete
                            </GhostButton>
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

      <Card className="border-line">
        <CardHeader
          title="Package governance"
          subtitle="Every package version is tracked with effective dates. Price changes are frozen for existing subscribers."
          icon={ShieldCheck}
        />
        <ul className="mt-4 space-y-2 text-xs text-ink-muted">
          <li>• Packages start as unpublished and must be explicitly published</li>
          <li>• Each publish increments the version; previous version gets an effective_to date</li>
          <li>• Organizational subscriptions freeze the contractual price at creation</li>
          <li>• Individual subscriptions also freeze the contractual price</li>
        </ul>
      </Card>

      {/* Edit Package Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-accent-cyan" />
                <h3 className="text-base font-bold text-ink">Edit Package</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={editPackageForm.name}
                  onChange={(e) => setEditPackageForm({ ...editPackageForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editPackageForm.description}
                  onChange={(e) => setEditPackageForm({ ...editPackageForm, description: e.target.value })}
                  className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Target Audience
                  </label>
                  <select
                    value={editPackageForm.target_audience}
                    onChange={(e) =>
                      setEditPackageForm({
                        ...editPackageForm,
                        target_audience: e.target.value as 'individual' | 'organization' | 'both',
                      })
                    }
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none"
                  >
                    <option value="organization">Organization</option>
                    <option value="individual">Individual</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Billing Period
                  </label>
                  <select
                    value={editPackageForm.billing_period}
                    onChange={(e) =>
                      setEditPackageForm({
                        ...editPackageForm,
                        billing_period: e.target.value as 'monthly' | 'yearly' | 'lifetime',
                      })
                    }
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editPackageForm.price}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, price: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Included Interviews
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editPackageForm.included_interviews}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, included_interviews: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Recruiter Seats
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editPackageForm.included_recruiter_seats}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, included_recruiter_seats: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Candidate Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editPackageForm.included_candidate_seats}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, included_candidate_seats: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Duration (Min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={editPackageForm.interview_duration_limit_minutes}
                    onChange={(e) => setEditPackageForm({ ...editPackageForm, interview_duration_limit_minutes: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-1.5 text-xs font-bold text-accent-cyan hover:bg-cyan-500/30 disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Package Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Package Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-accent-cyan" />
                <h3 className="text-base font-bold text-ink">Create New Package</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Growth Suite"
                  value={packageForm.name}
                  onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                  className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of included limits and privileges"
                  value={packageForm.description}
                  onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                  className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Target Audience
                  </label>
                  <select
                    value={packageForm.target_audience}
                    onChange={(e) =>
                      setPackageForm({
                        ...packageForm,
                        target_audience: e.target.value as 'individual' | 'organization' | 'both',
                      })
                    }
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none"
                  >
                    <option value="organization">Organization</option>
                    <option value="individual">Individual</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Billing Period
                  </label>
                  <select
                    value={packageForm.billing_period}
                    onChange={(e) =>
                      setPackageForm({
                        ...packageForm,
                        billing_period: e.target.value as 'monthly' | 'yearly' | 'lifetime',
                      })
                    }
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={packageForm.price}
                    onChange={(e) => setPackageForm({ ...packageForm, price: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Included Interviews
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={packageForm.included_interviews}
                    onChange={(e) => setPackageForm({ ...packageForm, included_interviews: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Recruiter Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={packageForm.included_recruiter_seats}
                    onChange={(e) => setPackageForm({ ...packageForm, included_recruiter_seats: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Candidate Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={packageForm.included_candidate_seats}
                    onChange={(e) => setPackageForm({ ...packageForm, included_candidate_seats: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">
                    Duration (Min)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={packageForm.interview_duration_limit_minutes}
                    onChange={(e) => setPackageForm({ ...packageForm, interview_duration_limit_minutes: e.target.value })}
                    className="w-full rounded-xl border border-line bg-inset px-3 py-2 text-xs text-ink outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl border border-cyan-500/50 bg-cyan-500/20 px-4 py-1.5 text-xs font-bold text-accent-cyan hover:bg-cyan-500/30 disabled:opacity-50 cursor-pointer"
                >
                  {creating ? 'Creating...' : 'Create Draft Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}