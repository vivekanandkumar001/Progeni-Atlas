'use client';

import { useState } from 'react';
import { computeStatusCounts, filterAndSortCandidates } from '@/lib/recruiter-dashboard';
import type {
  CandidateDossier,
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortMode,
} from '../dashboard-types';

export function useCandidateFilters({ candidates }: { candidates: CandidateDossier[] }) {
  // FILTER & SEARCH STATES
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>('all');
  const [selectedRecFilter, setSelectedRecFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<DashboardSortField>('status');
  const [sortDirection, setSortDirection] = useState<DashboardSortDirection>('asc');
  const [sortMode, setSortMode] = useState<DashboardSortMode>('filter');

  // STUDENT STATUS COUNTS
  const statusCounts = computeStatusCounts(candidates);

  const handleHeaderSort = (field: DashboardSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CLEAR ALL DOSSIER FILTERS (CLEAR ALL FILTERS BUTTON)
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedRecFilter('all');
    setSelectedJobFilter('all');
    setSelectedStatusFilter('all');
  };

  // FILTER & SORT CANDIDATES
  const filteredCandidates = filterAndSortCandidates(candidates, {
    searchQuery,
    selectedJobFilter,
    selectedRecFilter,
    selectedStatusFilter,
    sortMode,
    sortField,
    sortDirection,
  });

  return {
    searchQuery,
    setSearchQuery,
    selectedJobFilter,
    setSelectedJobFilter,
    selectedRecFilter,
    setSelectedRecFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    sortMode,
    setSortMode,
    handleHeaderSort,
    statusCounts,
    filteredCandidates,
    clearAllFilters,
  };
}

export type UseCandidateFiltersReturn = ReturnType<typeof useCandidateFilters>;
