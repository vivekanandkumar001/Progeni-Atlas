'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { JobProfile } from '../dashboard-types';
import type { showToastFn } from './useToast';

export function useInviteCandidate({
  jobProfiles,
  fetchDashboard,
  showToast,
  walletBalance,
}: {
  jobProfiles: JobProfile[];
  fetchDashboard: () => Promise<void>;
  showToast: showToastFn;
  walletBalance?: number | null;
}) {
  const isZeroBalance = walletBalance !== null && walletBalance !== undefined && walletBalance <= 0;

  // MODAL STATE
  const [showInviteModal, setShowInviteModal] = useState(false);

  // FORM STATES (INVITE CANDIDATE)
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteJobId, setInviteJobId] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteJd, setInviteJd] = useState('');
  const [inviteDate, setInviteDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [inviteTime, setInviteTime] = useState('10:00');
  const [inviteDuration, setInviteDuration] = useState('30');
  const [inviting, setInviting] = useState(false);
  const [isDraggingJd, setIsDraggingJd] = useState(false);
  const [parsingJd, setParsingJd] = useState(false);
  const [uploadedJdFile, setUploadedJdFile] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // OPEN INVITE MODAL WITH OPTIONAL PRE-POPULATED JOB PROFILE
  const openInviteModal = (jobId?: string) => {
    if (jobId) {
      setInviteJobId(jobId);
      const selected = jobProfiles.find((j) => j.id === jobId);
      if (selected) {
        setInviteRole(selected.title);
        if (selected.jobDescription) {
          setInviteJd(selected.jobDescription);
        }
        if (selected.durationMinutes) {
          setInviteDuration(String(selected.durationMinutes));
        }
      }
    }
    setShowInviteModal(true);
  };

  const handleJobSelect = (jobId: string) => {
    setInviteJobId(jobId);
    if (jobId === 'custom') {
      if (!inviteRole) setInviteRole('');
    } else {
      const selected = jobProfiles.find((j) => j.id === jobId);
      if (selected) {
        setInviteRole(selected.title);
        if (selected.jobDescription) {
          setInviteJd(selected.jobDescription);
        }
        if (selected.durationMinutes) {
          setInviteDuration(String(selected.durationMinutes));
        }
      }
    }
  };

  // HANDLERS: JD FILE UPLOAD & DRAG-AND-DROP
  const handleJdFile = async (file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    setParsingJd(true);
    setUploadedJdFile(file.name);

    try {
      if (['txt', 'md', 'json', 'csv'].includes(ext || '')) {
        const text = await file.text();
        if (text.trim()) {
          setInviteJd(text.trim());
          showToast(`Extracted Job Description from ${file.name}`, 'success');
        } else {
          showToast(`File ${file.name} is empty.`, 'error');
        }
      } else {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch('/api/recruiter/parse-jd', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Failed to extract text from document');
        }
        if (data.text) {
          setInviteJd(data.text);
          showToast(
            `Extracted Job Description from ${file.name} (${(data.charCount || data.text.length).toLocaleString()} chars)`,
            'success'
          );
        } else {
          showToast(`No readable text found in ${file.name}.`, 'error');
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not parse JD file. You can paste the text manually.', 'error');
      setUploadedJdFile(null);
    } finally {
      setParsingJd(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJd(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJd(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJd(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleJdFile(files[0]);
    }
  };

  // HANDLER: SUBMIT CANDIDATE INVITE
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isZeroBalance) {
      showToast('Cannot schedule interview: Your wallet balance is 0 credits. Please recharge your account in Billing.', 'error');
      return;
    }

    const effectiveRole =
      inviteJobId === 'custom'
        ? inviteRole.trim()
        : jobProfiles.find((j) => j.id === inviteJobId)?.title || inviteRole.trim();

    if (!inviteName.trim()) {
      showToast('Please provide the candidate full name.', 'error');
      return;
    }
    if (!inviteEmail.trim()) {
      showToast('Please provide a candidate email address.', 'error');
      return;
    }
    if (!effectiveRole) {
      showToast('Please select or specify a role (for hire).', 'error');
      return;
    }
    if (!inviteJd.trim()) {
      showToast('Please provide a job description (JD).', 'error');
      return;
    }
    if (!inviteDate) {
      showToast('Please select the date of interview.', 'error');
      return;
    }
    if (!inviteTime) {
      showToast('Please select the time of interview.', 'error');
      return;
    }

    setInviting(true);
    try {
      const res = await apiFetch('/api/recruiter/invite-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          candidateEmail: inviteEmail.trim(),
          candidateName: inviteName.trim(),
          jobProfileId: inviteJobId && inviteJobId !== 'custom' ? inviteJobId : undefined,
          role: effectiveRole,
          jd: inviteJd.trim(),
          interviewDate: inviteDate,
          interviewTime: inviteTime,
          durationMinutes: Number(inviteDuration) || 30,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Invite failed (${res.status})`);
      }

      if (data.emailDelivered === false) {
        showToast(
          `Interview scheduled for ${inviteEmail}, but the invitation email was NOT delivered: ${data.emailError || 'email transport not configured — add RESEND_API_KEY'}`,
          'error',
        );
      } else {
        showToast(`AI Technical Interview scheduled and invitation emailed to ${inviteEmail}.`, 'success');
      }
      setInviteName('');
      setInviteEmail('');
      setInviteJobId('');
      setInviteRole('');
      setInviteJd('');
      setInviteDuration('30');
      setUploadedJdFile(null);
      setIsDraggingJd(false);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setInviteDate(tomorrow.toISOString().split('T')[0]);
      setInviteTime('10:00');
      setShowInviteModal(false);
      // Refresh dashboard to display candidate or new invite
      fetchDashboard();
    } catch (err: any) {
      showToast(err?.message || 'Failed to schedule technical interview.', 'error');
    } finally {
      setInviting(false);
    }
  };

  return {
    jobProfiles,
    showInviteModal,
    setShowInviteModal,
    openInviteModal,
    inviteName,
    setInviteName,
    inviteEmail,
    setInviteEmail,
    inviteJobId,
    setInviteJobId,
    inviteRole,
    setInviteRole,
    inviteJd,
    setInviteJd,
    inviteDate,
    setInviteDate,
    inviteTime,
    setInviteTime,
    inviteDuration,
    setInviteDuration,
    inviting,
    isDraggingJd,
    parsingJd,
    uploadedJdFile,
    fileInputRef,
    handleJobSelect,
    handleJdFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInviteSubmit,
    isZeroBalance,
    walletBalance,
  };
}

export type UseInviteCandidateReturn = ReturnType<typeof useInviteCandidate>;
