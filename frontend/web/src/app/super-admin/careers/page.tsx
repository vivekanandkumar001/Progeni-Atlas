'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Pill,
  RefreshButton,
  SearchInput,
  StatCard,
  TableSkeleton,
} from '@/components/super-admin/ui';

function PrimaryButton({
  children,
  onClick,
  type = 'button',
  icon: Icon,
  loading = false,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-accent-cyan/15 px-3 py-1.5 text-xs font-semibold text-accent-cyan transition-all hover:bg-accent-cyan/25 disabled:opacity-50 ${className}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span>{loading ? 'Please wait...' : children}</span>
    </button>
  );
}
import {
  formatDateTime,
  formatNumber,
  saFetch,
  type CareerApplication,
  type CompanyCareer,
} from '@/lib/super-admin';

type CareersResponse = {
  success: boolean;
  careers: CompanyCareer[];
  total: number;
  publishedCount: number;
  draftCount: number;
  totalApplications: number;
};

type ApplicationsResponse = {
  success: boolean;
  applications: CareerApplication[];
  count: number;
};

const DEPARTMENTS = [
  'All',
  'AI / ML',
  'Engineering',
  'Product',
  'Operations',
  'Design',
  'Marketing',
  'Sales',
];

export default function SuperAdminCareersPage() {
  const [careers, setCareers] = useState<CompanyCareer[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal: Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CompanyCareer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [dept, setDept] = useState('Engineering');
  const [location, setLocation] = useState('Remote (Global)');
  const [jobType, setJobType] = useState('Full-time');
  const [experience, setExperience] = useState('Senior (3+ yrs)');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>('published');

  // Applications Drawer
  const [drawerJob, setDrawerJob] = useState<CompanyCareer | null>(null);
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadCareers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await saFetch<CareersResponse>('/api/super-admin/careers');
      if (res.success) {
        setCareers(res.careers || []);
        setPublishedCount(res.publishedCount || 0);
        setDraftCount(res.draftCount || 0);
        setTotalApplications(res.totalApplications || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load company careers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCareers();
  }, [loadCareers]);

  const openCreateModal = () => {
    setEditingJob(null);
    setTitle('');
    setDept('Engineering');
    setLocation('Remote (Global)');
    setJobType('Full-time');
    setExperience('Senior (3+ yrs)');
    setDescription('');
    setRequirements('');
    setStatus('published');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (job: CompanyCareer) => {
    setEditingJob(job);
    setTitle(job.title);
    setDept(job.dept);
    setLocation(job.location);
    setJobType(job.type);
    setExperience(job.experience);
    setDescription(job.description);
    setRequirements(job.requirements || '');
    setStatus(job.status);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Job title is required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        title: title.trim(),
        dept,
        location,
        type: jobType,
        experience,
        description,
        requirements,
        status,
      };

      if (editingJob) {
        const jobId = editingJob.id;
        await saFetch(`/api/super-admin/careers/${jobId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await saFetch('/api/super-admin/careers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setModalOpen(false);
      await loadCareers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save job opening.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (job: CompanyCareer) => {
    const nextStatus = job.status === 'published' ? 'draft' : 'published';
    setActionLoadingId(job.id);
    try {
      await saFetch(`/api/super-admin/careers/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadCareers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update job status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteJob = async (job: CompanyCareer) => {
    if (!window.confirm(`Are you sure you want to delete "${job.title}"?`)) return;
    setActionLoadingId(job.id);
    try {
      await saFetch(`/api/super-admin/careers/${job.id}`, {
        method: 'DELETE',
      });
      await loadCareers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete job opening.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openApplicationsDrawer = async (job: CompanyCareer) => {
    setDrawerJob(job);
    setLoadingApps(true);
    setApplications([]);
    try {
      const res = await saFetch<ApplicationsResponse>(`/api/super-admin/careers/${job.id}/applications`);
      if (res.success) {
        setApplications(res.applications || []);
      }
    } catch (e) {
      console.error('Failed to load applications', e);
    } finally {
      setLoadingApps(false);
    }
  };

  // Filtered List
  const filteredCareers = useMemo(() => {
    return careers.filter((job) => {
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        job.title.toLowerCase().includes(q) ||
        job.dept.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.experience.toLowerCase().includes(q);

      const matchDept = selectedDept === 'All' || job.dept === selectedDept;
      const matchStatus = selectedStatus === 'all' || job.status === selectedStatus;

      return matchQuery && matchDept && matchStatus;
    });
  }, [careers, query, selectedDept, selectedStatus]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Careers & Openings"
        description="Manage Progeni Atlas's internal hiring requirements. Roles published here immediately appear on the public /career landing page."
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={loadCareers} loading={loading} />
            <PrimaryButton icon={Plus} onClick={openCreateModal}>
              Create Opening
            </PrimaryButton>
          </div>
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Job Openings"
          value={formatNumber(careers.length)}
          hint="Active & draft internal roles"
          icon={Briefcase}
          tone="cyan"
        />
        <StatCard
          label="Published on /career"
          value={formatNumber(publishedCount)}
          hint="Live roles accepting applications"
          icon={Globe}
          tone="emerald"
        />
        <StatCard
          label="Draft / Archived"
          value={formatNumber(draftCount)}
          hint="Unpublished internal requirements"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Total Applications"
          value={formatNumber(totalApplications)}
          hint="Candidates applied across all roles"
          icon={Users}
          tone="violet"
        />
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader
          title="Progeni Atlas Internal Openings"
          subtitle="All open roles configured for Progeni Atlas company hiring"
          icon={Building2}
          action={
            <span className="text-xs text-ink-muted">
              Showing {filteredCareers.length} of {careers.length} roles
            </span>
          }
        />

        {/* Filter Controls */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search roles by title, department, location..."
            className="w-full sm:min-w-[260px] sm:flex-1"
          />

          <div className="flex items-center gap-2">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              aria-label="Department filter"
              className="rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  Dept: {d}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Status filter"
              className="rounded-xl border border-line bg-inset px-3 py-1.5 text-xs text-ink outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Roles Table */}
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : filteredCareers.length === 0 ? (
            <EmptyState
              title="No job openings found"
              hint="No roles match your search filters. Click 'Create Opening' to add a new requirement."
              icon={Briefcase}
            />
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="pb-3 pl-2">Role Title & Experience</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Location & Type</th>
                  <th className="pb-3 text-center">Applications</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink">
                {filteredCareers.map((job) => {
                  const isPublished = job.status === 'published';
                  const isActionLoading = actionLoadingId === job.id;

                  return (
                    <tr key={job.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3 pl-2">
                        <div className="font-semibold text-ink">{job.title}</div>
                        <div className="text-xs text-ink-muted">{job.experience}</div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-lg border border-line bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink">
                          {job.dept}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 text-xs text-ink">
                          <MapPin className="h-3.5 w-3.5 text-ink-muted" />
                          {job.location}
                        </div>
                        <div className="text-xs text-ink-muted">{job.type}</div>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => openApplicationsDrawer(job)}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-accent-violet hover:bg-violet-500/20 transition-all cursor-pointer"
                        >
                          <Users className="h-3 w-3" />
                          <span>{job.application_count || 0}</span>
                        </button>
                      </td>
                      <td className="py-3">
                        {isPublished ? (
                          <Pill tone="emerald">Live</Pill>
                        ) : job.status === 'draft' ? (
                          <Pill tone="amber">Draft</Pill>
                        ) : (
                          <Pill tone="neutral">Archived</Pill>
                        )}
                      </td>
                      <td className="py-3 text-right pr-2">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openApplicationsDrawer(job)}
                            title="View candidate applications"
                            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(job)}
                            title="Edit opening"
                            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleToggleStatus(job)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                              isPublished
                                ? 'border-amber-500/30 bg-amber-500/10 text-accent-amber hover:bg-amber-500/20'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-accent-emerald hover:bg-emerald-500/20'
                            }`}
                          >
                            {isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteJob(job)}
                            title="Delete opening"
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal: Create / Edit Job Opening */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-accent-cyan" />
                <h3 className="text-lg font-bold text-ink">
                  {editingJob ? 'Edit Company Opening' : 'Create New Job Opening'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && <div className="mt-4"><ErrorBanner message={formError} /></div>}

            <form onSubmit={handleSaveJob} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Machine Learning Engineer"
                  className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted">Department</label>
                  <select
                    value={dept}
                    onChange={(e) => setDept(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                  >
                    {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Remote (Global) or Noida, India"
                    className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted">Employment Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted">Experience Level</label>
                  <input
                    type="text"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="e.g. Senior (4+ yrs)"
                    className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted">Role Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key responsibilities and day-to-day impact..."
                  className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted">Requirements & Skills</label>
                <textarea
                  rows={2}
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Key skills, tech stack, and qualifications..."
                  className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-muted">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-line bg-inset px-3 py-2 text-sm text-ink outline-none focus:border-cyan-500"
                >
                  <option value="published">Published (Visible immediately on /career)</option>
                  <option value="draft">Draft (Saved internally, hidden from public)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-2 cursor-pointer">
                  Cancel
                </button>
                <PrimaryButton type="submit" loading={submitting}>
                  {editingJob ? 'Save Changes' : 'Create Opening'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applications Drawer */}
      {drawerJob && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-surface border-l border-line p-6 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-muted">
                  {drawerJob.dept}
                </div>
                <h3 className="mt-2 text-lg font-bold text-ink">{drawerJob.title}</h3>
                <p className="text-xs text-ink-muted">{drawerJob.location} • {drawerJob.type}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerJob(null)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-ink">
                  Candidate Applications ({applications.length})
                </h4>
                <button
                  type="button"
                  onClick={() => openApplicationsDrawer(drawerJob)}
                  className="text-xs text-accent-cyan hover:underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>

              {loadingApps ? (
                <div className="py-8 text-center text-xs text-ink-muted">Loading applicants...</div>
              ) : applications.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface-2/40 p-8 text-center">
                  <User className="h-8 w-8 text-ink-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-ink">No applications yet</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    When candidates apply on the public /career page, their dossiers will appear here.
                  </p>
                </div>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl border border-line bg-surface-2/50 p-4 space-y-2 hover:border-line-strong transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-ink text-sm">{app.applicantName}</div>
                        <div className="flex items-center gap-1 text-xs text-ink-muted">
                          <Mail className="h-3 w-3" />
                          <a href={`mailto:${app.applicantEmail}`} className="text-accent-cyan hover:underline">
                            {app.applicantEmail}
                          </a>
                        </div>
                      </div>
                      <span className="text-[11px] text-ink-muted">
                        {app.appliedAt ? formatDateTime(app.appliedAt) : 'Recently'}
                      </span>
                    </div>

                    {app.applicantLinkedIn && (
                      <div className="text-xs">
                        <span className="text-ink-muted">LinkedIn: </span>
                        <a
                          href={app.applicantLinkedIn}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-cyan hover:underline"
                        >
                          {app.applicantLinkedIn}
                        </a>
                      </div>
                    )}

                    {app.applicantNote && (
                      <div className="rounded-lg border border-line bg-surface p-2.5 text-xs text-ink-muted">
                        <span className="font-semibold text-ink block mb-0.5">Cover Note:</span>
                        {app.applicantNote}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-line pt-4 flex justify-end">
              <button type="button" onClick={() => setDrawerJob(null)} className="rounded-xl border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-2 cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
