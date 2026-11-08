'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SilenceVADDetector } from '@/lib/media/vad';
import { logAudioEvent, PlaybackState } from '@/lib/hooks/useInterviewerSpeech';
import { transcribeInterviewAudio } from '@/lib/api';
import type { AIState } from '@/components/interview/AIAvatarViewport';
import type { CaptionEntry } from '@/components/interview/LiveClosedCaptions';
import type { AnswerFlowState } from '@/app/candidate/interview/[id]/room/page';

const AUTO_SUBMIT_DELAY_SECONDS = 3;

export interface UseInterviewAudioRecorderOptions {
  sessionId: string;
  stream: MediaStream | null;
  turnIndex: number;
  currentQuestion: string;
  answerFlowState: AnswerFlowState;
  answerFlowStateRef: React.MutableRefObject<AnswerFlowState>;
  setFlowState: (nextState: AnswerFlowState) => void;
  playbackState: PlaybackState;
  isMuted: boolean;
  isSubmitting: boolean;
  isSubmittingRef: React.MutableRefObject<boolean>;
  isConcluding: boolean;
  isAnswerCaptureClosedRef: React.MutableRefObject<boolean>;
  isUserEditingRef: React.MutableRefObject<boolean>;
  candidateAnswer: string;
  candidateAnswerRef: React.MutableRefObject<string>;
  setCandidateAnswer: React.Dispatch<React.SetStateAction<string>>;
  liveTranscript: string;
  liveInterimTranscript: string;
  isWebSpeechSupported: boolean;
  isSpeechRecognizing: boolean;
  startSpeechRecognition: () => void;
  stopSpeechRecognition: () => void;
  resetSpeechRecognition: () => void;
  getLatestTranscript: () => string;
  setAiState: React.Dispatch<React.SetStateAction<AIState>>;
  setSubtitles: React.Dispatch<React.SetStateAction<CaptionEntry[]>>;
  setApiError: (err: string | null) => void;
  hasStartedSpeakingRef: React.MutableRefObject<boolean>;
  onSubmitAnswer: (answerOverride?: string, source?: 'auto' | 'manual') => Promise<void>;
  /** High-speed PCM frames for telephonic barge-in (fed while the AI speaks). */
  onPcmFrame?: (pcm: Float32Array, isVocal: boolean) => void;
}

export interface UseInterviewAudioRecorderReturn {
  autoSubmitCountdown: number | null;
  autoSubmitPending: boolean;
  cancelSilenceTimer: () => void;
  startSilenceTimer: () => void;
  isThinkingPaused: boolean;
  extendThinkingTime: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  releaseRecordingStream: () => void;
  isQuestionEcho: (text: string) => boolean;
  stopVad: () => void;
  vadRef: React.MutableRefObject<SilenceVADDetector | null>;
  recordingStream: MediaStream | null;
}

