import { z } from 'zod';
import { InterviewStageSchema } from './database';

export const ActionDecisionSchema = z.enum(['PASS', 'PROBE_FURTHER', 'SWITCH_TOPIC', 'TERMINATE']);
export type ActionDecision = z.infer<typeof ActionDecisionSchema>;

export const SpeakerSchema = z.enum(['ai_interviewer', 'ai_agent', 'candidate']);
export type Speaker = z.infer<typeof SpeakerSchema>;

export const TurnMetricsSchema = z.object({
  relevanceScore: z.number().min(0.0).max(10.0),
  depthScore: z.number().min(0.0).max(10.0),
  correctnessScore: z.number().min(0.0).max(10.0),
});
export type TurnMetrics = z.infer<typeof TurnMetricsSchema>;

export const ProctoringMetricsSchema = z.object({
  gazeConfidence: z.number().min(0.0).max(1.0).default(1.0),
  audioVoiceCount: z.number().int().min(0).default(1),
  tabFocusLost: z.boolean().default(false),
});
export type ProctoringMetrics = z.infer<typeof ProctoringMetricsSchema>;

export const TurnEvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  turnIndex: z.number().int().nonnegative(),
  questionAsked: z.string(),
  candidateAnswer: z.string(),
  expectedConcepts: z.array(z.string()).optional().default([]),
  metrics: TurnMetricsSchema,
  proctoring: ProctoringMetricsSchema.optional().default({
    gazeConfidence: 1.0,
    audioVoiceCount: 1,
    tabFocusLost: false,
  }),
  evaluatorNotes: z.string().optional(),
  missingConcepts: z.array(z.string()).default([]),
  redFlagsDetected: z.array(z.string()).default([]),
  actionDecision: ActionDecisionSchema,
  recommendedFollowUp: z.string().optional(),
});
export type TurnEvaluation = z.infer<typeof TurnEvaluationSchema>;

export const TranscriptTurnSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  stage: InterviewStageSchema,
  speaker: SpeakerSchema,
  text: z.string(),
  audioClipUrl: z.string().url().optional(),
  latencyMs: z.number().int().optional(),
  timestamp: z.date().or(z.string()),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const PresignedUrlRequestSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  expiresInSec: z.number().int().min(1).max(86400).default(300),
});
export type PresignedUrlRequest = z.infer<typeof PresignedUrlRequestSchema>;

export const PresignedUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  fileKey: z.string(),
  publicUrl: z.string().url(),
});
export type PresignedUrlResponse = z.infer<typeof PresignedUrlResponseSchema>;
