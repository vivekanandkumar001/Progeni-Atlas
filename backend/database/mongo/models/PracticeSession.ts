import { Schema, model } from 'mongoose';

const PracticeSessionSchema = new Schema({
  candidateId: { type: String, required: true, index: true },
  drillId: { type: String, required: true },
  category: { type: String, required: true },
  difficulty: { type: String, required: true },
  turns: [
    {
      turnIndex: Number,
      question: String,
      userAnswer: String,
      audioClipUrl: String,
      scores: { relevance: Number, depth: Number, correctness: Number },
      feedback: String,
      timestamp: { type: Date, default: Date.now },
    }
  ],
  finalReport: {
    overallScore: Number,
    strengths: [String],
    areasForGrowth: [String],
    modelAnswerKey: String,
  },
  completedAt: { type: Date, default: Date.now },
});

export const PracticeSession = model('PracticeSession', PracticeSessionSchema);
