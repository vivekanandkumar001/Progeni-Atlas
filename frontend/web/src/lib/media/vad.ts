/**
 * Voice Activity Detection (VAD) & Silence Auto-Finalizer
 *
 * Listens to an active MediaStream audio track and detects when the candidate
 * starts speaking and stops speaking, differentiating genuine voice activity from
 * ambient noise, fans, and mechanical clicks (e.g. keyboard typing) using:
 * 1. Speech-band frequency isolation (200Hz - 3400Hz).
 * 2. Dual-threshold hysteresis (higher start threshold, lower end threshold).
 * 3. Temporal onset filtering (rejects transient spikes < 150ms).
 * 4. Adaptive ambient noise floor tracking.
 * 5. Hangover duration (300ms) to bridge natural intra-sentence speech pauses.
 */

export interface VADConfig {
  /** RMS level to trigger candidate speech onset (default: 0.022) */
  rmsSpeechStartThreshold?: number;
  /** RMS level to maintain candidate speech (default: 0.012) */
  rmsSpeechEndThreshold?: number;
  /** Legacy alias for rmsSpeechStartThreshold */
  rmsSpeechThreshold?: number;
  /** Silence window after speech to finalize answer (default: 5000ms) */
  silenceDurationMs?: number;
  /** Minimum sustained voice duration (ms) to confirm genuine speech vs transient noise (default: 150ms) */
  minSpeechDurationMs?: number;
  /** Speech hangover duration (ms) before declaring speech paused (default: 300ms) */
  speechHangoverMs?: number;
  /** Maximum answer duration safety cap (default: 180,000ms / 3 mins) */
  maxAnswerDurationMs?: number;
}

export const DEFAULT_VAD_CONFIG: Required<VADConfig> = {
  rmsSpeechStartThreshold: 0.015,
  rmsSpeechEndThreshold: 0.008,
  rmsSpeechThreshold: 0.015,
  silenceDurationMs: 6000,
  minSpeechDurationMs: 120,
  speechHangoverMs: 3000,
  maxAnswerDurationMs: 180000,
};

