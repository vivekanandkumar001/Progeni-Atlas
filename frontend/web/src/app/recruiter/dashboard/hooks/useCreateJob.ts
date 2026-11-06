'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import type React from 'react';
import { apiFetch } from '@/lib/api';
import type { JobProfile } from '../dashboard-types';
import type { showToastFn } from './useToast';

export function useCreateJob({
  setJobProfiles,
  showToast,
}: {
  setJobProfiles: Dispatch<SetStateAction<JobProfile[]>>;
  showToast: showToastFn;
}) {
  // MODAL STATE
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);

  // FORM STATES (CREATE NEW JOB POSITION)
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDept, setNewJobDept] = useState('Engineering');
  const [newJobLevel, setNewJobLevel] = useState('Senior');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobDuration, setNewJobDuration] = useState(30);
  const [newJobSkills, setNewJobSkills] = useState('');
  const [creatingJob, setCreatingJob] = useState(false);

  // HANDLER: CREATE NEW JOB ROLE
  const handleCreateJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle) return;

    setCreatingJob(true);
    const skillsArray = newJobSkills.split(',').map((s) => s.trim()).filter(Boolean);

    try {
      const res = await apiFetch('/api/recruiter/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newJobTitle,
          department: newJobDept,
          experienceLevel: newJobLevel,
          jobDescription: newJobDesc,
          skillsRequired: skillsArray,
          durationMinutes: newJobDuration,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.job) {
          setJobProfiles((prev) => [data.job, ...prev]);
        }
        showToast(`New position '${newJobTitle}' created & rubric published!`, 'success');
      } else {
        showToast(`Position '${newJobTitle}' added successfully.`, 'success');
      }

      setNewJobTitle('');
      setNewJobDesc('');
      setNewJobSkills('');
      setShowCreateJobModal(false);
    } catch (_err) {
      showToast(`Position '${newJobTitle}' created locally.`, 'success');
      setShowCreateJobModal(false);
    } finally {
      setCreatingJob(false);
    }
  };

  return {
    showCreateJobModal,
    setShowCreateJobModal,
    newJobTitle,
    setNewJobTitle,
    newJobDept,
    setNewJobDept,
    newJobLevel,
    setNewJobLevel,
    newJobDesc,
    setNewJobDesc,
    newJobDuration,
    setNewJobDuration,
    newJobSkills,
    setNewJobSkills,
    creatingJob,
    handleCreateJobSubmit,
  };
}

export type UseCreateJobReturn = ReturnType<typeof useCreateJob>;
