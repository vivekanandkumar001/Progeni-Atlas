// Shared types & constants for the Recruiter Dashboard route.
// Imported by page.tsx, the route's hooks, and its components (no cycles: this
// module imports nothing from them). Pure types/constants — no 'use client' needed.

export type StudentStatus = 'selected' | 'rejected' | 'inprocess' | 'backout';

export type DashboardSortField = 'status' | 'aiMatchScore' | 'name' | 'appliedDate';
export type DashboardSortDirection = 'asc' | 'desc';
export type DashboardSortMode = 'filter' | 'sortTop';

export interface OverviewStats {
  totalCandidates: number;
  activePositions: number;
  avgMatchScore: number;
  scheduledInterviews: number;
  screeningQuota: number;
  quotaUsed: number;
  freeDemosTotal?: number;
  freeDemosUsed?: number;
  freeDemosRemaining?: number;
  demoDurationMinutes?: number;
}

export interface JobProfile {
  id: string;
  title: string;
  department: string;
  experienceLevel: string;
  applicantsCount: number;
  skillsRequired: string[];
  jobDescription?: string;
  durationMinutes?: number;
  createdAt: string;
}

export interface ScoreBreakdown {
  technicalDepth: number;
  systemArchitecture: number;
  communication: number;
  problemSolving: number;
}

export interface CandidateDossier {
  id: string;
  sessionId?: string;
  name: string;
  email: string;
  targetPosition: string;
  jobProfileId?: string | null;
  department: string;
  aiMatchScore?: number | null;
  recommendation?: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'REJECT' | string | null;
  status: string;
  stage: string;
  appliedDate: string;
  scheduledAt?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  interviewDuration?: string | null;
  skills: string[];
  summary?: string | null;
  breakdown: ScoreBreakdown | null;
  keyHighlights: string[];
  hiringStatus?: string;
  studentStatus?: StudentStatus | string;
  aptitudeScore?: {
    overallScore: number;
    percentile: number;
    accuracy: number;
    trustScore: number;
    speedIndex: string;
    completedAt?: string;
  } | null;
}

export interface DashboardError {
  title: string;
  message: string;
  errorType?: 'unauthorized' | 'role_forbidden' | 'org_missing' | 'generic';
}

export interface BulkProposal {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  matchScore: number;
  skills: string[];
  proposedDate: string;
  proposedTime: string;
  durationMinutes: number;
  status: string;
}

export const INITIAL_OVERVIEW: OverviewStats = {
  totalCandidates: 0,
  activePositions: 0,
  avgMatchScore: 0,
  scheduledInterviews: 0,
  screeningQuota: 50,
  quotaUsed: 0,
};
