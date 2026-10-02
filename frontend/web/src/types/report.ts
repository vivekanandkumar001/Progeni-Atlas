export interface TurnReview {
  turnIndex: number;
  stage: 'introduction' | 'resume_probe' | 'technical_depth' | 'system_architecture' | 'wrap_up';
  questionAsked: string;
  candidateAnswerSummary: string;
  audioClipUrl?: string;
  scores: {
    relevance: number; // 0 - 10
    depth: number;     // 0 - 10
    correctness: number; // 0 - 10
  };
  keyConceptsCovered: string[];
  missingConcepts: string[];
  evaluatorFeedback: string;
}

export interface CompetencyPillars {
  algorithmicProblemSolving: number; // 0 - 100
  systemArchitecture: number;        // 0 - 100
  codeQualityAndSyntax: number;      // 0 - 100
  communicationAndClarity: number;   // 0 - 100
}

export interface CandidateEvaluationDossier {
  sessionId: string;
  candidate: {
    fullName: string;
    email: string;
    avatarUrl?: string;
    program: string;
    academicYear: string;
  };
  jobContext: {
    roleTitle: string;
    companyName: string;
    interviewDate: string;
    durationMinutes: number;
  };
  overallScore: number; // 0 - 100
  hiringRecommendation: 'STRONG_HIRE' | 'HIRE' | 'LEAN_HIRE' | 'NEEDS_IMPROVEMENT';
  percentileRank: number; // e.g., 88 (Top 12%)
  competencyPillars: CompetencyPillars;
  executiveSummary: string;
  verifiedStrengths: string[];
  targetedGrowthAreas: string[];
  proctoringIntegritySummary: {
    overallIntegrityScore: number;
    gazeConsistencyPercentage: number;
    tabSwitchCount: number;
    multipleVoicesDetected: boolean;
  };
  turnReviews: TurnReview[];
  verificationDossierId: string;
}
