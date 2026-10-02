export type PracticeCategory = 
  | 'ALL'
  | 'SYSTEM_DESIGN'
  | 'DATA_STRUCTURES'
  | 'DISTRIBUTED_SYSTEMS'
  | 'BEHAVIORAL'
  | 'DATABASE_INTERNALS';

export type DrillDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface PracticeDrillItem {
  id: string;
  title: string;
  category: PracticeCategory;
  difficulty: DrillDifficulty;
  estimatedMinutes: number; // e.g. 8, 12, 15
  coreSkillsTested: string[]; // e.g. ["Sticky Assignors", "Rebalance Protocol"]
  description: string;
  sampleStarterQuestion: string;
  totalAttempts: number;
  userBestScore?: number; // 0 - 100
  recommendedReason?: string; // e.g. "Triggered by your recent interview growth area"
}

export interface MicroFeedbackReport {
  drillId: string;
  score: number; // 0 - 100
  durationSeconds: number;
  strengthsSummary: string[];
  omissionsAndMistakes: string[];
  modelAnswerOverview: string;
  suggestedFollowUpTopics: string[];
}

export interface DrillTurnEvaluation {
  turnIndex: number;
  question: string;
  userAnswer: string;
  audioClipUrl?: string;
  scores: {
    relevance: number;
    depth: number;
    correctness: number;
  };
  feedback: string;
  followUpQuestion?: string;
  isFinalTurn: boolean;
}

export interface CandidatePracticeStats {
  totalDrillsCompleted: number;
  averageScore: number;
  totalPracticeMinutes: number;
  readinessPercentage: number;
  categoryBreakdown: Record<string, number>;
}
