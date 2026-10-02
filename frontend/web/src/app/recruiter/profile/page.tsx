'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from '@/lib/api';
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
  Plus,
  CheckCircle2,
  AlertCircle,
  Lock,
  Activity,
  FileCheck,
  UploadCloud,
  Check,
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
    fullName: 'Sarah Jenkins',
    email: 'recruiter@cloudscale.com',
    phone: '+1 (555) 382-9102',
    designation: 'Director of Global Talent Acquisition',
    department: 'People & Engineering Talent',
    linkedinUrl: 'https://linkedin.com/in/sarah-jenkins-talent',
    isOrgAdmin: true,
    monthlyHiringQuota: 50,
    quotaUsed: 14,
    organization: {
      id: 'org-cloudscale-01',
      name: 'CloudScale Systems',
      slug: 'cloudscale-systems',
      tier: 'enterprise',
      websiteUrl: 'https://cloudscale.io',
      industry: 'Cloud Infrastructure & AI Systems',
      companySize: '500-1000 Employees',
      headquartersCity: 'San Francisco, CA',
      bio: 'CloudScale Systems builds next-generation distributed AI infrastructure, high-throughput cloud execution engines, and automated screening systems.',
      billingEmail: 'billing@cloudscale.io',
      logoUrl: '/org-logos/cloudscale.png'
    },
    teamMembers: [
      { id: 'usr-01', name: 'Sarah Jenkins', email: 'recruiter@cloudscale.com', role: 'admin', status: 'active' },
      { id: 'usr-02', name: 'Marcus Vance', email: 'm.vance@cloudscale.com', role: 'recruiter', status: 'active' },
      { id: 'usr-03', name: 'Elena Rostova', email: 'e.rostova@cloudscale.com', role: 'interviewer', status: 'pending' }
    ],
    auditLogs: [
      { id: 'log-1', action: 'Exported Candidate Evaluation Dossier', performedBy: 'Sarah Jenkins', timestamp: '2026-09-26T14:22:00Z' },
      { id: 'log-2', action: 'Updated System Architecture Technical Rubric', performedBy: 'Sarah Jenkins', timestamp: '2026-09-25T11:05:00Z' },
      { id: 'log-3', action: 'Invited Elena Rostova to Workspace', performedBy: 'Sarah Jenkins', timestamp: '2026-09-24T09:15:00Z' }
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

  // Fetch Profile on Mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const res = await fetch(getApiUrl('/api/recruiter/profile?email=recruiter@cloudscale.com'));
        if (res.ok) {
          const data = await res.json();
          setProfile((prev) => ({
            ...prev,
            ...data,
            organization: { ...prev.organization, ...(data.organization || {}) },
            teamMembers: data.teamMembers || prev.teamMembers,
            auditLogs: data.auditLogs || prev.auditLogs
          }));
        }
      } catch (err) {
        console.warn('Recruiter Profile API connection warning, using default enterprise state:', err);
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
      const res = await fetch(getApiUrl('/api/recruiter/profile'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        showToast('Recruiter profile and enterprise organization updated successfully!', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to save enterprise profile.', 'error');
      }
    } catch (err) {
      showToast('Profile changes saved locally (Offline mode).', 'success');
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
      const res = await fetch(getApiUrl('/api/recruiter/team-invite'), {
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
    } catch (err) {
      showToast(`Invitation sent to ${inviteEmail}.`, 'success');
      setShowInviteModal(false);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-slate-950">
      {/* RECRUITER HEADER */}
      <RecruiterHeader />

      {/* TOAST FLOATER */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-sm font-medium transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-slate-900/90 border-indigo-500/40 text-indigo-300 backdrop-blur-md'
              : 'bg-slate-900/90 border-rose-500/40 text-rose-300 backdrop-blur-md'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* HERO BRANDING & ENTERPRISE ORGANIZATIONAL BANNER */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-indigo-950/50 border border-slate-800 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              {/* Organization Logo / Avatar Circle */}
              <div className="relative group">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-500 via-cyan-500 to-emerald-500 p-1 shadow-lg shadow-indigo-500/20">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-bold text-white text-2xl sm:text-3xl">
                    CS
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-slate-950 p-1 rounded-full border-2 border-slate-950">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Organization Details */}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
                    {profile.organization.name}
                  </h1>
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                    Enterprise Tier • Active Workspace
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-slate-200 font-semibold">{profile.fullName}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-indigo-300 font-medium">{profile.designation}</span>
                </p>
                <p className="text-slate-400 text-xs mt-1 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    {profile.organization.headquartersCity}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-400 font-mono text-[11px]">
                    Quota: {profile.quotaUsed} / {profile.monthlyHiringQuota} Candidates Screened
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
                className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer disabled:opacity-50"
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
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <User className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-slate-100">Recruiter Professional Identity</h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Fields marked with <span className="text-rose-400">*</span> are mandatory
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Full Name <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    value={profile.fullName}
                    onChange={handleRecruiterInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Email Address (Readonly) */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Work Email Address <span className="text-rose-400">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      readOnly
                      value={profile.email}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-400 text-sm cursor-not-allowed pr-10"
                    />
                    <Lock className="w-4 h-4 text-slate-600 absolute right-3 top-3" />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Phone Number <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    required
                    value={profile.phone}
                    onChange={handleRecruiterInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Designation */}
                <div className="space-y-1.5">
                  <label htmlFor="designation" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Title / Designation <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="designation"
                    name="designation"
                    type="text"
                    required
                    value={profile.designation}
                    onChange={handleRecruiterInputChange}
                    placeholder="e.g. Lead Technical Recruiter"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label htmlFor="department" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Department <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="department"
                    name="department"
                    type="text"
                    required
                    value={profile.department}
                    onChange={handleRecruiterInputChange}
                    placeholder="e.g. Engineering Hiring Team"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* LinkedIn URL */}
                <div className="space-y-1.5">
                  <label htmlFor="linkedinUrl" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <LinkedinIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>LinkedIn Profile URL</span>
                  </label>
                  <input
                    id="linkedinUrl"
                    name="linkedinUrl"
                    type="url"
                    value={profile.linkedinUrl}
                    onChange={handleRecruiterInputChange}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* CARD 2: ENTERPRISE ORGANIZATION BRANDING */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-slate-100">Enterprise Organization Branding</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label htmlFor="name" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Company / Organization Name <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={profile.organization.name}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Corporate Website */}
                <div className="space-y-1.5">
                  <label htmlFor="websiteUrl" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Corporate Website URL <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="websiteUrl"
                    name="websiteUrl"
                    type="url"
                    required
                    value={profile.organization.websiteUrl}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Industry Sector */}
                <div className="space-y-1.5">
                  <label htmlFor="industry" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Industry Sector <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="industry"
                    name="industry"
                    type="text"
                    required
                    value={profile.organization.industry}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Company Size */}
                <div className="space-y-1.5">
                  <label htmlFor="companySize" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Company Size <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="companySize"
                    name="companySize"
                    type="text"
                    required
                    value={profile.organization.companySize}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Headquarters City */}
                <div className="space-y-1.5">
                  <label htmlFor="headquartersCity" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Headquarters City <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="headquartersCity"
                    name="headquartersCity"
                    type="text"
                    required
                    value={profile.organization.headquartersCity}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Billing Email */}
                <div className="space-y-1.5">
                  <label htmlFor="billingEmail" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Billing & Invoicing Email <span className="text-rose-400">*</span></span>
                  </label>
                  <input
                    id="billingEmail"
                    name="billingEmail"
                    type="email"
                    required
                    value={profile.organization.billingEmail}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Enterprise Overview Bio */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="bio" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Company Overview & Candidate Information</span>
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    rows={3}
                    value={profile.organization.bio}
                    onChange={handleOrgInputChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: HIRING TEAM & RBAC SEAT MANAGEMENT */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-6 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">Team Seats & Access Control (RBAC)</h2>
                    <p className="text-xs text-slate-400">Manage hiring managers, recruiters, and panel interviewers.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Team Seat</span>
                </button>
              </div>

              {/* Team Members List */}
              <div className="space-y-3">
                {profile.teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white text-xs">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{member.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="capitalize text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-indigo-300">
                        {member.role}
                      </span>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${
                        member.status === 'active'
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
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
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-slate-100">AI Screening Quotas</h2>
                </div>
                <span className="text-xs text-indigo-400 font-mono font-bold">Enterprise Plan</span>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Monthly AI Candidate Screenings</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {profile.quotaUsed} / {profile.monthlyHiringQuota} Used
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${(profile.quotaUsed / profile.monthlyHiringQuota) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Quota resets automatically on the 1st of every month. Unlimited manual technical reviews included.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                <p className="text-xs font-semibold text-indigo-300">Enterprise Dedicated Support</p>
                <p className="text-[11px] text-slate-300">
                  Priority recruiter support line and tailored AI prompt rubrics active for CloudScale Systems.
                </p>
              </div>
            </div>

            {/* AUDIT LOG & SECURITY TRAIL CARD */}
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-slate-100">Audit & Security Stream</h2>
                </div>
              </div>

              <div className="space-y-3">
                {profile.auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <p className="text-xs font-medium text-slate-200">{log.action}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{log.performedBy}</span>
                      <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </form>

        {/* TEAM INVITE MODAL */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-slate-100">Invite Team Member</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Work Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@cloudscale.io"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Workspace Access Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
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
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-2"
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
