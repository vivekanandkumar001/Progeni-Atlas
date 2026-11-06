'use client';

import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useCandidateProfileData } from '@/lib/hooks/useCandidateProfileData';
import { useWebRTCDiagnostics } from '@/lib/hooks/useWebRTCDiagnostics';
import {
  ProfileHeroBanner,
  PersonalAcademicCard,
  SkillsTagsCard,
  SocialHandlesCard,
  ResumeStorageCard,
  WebRTCPreflightCard,
  AccountSecurityCard,
} from '@/components/candidate-profile';

export default function CandidateProfilePage() {
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const {
    profile,
    loadError,
    emailVerified,
    loading,
    saving,
    suggestedSkills,
    isUploadingResume,
    handleInputChange,
    handleSaveProfile,
    handleAddSkill,
    handleRemoveSkill,
    handleResumeFileSelect,
  } = useCandidateProfileData({ onToast: showToast });

  const {
    diagRunning,
    micStatus,
    camStatus,
    latencyMs,
    audioLevel,
    videoRef,
    runHardwareDiagnostics,
  } = useWebRTCDiagnostics({
    email: profile.email,
    onToast: showToast,
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <DashboardHeader />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-sm font-medium transition-all animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-surface border-cyan-500/40 text-accent-cyan backdrop-blur-md'
              : 'bg-surface border-rose-500/40 text-accent-rose backdrop-blur-md'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-accent-cyan shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-accent-rose shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loading && (
          <div className="rounded-2xl bg-surface border border-line p-4 text-sm text-ink-muted flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-accent-cyan" />
            Loading your profile...
          </div>
        )}

        {loadError && (
          <div className="rounded-2xl bg-surface border border-rose-500/30 p-4 text-sm text-accent-rose">
            {loadError}
          </div>
        )}

        {/* Hero Branding & Profile Banner */}
        <ProfileHeroBanner
          profile={profile}
          loading={loading}
          emailVerified={emailVerified}
          loadError={loadError}
          saving={saving}
          onSave={handleSaveProfile}
        />

        {/* 2-Column Grid System */}
        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Personal, Academic, Skills & Social Links */}
          <div className="lg:col-span-2 space-y-8">
            <PersonalAcademicCard profile={profile} onChange={handleInputChange} />

            <SkillsTagsCard
              skills={profile.skillsSummary}
              suggestedSkills={suggestedSkills}
              saving={saving}
              onAddSkill={handleAddSkill}
              onRemoveSkill={handleRemoveSkill}
            />

            <SocialHandlesCard
              githubUrl={profile.githubUrl}
              linkedinUrl={profile.linkedinUrl}
              portfolioUrl={profile.portfolioUrl}
              onChange={handleInputChange}
            />
          </div>

          {/* Right Column: Resume Storage, WebRTC Preflight & Account Security */}
          <div className="space-y-8">
            <ResumeStorageCard
              resume={profile.resume}
              isUploading={isUploadingResume}
              onFileSelect={handleResumeFileSelect}
            />

            <WebRTCPreflightCard
              camStatus={camStatus}
              micStatus={micStatus}
              latencyMs={latencyMs}
              audioLevel={audioLevel}
              diagRunning={diagRunning}
              videoRef={videoRef}
              onRunDiagnostics={runHardwareDiagnostics}
            />

            <AccountSecurityCard
              email={profile.email}
              emailVerified={emailVerified}
            />
          </div>
        </form>
      </main>
    </div>
  );
}
