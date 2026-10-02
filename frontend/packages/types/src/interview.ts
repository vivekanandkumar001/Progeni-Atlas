import { z } from 'zod';

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const InterviewStageSchema = z.enum([
  'intro',
  'resume_probe',
  'technical',
  'scenario',
  'wrap_up',
]);
export type InterviewStage = z.infer<typeof InterviewStageSchema>;

export const SessionStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'abandoned',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const FinalRecommendationSchema = z.enum([
  'STRONG_HIRE',
  'HIRE',
  'LEAN_HIRE',
  'REJECT',
]);
export type FinalRecommendation = z.infer<typeof FinalRecommendationSchema>;

export const ActionDecisionSchema = z.enum([
  'PASS',
  'PROBE_FURTHER',
  'SWITCH_TOPIC',
  'TERMINATE',
]);
export type ActionDecision = z.infer<typeof ActionDecisionSchema>;

export const SpeakerSchema = z.enum(['ai_agent', 'candidate']);
export type Speaker = z.infer<typeof SpeakerSchema>;

// =============================================================================
// EVALUATION CONTRACTS
// =============================================================================

export const TurnMetricsSchema = z.object({
  relevanceScore: z.number().min(0.0).max(10.0),
  depthScore: z.number().min(0.0).max(10.0),
  correctnessScore: z.number().min(0.0).max(10.0),
});
export type TurnMetrics = z.infer<typeof TurnMetricsSchema>;

export const TurnEvaluationSchema = z.object({
  sessionId: z.string().uuid().or(z.string()),
  turnIndex: z.number().int().nonnegative(),
  questionAsked: z.string(),
  candidateAnswer: z.string(),
  expectedConcepts: z.array(z.string()),
  metrics: TurnMetricsSchema,
  evaluatorNotes: z.string(),
  missingConcepts: z.array(z.string()),
  redFlagsDetected: z.array(z.string()),
  actionDecision: ActionDecisionSchema,
  recommendedFollowUp: z.string().optional().nullable(),
});
export type TurnEvaluation = z.infer<typeof TurnEvaluationSchema>;

// =============================================================================
// TRANSCRIPT CONTRACTS
// =============================================================================

export const TranscriptTurnSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  stage: InterviewStageSchema,
  speaker: SpeakerSchema,
  text: z.string(),
  audioUrl: z.string().url().optional(),
  audioLatencyMs: z.number().optional(),
  timestamp: z.string().datetime().or(z.date()),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const InterviewTranscriptSchema = z.object({
  sessionId: z.string(),
  turns: z.array(TranscriptTurnSchema),
  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});
export type InterviewTranscript = z.infer<typeof InterviewTranscriptSchema>;

// =============================================================================
// WEBSOCKET CONTRACTS
// =============================================================================

export const WebSocketMessageTypeSchema = z.enum([
  'AUDIO_CHUNK',
  'TEXT_CHUNK',
  'AGENT_TRANSCRIPT',
  'AGENT_STATE_UPDATE',
]);
export type WebSocketMessageType = z.infer<typeof WebSocketMessageTypeSchema>;

export const WSAudioChunkPayloadSchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  audioBase64: z.string(),
  mimeType: z.string().default('audio/webm'),
  isFinal: z.boolean().default(false),
});
export type WSAudioChunkPayload = z.infer<typeof WSAudioChunkPayloadSchema>;

export const WSTextChunkPayloadSchema = z.object({
  text: z.string(),
  isFinal: z.boolean().default(false),
});
export type WSTextChunkPayload = z.infer<typeof WSTextChunkPayloadSchema>;

export const WSAgentTranscriptPayloadSchema = z.object({
  text: z.string(),
  audioUrl: z.string().optional(),
  stage: InterviewStageSchema,
});
export type WSAgentTranscriptPayload = z.infer<typeof WSAgentTranscriptPayloadSchema>;

export const WSAgentStateUpdatePayloadSchema = z.object({
  state: z.enum(['listening', 'thinking', 'speaking', 'evaluating', 'idle']),
  currentStage: InterviewStageSchema,
  progressPercentage: z.number().min(0).max(100),
});
export type WSAgentStateUpdatePayload = z.infer<typeof WSAgentStateUpdatePayloadSchema>;

export const WebSocketMessageSchema = z.object({
  type: WebSocketMessageTypeSchema,
  sessionId: z.string(),
  timestamp: z.string().datetime().optional(),
  payload: z.record(z.any()),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
