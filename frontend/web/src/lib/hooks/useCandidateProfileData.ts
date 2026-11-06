'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  apiJson,
  fetchCandidateProfile,
  fetchCandidateResumes,
  fetchCandidateSkills,
  formatBytes,
  getAccessToken,
  type CandidateProfile as ProfileRecord,
  type CandidateSkill,
} from '@/lib/api';

export interface ResumeData {
  id: string;
  fileName: string;
  fileSizeFormatted: string;
  fileUrl: string;
  uploadedAt: string | null;
  status: string;
  isActive: boolean;
}

export interface CandidateProfileData {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  course: string;
  branch: string;
  academicYear: string;
  collegeName: string;
  bio: string;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  skillsSummary: string[];
  resume: ResumeData | null;
}

export const EMPTY_PROFILE: CandidateProfileData = {
  fullName: '',
  email: '',
  phone: '',
  course: '',
  branch: '',
  academicYear: '',
  collegeName: '',
  bio: '',
  githubUrl: '',
  linkedinUrl: '',
  portfolioUrl: '',
  skillsSummary: [],
  resume: null,
};

export function profileToForm(record: ProfileRecord): CandidateProfileData {
  return {
    id: record.id,
    fullName: record.fullName || record.full_name || '',
    email: record.email || '',
    phone: record.phone || '',
    course: record.course || '',
    branch: record.branch || '',
    academicYear: record.academicYear || record.academic_year || '',
    collegeName: record.collegeName || record.college_name || '',
    bio: record.bio || '',
    githubUrl: record.githubUrl || record.github_url || '',
    linkedinUrl: record.linkedinUrl || record.linkedin_url || '',
    portfolioUrl: record.portfolioUrl || record.portfolio_url || '',
    skillsSummary: Array.isArray(record.skillsSummary)
      ? Array.from(
          new Set(
            record.skillsSummary
              .map((s) => (typeof s === 'string' ? s.trim() : ''))
              .filter((s): s is string => s.length > 0)
          )
        )
      : [],
    resume: null,
  };
}

export function resumeToCard(resume: any): ResumeData {
  const item = resume?.resume || resume;
  const rawSize =
    item?.file_size ?? item?.file_size_bytes ?? item?.fileSizeBytes ?? item?.fileSize ?? null;
  const formattedSize =
    item?.fileSizeFormatted ||
    (typeof rawSize === 'number' ? formatBytes(rawSize) : null) ||
    'Unknown size';
  return {
    id: String(item?.id || ''),
    fileName: item?.fileName || item?.file_name || 'Resume.pdf',
    fileSizeFormatted: formattedSize,
    fileUrl: item?.fileUrl || item?.secure_url || item?.file_url || '#',
    uploadedAt: item?.uploadedAt || item?.uploaded_at || new Date().toISOString(),
    status: item?.status || 'PARSED',
    isActive: item?.isActive ?? item?.is_active ?? true,
  };
}

export interface UseCandidateProfileDataOptions {
  onToast: (text: string, type: 'success' | 'error') => void;
  enabled?: boolean;
}

