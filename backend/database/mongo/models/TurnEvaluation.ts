import { Schema, model, Document, Model } from 'mongoose';

export type ActionDecisionType = 'PASS' | 'PROBE_FURTHER' | 'SWITCH_TOPIC' | 'TERMINATE';

export interface IEvaluationMetrics {
  relevanceScore: number;
  depthScore: number;
  correctnessScore: number;
}

export interface IProctoringMetrics {
  gazeConfidence: number;
  audioVoiceCount: number;
  tabFocusLost: boolean;
}

export interface ITurnEvaluation extends Document {
  sessionId: string;
  turnIndex: number;
  questionAsked: string;
  candidateAnswer: string;
  expectedConcepts?: string[];
  metrics: IEvaluationMetrics;
  proctoring?: IProctoringMetrics;
  evaluatorNotes?: string;
  missingConcepts: string[];
  redFlagsDetected: string[];
  actionDecision: ActionDecisionType;
  recommendedFollowUp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MetricsSchema = new Schema<IEvaluationMetrics>(
  {
    relevanceScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 10.0,
    },
    depthScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 10.0,
    },
    correctnessScore: {
      type: Number,
      required: true,
      min: 0.0,
      max: 10.0,
    },
  },
  { _id: false }
);

const ProctoringSchema = new Schema<IProctoringMetrics>(
  {
    gazeConfidence: {
      type: Number,
      required: true,
      default: 1.0,
      min: 0.0,
      max: 1.0,
    },
    audioVoiceCount: {
      type: Number,
      required: true,
      default: 1,
    },
    tabFocusLost: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { _id: false }
);

const TurnEvaluationSchema = new Schema<ITurnEvaluation>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    turnIndex: {
      type: Number,
      required: true,
    },
    questionAsked: {
      type: String,
      required: true,
    },
    candidateAnswer: {
      type: String,
      required: true,
    },
    expectedConcepts: {
      type: [String],
      default: [],
    },
    metrics: {
      type: MetricsSchema,
      required: true,
    },
    proctoring: {
      type: ProctoringSchema,
      required: false,
      default: () => ({ gazeConfidence: 1.0, audioVoiceCount: 1, tabFocusLost: false }),
    },
    evaluatorNotes: {
      type: String,
      required: false,
    },
    missingConcepts: {
      type: [String],
      default: [],
    },
    redFlagsDetected: {
      type: [String],
      default: [],
    },
    actionDecision: {
      type: String,
      required: true,
      enum: ['PASS', 'PROBE_FURTHER', 'SWITCH_TOPIC', 'TERMINATE'],
    },
    recommendedFollowUp: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'turn_evaluations',
  }
);

// Compound Index for retrieving evaluation history for a given session sorted by turn
TurnEvaluationSchema.index({ sessionId: 1, turnIndex: 1 }, { unique: true });

export const TurnEvaluationModel: Model<ITurnEvaluation> =
  model<ITurnEvaluation>('TurnEvaluation', TurnEvaluationSchema);

export default TurnEvaluationModel;