export function useInterviewAudioRecorder({
  sessionId,
  stream,
  turnIndex,
  currentQuestion,
  answerFlowState,
  answerFlowStateRef,
  setFlowState,
  playbackState,
  isMuted,
  isSubmitting,
  isSubmittingRef,
  isConcluding,
  isAnswerCaptureClosedRef,
  isUserEditingRef,
  candidateAnswer,
  candidateAnswerRef,
  setCandidateAnswer,
  liveTranscript,
  liveInterimTranscript,
  isWebSpeechSupported,
  isSpeechRecognizing,
  startSpeechRecognition,
  stopSpeechRecognition,
  resetSpeechRecognition,
  getLatestTranscript,
  setAiState,
  setSubtitles,
  setApiError,
  hasStartedSpeakingRef,
  onSubmitAnswer,
  onPcmFrame,
}: UseInterviewAudioRecorderOptions): UseInterviewAudioRecorderReturn {
  const onSubmitAnswerRef = useRef(onSubmitAnswer);
  useEffect(() => {
    onSubmitAnswerRef.current = onSubmitAnswer;
  }, [onSubmitAnswer]);

  // Keep the high-frequency PCM feed and the recognition flag behind refs so
  // the VAD is not torn down and rebuilt on every render / recognition toggle.
  const onPcmFrameRef = useRef(onPcmFrame);
  useEffect(() => {
    onPcmFrameRef.current = onPcmFrame;
  }, [onPcmFrame]);

  const isSpeechRecognizingRef = useRef(isSpeechRecognizing);
  useEffect(() => {
    isSpeechRecognizingRef.current = isSpeechRecognizing;
  }, [isSpeechRecognizing]);

  // Echo check against active interviewer question
  const isQuestionEcho = useCallback(
    (text: string): boolean => {
      if (!currentQuestion || !text) return false;
      const normText = text?.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const normQ = currentQuestion?.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (!normText || !normQ) return false;
      if (normQ.includes(normText) || normText.includes(normQ)) return true;

      const textWords = new Set(normText.split(/\s+/).filter((w) => w.length > 2));
      const qWords = normQ.split(/\s+/).filter((w) => w.length > 2);
      if (textWords.size === 0 || qWords.length === 0) return false;

      let matchCount = 0;
      for (const w of qWords) {
        if (textWords.has(w)) matchCount++;
      }
      return matchCount / Math.max(textWords.size, 1) > 0.55;
    },
    [currentQuestion]
  );

  // Submit after continuous silence is detected (generous thinking window).
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const [autoSubmitPending, setAutoSubmitPending] = useState<boolean>(false);
  const [isThinkingPaused, setIsThinkingPaused] = useState<boolean>(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerVersionRef = useRef<number>(0);

  const extendThinkingTime = useCallback(() => {
    if (silenceIntervalRef.current !== null) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    silenceTimerVersionRef.current = 0;
    setAutoSubmitPending(false);
    setAutoSubmitCountdown(null);
    setIsThinkingPaused(true);
    // Give 45 seconds of peaceful thinking time without auto-cutoff
    setTimeout(() => {
      setIsThinkingPaused(false);
    }, 45000);
  }, []);

  const liveTranscriptRef = useRef(liveTranscript);
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  const cancelSilenceTimer = useCallback(() => {
    if (silenceIntervalRef.current !== null) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    silenceTimerVersionRef.current = 0;
    setAutoSubmitPending(false);
    setAutoSubmitCountdown(null);
  }, []);

  const startSilenceTimer = useCallback(() => {
    if (isThinkingPaused) return;
    if (silenceIntervalRef.current !== null) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (isAnswerCaptureClosedRef.current || isSubmittingRef.current) return;
    if (answerFlowStateRef.current !== 'SILENCE_PENDING' && answerFlowStateRef.current !== 'ANSWER_ACTIVE') return;

    const version = ++silenceTimerVersionRef.current;
    let remaining = AUTO_SUBMIT_DELAY_SECONDS;
    setAutoSubmitCountdown(remaining);
    setAutoSubmitPending(true);

    silenceIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setAutoSubmitCountdown(remaining);
      } else {
        if (silenceIntervalRef.current !== null) {
          clearInterval(silenceIntervalRef.current);
          silenceIntervalRef.current = null;
        }
      }
    }, 1000);

    silenceTimerRef.current = setTimeout(() => {
      if (silenceTimerVersionRef.current !== version) return;
      if (isAnswerCaptureClosedRef.current || isSubmittingRef.current) return;
      cancelSilenceTimer();
      void onSubmitAnswerRef.current(undefined, 'auto');
    }, AUTO_SUBMIT_DELAY_SECONDS * 1000);
  }, [cancelSilenceTimer, isAnswerCaptureClosedRef, isSubmittingRef, answerFlowStateRef]);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  // Conversational two-way auto-listening trigger
  useEffect(() => {
    if (
      (answerFlowState === 'LISTENING_FOR_ANSWER' ||
        answerFlowState === 'ANSWER_ACTIVE' ||
        answerFlowState === 'SILENCE_PENDING') &&
      playbackState !== 'PLAYING' &&
      !isMuted &&
      !isSubmitting &&
      !isTranscribing &&
      !isConcluding &&
      !isUserEditingRef.current &&
      !isAnswerCaptureClosedRef.current &&
      Boolean(currentQuestion)
    ) {
      if (isWebSpeechSupported && !isSpeechRecognizing) {
        startSpeechRecognition();
      }
    } else if (answerFlowState === 'AI_SPEAKING' || playbackState === 'PLAYING' || isAnswerCaptureClosedRef.current) {
      if (isSpeechRecognizing) {
        stopSpeechRecognition();
      }
    }
  }, [
    answerFlowState,
    playbackState,
    isMuted,
    isSubmitting,
    isTranscribing,
    isConcluding,
    Boolean(currentQuestion),
    isWebSpeechSupported,
    isSpeechRecognizing,
    startSpeechRecognition,
    stopSpeechRecognition,
    isUserEditingRef,
    isAnswerCaptureClosedRef,
  ]);

  // Live audio track managed independently of the LiveKit stream
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordingTrackEnabled, setRecordingTrackEnabled] = useState<boolean | null>(null);
  const vadRef = useRef<SilenceVADDetector | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const stopVad = useCallback(() => {
    if (vadRef.current) {
      vadRef.current.stop();
      vadRef.current = null;
    }
  }, []);

  // Automatic Voice Activity Detection (VAD) loop during listening states
  useEffect(() => {
    const vadAudioStream = recordingStream || stream;

    const isAiSpeaking = answerFlowState === 'AI_SPEAKING' || playbackState === 'PLAYING';
    const isValidState =
      answerFlowState === 'LISTENING_FOR_ANSWER' ||
      answerFlowState === 'ANSWER_ACTIVE' ||
      answerFlowState === 'SILENCE_PENDING' ||
      isAiSpeaking;

    if (
      !isValidState ||
      !vadAudioStream ||
      !sessionId ||
      isSubmitting ||
      isMuted
    ) {
      stopVad();
      return;
    }

    const audioTrack = vadAudioStream.getAudioTracks()[0];
    if (!audioTrack || audioTrack.readyState !== 'live') {
      setRecordingStream(null);
      setRecordingTrackEnabled(null);
      stopVad();
      return;
    }

    const vad = new SilenceVADDetector({
      rmsSpeechStartThreshold: 0.015,
      rmsSpeechEndThreshold: 0.008,
      minSpeechDurationMs: 120,
      speechHangoverMs: 800,
      silenceDurationMs: 1500,
    });
    vadRef.current = vad;

    vad.onSpeechStart = () => {
      if (isSubmittingRef.current) return;
      if (
        answerFlowStateRef.current === 'SUBMITTING' ||
        answerFlowStateRef.current === 'EVALUATING'
      )
        return;

      // Barge-in is owned by TelephonicBargeInController (fed through
      // onPcmFrame below), so this handler only opens the normal answer window.
      if (isAnswerCaptureClosedRef.current) return;

      logAudioEvent('VAD_SPEECH_START', { session_id: sessionId, turn_index: turnIndex });
      hasStartedSpeakingRef.current = true;
      cancelSilenceTimer();
      setFlowState('ANSWER_ACTIVE');

      if (!isUserEditingRef.current && isWebSpeechSupported && !isSpeechRecognizingRef.current) {
        startSpeechRecognition();
      }
    };

    vad.onSpeechPause = () => {
      if (isAnswerCaptureClosedRef.current || isSubmittingRef.current) return;
      if (answerFlowStateRef.current !== 'ANSWER_ACTIVE') return;

      const currentAnswer = (
        isUserEditingRef.current
          ? candidateAnswerRef.current
          : candidateAnswerRef.current || getLatestTranscript()
      ).trim();
      const wordCount = currentAnswer.split(/\s+/).filter(Boolean).length;
      const hasSpokenContent = wordCount >= 1 || currentAnswer.length >= 4 || hasStartedSpeakingRef.current;

      if (hasSpokenContent && !isQuestionEcho(currentAnswer) && !isUserEditingRef.current) {
        logAudioEvent('VAD_SPEECH_PAUSE_ARMING_COUNTDOWN', {
          session_id: sessionId,
          turn_index: turnIndex,
          answer_len: currentAnswer.length,
        });
        setFlowState('SILENCE_PENDING');
        startSilenceTimer();
      } else if (!hasSpokenContent && !isUserEditingRef.current) {
        // Prevent deadlock: If no words captured after 3s pause, revert to LISTENING_FOR_ANSWER
        setFlowState('LISTENING_FOR_ANSWER');
        cancelSilenceTimer();
      }
    };

    vad.onPcmFrame = (pcm, isVocal) => {
      onPcmFrameRef.current?.(pcm, isVocal);
    };

    vad.start(vadAudioStream);

    return () => {
      vad.stop();
      vadRef.current = null;
    };
  }, [
    answerFlowState,
    playbackState,
    recordingStream,
    stream,
    sessionId,
    isSubmitting,
    isMuted,
    turnIndex,
    isWebSpeechSupported,
    startSpeechRecognition,
    cancelSilenceTimer,
    startSilenceTimer,
    setFlowState,
    getLatestTranscript,
    isQuestionEcho,
    isAnswerCaptureClosedRef,
    isSubmittingRef,
    answerFlowStateRef,
    hasStartedSpeakingRef,
    isUserEditingRef,
    candidateAnswerRef,
    stopVad,
  ]);

  // Fallback: Arm silence countdown if no interim speech received for 6.0s in ANSWER_ACTIVE
  useEffect(() => {
    if (answerFlowState !== 'ANSWER_ACTIVE') return;
    if (isUserEditingRef.current || isAnswerCaptureClosedRef.current || isSubmitting) return;

    const currentAnswer = (candidateAnswer || liveTranscript || '').trim();
    const wordCount = currentAnswer.split(/\s+/).filter(Boolean).length;
    if (currentAnswer.length < 25 || wordCount < 5 || isQuestionEcho(currentAnswer)) return;

    if (liveInterimTranscript.trim().length > 0) {
      return;
    }

    const timer = setTimeout(() => {
      if (
        answerFlowStateRef.current === 'ANSWER_ACTIVE' &&
        !isAnswerCaptureClosedRef.current &&
        !isSubmittingRef.current
      ) {
        setFlowState('SILENCE_PENDING');
        startSilenceTimer();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    answerFlowState,
    candidateAnswer,
    liveTranscript,
    liveInterimTranscript,
    isSubmitting,
    isQuestionEcho,
    setFlowState,
    startSilenceTimer,
    isUserEditingRef,
    isAnswerCaptureClosedRef,
    answerFlowStateRef,
    isSubmittingRef,
  ]);

  // Acquire a fresh audio-only MediaStream whose track is guaranteed live
  const acquireLiveAudioStream = useCallback(async (): Promise<{
    stream: MediaStream;
    track: MediaStreamTrack;
  } | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setApiError('getUserMedia is not available in this browser. Type your answer instead.');
      return null;
    }

    if (recordingStream && recordingStream.getAudioTracks().length > 0) {
      const existingTrack = recordingStream.getAudioTracks()[0];
      if (existingTrack.readyState === 'live') {
        if (recordingTrackEnabled === false) {
          existingTrack.enabled = true;
          setRecordingTrackEnabled(true);
        }
        return { stream: recordingStream, track: existingTrack };
      } else {
        try {
          existingTrack.stop();
        } catch {}
        setRecordingStream(null);
        setRecordingTrackEnabled(null);
      }
    }

    let freshStream: MediaStream | null = null;
    let track: MediaStreamTrack | null = null;

    try {
      freshStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
        },
        video: false,
      });
      track = freshStream.getAudioTracks()[0];
      if (!track) {
        setApiError('No audio track found in newly acquired stream. Type your answer instead.');
        freshStream.getTracks().forEach((t) => t.stop());
        return null;
      }
      setRecordingStream(freshStream);
      setRecordingTrackEnabled(true);
      return { stream: freshStream, track };
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      const errName = (errObj.name || '').toLowerCase();
      const errMsg = errObj.message || String(err);

      if (errName === 'notallowederror' || errMsg.includes('permission denied') || errMsg.includes('not allowed')) {
        setApiError('Microphone permission denied. Type your answer instead.');
      } else if (
        errName === 'notfounderror' ||
        errMsg.includes('no microphone') ||
        errMsg.includes('device not found')
      ) {
        setApiError('No microphone found. Type your answer instead.');
      } else if (
        errName === 'notreadableerror' ||
        errMsg.includes('not readable') ||
        errMsg.includes('device in use')
      ) {
        setApiError('Microphone in use by another application. Type your answer instead.');
      } else {
        setApiError(`Microphone could not be accessed: ${errMsg}. Type your answer instead.`);
      }
      console.error('[startRecording] getUserMedia error:', err);
      return null;
    }
  }, [recordingStream, recordingTrackEnabled, setApiError]);

  // Helper: stop only the tracks we created for recording
  const releaseRecordingStream = useCallback(() => {
    if (recordingStream) {
      recordingStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      setRecordingStream(null);
      setRecordingTrackEnabled(null);
    }
  }, [recordingStream]);

  // Real voice capture: MediaRecorder manual audio option for fallback
  const startRecording = useCallback(async () => {
    if (!sessionId) return;

    const acquired = await acquireLiveAudioStream();
    if (!acquired) return;

    const { stream: freshStream } = acquired;

    if (typeof MediaRecorder === 'undefined') {
      setApiError('Audio recording is not supported in this browser. Type your answer instead.');
      releaseRecordingStream();
      return;
    }

    try {
      stopVad();

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const chosenMimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported?.(type)) || mimeTypes[1];

      const recorder = new MediaRecorder(freshStream, { mimeType: chosenMimeType });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stopSpeechRecognition();
        setIsRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: chosenMimeType || 'audio/webm' });
        recordedChunksRef.current = [];
        if (blob.size === 0) {
          setAiState('listening');
          releaseRecordingStream();
          return;
        }
        setIsTranscribing(true);
        setAiState('transcribing');
        try {
          const transcript = await transcribeInterviewAudio(sessionId, blob);
          const text = transcript.trim();
          setIsTranscribing(false);
          const answerText = text || liveTranscriptRef.current.trim();
          if (answerText) {
            setCandidateAnswer(answerText);
            resetSpeechRecognition();
            isUserEditingRef.current = false;
            setSubtitles((prev) => [
              ...prev,
              { id: `a-${turnIndex}-${Date.now()}`, speaker: 'You', text: answerText },
            ]);
            setAiState('evaluating');
            await onSubmitAnswerRef.current(answerText);
          } else {
            setAiState('listening');
          }
        } catch (err) {
          setIsTranscribing(false);
          const errMsg =
            err instanceof Error ? err.message : 'Your answer could not be transcribed. Please record again.';
          console.warn('[startRecording] transcription error:', err);
          if (liveTranscriptRef.current.trim() && !candidateAnswerRef.current.trim()) {
            setCandidateAnswer(liveTranscriptRef.current.trim());
          }
          setApiError(
            errMsg + ' Your recognized answer has been preserved below. You can edit and submit it, or record again.'
          );
          setAiState('listening');
        } finally {
          setIsTranscribing(false);
          releaseRecordingStream();
        }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setIsRecording(true);
      isUserEditingRef.current = false;
      if (isWebSpeechSupported) {
        resetSpeechRecognition();
        startSpeechRecognition();
      }

      stopVad();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Microphone recording could not start.';
      setApiError(errMsg);
      console.error('[startRecording] unexpected error:', err);
      setAiState('listening');
      releaseRecordingStream();
    }
  }, [
    sessionId,
    acquireLiveAudioStream,
    releaseRecordingStream,
    stopVad,
    stopSpeechRecognition,
    resetSpeechRecognition,
    startSpeechRecognition,
    isWebSpeechSupported,
    setAiState,
    setCandidateAnswer,
    isUserEditingRef,
    setSubtitles,
    turnIndex,
    candidateAnswerRef,
    setApiError,
  ]);

  const stopRecording = useCallback(() => {
    stopSpeechRecognition();
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [stopSpeechRecognition]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelSilenceTimer();
      stopVad();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (recordingStream) {
        recordingStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      }
    };
  }, [cancelSilenceTimer, recordingStream, stopVad]);

  return {
    autoSubmitCountdown,
    autoSubmitPending,
    cancelSilenceTimer,
    startSilenceTimer,
    isThinkingPaused,
    extendThinkingTime,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    releaseRecordingStream,
    isQuestionEcho,
    stopVad,
    vadRef,
    recordingStream,
  };
}
