'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { showToastFn } from './useToast';

export function useDossierExport({
  selectedJobFilter,
  showToast,
}: {
  selectedJobFilter: string;
  showToast: showToastFn;
}) {
  // EXPORT STATE
  const [isExporting, setIsExporting] = useState(false);

  const handleExportDossiers = async (format: 'xlsx' | 'csv' = 'xlsx') => {
    setIsExporting(true);
    try {
      const url = `/api/recruiter/dossiers/export?format=${format}${
        selectedJobFilter && selectedJobFilter !== 'all' ? `&jobId=${encodeURIComponent(selectedJobFilter)}` : ''
      }`;
      const res = await apiFetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      a.download = `talentpulse_candidate_dossiers_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
      showToast(`Exported candidate dossiers (${ext.toUpperCase()}) successfully!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to export candidate dossiers', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return { isExporting, handleExportDossiers };
}

export type UseDossierExportReturn = ReturnType<typeof useDossierExport>;
