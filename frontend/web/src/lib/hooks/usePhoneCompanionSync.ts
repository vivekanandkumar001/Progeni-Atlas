'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectionState } from 'livekit-client';
import { apiFetch } from '@/lib/api';
import { evaluateRepairAttempt } from '@/lib/media/repairGuard';

export interface UsePhoneCompanionSyncOptions {
  source: string;
  phoneStatus: ConnectionState | string;
  sessionId: string;
  startPairing: () => void;
}

export interface UsePhoneCompanionSyncReturn {
  isPhoneDisconnected: boolean;
  reconnectCountdown: number;
  isPhoneTerminalFailure: boolean;
  setIsPhoneTerminalFailure: React.Dispatch<React.SetStateAction<boolean>>;
  resetPairAttempts: () => void;
}

export function usePhoneCompanionSync({
  source,
  phoneStatus,
  sessionId,
  startPairing,
}: UsePhoneCompanionSyncOptions): UsePhoneCompanionSyncReturn {
  const [reconnectCountdown, setReconnectCountdown] = useState<number>(60);
  const isPhoneDisconnected =
    source === 'phone' &&
    (phoneStatus === ConnectionState.Disconnected || (phoneStatus as string) === 'disconnected');

  const lastPairAttemptRef = useRef<number>(0);
  const pairAttemptsRef = useRef<number>(0);
  const [isPhoneTerminalFailure, setIsPhoneTerminalFailure] = useState<boolean>(false);

  const prevPhoneStatusRef = useRef(phoneStatus);
  useEffect(() => {
    const prevStatus = prevPhoneStatusRef.current;
    prevPhoneStatusRef.current = phoneStatus;

    if (source !== 'phone') return;

    const isNowDisconnected =
      phoneStatus === ConnectionState.Disconnected || (phoneStatus as string) === 'disconnected';
    const wasDisconnected =
      prevStatus === ConnectionState.Disconnected || (prevStatus as string) === 'disconnected';
    const isNowConnected =
      phoneStatus === ConnectionState.Connected || (phoneStatus as string) === 'connected';

    if (isNowDisconnected && !wasDisconnected) {
      const decision = evaluateRepairAttempt(
        lastPairAttemptRef.current,
        pairAttemptsRef.current,
        3,
        10000
      );

      if (decision.terminal) {
        setIsPhoneTerminalFailure(true);
        return;
      }

      if (!decision.allowed) {
        console.warn(`[Re-pair Guard] Re-pairing attempt suppressed: ${decision.reason}`);
        return;
      }

      lastPairAttemptRef.current = Date.now();
      pairAttemptsRef.current += 1;

      apiFetch(`/api/v1/interview-sessions/${sessionId}/companion/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone_disconnected',
          details: {
            reason: 'phone_feed_dropped',
            timestamp: new Date().toISOString(),
            attempt: pairAttemptsRef.current,
          },
        }),
      }).catch((err) => console.warn('Failed to log phone_disconnected event:', err));

      startPairing();
    }

    if (isNowConnected && wasDisconnected) {
      pairAttemptsRef.current = 0;
      lastPairAttemptRef.current = 0;
      setIsPhoneTerminalFailure(false);

      apiFetch(`/api/v1/interview-sessions/${sessionId}/companion/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone_reconnected',
          details: { timestamp: new Date().toISOString() },
        }),
      }).catch((err) => console.warn('Failed to log phone_reconnected event:', err));
    }
  }, [source, phoneStatus, sessionId, startPairing]);

  useEffect(() => {
    if (!isPhoneDisconnected) return;
    const timer = setInterval(() => {
      setReconnectCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPhoneDisconnected]);

  const resetPairAttempts = useCallback(() => {
    pairAttemptsRef.current = 0;
    lastPairAttemptRef.current = 0;
    setIsPhoneTerminalFailure(false);
  }, []);

  return {
    isPhoneDisconnected,
    reconnectCountdown,
    isPhoneTerminalFailure,
    setIsPhoneTerminalFailure,
    resetPairAttempts,
  };
}
