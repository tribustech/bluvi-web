import { DEFAULT_NEARBY_RADIUS_KM, type LakesHomeParams } from '@/core/lakes';

/** fish HOME_SECTION_PREVIEW_LIMIT: 10 shown + 1 to know there are more. */
export const HOME_LIMIT = 11;

/**
 * The rows without location — what the server prefetches (page.tsx) and the home starts from: one
 * cache entry, and the fallback when the located read fails. A plain module, so the server page
 * reads the value (a 'use client' module would hand it a client reference).
 */
export const HOME_PARAMS: LakesHomeParams = { latitude: null, longitude: null, radiusKm: DEFAULT_NEARBY_RADIUS_KM, limit: HOME_LIMIT };
