// Ported from fish `features/partide/helpers/venueRef.ts` (pure).
// Pure derivation of a session's VenueRef — used by Jurnal (Task 6) and Statistici/Tipare
// (Task 7) to key useMapMarkers/useTacticalMap/usePatterns off the session's venue triple.
import type { LocalSession, VenueRef } from './types';
import { standLabel } from './standLabel';
import { haversineMeters } from './castGeometry';

export function sessionVenueRef(s: LocalSession): VenueRef {
  if (s.lakeId) return { venueType: 'lake', lakeId: s.lakeId };
  if (s.publicWaterCode) return { venueType: 'publicWater', publicWaterCode: s.publicWaterCode };
  return { venueType: 'pin', anchor: { lat: s.anchorLat, lng: s.anchorLng } };
}

export const VENUE_KIND_LABEL: Record<LocalSession['venueType'], string> = {
  lake: 'Baltă din catalog',
  publicWater: 'Apă publică',
  pin: 'Pin propriu',
};

export function sessionSubtitle(s: Pick<LocalSession, 'standName' | 'locality' | 'venueType'>): string {
  return standLabel(s.standName) ?? s.locality ?? VENUE_KIND_LABEL[s.venueType];
}

/** fish helpers/patterns.ts ANCHOR_RADIUS_M: two pins this close are the same spot. */
export const ANCHOR_RADIUS_M = 40;

/**
 * fish domain/hooks.ts `sameVenue` (useMapMarkers): a marker belongs to a venue when both name the
 * same lake / public water, or — two pins — when their anchors are within ANCHOR_RADIUS_M.
 */
export function sameVenue(a: VenueRef, b: VenueRef): boolean {
  if (a.venueType !== b.venueType) return false;
  if (a.venueType === 'lake' && b.venueType === 'lake') return a.lakeId === b.lakeId;
  if (a.venueType === 'publicWater' && b.venueType === 'publicWater') return a.publicWaterCode === b.publicWaterCode;
  if (a.venueType === 'pin' && b.venueType === 'pin') return haversineMeters(a.anchor, b.anchor) <= ANCHOR_RADIUS_M;
  return false;
}
