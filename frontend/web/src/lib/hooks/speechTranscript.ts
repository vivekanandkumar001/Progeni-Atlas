export interface RecognitionResultLike {
  isFinal: boolean;
  0?: { transcript?: string };
}

export interface TranscriptSnapshot {
  committed: string;
  interim: string;
  displayed: string;
}

const join = (...parts: string[]) => parts.map((part) => part.trim()).filter(Boolean).join(' ').trim();

export function resolveAnswerSubmissionText(options: {
  speechTranscript: string;
  candidateAnswer: string;
  answerOverride?: string;
  isUserEditing: boolean;
}): string {
  const { speechTranscript, candidateAnswer, answerOverride, isUserEditing } = options;
  // A manual edit is authoritative. Otherwise prefer the transcript snapshot
  // captured before stopping recognition, which may still contain an interim
  // phrase that stop() intentionally drops when preserving text for a restart.
  return isUserEditing
    ? answerOverride ?? candidateAnswer
    : speechTranscript || candidateAnswer;
}

/**
 * Accumulates Web Speech API results by their stable result index. Result lists
 * are cumulative in conforming browsers; resultIndex identifies the changed
 * suffix. Keeping slots prevents later interim revisions from replacing finals
 * and prevents cumulative snapshots from appending the same phrase twice.
 */
export class SpeechTranscriptAccumulator {
  private answerBase = '';
  private results: Array<{ text: string; isFinal: boolean }> = [];

  update(results: ArrayLike<RecognitionResultLike>, resultIndex = 0): TranscriptSnapshot {
    // Empty events carry no new information; do not wipe the last valid result.
    if (!results || results.length === 0) return this.snapshot();

    const start = Math.max(0, Math.min(Number.isFinite(resultIndex) ? resultIndex : 0, results.length));
    for (let index = start; index < results.length; index += 1) {
      const result = results[index];
      const text = (result?.[0]?.transcript || '').trim();
      const previous = this.results[index];
      if (!text) {
        // Empty recognition hypotheses must not erase confirmed speech.
        if (!previous?.isFinal) this.results[index] = { text: '', isFinal: false };
        continue;
      }
      // A finalized slot is immutable, including when a buggy engine reports a
      // later interim revision at the same index.
      if (previous?.isFinal) continue;
      this.results[index] = { text, isFinal: Boolean(result.isFinal) };
    }

    return this.snapshot();
  }

  /** Commit all hypotheses (finals and any pending interim words) when recognition ends/restarts so no spoken words are lost. */
  endRecognition(): TranscriptSnapshot {
    const words = this.results.map((result) => (result.text || '').trim()).filter(Boolean);
    if (words.length > 0) {
      this.answerBase = join(this.answerBase, ...words);
    }
    this.results = [];
    return this.snapshot();
  }

  reset(): TranscriptSnapshot {
    this.answerBase = '';
    this.results = [];
    return this.snapshot();
  }

  set(text: string): TranscriptSnapshot {
    this.answerBase = (text || '').trim();
    this.results = [];
    return this.snapshot();
  }

  getFinalTranscript(): string {
    return join(this.answerBase, ...this.results.filter((result) => result.isFinal).map((result) => result.text));
  }

  snapshot(): TranscriptSnapshot {
    const committed = this.getFinalTranscript();
    const interim = join(...this.results.filter((result) => !result.isFinal).map((result) => result.text));
    return { committed, interim, displayed: join(committed, interim) };
  }
}
