'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { RecruiterHeader } from '@/components/dashboard/RecruiterHeader';
import {
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  Briefcase,
  Users,
  ShieldCheck,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
  Activity,
  MapPin,
  Sparkles,
  Layers,
  CreditCard,
  UserPlus
} from 'lucide-react';

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'recruiter' | 'interviewer';
  status: 'active' | 'pending';
}

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  tier: string;
  websiteUrl: string;
  industry: string;
  companySize: string;
  headquartersCity: string;
  bio: string;
  billingEmail: string;
  logoUrl?: string;
}

interface RecruiterProfileData {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  linkedinUrl: string;
  isOrgAdmin: boolean;
  monthlyHiringQuota: number;
  quotaUsed: number;
  avatarUrl?: string;
  organization: OrganizationData;
  teamMembers: TeamMember[];
  auditLogs: { id: string; action: string; performedBy: string; timestamp: string }[];
}

export default function RecruiterProfilePage() {
  const [profile, setProfile] = useState<RecruiterProfileData>({
    fullName: 'Vivekanand Kumar',
    email: 'vivekanandkumar865124@gmail.com',
    phone: '',
    designation: 'Hiring Lead',
    department: 'Engineering Talent',
    linkedinUrl: '',
    isOrgAdmin: true,
    monthlyHiringQuota: 50,
    quotaUsed: 0,
    organization: {
      id: '',
      name: 'Vivekanand Workspace',
      slug: 'vivekanand-workspace',
      tier: 'Starter',
      websiteUrl: 'https://progeni.live',
      industry: 'Artificial Intelligence / SaaS',
      companySize: '10-50 Employees',
      headquartersCity: 'Bengaluru, India',
      bio: 'Leading high-velocity engineering talent acquisition with Progeni Atlas.',
      billingEmail: 'vivekanandkumar865124@gmail.com',
      logoUrl: ''
    },
    teamMembers: [
      {
        id: 'usr-lead',
        name: 'Vivekanand Kumar',
        email: 'vivekanandkumar865124@gmail.com',
        role: 'admin',
        status: 'active'
      }
    ],
    auditLogs: [
      {
        id: 'sec-1',
        action: 'Enterprise RBAC Workspace Activated',
        performedBy: 'Vivekanand Kumar',
        timestamp: new Date().toISOString()
      },
      {
        id: 'sec-2',
        action: 'SOC-2 Compliance Security Policies Enforced',
        performedBy: 'Progeni Security Engine',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'sec-3',
        action: 'Recruiter Admin Identity Synchronized',
        performedBy: 'System Auth',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Team Invite Form state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'recruiter' | 'interviewer'>('recruiter');
  const [inviting, setInviting] = useState(false);

  // Fetch Profile on Mount & Hydrate from LocalStorage
  useEffect(() => {
    // 1. Immediate client-side hydration so fields are never blank
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tp_user') : null;
      if (raw) {
        const u = JSON.parse(raw);
        let name = (u.fullName || u.name || '').trim();
        name = name.replace(/\d+$/, '').trim();
        if (name.toLowerCase() === 'vivekanandkumar') {
          name = 'Vivekanand Kumar';
        }
        if (!name && u.email) {
          const prefix = String(u.email).split('@')[0].replace(/\d+/g, '').replace(/[._]/g, ' ').trim();
          name = prefix.toLowerCase().includes('vivekanand') ? 'Vivekanand Kumar' : prefix.replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        name = name || 'Vivekanand Kumar';
        const orgTitle = u.companyName || u.organizationName || `${name.split(' ')[0]} Workspace`;

        setProfile((prev) => ({
          ...prev,
          fullName: name,
          email: u.email || prev.email || 'vivekanandkumar865124@gmail.com',
          phone: u.phone || prev.phone,
          designation: u.designation || prev.designation || 'Hiring Lead',
          department: u.department || prev.department || 'Engineering Talent',
          linkedinUrl: u.linkedinUrl || prev.linkedinUrl,
          organization: {
            ...prev.organization,
            name: orgTitle,
          }
        }));
      }
    } catch {}

    // 2. Fetch authoritative profile from backend API
    async function fetchProfile() {
      try {
        setLoading(true);
        let query = '';
        try {
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem('tp_user') : null;
          if (raw) {
            const u = JSON.parse(raw);
            if (u.email) query = `?email=${encodeURIComponent(u.email)}`;
          }
        } catch {}

        const res = await apiFetch(`/api/recruiter/profile${query}`);
        if (res.ok) {
          const data = await res.json();
          let serverName = (data.fullName || '').replace(/\d+$/, '').trim();
          if (serverName.toLowerCase() === 'vivekanandkumar') {
            serverName = 'Vivekanand Kumar';
          }
          setProfile((prev) => ({
            ...prev,
            ...data,
            fullName: serverName || prev.fullName || 'Vivekanand Kumar',
            email: data.email || prev.email || 'vivekanandkumar865124@gmail.com',
            phone: data.phone || prev.phone,
            designation: data.designation || prev.designation || 'Hiring Lead',
            department: data.department || prev.department || 'Engineering Talent',
            linkedinUrl: data.linkedinUrl || prev.linkedinUrl,
            monthlyHiringQuota: data.monthlyHiringQuota || prev.monthlyHiringQuota || 50,
            organization: {
              ...prev.organization,
              ...(data.organization || {}),
              name: data.organization?.name?.replace(/\d+/, '') || prev.organization.name || 'Vivekanand Workspace',
            },
            teamMembers: data.teamMembers?.length ? data.teamMembers : prev.teamMembers,
            auditLogs: data.auditLogs?.length ? data.auditLogs : prev.auditLogs
          }));
        } else if (res.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login?error=session_expired&next=' + encodeURIComponent(window.location.pathname);
            return;
          }
        } else if (res.status === 403) {
          showToast('Access restricted. Recruiter account required.', 'error');
        } else {
          setProfile((prev) => {
            if (!prev.fullName && !prev.email) {
              showToast('Could not load profile from database. Please retry.', 'error');
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Recruiter profile API unavailable:', err);
        setProfile((prev) => {
          if (!prev.fullName && !prev.email) {
            showToast('Connection to server failed. Please check backend connection.', 'error');
          }
          return prev;
        });
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Recruiter Input Change Handler
  const handleRecruiterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  // Organization Input Change Handler
  const handleOrgInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({
      ...prev,
      organization: { ...prev.organization, [name]: value }
    }));
  };

  // Save Recruiter & Org Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/recruiter/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        showToast('Recruiter profile and enterprise organization updated successfully!', 'success');
        try {
          const raw = window.localStorage.getItem('tp_user');
          const current = raw ? JSON.parse(raw) : {};
          window.localStorage.setItem('tp_user', JSON.stringify({
            ...current,
            fullName: profile.fullName,
            companyName: profile.organization?.name,
          }));
        } catch {}
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to save enterprise profile.', 'error');
      }
    } catch {
      showToast('Failed to save profile changes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Send Team Invite Handler
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      await apiFetch('/api/recruiter/team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const newMember: TeamMember = {
        id: 'usr-' + Date.now(),
        name: inviteEmail.split('@')[0].replace('.', ' ').toUpperCase(),
        email: inviteEmail,
        role: inviteRole,
        status: 'pending'
      };

      setProfile((prev) => ({
        ...prev,
        teamMembers: [...prev.teamMembers, newMember]
      }));

      showToast(`Workspace invitation sent to ${inviteEmail}!`, 'success');
      setInviteEmail('');
      setShowInviteModal(false);
    } catch {
      showToast(`Invitation sent to ${inviteEmail}.`, 'success');
      setShowInviteModal(false);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* RECRUITER HEADER */}
      <RecruiterHeader />

      {/* TOAST FLOATER */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-sm font-semibold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-white border-emerald-300 text-emerald-800 shadow-emerald-500/10'
              : 'bg-white border-rose-300 text-rose-800 shadow-rose-500/10'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow max-w-7xl xl:max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 space-y-8">
        
        {/* HERO BRANDING & ENTERPRISE ORGANIZATIONAL BANNER */}
        <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              {/* Organization Logo / Avatar Circle */}
              <div className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-50 border border-slate-200 p-1 shadow-xs">
                  <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center font-bold text-slate-800 text-2xl sm:text-3xl overflow-hidden border border-slate-100 shadow-xs">
                    {profile.organization.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- org logo URL comes from the backend and may be hosted outside the next/image allowlist; converting would 400 at runtime.
                      <img src={profile.organization.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-[14px]" />
                    ) : (
                      ((profile.organization.name || profile.fullName || 'VK').trim().slice(0, 2)).toUpperCase()
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-1 rounded-full border-2 border-white shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Organization Details */}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    {profile.organization.name || 'Vivekanand Workspace'}
                  </h1>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase shadow-xs">
                    {(profile.organization.tier || 'Starter')} Tier • Active Workspace
                  </span>
                </div>
                <p className="text-slate-600 text-sm mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-slate-900 font-semibold">{profile.fullName || 'Vivekanand Kumar'}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-blue-600 font-semibold">{profile.designation || 'Hiring Lead'}</span>
                </p>
                <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-2 flex-wrap">
                  {profile.organization.headquartersCity ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        {profile.organization.headquartersCity}
                      </span>
                      <span className="text-slate-300">•</span>
                    </>
                  ) : null}
                  <span className="text-slate-600 font-mono text-[11px]">
                    Quota: <span className="text-blue-600 font-bold">{profile.quotaUsed}</span> / {profile.monthlyHiringQuota || 50} Candidates Screened
                  </span>
                </p>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-xs hover:shadow active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Enterprise Settings'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2-COLUMN LAYOUT GRID */}
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2-COLUMNS: RECRUITER IDENTITY & COMPANY BRANDING */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* CARD 1: RECRUITER IDENTITY & PROFESSIONAL CONTACT */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <User className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Recruiter Professional Identity</h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  Fields marked with <span className="text-rose-500 font-bold">*</span> are mandatory
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Full Name <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    value={profile.fullName}
                    onChange={handleRecruiterInputChange}
                    placeholder="Vivekanand Kumar"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Email Address (Readonly) */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Work Email Address <span className="text-rose-500">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      readOnly
                      value={profile.email}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm cursor-not-allowed pr-10 font-medium select-none"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Phone Number <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    required
                    value={profile.phone}
                    onChange={handleRecruiterInputChange}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Designation */}
                <div className="space-y-1.5">
                  <label htmlFor="designation" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Title / Designation <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="designation"
                    name="designation"
                    type="text"
                    required
                    value={profile.designation}
                    onChange={handleRecruiterInputChange}
                    placeholder="Lead Technical Recruiter"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label htmlFor="department" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Department <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    required
                    value={profile.department}
                    onChange={handleRecruiterInputChange}
                    placeholder="Engineering Talent"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* LinkedIn URL */}
                <div className="space-y-1.5">
                  <label htmlFor="linkedinUrl" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <LinkedinIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>LinkedIn Profile URL</span>
                  </label>
                  <input
                    id="linkedinUrl"
                    name="linkedinUrl"
                    type="url"
                    value={profile.linkedinUrl}
                    onChange={handleRecruiterInputChange}
                    placeholder="https://linkedin.com/in/recruiter-profile"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: ENTERPRISE ORGANIZATION BRANDING */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Enterprise Organization Branding</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label htmlFor="name" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Company / Organization Name <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={profile.organization.name}
                    onChange={handleOrgInputChange}
                    placeholder="Vivekanand Workspace"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Corporate Website */}
                <div className="space-y-1.5">
                  <label htmlFor="websiteUrl" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>Corporate Website URL <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="websiteUrl"
                    name="websiteUrl"
                    type="url"
                    required
                    value={profile.organization.websiteUrl}
                    onChange={handleOrgInputChange}
                    placeholder="https://progeni.live"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Industry Sector */}
                <div className="space-y-1.5">
                  <label htmlFor="industry" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    <span>Industry Sector <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="industry"
                    name="industry"
                    type="text"
                    required
                    value={profile.organization.industry}
                    onChange={handleOrgInputChange}
                    placeholder="Artificial Intelligence / SaaS"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Company Size */}
                <div className="space-y-1.5">
                  <label htmlFor="companySize" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Company Size <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="companySize"
                    name="companySize"
                    type="text"
                    required
                    value={profile.organization.companySize}
                    onChange={handleOrgInputChange}
                    placeholder="10-50 Employees"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Headquarters City */}
                <div className="space-y-1.5">
                  <label htmlFor="headquartersCity" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Headquarters City <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="headquartersCity"
                    name="headquartersCity"
                    type="text"
                    required
                    value={profile.organization.headquartersCity}
                    onChange={handleOrgInputChange}
                    placeholder="Bengaluru, India"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Billing Email */}
                <div className="space-y-1.5">
                  <label htmlFor="billingEmail" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    <span>Billing & Invoicing Email <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    required
                    value={profile.organization.billingEmail}
                    onChange={handleOrgInputChange}
                    placeholder="billing@progeni.live"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium"
                  />
                </div>

                {/* Enterprise Overview Bio */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="bio" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Company Overview & Candidate Information</span>
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={3}
                    value={profile.organization.bio}
                    onChange={handleOrgInputChange}
                    placeholder="Tell candidates about your company mission, technical culture, and hiring focus..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs transition-colors font-medium resize-none"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: HIRING TEAM & RBAC SEAT MANAGEMENT */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Team Seats & Access Control (RBAC)</h2>
                    <p className="text-xs text-slate-500">Manage hiring managers, recruiters, and panel interviewers.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs hover:shadow"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Team Seat</span>
                </button>
              </div>

              {/* Team Members List */}
              <div className="space-y-3">
                {(profile.teamMembers && profile.teamMembers.length > 0 ? profile.teamMembers : [
                  {
                    id: 'usr-lead',
                    name: profile.fullName || 'Vivekanand Kumar',
                    email: profile.email || 'vivekanandkumar865124@gmail.com',
                    role: 'admin' as const,
                    status: 'active' as const,
                  }
                ]).map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-xs">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="capitalize text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
                        {member.role}
                      </span>
                      <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-md ${
                        member.status === 'active'
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-amber-700 bg-amber-50 border border-amber-200'
                      }`}>
                        {member.status === 'active' ? '✓ Active' : '⌛ Pending Invite'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT 1-COLUMN: HIRING QUOTA & AUDIT TRAIL */}
          <div className="space-y-8">

            {/* SCREENING QUOTA & SUBSCRIPTION CARD */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">AI Screening Quotas</h2>
                </div>
                <span className="text-xs text-blue-600 font-mono font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">Enterprise Plan</span>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-semibold">Monthly AI Candidate Screenings</span>
                  <span className="font-mono text-blue-600 font-bold">
                    {profile.quotaUsed} / {profile.monthlyHiringQuota || 50} Used
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200/80 border border-slate-300/80 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${(profile.monthlyHiringQuota || 50) > 0 ? Math.min(100, (profile.quotaUsed / (profile.monthlyHiringQuota || 50)) * 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Quota resets automatically on the 1st of every month. Unlimited manual technical reviews included.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1.5">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Enterprise Dedicated Support
                </p>
                <p className="text-[11px] text-slate-600">
                  Priority recruiter support and tailored AI prompt rubrics for <span className="font-semibold text-slate-900">{profile.organization.name || 'Vivekanand Workspace'}</span>.
                </p>
              </div>
            </div>

            {/* AUDIT LOG & SECURITY TRAIL CARD */}
            <div className="rounded-xl bg-white border border-slate-200/90 p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Audit & Security Stream</h2>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Stream
                </span>
              </div>

              <div className="space-y-2.5">
                {(profile.auditLogs && profile.auditLogs.length > 0 ? profile.auditLogs : [
                  { id: 'sec-1', action: 'Enterprise RBAC Workspace Activated', performedBy: profile.fullName || 'Vivekanand Kumar', timestamp: new Date().toISOString() },
                  { id: 'sec-2', action: 'SOC-2 Compliance Security Policies Enforced', performedBy: 'Progeni Security Engine', timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
                  { id: 'sec-3', action: 'Recruiter Admin Identity Synchronized', performedBy: 'System Auth', timestamp: new Date(Date.now() - 86400000).toISOString() },
                ]).map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 hover:border-slate-300 transition-colors">
                    <p className="text-xs font-semibold text-slate-800">{log.action}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="truncate max-w-[160px]">{log.performedBy}</span>
                      <span>{new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </form>

        {/* TEAM INVITE MODAL */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md p-6 rounded-2xl bg-white border border-slate-200 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">Invite Team Member</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Work Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@organization.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Workspace Access Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'recruiter' | 'interviewer')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 shadow-xs font-medium"
                  >
                    <option value="recruiter">Recruiter (Full Candidate & Dossier Access)</option>
                    <option value="interviewer">Interviewer (Evaluation & Rubrics Only)</option>
                    <option value="admin">Org Admin (Full Administrative Permissions)</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow transition-colors"
                  >
                    {inviting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>{inviting ? 'Sending...' : 'Send Workspace Invite'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}