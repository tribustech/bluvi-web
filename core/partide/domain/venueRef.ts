// Ported from fish `features/partide/helpers/venueRef.ts` (pure).
// Pure derivation of a session's VenueRef — used by Jurnal (Task 6) and Statistici/Tipare
// (Task 7) to key useMapMarkers/useTacticalMap/usePatterns off the session's venue triple.
import type { LocalSession, VenueRef } from './types';
import { standLabel } from './standLabel';

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
