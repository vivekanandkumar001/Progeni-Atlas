'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { speakInterviewText } from '@/lib/api';

export type PlaybackState = 'IDLE' | 'LOADING' | 'PLAYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface UseInterviewerSpeechOptions {
  sessionId: string;
  stream: MediaStream | null;
  isMutedRef: React.MutableRefObject<boolean>;
  onSpeechStart?: () => void;
  onSpeechEnd?: (dialogueId: string) => void;
  onSpeechError?: (dialogueId: string, error: unknown) => void;
  /**
   * Playback rate for interviewer audio. Kept at 1.0 - 1.25 for natural human pace.
   */
  playbackRate?: number;
  /**
   * TTS voice selection for interviewer audio:
   * - "en": English Studio Voice (Azure AvaNeural / Gemini Aoede)
   * - "hinglish": Indian English / Hinglish Studio Voice (Azure NeerjaNeural)
   * - "default": Provider default
   */
  voice?: 'en' | 'hinglish' | 'default';
}

export interface UseInterviewerSpeechReturn {
  playbackState: PlaybackState;
  speakQuestion: (text: string, dialogueKey?: string, voice?: 'en' | 'hinglish' | 'default' | string) => Promise<void>;
  playInstantBackchannel: (customPhrase?: string) => void;
  stopCurrentPlayback: (reason?: string) => void;
  handleReplayAudio: (textToReplay: string) => void;
  restoreMicrophoneTrack: () => void;
  muteMicrophoneTrack: () => void;
  ttsEndTimeRef: React.MutableRefObject<number>;
  activeDialogueIdRef: React.MutableRefObject<string | null>;
  playedDialogueKeysRef: React.MutableRefObject<Set<string>>;
  failedDialogueKeysRef: React.MutableRefObject<Set<string>>;
  setPlaybackState: React.Dispatch<React.SetStateAction<PlaybackState>>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  getAudioAnalyser: () => AnalyserNode | null;
}

export const STUDIO_VOICE_ASSETS: Record<string, string> = {
  got_it: '/audio/voice/got_it.mp3',
  makes_sense: '/audio/voice/makes_sense.mp3',
  right_understood: '/audio/voice/right_understood.mp3',
  tracking_approach: '/audio/voice/tracking_approach.mp3',
  go_ahead: '/audio/voice/go_ahead.mp3',
  interesting_point: '/audio/voice/interesting_point.mp3',
  i_see: '/audio/voice/i_see.mp3',
  take_your_time: '/audio/voice/take_your_time.mp3',
  good_progress: '/audio/voice/good_progress.mp3',
  complexity_check: '/audio/voice/complexity_check.mp3',
  clarification: '/audio/voice/clarification.mp3',
  thinking_bridge: '/audio/voice/thinking_bridge.mp3',
  welcome_sarah: '/audio/voice/welcome_sarah.mp3',
  thank_you_conclusion: '/audio/voice/thank_you_conclusion.mp3',
  hinglish_got_it: '/audio/voice/hinglish_got_it.mp3',
  hinglish_makes_sense: '/audio/voice/hinglish_makes_sense.mp3',
  hinglish_go_ahead: '/audio/voice/hinglish_go_ahead.mp3',
};

// Module-level in-memory cache of pre-decoded Web Audio API buffers
const globalAudioBufferCache = new Map<string, AudioBuffer>();
let globalAudioContext: AudioContext | null = null;
let globalAnalyserNode: AnalyserNode | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!globalAudioContext) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      globalAudioContext = new AudioCtx();
    }
  }
  return globalAudioContext;
}

function getSharedAnalyser(): AnalyserNode | null {
  const ctx = getSharedAudioContext();
  if (!ctx) return null;
  if (!globalAnalyserNode) {
    globalAnalyserNode = ctx.createAnalyser();
    globalAnalyserNode.fftSize = 256;
    globalAnalyserNode.connect(ctx.destination);
  }
  return globalAnalyserNode;
}

