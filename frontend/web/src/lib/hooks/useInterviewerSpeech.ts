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
   * Playback rate for interviewer audio. Kept at 1.25 to match existing
   * interview behaviour; exposed so it can be tuned without code changes
   * (V-12). Values outside 0.5-2.0 are clamped.
   */
  playbackRate?: number;
  /**
   * TTS voice selection for interviewer audio.
   * Only English and Hinglish variants supported:
   * - "en": English (default, OpenAI nova/alloy, Azure en-US-AvaNeural)
   * - "hinglish": Hinglish (Hindi-English mix with Hindi intonation patterns)
   * - "default": Uses provider-configured default (English)
   * (V-24) Exposed so interview sessions can customize interviewer voice language.
   */
  voice?: "en" | "hinglish" | "default";
}

export interface UseInterviewerSpeechReturn {
  playbackState: PlaybackState;
  speakQuestion: (text: string, dialogueKey?: string, voice?: 'en' | 'hinglish' | 'default' | string) => Promise<void>;
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
}

/** Clamp interviewer playback rate to a safe, natural range (V-12). */
export const clampPlaybackRate = (rate: number): number =>
  Math.min(2, Math.max(0.5, Number.isFinite(rate) ? rate : 1.0));

export const safeHash = (text: string): string => {
  let hash = 0;
  const str = text.trim().toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
};

export const logAudioEvent = (event: string, details: Record<string, unknown>) => {};

