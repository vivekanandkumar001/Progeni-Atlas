'use client';

import { useState } from 'react';
import { RecruiterHeader } from '@/components/dashboard/RecruiterHeader';
import type { CandidateDossier } from './dashboard-types';
import { useToast } from './hooks/useToast';
import { useDashboardData } from './hooks/useDashboardData';
import { useCandidateFilters } from './hooks/useCandidateFilters';
import { useDossierExport } from './hooks/useDossierExport';
import { useInviteCandidate } from './hooks/useInviteCandidate';
import { useCreateJob } from './hooks/useCreateJob';
import { useBulkScheduling } from './hooks/useBulkScheduling';
import { useCandidateStatus } from './hooks/useCandidateStatus';
import { useRescheduleInterview } from './hooks/useRescheduleInterview';
import { ToastFloater } from './components/ToastFloater';
import { DashboardErrorBanner } from './components/DashboardErrorBanner';
import { HeroBannerSection } from './components/HeroBannerSection';
import { StatsOverviewSection } from './components/StatsOverviewSection';
import { DashboardControlBar } from './components/DashboardControlBar';
import { CandidateDossiersSection } from './components/CandidateDossiersSection';
import { JobPositionsSection } from './components/JobPositionsSection';
import { InviteCandidateModal } from './components/InviteCandidateModal';
import { BulkSchedulingModal } from './components/BulkSchedulingModal';
import { CreateJobModal } from './components/CreateJobModal';
import { CandidateDossierModal } from './components/CandidateDossierModal';
import { RescheduleInterviewModal } from './components/RescheduleInterviewModal';

export default function RecruiterDashboardPage() {
  const { toastMessage, showToast } = useToast();

  const {
    overview,
    jobProfiles,
    setJobProfiles,
    candidates,
    setCandidates,
    loading,
    activeTab,
    setActiveTab,
    error,
    walletBalance,
    fetchDashboard,
  } = useDashboardData();

  // MODAL STATE (CANDIDATE DETAILED DOSSIER)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDossier | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    selectedJobFilter,
    selectedRecFilter,
    setSelectedRecFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    sortMode,
    setSortMode,
    handleHeaderSort,
    statusCounts,
    filteredCandidates,
    clearAllFilters,
  } = useCandidateFilters({ candidates });

  const { isExporting, handleExportDossiers } = useDossierExport({ selectedJobFilter, showToast });
  const invite = useInviteCandidate({ jobProfiles, fetchDashboard, showToast, walletBalance });
  const createJob = useCreateJob({ setJobProfiles, showToast });
  const bulk = useBulkScheduling({ fetchDashboard, showToast, walletBalance });
  const { handleUpdateStudentStatus } = useCandidateStatus({
    setCandidates,
    selectedCandidate,
    setSelectedCandidate,
    showToast,
  });
  const reschedule = useRescheduleInterview({
    setCandidates,
    selectedCandidate,
    setSelectedCandidate,
    showToast,
    walletBalance,
  });

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-indigo-500 selection:text-slate-950">
      {/* RECRUITER NAVIGATION HEADER */}
      <RecruiterHeader />

      {/* TOAST NOTIFICATION FLOATER */}
      <ToastFloater toastMessage={toastMessage} />

      {/* MAIN CONTAINER */}
      <main className="flex-grow max-w-7xl xl:max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 space-y-8">

        {error && (
          <DashboardErrorBanner error={error} fetchDashboard={fetchDashboard} />
        )}

        {/* HERO BRANDING & ACTION BANNER */}
        <HeroBannerSection
          openInviteModal={invite.openInviteModal}
          setShowCreateJobModal={createJob.setShowCreateJobModal}
        />

        {/* TOP STATS OVERVIEW CARDS GRID */}
        <StatsOverviewSection overview={overview} />

        {/* SEARCH, FILTER & TAB CONTROL BAR - CLEAN REARRANGED LAYOUT */}
        <DashboardControlBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          candidates={candidates}
          jobProfiles={jobProfiles}
          filteredCandidates={filteredCandidates}
          statusCounts={statusCounts}
          selectedStatusFilter={selectedStatusFilter}
          setSelectedStatusFilter={setSelectedStatusFilter}
          sortMode={sortMode}
          setSortMode={setSortMode}
          onBulkUploadClick={() => {
            bulk.setBulkTargetJobId(selectedJobFilter !== 'all' ? selectedJobFilter : (jobProfiles[0]?.id || ''));
            bulk.setShowBulkModal(true);
          }}
          handleExportDossiers={handleExportDossiers}
          isExporting={isExporting}
          setShowCreateJobModal={createJob.setShowCreateJobModal}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedRecFilter={selectedRecFilter}
          setSelectedRecFilter={setSelectedRecFilter}
          sortField={sortField}
          setSortField={setSortField}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
        />

        {/* TAB 1: CANDIDATE DOSSIERS TABLE VIEW */}
        {activeTab === 'dossiers' && (
          <CandidateDossiersSection
            loading={loading}
            filteredCandidates={filteredCandidates}
            totalCandidatesCount={candidates.length}
            openInviteModal={invite.openInviteModal}
            handleHeaderSort={handleHeaderSort}
            handleUpdateStudentStatus={handleUpdateStudentStatus}
            handleOpenReschedule={reschedule.handleOpenReschedule}
            setSelectedCandidate={setSelectedCandidate}
            onClearFilters={clearAllFilters}
          />
        )}

        {/* TAB 2: ACTIVE JOB POSITIONS & RUBRICS GRID */}
        {activeTab === 'jobs' && (
          <JobPositionsSection
            jobProfiles={jobProfiles}
            openInviteModal={invite.openInviteModal}
            openCreateJobModal={() => createJob.setShowCreateJobModal(true)}
          />
        )}

        {/* MODAL 1: SCHEDULE AI TECHNICAL INTERVIEW */}
        {invite.showInviteModal && <InviteCandidateModal {...invite} />}

        {/* MODAL 1B: BULK RESUME UPLOAD & AI-ASSISTED SCHEDULING (REQ-1, REQ-2, REQ-3) */}
        {bulk.showBulkModal && <BulkSchedulingModal jobProfiles={jobProfiles} {...bulk} />}

        {/* MODAL 2: CREATE NEW JOB POSITION */}
        {createJob.showCreateJobModal && <CreateJobModal {...createJob} />}

        {/* MODAL 3: CANDIDATE DETAILED AI EVALUATION DOSSIER MODAL */}
        {selectedCandidate && (
          <CandidateDossierModal
            selectedCandidate={selectedCandidate}
            setSelectedCandidate={setSelectedCandidate}
            handleUpdateStudentStatus={handleUpdateStudentStatus}
            handleOpenReschedule={reschedule.handleOpenReschedule}
            showToast={showToast}
          />
        )}

        {/* MODAL 4: RESCHEDULE INTERVIEW MODAL */}
        {reschedule.rescheduleCandidate && <RescheduleInterviewModal {...reschedule} />}

      </main>
    </div>
  );
}
