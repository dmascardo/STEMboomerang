import { CandidateRecord, REQUIRED_FIELDS } from '../types/candidate';

/**
 * Heuristic validation functions
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Basic phone validation - accepts various formats
  const phoneRegex = /[\d\s\-\(\)\.+]{10,}/;
  return phoneRegex.test(phone);
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidStateCode(state: string): boolean {
  const stateCodes = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
  ];
  return stateCodes.includes(state.toUpperCase());
}

/**
 * Validates a candidate record and returns flagging information
 */
export function validateRecord(record: Partial<CandidateRecord>): {
  needsReview: boolean;
  flagReasons: string[];
  flagDetails: string;
  missingRequired: string[];
} {
  const flagReasons: string[] = [];
  const missingRequired: string[] = [];
  
  // Check for missing required fields
  for (const field of REQUIRED_FIELDS) {
    const value = record[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingRequired.push(field);
      flagReasons.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate email format
  if (record.email && !isValidEmail(record.email)) {
    flagReasons.push('Invalid email format');
  }
  
  // Validate phone format
  if (record.phone && !isValidPhone(record.phone)) {
    flagReasons.push('Invalid phone format');
  }
  
  // Validate URLs
  if (record.linkedin_url && !isValidURL(record.linkedin_url)) {
    flagReasons.push('Invalid LinkedIn URL');
  }
  if (record.portfolio_url && !isValidURL(record.portfolio_url)) {
    flagReasons.push('Invalid portfolio URL');
  }
  if (record.github_url && !isValidURL(record.github_url)) {
    flagReasons.push('Invalid GitHub URL');
  }
  
  // Validate state code
  if (record.state && !isValidStateCode(record.state)) {
    flagReasons.push('Invalid state code');
  }
  
  // Check resume text quality
  if (record.resume_text_quality === 'Low') {
    flagReasons.push('Low resume text quality');
  }
  
  // Check career level confidence
  if (record.career_level_confidence === 'Low') {
    flagReasons.push('Low career level confidence');
  }
  
  // Check extraction confidence
  if (record.extraction_confidence === 'Low') {
    flagReasons.push('Low extraction confidence');
  }
  
  const needsReview = flagReasons.length > 0;
  const flagDetails = needsReview
    ? `Record flagged: ${flagReasons.join('; ')}`
    : 'No issues detected';
  
  return {
    needsReview,
    flagReasons,
    flagDetails,
    missingRequired,
  };
}

/**
 * Counts populated fields in a record
 */
export function countFields(record: Partial<CandidateRecord>): {
  totalFields: number;
  requiredFields: number;
} {
  let totalFields = 0;
  let requiredFields = 0;
  
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && value !== undefined && value !== '') {
      totalFields++;
      
      if (REQUIRED_FIELDS.includes(key as any)) {
        requiredFields++;
      }
    }
  }
  
  return { totalFields, requiredFields };
}