export class SilenceVADDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  private isListening = false;
  private isSpeechActive = false;
  private speechCandidateStartTime: number | null = null;
  private speechStartTime: number | null = null;
  private lastSpeechTime: number | null = null;
  private ambientNoiseFloor = 0.005;
  private silenceTimer: NodeJS.Timeout | null = null;
  private maxDurationTimer: NodeJS.Timeout | null = null;
  private lastPartialEmitTime = 0;

  private config: Required<VADConfig>;

  /** Fired when genuine candidate voice activity is confirmed (>= minSpeechDurationMs in speech band) */
  public onSpeechStart?: () => void;
  /** Fired when candidate voice ceases for longer than hangover duration */
  public onSpeechPause?: () => void;
  /** Optional audio blob callback when recording completes */
  public onSpeechEnd?: (blob: Blob, speechDurationMs: number) => void;
  public onPartialAudio?: (blob: Blob) => void;
  /** Volume and speech state callback for visual meters */
  public onVolumeChange?: (rms: number, isSpeech: boolean) => void;
  /** High-speed PCM frame callback for Telephonic Barge-In & Lookback Ring Buffering */
  public onPcmFrame?: (pcm: Float32Array, isVocal: boolean) => void;
  public onError?: (error: Error) => void;

  constructor(config: VADConfig = {}) {
    const startThresh = config.rmsSpeechStartThreshold ?? config.rmsSpeechThreshold ?? DEFAULT_VAD_CONFIG.rmsSpeechStartThreshold;
    const endThresh = config.rmsSpeechEndThreshold ?? (startThresh * 0.55);
    this.config = {
      ...DEFAULT_VAD_CONFIG,
      ...config,
      rmsSpeechStartThreshold: startThresh,
      rmsSpeechEndThreshold: endThresh,
      rmsSpeechThreshold: startThresh,
    };
  }

  /**
   * Start VAD monitoring on an existing, live MediaStream without requesting new getUserMedia.
   */
  public start(stream: MediaStream): void {
    this.stop();

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') {
      this.onError?.(new Error('No live audio track available in MediaStream for VAD'));
      return;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      // Prepare MediaRecorder only if onSpeechEnd or onPartialAudio is attached
      if (this.onSpeechEnd || this.onPartialAudio) {
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
          (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)
        );

        this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        this.chunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.chunks.push(e.data);
        };

        this.mediaRecorder.onstop = () => {
          const mime = mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type: mime });
          const duration = this.speechStartTime ? Date.now() - this.speechStartTime : 0;
          this.chunks = [];

          if (blob.size > 0 && duration >= this.config.minSpeechDurationMs) {
            this.onSpeechEnd?.(blob, duration);
          }
        };

        this.mediaRecorder.start(250);
      }

      this.isListening = true;
      this.isSpeechActive = false;
      this.speechCandidateStartTime = null;
      this.speechStartTime = null;
      this.lastSpeechTime = null;
      this.ambientNoiseFloor = 0.005;

      // Cap maximum single answer duration safety timer
      this.maxDurationTimer = setTimeout(() => {
        if (this.isListening) this.finalizeAnswer();
      }, this.config.maxAnswerDurationMs);

      this.processAudio();
    } catch (err) {
      this.onError?.(err instanceof Error ? err : new Error('Failed to initialize VAD Web Audio nodes'));
    }
  }

  private processAudio = (): void => {
    if (!this.isListening || !this.analyser || !this.audioCtx) return;

    const sampleRate = this.audioCtx.sampleRate || 44100;
    const binFreq = sampleRate / 512;
    // Speech band: ~200Hz to ~3400Hz (human vocal fundamental and vowel/consonant formants)
    const minSpeechBin = Math.max(1, Math.floor(200 / binFreq));
    const maxSpeechBin = Math.min(this.analyser.frequencyBinCount - 1, Math.ceil(3400 / binFreq));
    // High frequency noise band: > 4000Hz (keyboard clicks, mouse taps, fan hiss)
    const highNoiseBin = Math.min(this.analyser.frequencyBinCount - 1, Math.floor(4000 / binFreq));

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let totalSum = 0;
    let speechSum = 0;
    let highSum = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const val = dataArray[i] / 255;
      const energy = val * val;
      totalSum += energy;
      if (i >= minSpeechBin && i <= maxSpeechBin) {
        speechSum += energy;
      }
      if (i >= highNoiseBin) {
        highSum += energy;
      }
    }

    const totalRms = Math.sqrt(totalSum / dataArray.length);
    const speechBinCount = Math.max(1, maxSpeechBin - minSpeechBin + 1);
    const speechRms = Math.sqrt(speechSum / speechBinCount);
    const highBinCount = Math.max(1, dataArray.length - highNoiseBin);
    const highRms = Math.sqrt(highSum / highBinCount);

    // Dynamic SNR & noise floor tracking during low-energy periods
    if (!this.isSpeechActive && speechRms < this.config.rmsSpeechEndThreshold) {
      this.ambientNoiseFloor = this.ambientNoiseFloor * 0.98 + totalRms * 0.02;
      this.ambientNoiseFloor = Math.max(0.002, Math.min(0.04, this.ambientNoiseFloor));
    }

    const effectiveStart = Math.max(this.config.rmsSpeechStartThreshold, this.ambientNoiseFloor * 2.2);
    const effectiveEnd = Math.max(this.config.rmsSpeechEndThreshold, this.ambientNoiseFloor * 1.4);

    // Vocal dominance check: speech band energy must be substantial and not overshadowed by high-frequency clicks
    const vocalRatio = speechSum / Math.max(totalSum, 0.0001);
    const isVocalDominant = vocalRatio >= 0.18 && speechRms >= highRms * 0.70;

    const meetsStartCriteria = speechRms >= effectiveStart && isVocalDominant;
    const meetsEndCriteria = speechRms >= effectiveEnd;

    this.onVolumeChange?.(speechRms, this.isSpeechActive);

    if (this.onPcmFrame && this.analyser) {
      const pcmData = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(pcmData);
      this.onPcmFrame(pcmData, meetsStartCriteria || this.isSpeechActive);
    }

    const now = Date.now();

    if (!this.isSpeechActive) {
      if (meetsStartCriteria) {
        if (this.speechCandidateStartTime === null) {
          this.speechCandidateStartTime = now;
        } else if (now - this.speechCandidateStartTime >= this.config.minSpeechDurationMs) {
          // Sustained vocal onset confirmed: transition to active speech
          this.isSpeechActive = true;
          this.speechStartTime = this.speechCandidateStartTime;
          this.lastSpeechTime = now;
          this.speechCandidateStartTime = null;
          this.onSpeechStart?.();
        }
      } else {
        // Transient noise spike (e.g. keyboard click < 150ms) rejected without triggering speech
        this.speechCandidateStartTime = null;
      }
    } else {
      // Speech is active
      if (meetsEndCriteria) {
        this.lastSpeechTime = now;

        // Periodic partial audio chunks if configured
        if (this.onPartialAudio && now - this.lastPartialEmitTime >= 3000 && this.chunks.length > 0) {
          this.lastPartialEmitTime = now;
          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const partialBlob = new Blob(this.chunks, { type: mime });
          if (partialBlob.size > 2000) {
            this.onPartialAudio(partialBlob);
          }
        }

        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
      } else if (this.lastSpeechTime && now - this.lastSpeechTime >= this.config.speechHangoverMs) {
        // Candidate paused speaking (beyond 300ms syllable hangover)
        this.isSpeechActive = false;
        this.speechCandidateStartTime = null;
        this.onSpeechPause?.();

        // If onSpeechEnd callback is configured with internal silenceDurationMs:
        if (this.onSpeechEnd && !this.silenceTimer) {
          const silentElapsed = now - this.lastSpeechTime;
          if (silentElapsed >= this.config.silenceDurationMs) {
            this.silenceTimer = setTimeout(() => {
              this.finalizeAnswer();
            }, 100);
          }
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.processAudio);
  };

  public finalizeAnswer(): void {
    if (!this.isListening) return;
    this.isListening = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
  }

  public stop(): void {
    this.isListening = false;
    this.isSpeechActive = false;
    this.speechCandidateStartTime = null;
    // NOTE: do not clear onSpeechStart/onSpeechPause/onSpeechEnd here.
    // start() calls stop() for idempotent teardown, so clearing the handlers
    // would erase the callbacks the caller assigned just before start().

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.mediaRecorder = null;

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
    if (this.audioCtx) {
      try {
        void this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
    this.analyser = null;
  }
}