export function useInterviewerSpeech({
  sessionId,
  stream,
  isMutedRef,
  onSpeechStart,
  onSpeechEnd,
  onSpeechError,
  playbackRate = 1.0,
}: UseInterviewerSpeechOptions): UseInterviewerSpeechReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('IDLE');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const activeDialogueIdRef = useRef<string | null>(null);
  const playedDialogueKeysRef = useRef<Set<string>>(new Set());
  const failedDialogueKeysRef = useRef<Set<string>>(new Set());
  const ttsEndTimeRef = useRef<number>(0);
  // Aborts superseded in-flight /speak requests (V-05): one live controller
  // at a time; a new speak or a stop cancels the previous fetch.
  const ttsAbortRef = useRef<AbortController | null>(null);
  // V-08: the browser-fallback voice is chosen once per session so the
  // interviewer's voice identity cannot change mid-interview.
  const fallbackVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const clampRate = clampPlaybackRate(playbackRate);

  const getFemaleVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    // V-08: reuse the first voice ever chosen for this session; re-scanning
    // per utterance let OS voice-list changes swap identity mid-interview.
    if (fallbackVoiceRef.current) return fallbackVoiceRef.current;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const englishVoices = voices.filter((v) => v.lang.startsWith('en'));
    const candidatePool = englishVoices.length > 0 ? englishVoices : voices;

    const femaleRegex =
      /female|woman|zira|samantha|victoria|karen|hazel|jenny|aria|sonia|michelle|claire|emma|catherine|eva|susan|heera|neerja|sunita|liberty|fiona|veena|moira|google us english|wavenet-[acef]|neural2-[acf]|standard-[acef]/i;
    const femaleVoice = candidatePool.find((v) => femaleRegex.test(v.name));
    if (femaleVoice) {
      fallbackVoiceRef.current = femaleVoice;
      return femaleVoice;
    }

    const maleRegex =
      /male|man|boy|david|mark|george|james|richard|alex|fred|guy|daniel|oliver|thomas|stefan|pavel|diego|wavenet-[bd]|neural2-[bd]|standard-[bd]/i;
    const nonMaleVoice = candidatePool.find((v) => !maleRegex.test(v.name));
    if (nonMaleVoice) {
      fallbackVoiceRef.current = nonMaleVoice;
      return nonMaleVoice;
    }

    const first = candidatePool[0] || null;
    fallbackVoiceRef.current = first;
    return first;
  }, []);

  const getOrCreateAudio = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.defaultPlaybackRate = clampRate;
      audio.playbackRate = clampRate;
      if ('preservesPitch' in audio) {
        audio.preservesPitch = true;
      } else if ('mozPreservesPitch' in audio) {
        (audio as any).mozPreservesPitch = true;
      } else if ('webkitPreservesPitch' in audio) {
        (audio as any).webkitPreservesPitch = true;
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
      // V-05: a superseded speak must not leave a provider request running
      // (wasted cost + late-response races).
      if (ttsAbortRef.current) {
        ttsAbortRef.current.abort();
        ttsAbortRef.current = null;
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

  const speakQuestion = useCallback(
    async (text: string, dialogueKey?: string, voice?: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      const textHash = safeHash(cleanText);
      const dialogueId = dialogueKey || `${sessionId}:dlg:${textHash}`;
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const playbackId = `pb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      logAudioEvent('SPEAK_FUNCTION_CALLED', {
        dialogue_id: dialogueId,
        request_id: requestId,
        playback_id: playbackId,
        text_hash: textHash,
        active_dialogue: activeDialogueIdRef.current,
        playback_state: playbackState,
        voice,
      });

      if (
        activeDialogueIdRef.current === dialogueId &&
        (playbackState === 'PLAYING' || playbackState === 'LOADING')
      ) {
        logAudioEvent('AUDIO_PLAY_SKIPPED_ACTIVE', { dialogue_id: dialogueId, playback_state: playbackState });
        return;
      }

      if (playedDialogueKeysRef.current.has(dialogueId) || failedDialogueKeysRef.current.has(dialogueId)) {
        logAudioEvent('AUDIO_PLAY_SKIPPED_COMPLETED_OR_FAILED', { dialogue_id: dialogueId });
        onSpeechEnd?.(dialogueId);
        return;
      }

      stopCurrentPlayback('starting_new_dialogue');

      activeDialogueIdRef.current = dialogueId;
      setPlaybackState('LOADING');
      onSpeechStart?.();

      try {
        logAudioEvent('TTS_REQUEST_START', { dialogue_id: dialogueId, request_id: requestId, text_hash: textHash });
        const controller = new AbortController();
        ttsAbortRef.current = controller;
        const blob = await speakInterviewText(sessionId, cleanText, controller.signal, voice);
        if (ttsAbortRef.current === controller) ttsAbortRef.current = null;
        logAudioEvent('TTS_REQUEST_END', { dialogue_id: dialogueId, request_id: requestId, blob_size: blob.size });

        if (activeDialogueIdRef.current !== dialogueId || controller.signal.aborted) {
          logAudioEvent('TTS_CANCELLED_IN_FLIGHT', {
            dialogue_id: dialogueId,
            active_dialogue: activeDialogueIdRef.current,
          });
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
          logAudioEvent('AUDIO_ENDED', { dialogue_id: dialogueId, playback_id: playbackId });
          if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
          }
          markTtsCompleted();
        };

        audio.onerror = () => {
          logAudioEvent('AUDIO_FAILED_TRYING_SPEECH_SYNTHESIS', { dialogue_id: dialogueId, playback_id: playbackId });
          if (currentObjectUrlRef.current) {
            URL.revokeObjectURL(currentObjectUrlRef.current);
            currentObjectUrlRef.current = null;
          }
          restoreMicrophoneTrack();
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 0.98;
            utterance.pitch = 1.02;
            const femaleVoice = getFemaleVoice();
            if (femaleVoice) utterance.voice = femaleVoice;
            utterance.onend = () => {
              playedDialogueKeysRef.current.add(dialogueId);
              activeDialogueIdRef.current = null;
              setPlaybackState('COMPLETED');
              restoreMicrophoneTrack();
              onSpeechEnd?.(dialogueId);
            };
            utterance.onerror = () => {
              activeDialogueIdRef.current = null;
              setPlaybackState('IDLE');
              restoreMicrophoneTrack();
              onSpeechError?.(dialogueId, new Error('speechSynthesis failed'));
            };
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
            setPlaybackState('PLAYING');
            return;
          }
          failedDialogueKeysRef.current.add(dialogueId);
          activeDialogueIdRef.current = null;
          setPlaybackState('IDLE');
          restoreMicrophoneTrack();
          onSpeechError?.(dialogueId, new Error('Audio error and speechSynthesis unavailable'));
        };

        audio.src = url;
        audio.defaultPlaybackRate = clampRate;
        audio.playbackRate = clampRate;
        if ('preservesPitch' in audio) {
          audio.preservesPitch = true;
        } else if ('mozPreservesPitch' in audio) {
          (audio as any).mozPreservesPitch = true;
        } else if ('webkitPreservesPitch' in audio) {
          (audio as any).webkitPreservesPitch = true;
        }
        logAudioEvent('AUDIO_PLAY_REQUESTED', {
          dialogue_id: dialogueId,
          playback_id: playbackId,
          playback_rate: audio.playbackRate,
        });
        await audio.play();
        logAudioEvent('AUDIO_PLAYING', {
          dialogue_id: dialogueId,
          playback_id: playbackId,
          playback_rate: audio.playbackRate,
        });
        // The mic must stay live while the interviewer speaks: barge-in
        // detection reads this same stream. A barge-in can pause the element
        // while play() is resolving, so only report PLAYING if it really is.
        if (!audio.paused) setPlaybackState('PLAYING');
      } catch (err) {
        if (currentObjectUrlRef.current) {
          URL.revokeObjectURL(currentObjectUrlRef.current);
          currentObjectUrlRef.current = null;
        }
        restoreMicrophoneTrack();
        // A deliberate abort (superseded speak / teardown) is not a provider
        // failure: never fall back to browser speechSynthesis for it.
        if ((err as any)?.name === 'AbortError') {
          logAudioEvent('TTS_REQUEST_ABORTED', { dialogue_id: dialogueId, request_id: requestId });
          return;
        }
        logAudioEvent('TTS_NETWORK_OR_SERVER_ERROR_FALLBACK', {
          dialogue_id: dialogueId,
          error: String(err),
          error_code: (err as any)?.errorCode,
          message: (err as any)?.message,
        });
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = clampRate;
          const femaleVoice = getFemaleVoice();
          if (femaleVoice) utterance.voice = femaleVoice;
          utterance.onend = () => {
            logAudioEvent('SPEECH_SYNTHESIS_COMPLETED', { dialogue_id: dialogueId });
            playedDialogueKeysRef.current.add(dialogueId);
            activeDialogueIdRef.current = null;
            setPlaybackState('COMPLETED');
            restoreMicrophoneTrack();
            onSpeechEnd?.(dialogueId);
          };
          utterance.onerror = (e) => {
            logAudioEvent('SPEECH_SYNTHESIS_ERROR', { dialogue_id: dialogueId, error: e.error });
            activeDialogueIdRef.current = null;
            setPlaybackState('IDLE');
            restoreMicrophoneTrack();
            onSpeechError?.(dialogueId, e);
          };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
          setPlaybackState('PLAYING');
          return;
        }
        activeDialogueIdRef.current = null;
        failedDialogueKeysRef.current.add(dialogueId);
        setPlaybackState('IDLE');
        onSpeechError?.(dialogueId, err);
      }
    },
    [
      sessionId,
      playbackState,
      getOrCreateAudio,
      stopCurrentPlayback,
      restoreMicrophoneTrack,
      getFemaleVoice,
      clampRate,
      onSpeechStart,
      onSpeechEnd,
      onSpeechError,
    ]
  );

  const speakQuestionRef = useRef(speakQuestion);
  useEffect(() => {
    speakQuestionRef.current = speakQuestion;
  }, [speakQuestion]);

  // V-04: teardown on unmount or room refresh. Without this, an in-flight
  // /speak response or a browser speechSynthesis utterance could keep playing
  // after the candidate left the room.
  useEffect(() => {
    return () => {
      if (ttsAbortRef.current) {
        ttsAbortRef.current.abort();
        ttsAbortRef.current = null;
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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      activeDialogueIdRef.current = null;
      logAudioEvent('AUDIO_TORN_DOWN', { reason: 'unmount' });
    };
  }, []);

  const handleReplayAudio = useCallback(
    (textToReplay: string) => {
      const textHash = safeHash(textToReplay);
      const dialogueId = `${sessionId}:dlg:${textHash}`;
      logAudioEvent('MANUAL_REPLAY_REQUESTED', { dialogue_id: dialogueId, text_hash: textHash });
      playedDialogueKeysRef.current.delete(dialogueId);
      failedDialogueKeysRef.current.delete(dialogueId);
      void speakQuestionRef.current(textToReplay, dialogueId);
    },
    [sessionId]
  );

  // Full-Duplex Telephonic Audio Pipeline:
  // We do NOT mute the candidate microphone while the AI is speaking.
  // The browser Acoustic Echo Cancellation (AEC) isolates caller voice,
  // allowing TelephonicBargeInController to detect interruptions with sub-200ms latency.

  return {
    playbackState,
    speakQuestion,
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
  };
}