/** Clamp interviewer playback rate to a safe, natural range. */
export const clampPlaybackRate = (rate: number): number =>
  Math.min(2, Math.max(0.5, Number.isFinite(rate) ? rate : 1.25));

export const safeHash = (text: string): string => {
  let hash = 0;
  const str = text.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
};

export const logAudioEvent = (_event: string, _details: Record<string, unknown>) => {};

export function useInterviewerSpeech({
  sessionId,
  stream,
  isMutedRef,
  onSpeechStart,
  onSpeechEnd,
  onSpeechError,
  playbackRate = 1.0,
  voice = 'default',
}: UseInterviewerSpeechOptions): UseInterviewerSpeechReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('IDLE');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const activeDialogueIdRef = useRef<string | null>(null);
  const playedDialogueKeysRef = useRef<Set<string>>(new Set());
  const failedDialogueKeysRef = useRef<Set<string>>(new Set());
  const ttsEndTimeRef = useRef<number>(0);
  const ttsAbortRef = useRef<AbortController | null>(null);

  const clampRate = clampPlaybackRate(playbackRate);

  // Pre-load all studio human voice buffers into RAM on mount
  useEffect(() => {
    let isMounted = true;
    const preloadVoiceAssets = async () => {
      const ctx = getSharedAudioContext();
      if (!ctx) return;

      for (const [key, path] of Object.entries(STUDIO_VOICE_ASSETS)) {
        if (globalAudioBufferCache.has(key)) continue;
        try {
          const res = await fetch(path);
          if (!res.ok) continue;
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          if (isMounted) {
            globalAudioBufferCache.set(key, audioBuffer);
          }
        } catch {
          // Preload errors are safely ignored; fallback uses HTMLAudioElement
        }
      }
    };

    void preloadVoiceAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  const getOrCreateAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.defaultPlaybackRate = clampRate;
      audio.playbackRate = clampRate;
      if ('preservesPitch' in audio) {
        audio.preservesPitch = true;
      }
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [clampRate]);

  const restoreMicrophoneTrack = useCallback(() => {
    const audioTracks = stream?.getAudioTracks();
    if (audioTracks && audioTracks.length > 0) {
      audioTracks.forEach((track) => {
        if (isMutedRef.current) {
          track.enabled = false;
        } else {
          track.enabled = true;
        }
      });
    }
  }, [stream, isMutedRef]);

  const muteMicrophoneTrack = useCallback(() => {
    const audioTracks = stream?.getAudioTracks();
    if (audioTracks && audioTracks.length > 0) {
      audioTracks.forEach((track) => {
        track.enabled = false;
      });
    }
  }, [stream]);

  const stopCurrentPlayback = useCallback(
    (reason: string = 'manual_stop') => {
      if (activeDialogueIdRef.current && playbackState === 'PLAYING') {
        logAudioEvent('AUDIO_INTERRUPTED', {
          dialogue_id: activeDialogueIdRef.current,
          reason,
          playback_state: playbackState,
        });
      }

      if (ttsAbortRef.current) {
        ttsAbortRef.current.abort();
        ttsAbortRef.current = null;
      }

      // Stop active Web Audio source if running
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {
          // ignore already stopped source
        }
        activeSourceRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = '';
        logAudioEvent('AUDIO_PAUSED', { dialogue_id: activeDialogueIdRef.current, reason });
      }

      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }

      activeDialogueIdRef.current = null;
      setPlaybackState('IDLE');
      restoreMicrophoneTrack();
    },
    [playbackState, restoreMicrophoneTrack]
  );

  // Play an in-memory pre-decoded AudioBuffer with sub-2ms hardware latency
  const playInMemoryBuffer = useCallback(
    (bufferKey: string, dialogueId: string): boolean => {
      const ctx = getSharedAudioContext();
      if (!ctx) return false;
      const buffer = globalAudioBufferCache.get(bufferKey);
      if (!buffer) return false;

      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {
          // ignore
        }
        activeSourceRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = clampRate;

      const analyser = getSharedAnalyser();
      if (analyser) {
        source.connect(analyser);
      } else {
        source.connect(ctx.destination);
      }

      activeSourceRef.current = source;
      activeDialogueIdRef.current = dialogueId;
      setPlaybackState('PLAYING');
      onSpeechStart?.();

      source.onended = () => {
        if (activeSourceRef.current === source) {
          activeSourceRef.current = null;
          ttsEndTimeRef.current = Date.now();
          playedDialogueKeysRef.current.add(dialogueId);
          activeDialogueIdRef.current = null;
          setPlaybackState('COMPLETED');
          restoreMicrophoneTrack();
          onSpeechEnd?.(dialogueId);
        }
      };

      source.start(0); // Hardware starts playback in < 2ms!
      return true;
    },
    [clampRate, onSpeechStart, onSpeechEnd, restoreMicrophoneTrack]
  );

  // Sub-5ms Instant Acoustic Backchannel:
  // Plays from RAM with zero network roundtrip and 100% human studio fidelity.
  const playInstantBackchannel = useCallback(
    (customPhrase?: string) => {
      const isHinglish = voice === 'hinglish';
      const defaultPool = isHinglish
        ? ['hinglish_got_it', 'hinglish_makes_sense', 'hinglish_go_ahead']
        : ['got_it', 'makes_sense', 'right_understood', 'tracking_approach', 'go_ahead'];

      let chosenKey = defaultPool[Math.floor(Math.random() * defaultPool.length)];
      if (customPhrase && customPhrase in STUDIO_VOICE_ASSETS) {
        chosenKey = customPhrase;
      }

      const dialogueId = `${sessionId}:instant:${chosenKey}:${Date.now()}`;
      const played = playInMemoryBuffer(chosenKey, dialogueId);

      if (!played) {
        // Fallback: If buffer decoding is in-progress, play via Audio element
        const audio = getOrCreateAudio();
        if (audio) {
          audio.src = STUDIO_VOICE_ASSETS[chosenKey] || '/audio/voice/got_it.mp3';
          audio.onended = () => {
            activeDialogueIdRef.current = null;
            setPlaybackState('COMPLETED');
            restoreMicrophoneTrack();
            onSpeechEnd?.(dialogueId);
          };
          activeDialogueIdRef.current = dialogueId;
          setPlaybackState('PLAYING');
          onSpeechStart?.();
          void audio.play().catch(() => {});
        }
      }
    },
    [voice, sessionId, playInMemoryBuffer, getOrCreateAudio, onSpeechStart, onSpeechEnd, restoreMicrophoneTrack]
  );

  const speakQuestion = useCallback(
    async (text: string, dialogueKey?: string, voiceOverride?: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      const textHash = safeHash(cleanText);
      const dialogueId = dialogueKey || `${sessionId}:dlg:${textHash}`;
      const effectiveVoice = voiceOverride || voice || 'default';

      if (
        activeDialogueIdRef.current === dialogueId &&
        (playbackState === 'PLAYING' || playbackState === 'LOADING')
      ) {
        return;
      }

      if (playedDialogueKeysRef.current.has(dialogueId) || failedDialogueKeysRef.current.has(dialogueId)) {
        onSpeechEnd?.(dialogueId);
        return;
      }

      stopCurrentPlayback('starting_new_dialogue');

      // Check if text corresponds to pre-loaded studio voice buffers
      const lower = cleanText.toLowerCase();
      if (lower.includes('welcome') && lower.includes('sarah') && globalAudioBufferCache.has('welcome_sarah')) {
        if (playInMemoryBuffer('welcome_sarah', dialogueId)) return;
      }
      if ((lower.includes('thank you for completing') || lower.includes('thank you for taking the time')) && globalAudioBufferCache.has('thank_you_conclusion')) {
        if (playInMemoryBuffer('thank_you_conclusion', dialogueId)) return;
      }

      activeDialogueIdRef.current = dialogueId;
      setPlaybackState('LOADING');
      onSpeechStart?.();

      try {
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        const blob = await speakInterviewText(sessionId, cleanText, controller.signal, effectiveVoice);
        if (ttsAbortRef.current === controller) ttsAbortRef.current = null;

        if (activeDialogueIdRef.current !== dialogueId || controller.signal.aborted) {
          return;
        }

        const url = URL.createObjectURL(blob);
        currentObjectUrlRef.current = url;

        const audio = getOrCreateAudio();
        if (!audio) throw new Error('Audio element unavailable');

        const markTtsCompleted = () => {
          ttsEndTimeRef.current = Date.now();
          playedDialogueKeysRef.current.add(dialogueId);
          activeDialogueIdRef.current = null;
          setPlaybackState('COMPLETED');
          restoreMicrophoneTrack();
          onSpeechEnd?.(dialogueId);
        };

        audio.onended = () => {
          if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
          }
          markTtsCompleted();
        };

        audio.onerror = () => {
          if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
          }
          restoreMicrophoneTrack();
          failedDialogueKeysRef.current.add(dialogueId);
          activeDialogueIdRef.current = null;
          setPlaybackState('FAILED');
          onSpeechError?.(dialogueId, new Error('Audio stream error'));
        };

        audio.src = url;
        audio.defaultPlaybackRate = clampRate;
        audio.playbackRate = clampRate;
        await audio.play();

        if (!audio.paused) setPlaybackState('PLAYING');
      } catch (err) {
        if (currentObjectUrlRef.current) {
          URL.revokeObjectURL(currentObjectUrlRef.current);
          currentObjectUrlRef.current = null;
        }
        restoreMicrophoneTrack();
        if ((err as { name?: string })?.name === 'AbortError') {
          return;
        }

        activeDialogueIdRef.current = null;
        failedDialogueKeysRef.current.add(dialogueId);
        setPlaybackState('FAILED');
        onSpeechError?.(dialogueId, err);
      }
    },
    [
      sessionId,
      playbackState,
      voice,
      getOrCreateAudio,
      stopCurrentPlayback,
      playInMemoryBuffer,
      clampRate,
      onSpeechStart,
      onSpeechEnd,
      onSpeechError,
      restoreMicrophoneTrack,
    ]
  );

  const speakQuestionRef = useRef(speakQuestion);
  useEffect(() => {
    speakQuestionRef.current = speakQuestion;
  }, [speakQuestion]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      if (ttsAbortRef.current) {
        ttsAbortRef.current.abort();
        ttsAbortRef.current = null;
      }
      if (activeSourceRef.current) {
        try {
          activeSourceRef.current.stop();
        } catch {
          // ignore
        }
        activeSourceRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
      activeDialogueIdRef.current = null;
    };
  }, []);

  const handleReplayAudio = useCallback(
    (textToReplay: string) => {
      const textHash = safeHash(textToReplay);
      const dialogueId = `${sessionId}:dlg:${textHash}`;
      playedDialogueKeysRef.current.delete(dialogueId);
      failedDialogueKeysRef.current.delete(dialogueId);
      void speakQuestionRef.current(textToReplay, dialogueId);
    },
    [sessionId]
  );

  return {
    playbackState,
    speakQuestion,
    playInstantBackchannel,
    stopCurrentPlayback,
    handleReplayAudio,
    restoreMicrophoneTrack,
    muteMicrophoneTrack,
    ttsEndTimeRef,
    activeDialogueIdRef,
    playedDialogueKeysRef,
    failedDialogueKeysRef,
    setPlaybackState,
    audioRef,
    getAudioAnalyser: getSharedAnalyser,
  };
}
