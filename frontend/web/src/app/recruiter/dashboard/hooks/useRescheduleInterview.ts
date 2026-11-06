'use client';

import { useState } from 'react';
import type React from 'react';
import { apiFetch } from '@/lib/api';
import type { CandidateDossier } from '../dashboard-types';
import type { showToastFn } from './useToast';

export function useRescheduleInterview({
  setCandidates,
  selectedCandidate,
  setSelectedCandidate,
  showToast,
  walletBalance,
}: {
  setCandidates: (updater: (prev: CandidateDossier[]) => CandidateDossier[]) => void;
  selectedCandidate: CandidateDossier | null;
  setSelectedCandidate: (updater: (prev: CandidateDossier | null) => CandidateDossier | null) => void;
  showToast: showToastFn;
  walletBalance?: number | null;
}) {
  const isZeroBalance = walletBalance !== undefined && walletBalance !== null && walletBalance <= 0;

  // RESCHEDULE MODAL STATES
  const [rescheduleCandidate, setRescheduleCandidate] = useState<CandidateDossier | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [rescheduleNotify, setRescheduleNotify] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);

  // OPEN RESCHEDULE MODAL
  const handleOpenReschedule = (cand: CandidateDossier) => {
    setRescheduleCandidate(cand);
    if (cand.scheduledDate) {
      setRescheduleDate(cand.scheduledDate);
      setRescheduleTime(cand.scheduledTime || '10:00');
    } else if (cand.scheduledAt) {
      try {
        const d = new Date(cand.scheduledAt);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setRescheduleDate(`${yyyy}-${mm}-${dd}`);
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setRescheduleTime(`${hh}:${min}`);
      } catch {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        setRescheduleDate(d.toISOString().split('T')[0]);
        setRescheduleTime('10:00');
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setRescheduleDate(d.toISOString().split('T')[0]);
      setRescheduleTime('10:00');
    }
    setRescheduleMessage('');
    setRescheduleNotify(true);
  };

  // SUBMIT RESCHEDULE REQUEST
  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isZeroBalance) {
      showToast('Your credit balance is 0. Please recharge your wallet before rescheduling an interview.', 'error');
      return;
    }
    if (!rescheduleCandidate || !rescheduleCandidate.sessionId) {
      showToast('Interview session ID is missing for this candidate.', 'error');
      return;
    }
    if (!rescheduleDate) {
      showToast('Please select a valid date.', 'error');
      return;
    }

    try {
      setRescheduling(true);
      const res = await apiFetch(`/api/recruiter/sessions/${rescheduleCandidate.sessionId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          interviewDate: rescheduleDate,
          interviewTime: rescheduleTime,
          message: rescheduleMessage,
          notify: rescheduleNotify,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule interview');
      }

      showToast(
        `Interview rescheduled for ${rescheduleCandidate.name}${rescheduleNotify ? ' and notification sent!' : '.'}`,
        'success'
      );

      const updatedScheduledAt = data.scheduledAt || `${rescheduleDate}T${rescheduleTime}:00`;
      setCandidates((prev) =>
        prev.map((c) =>
          c.sessionId === rescheduleCandidate.sessionId
            ? {
                ...c,
                scheduledAt: updatedScheduledAt,
                scheduledDate: rescheduleDate,
                scheduledTime: rescheduleTime,
                status: 'Scheduled',
                stage: 'Intro',
                studentStatus: 'inprocess',
                hiringStatus: 'in_process',
                recommendation: 'PENDING',
              }
            : c
        )
      );
      if (selectedCandidate?.sessionId === rescheduleCandidate.sessionId) {
        setSelectedCandidate((prev) =>
          prev
            ? {
                ...prev,
                scheduledAt: updatedScheduledAt,
                scheduledDate: rescheduleDate,
                scheduledTime: rescheduleTime,
                status: 'Scheduled',
                stage: 'Intro',
                studentStatus: 'inprocess',
                hiringStatus: 'in_process',
                recommendation: 'PENDING',
              }
            : null
        );
      }

      setRescheduleCandidate(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to reschedule interview', 'error');
    } finally {
      setRescheduling(false);
    }
  };

  return {
    rescheduleCandidate,
    setRescheduleCandidate,
    rescheduleDate,
    setRescheduleDate,
    rescheduleTime,
    setRescheduleTime,
    rescheduleMessage,
    setRescheduleMessage,
    rescheduleNotify,
    setRescheduleNotify,
    rescheduling,
    isZeroBalance,
    handleOpenReschedule,
    handleConfirmReschedule,
  };
}

export type UseRescheduleInterviewReturn = ReturnType<typeof useRescheduleInterview>;