export function useCandidateProfileData({ onToast, enabled = true }: UseCandidateProfileDataOptions) {
  const [profile, setProfile] = useState<CandidateProfileData>(EMPTY_PROFILE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const skillsRef = useRef<CandidateSkill[]>([]);
  const [isUploadingResume, setIsUploadingResume] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      setLoading(true);
      const [record, resumes, skills, suggestions] = await Promise.all([
        fetchCandidateProfile(),
        fetchCandidateResumes(),
        fetchCandidateSkills(),
        apiJson<string[]>('/api/candidate/skills/suggestions'),
      ]);

      if (!record) {
        setLoadError('We could not load your profile from the server. Please refresh or sign in again.');
        return;
      }

      const activeResume = (resumes ?? []).find((item) => item.is_active) ?? (resumes ?? [])[0] ?? (record as any)?.resume;
      setEmailVerified(Boolean(record.is_email_verified));

      const resolvedSuggestions = Array.isArray(suggestions)
        ? suggestions
        : Array.isArray((suggestions as any)?.suggestions)
          ? (suggestions as any).suggestions
          : [];
      setSuggestedSkills(resolvedSuggestions);

      const rawSkills = Array.isArray(skills)
        ? skills
        : Array.isArray((skills as any)?.skills)
          ? (skills as any).skills
          : Array.isArray((skills as any)?.competencies)
            ? (skills as any).competencies
            : [];
      skillsRef.current = rawSkills.filter((s: any) => s && (s.name || typeof s === 'string'));

      // The "Verified Technical Skills & Tags" section shows the skills
      // recorded on the candidate's profile (which the backend derives from
      // their most recent resume).
      const resolvedSkills = Array.from(
        new Set(
          (record.skillsSummary || [])
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter((s): s is string => s.length > 0)
        )
      );
      setProfile({
        ...profileToForm(record),
        skillsSummary: resolvedSkills,
        resume: activeResume ? resumeToCard(activeResume) : null,
      });
      setLoadError(null);
    } catch (err) {
      console.error('[Candidate Profile] Error loading profile data:', err);
      setLoadError('We could not load your profile from the server. Please refresh or sign in again.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled && getAccessToken()) {
      void loadProfile();
    }
  }, [loadProfile, enabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setProfile((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSaveProfile = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setSaving(true);
      try {
        const res = await apiJson<Record<string, unknown>>('/api/candidate/profile', {
          method: 'PUT',
          body: JSON.stringify({
            full_name: profile.fullName,
            phone: profile.phone,
            course: profile.course,
            branch: profile.branch,
            academic_year: profile.academicYear,
            college_name: profile.collegeName,
            bio: profile.bio,
            github_url: profile.githubUrl,
            linkedin_url: profile.linkedinUrl,
            portfolio_url: profile.portfolioUrl,
          }),
        });
        if (res) {
          onToast('Candidate profile updated and synchronized successfully!', 'success');
        } else {
          onToast('Failed to save profile changes. The update was not persisted.', 'error');
        }
      } catch {
        onToast('Profile could not be saved: the server was unreachable.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [profile, onToast]
  );

  const persistSkills = useCallback(
    async (nextSkills: string[], successMessage: string) => {
      setSaving(true);
      const previous = skillsRef.current;
      try {
        const payload = nextSkills.map((name) => {
          const match = previous.find((s) => s.name?.toLowerCase() === name?.toLowerCase());
          return {
            name,
            category: match?.category ?? null,
            proficiency: match?.proficiency ?? null,
            years_experience: match?.years_experience ?? null,
          };
        });
        const res = await apiJson<{ ok?: boolean }>('/api/candidate/skills', {
          method: 'PUT',
          body: JSON.stringify({ skills: payload }),
        });
        if (res) {
          onToast(successMessage, 'success');
        } else {
          onToast('Failed to save skills. The change was not persisted.', 'error');
        }
      } catch {
        onToast('Skills could not be saved: the server was unreachable.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [onToast]
  );

  const handleAddSkill = useCallback(
    (skillToAdd: string) => {
      const trimmed = skillToAdd.trim();
      if (!trimmed) return;
      if (profile.skillsSummary?.some((s) => s?.toLowerCase() === trimmed.toLowerCase())) return;
      const nextSkills = [...profile.skillsSummary, trimmed];
      setProfile((prev) => ({ ...prev, skillsSummary: nextSkills }));
      setNewSkillInput('');
      void persistSkills(nextSkills, `Added "${trimmed}" to your skills.`);
    },
    [profile.skillsSummary, persistSkills]
  );

  const handleRemoveSkill = useCallback(
    (skillToRemove: string) => {
      const nextSkills = profile.skillsSummary.filter((s) => s !== skillToRemove);
      setProfile((prev) => ({ ...prev, skillsSummary: nextSkills }));
      void persistSkills(nextSkills, `Removed "${skillToRemove}" from your skills.`);
    },
    [profile.skillsSummary, persistSkills]
  );

  const handleResumeFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
        onToast('Please upload a valid PDF document for your resume.', 'error');
        return;
      }

      setIsUploadingResume(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        let res = await apiJson<any>('/api/candidate/resume', {
          method: 'POST',
          body: formData,
        });

        if (!res || (!res.id && !res.resume?.id)) {
          console.warn(
            '[Resume Upload] POST response unconfirmed. Reconciling resume state with backend...'
          );
          const resumes = await fetchCandidateResumes();
          const latest =
            (resumes ?? []).find(
              (r: any) => r.file_name === file.name || r.fileName === file.name
            ) || (resumes ?? [])[0];
          if (latest) {
            res = latest;
          }
        }

        const uploaded = res?.resume || res;
        if (uploaded && (uploaded.id || uploaded.file_name || uploaded.fileName)) {
          setProfile((prev) => ({ ...prev, resume: resumeToCard(uploaded) }));
          // A parsed resume now auto-fills empty profile fields (name, phone,
          // links, education) and refreshes skills server-side, so re-read the
          // profile to surface that data without a manual page reload.
          if (String(uploaded.status || 'PARSED').toUpperCase() === 'PARSED') {
            await loadProfile();
          }
          const statusStr = String(uploaded.status || 'PARSED').toUpperCase();
          onToast(
            `Resume uploaded. Parser status: ${statusStr?.toLowerCase()}.`,
            statusStr === 'PARSED' ? 'success' : 'error'
          );
        } else {
          onToast(
            'Upload status could not be confirmed. Please check your network or try refreshing.',
            'error'
          );
        }
      } catch (err) {
        console.warn('[Resume Upload Catch] Attempting backend state reconciliation:', err);
        try {
          const resumes = await fetchCandidateResumes();
          const latest = (resumes ?? [])[0];
          if (latest) {
            setProfile((prev) => ({ ...prev, resume: resumeToCard(latest) }));
            await loadProfile();
            onToast('Resume uploaded and synchronized successfully.', 'success');
            return;
          }
        } catch {}
        onToast('Resume upload failed: the server was unreachable.', 'error');
      } finally {
        setIsUploadingResume(false);
      }
    },
    [onToast, loadProfile]
  );

  return {
    profile,
    setProfile,
    loadError,
    emailVerified,
    loading,
    saving,
    newSkillInput,
    setNewSkillInput,
    suggestedSkills,
    skillsRef,
    isUploadingResume,
    handleInputChange,
    handleSaveProfile,
    handleAddSkill,
    handleRemoveSkill,
    handleResumeFileSelect,
  };
}
