import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PracticeLabClient } from '@/components/practice/PracticeLabClient';

export const metadata: Metadata = {
  title: 'AI Practice Suite | Progeni Atlas',
  description: 'Practice live AI-powered technical interviews and interactive drills tailored to your target job and skills.',
};

export default function CandidatePracticePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans relative overflow-x-clip selection:bg-cyan-500/30 selection:text-accent-cyan">
      {/* Background ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Fixed Header Shell */}
      <DashboardHeader />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<div className="p-12 text-center text-xs text-ink-muted">Loading Practice Suite...</div>}>
          <PracticeLabClient />
        </Suspense>
      </main>
    </div>
  );
}
