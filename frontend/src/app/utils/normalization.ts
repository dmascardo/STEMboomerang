import { STATE_CODES } from '../types/candidate';

/**
 * Normalizes location data according to spec:
 * - city: Title Case
 * - state: USPS 2-letter code, uppercase
 */
export function normalizeLocation(city?: string | null, state?: string | null): {
  city: string | null;
  state: string | null;
  state_full: string | null;
  location_display: string | null;
} {
  const normalizedCity = city ? toTitleCase(city.trim()) : null;
  
  let normalizedState: string | null = null;
  let stateFull: string | null = null;
  
  if (state) {
    const cleanState = state.trim().toLowerCase();
    
    // Check if it's already a 2-letter code
    if (cleanState.length === 2) {
      normalizedState = cleanState.toUpperCase();
      // Find full name
      for (const [fullName, code] of Object.entries(STATE_CODES)) {
        if (code === normalizedState) {
          stateFull = toTitleCase(fullName);
          break;
        }
      }
    } else {
      // Try to find state code from full name
      normalizedState = STATE_CODES[cleanState] || null;
      stateFull = normalizedState ? toTitleCase(cleanState) : null;
    }
  }
  
  const locationDisplay = normalizedCity && normalizedState
    ? `${normalizedCity}, ${normalizedState}`
    : null;
  
  return {
    city: normalizedCity,
    state: normalizedState,
    state_full: stateFull,
    location_display: locationDisplay,
  };
}

/**
 * Normalizes email to lowercase
 */
export function normalizeEmail(email?: string | null): string | null {
  return email ? email.trim().toLowerCase() : null;
}

/**
 * Normalizes URL to lowercase
 */
export function normalizeURL(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.toLowerCase();
}

/**
 * Converts string to Title Case
 */
export function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalizes name to Title Case
 */
export function normalizeName(name?: string | null): string | null {
  return name ? toTitleCase(name.trim()) : null;
}
