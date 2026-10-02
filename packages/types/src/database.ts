import { z } from 'zod';

export const OrganizationTierSchema = z.enum(['starter', 'growth', 'enterprise']);
export type OrganizationTier = z.infer<typeof OrganizationTierSchema>;

export const UserRoleSchema = z.enum(['candidate', 'recruiter', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(['active', 'suspended']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ExperienceLevelSchema = z.enum(['junior', 'mid', 'senior', 'lead']);
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;

export const SessionTypeSchema = z.enum(['mock', 'live']);
export type SessionType = z.infer<typeof SessionTypeSchema>;

export const SessionStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'abandoned']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const InterviewStageSchema = z.enum(['intro', 'resume_probe', 'technical', 'scenario', 'wrap_up']);
export type InterviewStage = z.infer<typeof InterviewStageSchema>;

export const FinalRecommendationSchema = z.enum(['STRONG_HIRE', 'HIRE', 'LEAN_HIRE', 'REJECT']);
export type FinalRecommendation = z.infer<typeof FinalRecommendationSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  tier: OrganizationTierSchema.default('starter'),
  logoUrl: z.string().url().nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: UserRoleSchema.default('candidate'),
  status: UserStatusSchema.default('active'),
  avatarUrl: z.string().url().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type User = z.infer<typeof UserSchema>;

export const JobProfileSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  title: z.string().min(1).max(255),
  department: z.string().min(1).max(100),
  experienceLevel: ExperienceLevelSchema.default('mid'),
  jobDescription: z.string(),
  skillsRequired: z.array(z.string()).default([]),
  createdAt: z.date().or(z.string()),
});
export type JobProfile = z.infer<typeof JobProfileSchema>;

export const CandidateResumeMetadataSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive(),
  fileUrl: z.string().url(),
  mimeType: z.string().default('application/pdf'),
  parsedTextClean: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  uploadedAt: z.date().or(z.string()).optional(),
});
export type CandidateResumeMetadata = z.infer<typeof CandidateResumeMetadataSchema>;

export const InterviewSessionSchema = z.object({
  id: z.string().uuid(),
  jobProfileId: z.string().uuid().nullable().optional(),
  candidateId: z.string().uuid(),
  recruiterId: z.string().uuid().nullable().optional(),
  sessionType: SessionTypeSchema.default('live'),
  status: SessionStatusSchema.default('scheduled'),
  currentStage: InterviewStageSchema.default('intro'),
  recordingUrl: z.string().url().nullable().optional(),
  recordingDurationSec: z.number().int().nullable().optional(),
  totalScore: z.number().min(0).max(100).nullable().optional(),
  finalRecommendation: FinalRecommendationSchema.nullable().optional(),
  startedAt: z.date().or(z.string()).nullable().optional(),
  endedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
});
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;
