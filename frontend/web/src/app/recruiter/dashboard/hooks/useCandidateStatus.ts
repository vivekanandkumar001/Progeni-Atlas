'use client';

import type { Dispatch, SetStateAction } from 'react';
import { apiFetch } from '@/lib/api';
import type { CandidateDossier, StudentStatus } from '../dashboard-types';
import type { showToastFn } from './useToast';

export function useCandidateStatus({
  setCandidates,
  selectedCandidate,
  setSelectedCandidate,
  showToast,
}: {
  setCandidates: Dispatch<SetStateAction<CandidateDossier[]>>;
  selectedCandidate: CandidateDossier | null;
  setSelectedCandidate: Dispatch<SetStateAction<CandidateDossier | null>>;
  showToast: showToastFn;
}) {
  // UPDATE CANDIDATE STUDENT RECORD STATUS
  const handleUpdateStudentStatus = async (
    candidateId: string,
    newStatus: StudentStatus,
    sessionId?: string
  ) => {
    // Optimistic UI update
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateId
          ? { ...c, studentStatus: newStatus, hiringStatus: newStatus }
          : c
      )
    );
    if (selectedCandidate && selectedCandidate.id === candidateId) {
      setSelectedCandidate({
        ...selectedCandidate,
        studentStatus: newStatus,
        hiringStatus: newStatus,
      });
    }

    try {
      const cand = selectedCandidate;
      const res = await apiFetch(`/api/recruiter/candidates/${candidateId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          decision: newStatus,
          status: newStatus,
          sessionId: sessionId || cand?.sessionId,
          candidateEmail: cand?.email,
          candidateName: cand?.name,
          role: cand?.targetPosition,
          notes: newStatus === 'rejected' ? 'Application reviewed by hiring committee' : 'Shortlisted for technical round',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update candidate status');
      }
      showToast(data.message || `Student record status updated to '${newStatus.toUpperCase()}'`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update student status.', 'error');
    }
  };

  return { handleUpdateStudentStatus };
}

export type UseCandidateStatusReturn = ReturnType<typeof useCandidateStatus>;
