// Pure business logic for the Recruiter Dashboard (no React, no DOM).
// Extracted verbatim from src/app/recruiter/dashboard/page.tsx — fully unit-testable.
import type {
  CandidateDossier,
  DashboardSortDirection,
  DashboardSortField,
  DashboardSortMode,
  StudentStatus,
} from '@/app/recruiter/dashboard/dashboard-types';

export function isPastUnconducted(candidate: CandidateDossier): boolean {
  if (candidate.aiMatchScore != null) return false;
  const sess = String(candidate.status || '').toLowerCase();
  if (sess === 'completed') return false;
  if (sess.includes('abandon') || sess.includes('cancel') || sess.includes('backout')) return true;
  const stage = String(candidate.stage || '').toLowerCase();
  if (stage.includes('miss') || stage.includes('abandon')) return true;
  const rec = String(candidate.recommendation || '').toUpperCase();
  if (rec === 'MISSED' || rec === 'ABANDONED') return true;
  if (candidate.scheduledAt) {
    try {
      const schedTime = new Date(candidate.scheduledAt).getTime();
      if (!isNaN(schedTime) && schedTime + 15 * 60 * 1000 < Date.now()) {
        return true;
      }
    } catch {
      return false;
    }
  } else if (candidate.scheduledDate) {
    try {
      const t = candidate.scheduledTime || '10:00';
      const schedTime = new Date(`${candidate.scheduledDate}T${t}:00`).getTime();
      if (!isNaN(schedTime) && schedTime + 15 * 60 * 1000 < Date.now()) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

export function getStudentStatus(candidate: CandidateDossier): StudentStatus {
  // If explicitly selected or rejected, respect that decision
  const hiring = String(candidate.hiringStatus || '').toLowerCase().replace(/[-_\s]/g, '');
  if (hiring.includes('select') || hiring.includes('hire') || hiring.includes('offer')) return 'selected';
  if (hiring.includes('reject')) return 'rejected';

  const rec = String(candidate.recommendation || '').toUpperCase();
  if (rec === 'STRONG_HIRE' || rec === 'HIRE') return 'selected';
  if (rec === 'REJECT') return 'rejected';

  // Automatically mark past unconducted or missed session as backout
  if (isPastUnconducted(candidate)) return 'backout';

  if (candidate.studentStatus) {
    const s = String(candidate.studentStatus).toLowerCase().replace(/[-_\s]/g, '');
    if (s === 'selected') return 'selected';
    if (s === 'rejected') return 'rejected';
    if (s === 'backout') return 'backout';
    if (s === 'inprocess') return 'inprocess';
  }

  if (hiring.includes('backout') || hiring.includes('decline') || hiring.includes('withdraw')) return 'backout';
  if (hiring.includes('inprocess') || hiring.includes('panel') || hiring.includes('shortlist') || hiring.includes('progress')) return 'inprocess';

  const sess = String(candidate.status || '').toLowerCase().replace(/[-_\s]/g, '');
  if (sess.includes('abandon') || sess.includes('cancel') || sess.includes('backout') || sess.includes('decline')) return 'backout';

  return 'inprocess';
}

export function formatInterviewDateTime(
  scheduledAt?: string | null,
  scheduledDate?: string | null,
  scheduledTime?: string | null
): { date: string; time: string; isScheduled: boolean } {
  // If exact scheduled_date and scheduled_time from recruiter exist, format directly without UTC distortion
  if (scheduledDate) {
    let dateStr = scheduledDate;
    try {
      const parts = scheduledDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        dateStr = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {}

    let timeStr = '';
    if (scheduledTime) {
      const tParts = scheduledTime.split(':');
      if (tParts.length >= 2) {
        let hour = parseInt(tParts[0], 10);
        const minute = tParts[1].slice(0, 2);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12 || 12;
        timeStr = `${hour}:${minute} ${ampm}`;
      } else {
        timeStr = scheduledTime;
      }
    }

    return { date: dateStr, time: timeStr, isScheduled: true };
  }

  // Fall back to scheduledAt ISO string if present
  if (scheduledAt) {
    try {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) {
        const date = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const time = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return { date, time, isScheduled: true };
      }
    } catch {}
  }

  // If not scheduled, NEVER fall back to appliedDate / created_at!
  return { date: 'Not Scheduled', time: '', isScheduled: false };
}

// STUDENT STATUS COUNTS
export function computeStatusCounts(candidates: CandidateDossier[]): {
  selected: number;
  rejected: number;
  inprocess: number;
  backout: number;
} {
  return {
    selected: candidates.filter((c) => getStudentStatus(c) === 'selected').length,
    rejected: candidates.filter((c) => getStudentStatus(c) === 'rejected').length,
    inprocess: candidates.filter((c) => getStudentStatus(c) === 'inprocess').length,
    backout: candidates.filter((c) => getStudentStatus(c) === 'backout').length,
  };
}

// FILTER & SORT CANDIDATES
export function filterAndSortCandidates(
  candidates: CandidateDossier[],
  params: {
    searchQuery: string;
    selectedJobFilter: string;
    selectedRecFilter: string;
    selectedStatusFilter: string;
    sortMode: DashboardSortMode;
    sortField: DashboardSortField;
    sortDirection: DashboardSortDirection;
  }
): CandidateDossier[] {
  const {
    searchQuery,
    selectedJobFilter,
    selectedRecFilter,
    selectedStatusFilter,
    sortMode,
    sortField,
    sortDirection,
  } = params;

  return candidates
    .filter((c) => {
      const matchesSearch =
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.targetPosition?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.skills?.some((s) => s?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesJob =
        selectedJobFilter === 'all' ||
        c.jobProfileId === selectedJobFilter ||
        c.targetPosition === selectedJobFilter;
      const matchesRec =
        selectedRecFilter === 'all' || c.recommendation === selectedRecFilter;

      const candStatus = getStudentStatus(c);
      const matchesStatus =
        sortMode === 'sortTop' ||
        selectedStatusFilter === 'all' ||
        candStatus === selectedStatusFilter;

      return matchesSearch && matchesJob && matchesRec && matchesStatus;
    })
    .sort((a, b) => {
      const aStatus = getStudentStatus(a);
      const bStatus = getStudentStatus(b);

      // In sortTop mode, float chosen status to the very top
      if (sortMode === 'sortTop' && selectedStatusFilter !== 'all') {
        const aIsChosen = aStatus === selectedStatusFilter ? 1 : 0;
        const bIsChosen = bStatus === selectedStatusFilter ? 1 : 0;
        if (aIsChosen !== bIsChosen) {
          return bIsChosen - aIsChosen;
        }
      }

      if (sortField === 'status') {
        const order: Record<StudentStatus, number> = {
          selected: 0,
          inprocess: 1,
          backout: 2,
          rejected: 3,
        };
        const diff = (order[aStatus] ?? 99) - (order[bStatus] ?? 99);
        return sortDirection === 'asc' ? diff : -diff;
      }

      if (sortField === 'aiMatchScore') {
        const scoreA = a.aiMatchScore ?? -1;
        const scoreB = b.aiMatchScore ?? -1;
        return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }

      if (sortField === 'name') {
        const diff = a.name.localeCompare(b.name);
        return sortDirection === 'asc' ? diff : -diff;
      }

      if (sortField === 'appliedDate') {
        const dateA = new Date(a.appliedDate || 0).getTime();
        const dateB = new Date(b.appliedDate || 0).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      return 0;
    });
}
