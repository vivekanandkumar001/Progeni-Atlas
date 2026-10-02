import { Schema, model, Document, Model } from 'mongoose';

export type SpeakerType = 'ai_interviewer' | 'ai_agent' | 'candidate';
export type StageType = 'intro' | 'resume_probe' | 'technical' | 'scenario' | 'wrap_up';

export interface ITranscriptTurn {
  turnIndex: number;
  stage: StageType;
  speaker: SpeakerType;
  text: string;
  audioClipUrl?: string;
  latencyMs?: number;
  timestamp: Date;
}

export interface IInterviewTranscript extends Document {
  sessionId: string;
  candidateId: string;
  turns: ITranscriptTurn[];
  createdAt: Date;
  updatedAt: Date;
}

const TranscriptTurnSchema = new Schema<ITranscriptTurn>(
  {
    turnIndex: {
      type: Number,
      required: true,
    },
    stage: {
      type: String,
      required: true,
      enum: ['intro', 'resume_probe', 'technical', 'scenario', 'wrap_up'],
    },
    speaker: {
      type: String,
      required: true,
      enum: ['ai_interviewer', 'ai_agent', 'candidate'],
    },
    text: {
      type: String,
      required: true,
    },
    audioClipUrl: {
      type: String,
      required: false,
    },
    latencyMs: {
      type: Number,
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false }
);

const InterviewTranscriptSchema = new Schema<IInterviewTranscript>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    candidateId: {
      type: String,
      required: true,
      index: true,
    },
    turns: {
      type: [TranscriptTurnSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'interview_transcripts',
  }
);

// Compound Index for efficient session turn queries
InterviewTranscriptSchema.index({ sessionId: 1, 'turns.turnIndex': 1 });

export const InterviewTranscriptModel: Model<IInterviewTranscript> =
  model<IInterviewTranscript>('InterviewTranscript', InterviewTranscriptSchema);

export default InterviewTranscriptModel;
