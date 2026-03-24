import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CandidateRecord, REQUIRED_FIELDS } from '../types/candidate';
import { normalizeEmail, normalizeLocation, normalizeName, normalizeURL } from '../utils/normalization';
import { listCandidatesCandidatesGet, updateCandidateCandidatesUpdatePost } from '../../client';

interface CandidatesContextType {
  candidates: CandidateRecord[];
  addCandidate: (candidate: CandidateRecord) => void;
  updateCandidate: (id: number, updates: Partial<CandidateRecord>) => void;
  getCandidate: (id: number) => CandidateRecord | undefined;
  clearCandidates: () => void;
}

const CandidatesContext = createContext<CandidatesContextType | undefined>(undefined);

export function CandidatesProvider({ children }: { children: ReactNode }) {
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);

  const fetchCandidates = async () => {
    const response = await listCandidatesCandidatesGet();
    if (!response.data) {
      return;
    }
    const res: CandidateRecord[] = response.data.map(candidate => ({
      ...candidate,
      flag_reasons: candidate.flag_reasons?.split(',') || null,
      required_fields_missing: candidate.required_fields_missing?.split(',') || undefined,
    }));
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
    setCandidates(prev => [...prev, candidate]);
  };

  const updateCandidate = (id: number, updates: Partial<CandidateRecord>) => {
    // setCandidates(prev =>
    //   prev.map(c => {
    //     if (c.id !== id) return c;
    //     const trimmedUpdates = Object.fromEntries(
    //       Object.entries(updates).map(([key, value]) => {
    //         if (typeof value !== 'string') return [key, value];
    //         const trimmed = value.trim();
    //         return [key, trimmed === '' ? null : trimmed];
    //       })
    //     ) as Partial<CandidateRecord>;

    //     const merged = { ...c, ...trimmedUpdates } as CandidateRecord;
    //     return recalculateMissingFields(normalizeEditedFields(merged));
    //   })
    // );
    updateCandidateCandidatesUpdatePost({
      body: {
        id,

        ...updates,
        required_fields_missing: updates.required_fields_missing?.join(',') || undefined,
        flag_reasons: updates.flag_reasons?.join(',') || undefined,
      },
      query: {
        id,
      },
    });

    fetchCandidates();
  };

  const getCandidate = (id: number) => {
    return candidates.find(c => c.id === id);
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
