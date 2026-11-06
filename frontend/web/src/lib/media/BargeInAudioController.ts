/**
 * Telephonic-Grade Barge-In Controller & Audio Lookback Ring Buffer
 *
 * Implements full-duplex conversational voice interruption standards
 * (similar to LiveKit Agents, Retell AI, and Vapi):
 *
 * 1. Full-Duplex Processing: Keeps candidate mic open with Acoustic Echo Cancellation (AEC).
 * 2. Circular Audio Ring Buffer: Preserves 400-500ms of pre-interruption audio so
 *    the candidate's opening syllables ("Actually", "Wait", "Yes") are never clipped.
 * 3. Two-Tier Hysteresis: Requires sustained human speech (>= 200ms) before cutting off AI,
 *    rejecting transient coughs, sneezes, and keyboard clicks.
 * 4. AEC Stabilization Grace Window: Ignores audio during the first 350ms of AI speech
 *    while hardware/browser echo cancellers converge on the speaker output.
 * 5. Smooth Audio Ducking: 35ms linear gain ramp-down to eliminate audio pop/click artifacts.
 */

export interface BargeInConfig {
  /** Minimum sustained human speech to confirm genuine interruption (default: 200ms) */
  minInterruptionDurationMs: number;
  /** Buffer lookback window to recover initial syllables (default: 450ms) */
  lookbackBufferDurationMs: number;
  /** Grace cooldown right after AI starts speaking to allow AEC convergence (default: 350ms) */
  aecStabilizationGraceMs: number;
  /** Volume ducking fade-out time in ms before cutting output (default: 35ms) */
  duckingDurationMs: number;
}

export const DEFAULT_BARGE_IN_CONFIG: BargeInConfig = {
  minInterruptionDurationMs: 200,
  lookbackBufferDurationMs: 450,
  aecStabilizationGraceMs: 350,
  duckingDurationMs: 35,
};

export class TelephonicBargeInController {
  private isInterviewerSpeaking = false;
  private interviewerStartTime = 0;
  private speechDetectedStartTime: number | null = null;
  private pcmRingBuffer: Float32Array[] = [];
  private maxBufferedFrames = 30; // ~450ms to 600ms of audio frames at 60fps / 16ms hops
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private attachedElement: HTMLAudioElement | null = null;

  constructor(
    private onBargeInTriggered: (reason: string) => void,
    private config: BargeInConfig = DEFAULT_BARGE_IN_CONFIG
  ) {}

  /**
   * Attach the AI Interviewer's HTMLAudioElement for hardware-accelerated smooth audio ducking.
   */
  public attachAudioElement(element: HTMLAudioElement): void {
    if (this.attachedElement === element) return;
    this.attachedElement = element;
    try {
      if (!this.audioContext) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioCtxClass();
      }
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      this.gainNode = this.audioContext.createGain();
      const source = this.audioContext.createMediaElementSource(element);
      source.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
    } catch {
      // Fallback: Web Audio routing may throw if element is cross-origin or already connected
      this.gainNode = null;
    }
  }

  /**
   * Called when the AI interviewer begins voice playback.
   */
  public notifyInterviewerStart(): void {
    this.isInterviewerSpeaking = true;
    this.interviewerStartTime = Date.now();
    this.speechDetectedStartTime = null;
    this.pcmRingBuffer = [];
    if (this.gainNode && this.audioContext) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
        this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      } catch {}
    } else if (this.attachedElement) {
      this.attachedElement.volume = 1.0;
    }
  }

  /**
   * Called when the AI interviewer finishes voice playback or is paused.
   */
  public notifyInterviewerStop(): void {
    this.isInterviewerSpeaking = false;
    this.speechDetectedStartTime = null;
  }

  public get isPlaying(): boolean {
    return this.isInterviewerSpeaking;
  }

  /**
   * Continuous PCM frame feeder. Call on every VAD or Web Audio processor frame.
   * Maintains a rolling pre-roll ring buffer and triggers telephonic barge-in when verified.
   *
   * @param rawPcm - Float32Array samples of the candidate's mic input
   * @param isVocalActivity - True if energy is in human speech frequency band (200Hz - 3400Hz)
   * @returns true if barge-in was triggered on this frame
   */
  public pushAudioFrame(rawPcm: Float32Array | null, isVocalActivity: boolean): boolean {
    // 1. Maintain Circular Pre-Roll Buffer
    if (rawPcm && rawPcm.length > 0) {
      this.pcmRingBuffer.push(new Float32Array(rawPcm));
      if (this.pcmRingBuffer.length > this.maxBufferedFrames) {
        this.pcmRingBuffer.shift();
      }
    }

    if (!this.isInterviewerSpeaking) return false;

    const now = Date.now();

    // 2. AEC Stabilization Grace Window: Ignore initial audio right as AI starts speaking
    if (now - this.interviewerStartTime < this.config.aecStabilizationGraceMs) {
      return false;
    }

    // 3. Telephonic Hysteresis Onset Filter
    if (isVocalActivity) {
      if (this.speechDetectedStartTime === null) {
        this.speechDetectedStartTime = now;
      } else if (now - this.speechDetectedStartTime >= this.config.minInterruptionDurationMs) {
        // Confirmed genuine candidate voice interruption!
        this.executeBargeIn('sustained_speech_onset');
        return true;
      }
    } else {
      // Audio level fell below speech threshold before reaching minInterruptionDurationMs
      // Transient noise (cough, keyboard tap, breath) is rejected!
      this.speechDetectedStartTime = null;
    }

    return false;
  }

  /**
   * Get the preserved lookback audio frames that occurred just before interruption confirmation.
   */
  public getLookbackBuffer(): Float32Array[] {
    return [...this.pcmRingBuffer];
  }

  /**
   * Smoothly duck and cut interviewer audio, aborting speech without digital click/pop artifacts.
   */
  private executeBargeIn(reason: string): void {
    this.isInterviewerSpeaking = false;
    this.speechDetectedStartTime = null;

    // Fast 35ms linear volume ducking
    if (this.gainNode && this.audioContext) {
      try {
        const t = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(t);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, t);
        this.gainNode.gain.linearRampToValueAtTime(0.0, t + this.config.duckingDurationMs / 1000);
      } catch {}
    } else if (this.attachedElement) {
      try {
        this.attachedElement.volume = 0.0;
      } catch {}
    }

    // Fire interruption callback
    this.onBargeInTriggered(reason);
  }

  /**
   * Reset internal buffers.
   */
  public reset(): void {
    this.isInterviewerSpeaking = false;
    this.speechDetectedStartTime = null;
    this.pcmRingBuffer = [];
  }
}

