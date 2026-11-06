'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SpeechTranscriptAccumulator } from './speechTranscript';

export interface UseWebSpeechRecognitionOptions {
  language?: string;
  onTranscriptUpdate?: (displayed: string, committed?: string) => void;
  onFinalTranscript?: (committed: string) => void;
  onInterimUpdate?: (interim: string) => void;
  onSpeechStart?: () => void;
}

export interface UseWebSpeechRecognitionResult {
  isListening: boolean;
  transcript: string;
  committedTranscript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  setTranscript: (text: string) => void;
  getLatestTranscript: () => string;
}

export function useWebSpeechRecognition(
  options: UseWebSpeechRecognitionOptions = {}
): UseWebSpeechRecognitionResult {
  const {
    language = 'en-IN',
    onTranscriptUpdate,
    onFinalTranscript,
    onInterimUpdate,
    onSpeechStart,
  } = options;

  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscriptState] = useState<string>('');
  const [committedTranscript, setCommittedTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldBeListeningRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const languageRef = useRef<string>(language);

  const transcriptAccumulatorRef = useRef<SpeechTranscriptAccumulator>(new SpeechTranscriptAccumulator());

  const consecutiveErrorsRef = useRef<number>(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createAndStartRecognitionRef = useRef<() => void>(() => {});

  const onTranscriptUpdateRef = useRef(onTranscriptUpdate);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onInterimUpdateRef = useRef(onInterimUpdate);
  const onSpeechStartRef = useRef(onSpeechStart);

  useEffect(() => {
    onTranscriptUpdateRef.current = onTranscriptUpdate;
    onFinalTranscriptRef.current = onFinalTranscript;
    onInterimUpdateRef.current = onInterimUpdate;
    onSpeechStartRef.current = onSpeechStart;
  }, [onTranscriptUpdate, onFinalTranscript, onInterimUpdate, onSpeechStart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    setIsSupported(Boolean(SpeechRecognition));
  }, []);

  const publishSnapshot = useCallback((snapshot: ReturnType<SpeechTranscriptAccumulator['snapshot']>) => {
    setCommittedTranscript(snapshot.committed);
    setInterimTranscript(snapshot.interim);
    setTranscriptState(snapshot.displayed);
  }, []);

  // Preserve finalized words across recognition stops/restarts.
  const commitCurrentSession = useCallback(() => {
    const snapshot = transcriptAccumulatorRef.current.endRecognition();
    publishSnapshot(snapshot);
    if (onTranscriptUpdateRef.current && snapshot.displayed) {
      onTranscriptUpdateRef.current(snapshot.displayed, snapshot.committed);
    }
  }, [publishSnapshot]);

  const cleanupActiveRecognition = useCallback(() => {
    if (startingWatchdogRef.current !== null) {
      clearTimeout(startingWatchdogRef.current);
      startingWatchdogRef.current = null;
    }
    commitCurrentSession();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        if (typeof recognitionRef.current.abort === 'function') {
          recognitionRef.current.abort();
        } else {
          recognitionRef.current.stop();
        }
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    isStartingRef.current = false;
  }, [commitCurrentSession]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    cleanupActiveRecognition();
    setIsListening(false);
  }, [cleanupActiveRecognition]);

  const resetTranscript = useCallback(() => {
    publishSnapshot(transcriptAccumulatorRef.current.reset());
  }, [publishSnapshot]);

  const createAndStartRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!shouldBeListeningRef.current) return;
    if (isStartingRef.current) return;
    if (recognitionRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    cleanupActiveRecognition();

    try {
      isStartingRef.current = true;

      // Watchdog: If onstart does not fire within 1500ms, unlock starting state so it never freezes
      if (startingWatchdogRef.current !== null) {
        clearTimeout(startingWatchdogRef.current);
      }
      startingWatchdogRef.current = setTimeout(() => {
        startingWatchdogRef.current = null;
        if (isStartingRef.current) {
          console.warn('[useWebSpeechRecognition] Watchdog: onstart did not fire within 1500ms. Unlocking.');
          isStartingRef.current = false;
          cleanupActiveRecognition();
          if (shouldBeListeningRef.current) {
            createAndStartRecognitionRef.current();
          }
        }
      }, 1500);

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = languageRef.current || 'en-IN';

      recognition.onstart = () => {
        if (startingWatchdogRef.current !== null) {
          clearTimeout(startingWatchdogRef.current);
          startingWatchdogRef.current = null;
        }
        isStartingRef.current = false;
        setIsListening(true);
        consecutiveErrorsRef.current = 0;
        setError(null);
      };

      recognition.onspeechstart = () => {
        if (onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }
      };

      recognition.onsoundstart = () => {
        if (onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }
      };

      recognition.onresult = (event: any) => {
        if (!shouldBeListeningRef.current || !event?.results?.length) return;
        consecutiveErrorsRef.current = 0;

        const previousFinal = transcriptAccumulatorRef.current.getFinalTranscript();
        const snapshot = transcriptAccumulatorRef.current.update(event.results, event.resultIndex ?? 0);
        publishSnapshot(snapshot);

        if (onSpeechStartRef.current) {
          onSpeechStartRef.current();
        }
        if (onTranscriptUpdateRef.current) {
          onTranscriptUpdateRef.current(snapshot.displayed, snapshot.committed);
        }
        if (onInterimUpdateRef.current) {
          onInterimUpdateRef.current(snapshot.interim);
        }
        if (snapshot.committed !== previousFinal && onFinalTranscriptRef.current) {
          onFinalTranscriptRef.current(snapshot.committed);
        }
      };

      recognition.onerror = (event: any) => {
        if (startingWatchdogRef.current !== null) {
          clearTimeout(startingWatchdogRef.current);
          startingWatchdogRef.current = null;
        }
        isStartingRef.current = false;
        const errType = event.error;
        if (errType === 'no-speech' || errType === 'aborted') {
          return;
        }
        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          setError('Microphone access denied for speech recognition.');
          shouldBeListeningRef.current = false;
          setIsListening(false);
          cleanupActiveRecognition();
          return;
        }

        // Transient errors like network drop or audio glitched: back off and auto-recover
        console.warn('[useWebSpeechRecognition] Transient speech engine warning:', errType);
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 8) {
          setError(`Speech recognition: ${errType}`);
          shouldBeListeningRef.current = false;
          setIsListening(false);
          cleanupActiveRecognition();
        }
      };

      recognition.onend = () => {
        if (startingWatchdogRef.current !== null) {
          clearTimeout(startingWatchdogRef.current);
          startingWatchdogRef.current = null;
        }
        if (recognitionRef.current !== recognition) return;
        isStartingRef.current = false;
        recognitionRef.current = null;

        // Atomically preserve all recognized text (finals & interim) before session terminates
        commitCurrentSession();

        if (!shouldBeListeningRef.current) {
          setIsListening(false);
          return;
        }

        if (consecutiveErrorsRef.current >= 8) {
          setIsListening(false);
          shouldBeListeningRef.current = false;
          return;
        }

        // Clean auto-restart with fresh SpeechRecognition instance (250ms backoff for audio release)
        if (restartTimerRef.current !== null) {
          clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (shouldBeListeningRef.current) {
            createAndStartRecognitionRef.current();
          }
        }, 250);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      if (startingWatchdogRef.current !== null) {
        clearTimeout(startingWatchdogRef.current);
        startingWatchdogRef.current = null;
      }
      isStartingRef.current = false;
      recognitionRef.current = null;
      const msg = err?.message || '';
      console.warn('[useWebSpeechRecognition] Start caught error:', msg);
      cleanupActiveRecognition();
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= 8) {
        setError(msg || 'Could not start speech recognition');
        shouldBeListeningRef.current = false;
        setIsListening(false);
      } else {
        if (restartTimerRef.current !== null) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (shouldBeListeningRef.current) createAndStartRecognitionRef.current();
        }, 300);
      }
    }
  }, [cleanupActiveRecognition, commitCurrentSession, publishSnapshot]);

  useEffect(() => {
    createAndStartRecognitionRef.current = createAndStartRecognition;
  }, [createAndStartRecognition]);

  useEffect(() => {
    languageRef.current = language;
    if (shouldBeListeningRef.current && recognitionRef.current) {
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      cleanupActiveRecognition();
      createAndStartRecognition();
    }
  }, [language, createAndStartRecognition, cleanupActiveRecognition]);

  const startListening = useCallback(() => {
    shouldBeListeningRef.current = true;
    consecutiveErrorsRef.current = 0;
    setError(null);
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    createAndStartRecognition();
  }, [createAndStartRecognition]);

  // Clean up recognition and timers on unmount
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (restartTimerRef.current !== null) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      cleanupActiveRecognition();
    };
  }, [cleanupActiveRecognition]);

  const setTranscript = useCallback((text: string) => {
    publishSnapshot(transcriptAccumulatorRef.current.set(text || ''));
  }, [publishSnapshot]);

  const getLatestTranscript = useCallback((): string => {
    return transcriptAccumulatorRef.current.snapshot().displayed;
  }, []);

  return {
    isListening,
    transcript,
    committedTranscript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    getLatestTranscript,
  };
}
