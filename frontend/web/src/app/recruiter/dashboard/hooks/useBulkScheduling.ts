'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { BulkProposal } from '../dashboard-types';
import type { showToastFn } from './useToast';

export function useBulkScheduling({
  fetchDashboard,
  showToast,
  walletBalance,
}: {
  fetchDashboard: () => Promise<void>;
  showToast: showToastFn;
  walletBalance?: number | null;
}) {
  const isZeroBalance = walletBalance !== null && walletBalance !== undefined && walletBalance <= 0;

  // BULK RESUME UPLOAD & AI SCHEDULING (REQ-1, REQ-2, REQ-3)
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<'upload' | 'proposals'>('upload');
  const [bulkTargetJobId, setBulkTargetJobId] = useState('');
  const [bulkCustomRole, setBulkCustomRole] = useState('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [isBulkDragging, setIsBulkDragging] = useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkNotifyCandidates, setBulkNotifyCandidates] = useState(true);
  const [bulkInviteMessage, setBulkInviteMessage] = useState('');
  const [bulkProposals, setBulkProposals] = useState<BulkProposal[]>([]);

  const handleBulkFilesSelect = (filesList: FileList | null) => {
    if (!filesList) return;
    const allowed = ['.pdf', '.docx', '.txt'];
    const validFiles: File[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const f = filesList[i];
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (allowed.includes(ext)) {
        validFiles.push(f);
      }
    }
    if (validFiles.length === 0) {
      showToast('Please select valid .pdf, .docx, or .txt files.', 'error');
      return;
    }
    setBulkFiles((prev) => {
      const combined = [...prev, ...validFiles];
      return combined.slice(0, 50);
    });
  };

  const handleRemoveBulkFile = (index: number) => {
    setBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartBulkProcessing = async () => {
    const isCustom = bulkTargetJobId === 'custom' || (!bulkTargetJobId && bulkCustomRole.trim().length > 0);
    const effectiveRole = isCustom
      ? bulkCustomRole.trim()
      : (bulkCustomRole.trim() || 'Software Engineer');

    if (!bulkTargetJobId && !bulkCustomRole.trim()) {
      showToast('Please select a target job opening or specify a role title.', 'error');
      return;
    }
    if (bulkTargetJobId === 'custom' && !bulkCustomRole.trim()) {
      showToast('Please enter the custom role title.', 'error');
      return;
    }
    if (bulkFiles.length === 0) {
      showToast('Please upload at least one candidate resume.', 'error');
      return;
    }

    setIsProcessingBulk(true);
    try {
      const targetJobId = bulkTargetJobId && bulkTargetJobId !== 'custom' ? bulkTargetJobId : 'custom';
      const formData = new FormData();
      formData.append('jobId', targetJobId);
      formData.append('role', effectiveRole);
      formData.append('roleTitle', effectiveRole);
      bulkFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await apiFetch(`/api/recruiter/jobs/${targetJobId}/resumes/bulk`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const uploadData = await res.json();
      if (!res.ok) {
        throw new Error(uploadData.error || 'Failed to process bulk resumes');
      }

      const parsedCandidates = uploadData.candidates || [];
      if (parsedCandidates.length === 0) {
        throw new Error('No candidates could be extracted from uploaded resumes.');
      }

      const genRes = await apiFetch('/api/recruiter/schedules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobId: targetJobId,
          role: effectiveRole,
          candidateIds: parsedCandidates.map((c: any) => c.candidateId),
          candidates: parsedCandidates,
          interviewDurationMinutes: 30,
        }),
      });

      const genData = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.error || 'Failed to generate schedule proposals');
      }

      const proposalsWithMatch = (genData.proposals || []).map((p: any) => {
        const matchingCand = parsedCandidates.find((c: any) => c.candidateId === p.candidateId);
        return {
          ...p,
          matchScore: matchingCand?.matchScore ?? 75,
          skills: matchingCand?.skills ?? [],
        };
      });

      setBulkProposals(proposalsWithMatch);
      setBulkStep('proposals');
      showToast(`Extracted ${parsedCandidates.length} resumes & generated AI schedule proposals!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error processing bulk resumes', 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const handleUpdateProposalSlot = (index: number, field: 'proposedDate' | 'proposedTime', val: string) => {
    setBulkProposals((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleConfirmBulkSchedules = async () => {
    if (bulkProposals.length === 0) return;

    if (isZeroBalance) {
      showToast('Cannot schedule interviews: Your wallet balance is 0 credits. Please recharge your account in Billing.', 'error');
      return;
    }

    setIsProcessingBulk(true);
    try {
      const targetJobId = bulkTargetJobId && bulkTargetJobId !== 'custom' ? bulkTargetJobId : 'custom';
      const effectiveRole = bulkCustomRole.trim() || 'Software Engineer';
      const res = await apiFetch('/api/recruiter/schedules/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobId: targetJobId,
          role: effectiveRole,
          schedules: bulkProposals.map((p) => ({
            candidateId: p.candidateId,
            candidateName: p.candidateName,
            candidateEmail: p.candidateEmail,
            scheduledDate: p.proposedDate,
            scheduledTime: p.proposedTime,
            durationMinutes: p.durationMinutes || 30,
          })),
          notifyCandidates: bulkNotifyCandidates,
          message: bulkInviteMessage.trim() || undefined,
        }),
      });

      const confData = await res.json();
      if (!res.ok) {
        throw new Error(confData.error || 'Failed to confirm interview schedules');
      }

      showToast(`Confirmed ${confData.confirmedCount} candidate interviews successfully!`, 'success');
      setShowBulkModal(false);
      setBulkStep('upload');
      setBulkFiles([]);
      setBulkProposals([]);
      await fetchDashboard();
    } catch (err: any) {
      showToast(err?.message || 'Error confirming schedules', 'error');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  return {
    showBulkModal,
    setShowBulkModal,
    bulkStep,
    setBulkStep,
    bulkTargetJobId,
    setBulkTargetJobId,
    bulkCustomRole,
    setBulkCustomRole,
    bulkFiles,
    setBulkFiles,
    isBulkDragging,
    setIsBulkDragging,
    isProcessingBulk,
    bulkNotifyCandidates,
    setBulkNotifyCandidates,
    bulkInviteMessage,
    setBulkInviteMessage,
    bulkProposals,
    handleBulkFilesSelect,
    handleRemoveBulkFile,
    handleStartBulkProcessing,
    handleUpdateProposalSlot,
    handleConfirmBulkSchedules,
    isZeroBalance,
    walletBalance,
  };
}

export type UseBulkSchedulingReturn = ReturnType<typeof useBulkScheduling>;
