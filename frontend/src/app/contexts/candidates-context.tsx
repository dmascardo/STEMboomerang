import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CandidateRecord, REQUIRED_FIELDS } from '../types/candidate';
import { normalizeEmail, normalizeLocation, normalizeName, normalizeURL } from '../utils/normalization';
import { listCandidatesCandidatesGet } from '../../client';

interface CandidatesContextType {
  candidates: CandidateRecord[];
  addCandidate: (candidate: CandidateRecord) => void;
  updateCandidate: (id: number, updates: Partial<CandidateRecord>) => Promise<void>;
  getCandidate: (id: number) => CandidateRecord | undefined;
  deleteCandidates: (ids: number[]) => Promise<void>;
  clearCandidates: () => void;
}

const CandidatesContext = createContext<CandidatesContextType | undefined>(undefined);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const normalizeStringList = (value: string[] | string | null | undefined): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

const toCandidateRecord = (candidate: any): CandidateRecord => ({
  ...candidate,
  flag_reasons: normalizeStringList(candidate.flag_reasons) || null,
  required_fields_missing: normalizeStringList(candidate.required_fields_missing),
});

export function CandidatesProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);

  const fetchCandidates = async () => {
    const response = await listCandidatesCandidatesGet();
    if (!response.data) {
      return;
    }
    const res: CandidateRecord[] = response.data.map(toCandidateRecord);
    setCandidates(res);
  };

  useEffect(() => {

    fetchCandidates();
  }, []);

  const normalizeEditedFields = (record: CandidateRecord): CandidateRecord => {
    const next = { ...record };

    next.full_name = normalizeName(next.full_name);
    next.email = normalizeEmail(next.email);
    next.linkedin_url = normalizeURL(next.linkedin_url);
    next.portfolio_url = normalizeURL(next.portfolio_url);
    next.github_url = normalizeURL(next.github_url);

    const location = normalizeLocation(next.city, next.state);
    next.city = location.city;
    next.state = location.state;
    next.state_full = location.state_full;
    next.location_display = location.location_display;

    return next;
  };

  const recalculateMissingFields = (record: CandidateRecord): CandidateRecord => {
    const missingRequired = REQUIRED_FIELDS.filter((field) => {
      const value = record[field];
      return !value || (typeof value === 'string' && value.trim() === '');
    });

    const existingFlags = (record.flag_reasons ?? []).filter((flag) => flag !== 'missing_required_fields');
    const nextFlags = missingRequired.length > 0 ? [...existingFlags, 'missing_required_fields'] : existingFlags;

    let nextReviewReason = record.review_reason;
    if (missingRequired.length > 0) {
      nextReviewReason = `Missing required fields: ${missingRequired.join(', ')}`;
    } else if (record.review_reason?.startsWith('Missing required fields:')) {
      nextReviewReason = existingFlags.length > 0 ? record.review_reason : null;
    }

    return {
      ...record,
      required_fields_missing: missingRequired.length > 0 ? missingRequired : undefined,
      required_fields_found_count: REQUIRED_FIELDS.length - missingRequired.length,
      flag_reasons: nextFlags.length > 0 ? nextFlags : null,
      needs_review: nextFlags.length > 0 ? 'YES' : 'NO',
      review_reason: nextReviewReason,
    };
  };

  const addCandidate = (candidate: CandidateRecord) => {
    setCandidates(prev => [...prev, toCandidateRecord(candidate)]);
  };

  const updateCandidate = async (id: number, updates: Partial<CandidateRecord>) => {
    const current = candidates.find((candidate) => candidate.id === id);
    if (!current) {
      return;
    }

    const trimmedUpdates = Object.fromEntries(
      Object.entries(updates).map(([key, value]) => {
        if (typeof value !== 'string') return [key, value];
        const trimmed = value.trim();
        return [key, trimmed === '' ? null : trimmed];
      })
    ) as Partial<CandidateRecord>;

    const merged = { ...current, ...trimmedUpdates } as CandidateRecord;
    const normalized = normalizeEditedFields(merged);
    const recalculated = recalculateMissingFields(normalized);

    const response = await fetch(`${API_BASE_URL}/candidates/update?id=${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        ...recalculated,
        required_fields_missing: recalculated.required_fields_missing ?? undefined,
        flag_reasons: recalculated.flag_reasons ?? undefined,
      }),
    });

    if (!response.ok) {
      let detail = 'Failed to update candidate';
      try {
        const errorData = await response.json();
        if (typeof errorData?.detail === 'string') {
          detail = errorData.detail;
        }
      } catch {
        // Keep fallback.
      }
      throw new Error(detail);
    }

    await fetchCandidates();
  };

  const getCandidate = (id: number) => {
    return candidates.find(c => c.id === id);
  };

  const deleteCandidates = async (ids: number[]) => {
    const uniqueIds = Array.from(new Set(ids.filter((id) => id > 0)));
    if (uniqueIds.length === 0) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/candidates/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: uniqueIds }),
    });

    if (!response.ok) {
      let detail = 'Failed to delete candidates';
      try {
        const errorData = await response.json();
        if (typeof errorData?.detail === 'string') {
          detail = errorData.detail;
        }
      } catch {
        // Keep fallback.
      }
      throw new Error(detail);
    }

    setCandidates((prev) => prev.filter((candidate) => !uniqueIds.includes(candidate.id)));
  };

  const clearCandidates = () => {
    setCandidates([]);
  };

  return (
    <CandidatesContext.Provider
      value={{
        candidates,
        addCandidate,
        updateCandidate,
        getCandidate,
        deleteCandidates,
        clearCandidates,
      }}
    >
      {children}
    </CandidatesContext.Provider>
  );
}

export function useCandidates() {
  const context = useContext(CandidatesContext);
  if (!context) {
    throw new Error('useCandidates must be used within CandidatesProvider');
  }
  return context;
}
