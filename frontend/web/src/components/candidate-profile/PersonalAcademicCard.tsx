'use client';

import React from 'react';
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Building2,
  BookOpen,
  Calendar,
  FileText,
  Lock,
} from 'lucide-react';
import type { CandidateProfileData } from '@/lib/hooks/useCandidateProfileData';

interface PersonalAcademicCardProps {
  profile: CandidateProfileData;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function PersonalAcademicCard({ profile, onChange }: PersonalAcademicCardProps) {
  return (
    <div className="rounded-2xl bg-surface border border-line p-6 space-y-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <User className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-lg font-bold text-ink">Personal & Academic Profile</h2>
        </div>
        <span className="text-xs text-ink-muted font-mono">
          Fields marked with <span className="text-accent-rose">*</span> are mandatory
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Full Name */}
        <div className="space-y-1.5">
          <label htmlFor="fullName" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <User className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Full Name <span className="text-accent-rose">*</span></span>
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            value={profile.fullName}
            onChange={onChange}
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Email Address (Readonly) */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <Mail className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Email Address <span className="text-accent-rose">*</span></span>
          </label>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              readOnly
              value={profile.email}
              className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink-muted text-sm cursor-not-allowed pr-10"
            />
            <Lock className="w-4 h-4 text-ink-faint absolute right-3 top-3" />
          </div>
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <label htmlFor="phone" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <Phone className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Phone Number <span className="text-accent-rose">*</span></span>
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            required
            value={profile.phone}
            onChange={onChange}
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Course */}
        <div className="space-y-1.5">
          <label htmlFor="course" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <GraduationCap className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Degree / Course <span className="text-accent-rose">*</span></span>
          </label>
          <input
            id="course"
            name="course"
            type="text"
            required
            value={profile.course}
            onChange={onChange}
            placeholder="Please enter your course (e.g. B.Tech / M.Tech / B.Sc)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Branch / Field of Study */}
        <div className="space-y-1.5">
          <label htmlFor="branch" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <BookOpen className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Branch / Major <span className="text-accent-rose">*</span></span>
          </label>
          <input
            id="branch"
            name="branch"
            type="text"
            required
            value={profile.branch}
            onChange={onChange}
            placeholder="Please enter your branch / major (e.g. Computer Science)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Academic Year */}
        <div className="space-y-1.5">
          <label htmlFor="academicYear" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <Calendar className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Academic Year <span className="text-accent-rose">*</span></span>
          </label>
          <input
            id="academicYear"
            name="academicYear"
            type="text"
            required
            value={profile.academicYear}
            onChange={onChange}
            placeholder="Please enter your academic year (e.g. 4th Year)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* College / University Name */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="collegeName" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <Building2 className="w-3.5 h-3.5 text-accent-cyan" />
            <span>College / Institution Name <span className="text-accent-rose">*</span></span>
          </label>
          <input
            id="collegeName"
            name="collegeName"
            type="text"
            required
            value={profile.collegeName}
            onChange={onChange}
            placeholder="Please enter your college or institution name"
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
          />
        </div>

        {/* Bio / Executive Summary */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="bio" className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <FileText className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Professional Bio & Career Objective</span>
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            value={profile.bio}
            onChange={onChange}
            placeholder="Please provide a brief summary of your technical background, domain expertise, and target roles..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-inset border border-line text-ink text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  );
}
