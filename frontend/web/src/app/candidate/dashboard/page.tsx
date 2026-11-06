import React from 'react';
import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ReadinessBanner } from '@/components/dashboard/ReadinessBanner';
import { UpcomingInterviewCard } from '@/components/dashboard/UpcomingInterviewCard';
import { CompetencyCard } from '@/components/dashboard/CompetencyCard';
import { FeedbackDossier } from '@/components/dashboard/FeedbackDossier';
import { PracticeDrillList } from '@/components/dashboard/PracticeDrillList';
import { ResumeSyncFooter } from '@/components/dashboard/ResumeSyncFooter';

export const metadata: Metadata = {
  title: 'Candidate Dashboard | Progeni Atlas',
  description: 'Track your AI interview readiness, practice technical drills, view competency breakdowns, and access scheduled live video screening rooms.',
};

export default function CandidateDashboardPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans relative overflow-x-clip selection:bg-cyan-500/30 selection:text-accent-cyan">
      {/* Background ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Fixed Header Shell */}
      <DashboardHeader />

      {/* Main Dashboard Canvas - 12 Column Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Section A: Hero Banner (Span 12 Columns) */}
        <section id="overview" className="w-full">
          <ReadinessBanner />
        </section>

        {/* Section B & C: Active Interview (Span 7) & Competency Scorecard (Span 5) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <div id="interviews" className="lg:col-span-7">
            <UpcomingInterviewCard />
          </div>
          <div id="insights" className="lg:col-span-5">
            <CompetencyCard />
          </div>
        </section>

        {/* Section D & E: Verified Feedback Dossier (Span 6) & Practice Drills (Span 6) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
          <div className="lg:col-span-6">
            <FeedbackDossier />
          </div>
          <div id="drills" className="lg:col-span-6">
            <PracticeDrillList />
          </div>
        </section>

        {/* Section F: Quick Resume & Profile Sync Bar (Span 12 Columns) */}
        <section className="w-full pt-2">
          <ResumeSyncFooter />
        </section>
      </main>
    </div>
  );
}
