import { formatCount } from '../../realtime/chat/format';
import type { LakeDetail } from '../schemas';

/*
 * The lake page's pure logic — fish `features/venues/detail/sections.ts`,
 * `features/venues/detail/sectionLogic.ts`, `features/lakes/helpers/lakeDetailLogic.ts#buildLakeSectionChips`,
 * the `bookingState` / quick-action rules of `app/(app)/lakes/[lakeId].tsx`,
 * `features/lakes/detail/LakeCharacteristics.tsx#buildStats`, `features/lakes/detail/LakeContactSection.tsx`
 * (coordinate parsing), `components/NavigationSheet.tsx#buildMapUrls` and
 * `features/lakes/components/ShareLakeSheet.tsx` (the shared text).
 */

/* fish features/venues/detail/sections.ts */

export type VenueSectionId =
  | 'prezentare'
  | 'facilitati'
  | 'pesti'
  | 'partide'
  | 'capturi'
  | 'preturi'
  | 'concursuri'
  | 'recenzii'
  | 'contact'
  | 'locatie';

export const VENUE_SECTION_ORDER: VenueSectionId[] = [
  'prezentare',
  'facilitati',
  'pesti',
  'partide',
  'capturi',
  'preturi',
  'concursuri',
  'recenzii',
  'contact',
  'locatie',
];

export const VENUE_SECTION_LABELS: Record<VenueSectionId, string> = {
  prezentare: 'Prezentare',
  facilitati: 'Facilități',
  pesti: 'Pești',
  partide: 'Partide',
  capturi: 'Capturi',
  preturi: 'Prețuri',
  concursuri: 'Concursuri',
  recenzii: 'Recenzii',
  contact: 'Contact',
  locatie: 'Locație',
};

/* fish features/venues/detail/sectionLogic.ts */

export interface SectionOffset<T extends string = string> {
  id: T;
  y: number;
}

/** Last section whose top has scrolled under the pinned nav (topOffset px from the viewport top). */
export function computeActiveSection<T extends string>(scrollY: number, offsets: SectionOffset<T>[], topOffset: number): T | null {
  if (offsets.length === 0) return null;
  const sorted = [...offsets].sort((a, b) => a.y - b.y);
  let current = sorted[0].id;
  for (const section of sorted) {
    if (section.y - topOffset <= scrollY) current = section.id;
  }
  return current;
}

/* fish features/lakes/helpers/lakeDetailLogic.ts#buildLakeSectionChips */

export type LakeSectionFlags = {
  hasFacilities: boolean;
  hasFish: boolean;
  hasPartide: boolean;
  hasPrices: boolean;
  hasCompetitions: boolean;
  hasContact: boolean;
};

export function buildLakeSectionChips(flags: LakeSectionFlags): VenueSectionId[] {
  const visible: Record<VenueSectionId, boolean> = {
    prezentare: true,
    facilitati: flags.hasFacilities,
    pesti: flags.hasFish,
    partide: flags.hasPartide,
    capturi: false,
    preturi: flags.hasPrices,
    concursuri: flags.hasCompetitions,
    recenzii: true,
    contact: flags.hasContact,
    locatie: false,
  };
  return VENUE_SECTION_ORDER.filter(id => visible[id]);
}

/**
 * fish [lakeId].tsx `competitionsVisible`: the Concursuri section (and chip) stays until BOTH
 * counts are known, and hides only when they are known to be 0 + 0. `null` = not known (loading
 * or failed).
 */
export function lakeCompetitionsVisible(counts: { live: number; upcoming: number } | null): boolean {
  return counts == null || counts.live + counts.upcoming > 0;
}

/** fish [lakeId].tsx `hasContact`: the address, the website, a phone or the coordinates. */
export function lakeHasContact(lake: Pick<LakeDetail, 'address' | 'website' | 'contact' | 'coordinates'>): boolean {
  return !!(lake.address || lake.website || (lake.contact?.length ?? 0) > 0 || lake.coordinates);
}

/* fish [lakeId].tsx `bookingState` — three reservation modes behind one affordance. */

export type LakeBookingState = 'enabled' | 'legacy_phone' | 'none';

export function lakeBookingState(lake: Pick<LakeDetail, 'bookingEnabled' | 'acceptsReservations'>): LakeBookingState {
  return lake.bookingEnabled ? 'enabled' : lake.acceptsReservations ? 'legacy_phone' : 'none';
}

/**
 * fish [lakeId].tsx `openBookingAffordance` — where the hero «Rezervă acum» and the Rezervă tile
 * lead (parity lakes.detail.c16):
 *  - `book`: the booking flow (bookingEnabled, signed in);
 *  - `sign-in`: a guest signs in first (bookingEnabled, signed out; no redirect into the grid);
 *  - `contact`: legacy phone reservations scroll to the contact section;
 *  - `interest`: no booking at all opens the demand-signal sheet («Aș vrea să pot rezerva aici»).
 */
export type LakeBookingAction = 'book' | 'sign-in' | 'contact' | 'interest';

export function lakeBookingAction(state: LakeBookingState, isAuthenticated: boolean): LakeBookingAction {
  if (state === 'enabled') return isAuthenticated ? 'book' : 'sign-in';
  return state === 'legacy_phone' ? 'contact' : 'interest';
}

/**
 * fish hooks/useNouBadge.ts LAKE_BOOKING_NEW_BADGE_UNTIL: the «NOU» pill on the Rezervă tile was
 * date-gated to before 2026-10-01 and only where booking exists (parity lakes.detail.c15,
 * lakes.b.expired-nou-badges). Kept as a function so the expiry is testable; the web ships it
 * expired.
 */
export const LAKE_BOOKING_NEW_BADGE_UNTIL = Date.parse('2026-10-01T00:00:00Z');

export function lakeBookingNouBadge(state: LakeBookingState, nowMs: number): boolean {
  return state !== 'none' && nowMs < LAKE_BOOKING_NEW_BADGE_UNTIL;
}

/* fish features/lakes/detail/LakeCharacteristics.tsx#buildStats (the data; icons are the UI's) */

export type LakeStatKey = 'surface' | 'depth' | 'seats' | 'regime' | 'fishingType' | 'fishingSpotTypes';
export type LakeStat = { key: LakeStatKey; value: string; label: string };

export function buildLakeStats(
  lake: Pick<LakeDetail, 'surface' | 'depth' | 'numberOfSeats' | 'regime' | 'fishingType' | 'fishingSpotTypes'>,
): LakeStat[] {
  const stats: LakeStat[] = [];
  // fish prints the number as is (`${lake.surface} ha`); the web writes the Romanian decimal comma.
  if (lake.surface != null) stats.push({ key: 'surface', value: `${String(lake.surface).replace('.', ',')} ha`, label: 'Suprafață' });
  if (lake.depth && (lake.depth.min != null || lake.depth.max != null)) {
    const n = (v: number | null | undefined) => (v == null ? '?' : String(v).replace('.', ','));
    stats.push({ key: 'depth', value: `${n(lake.depth.min)} – ${n(lake.depth.max)} m`, label: 'Adâncime' });
  }
  if (lake.numberOfSeats != null) stats.push({ key: 'seats', value: formatCount(lake.numberOfSeats, 'loc', 'locuri'), label: 'Standuri pescuit' });
  if (lake.regime) stats.push({ key: 'regime', value: lake.regime, label: 'Regim de pescuit' });
  if (lake.fishingType) stats.push({ key: 'fishingType', value: lake.fishingType, label: 'Tip de pescuit' });
  if (lake.fishingSpotTypes) stats.push({ key: 'fishingSpotTypes', value: lake.fishingSpotTypes, label: 'Loc de pescuit' });
  return stats;
}

/* fish LakeContactSection: the coordinates only count when both parse as numbers. */

export function parseLakeCoordinates(coordinates: { lat?: string | null; long?: string | null } | null | undefined): { lat: number; lng: number } | null {
  if (!coordinates?.lat || !coordinates?.long) return null;
  const lat = parseFloat(coordinates.lat);
  const lng = parseFloat(coordinates.long);
  return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng };
}

/* fish components/NavigationSheet.tsx#buildMapUrls */

export type LakeMapUrls = { google: string; waze: string; apple: string };

/**
 * Directions to the lake. fish opens Apple Maps with the `maps:` scheme (iOS only); the web uses
 * the https form, which opens the Maps app on Apple devices and the web map elsewhere.
 */
export function buildMapUrls(coordinates: { lat?: string | null; long?: string | null } | null | undefined): LakeMapUrls | null {
  if (!coordinates?.lat || !coordinates?.long) return null;
  const { lat, long } = coordinates;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${long}&travelmode=driving&dir_action=navigate`,
    waze: `https://waze.com/ul?ll=${lat},${long}&navigate=yes&z=10`,
    apple: `https://maps.apple.com/?daddr=${lat},${long}`,
  };
}

/* fish features/lakes/components/ShareLakeSheet.tsx */

export const LAKE_SHARE_DEFAULT_MESSAGE = 'Mergem la pescuit aici?';

/** The preview / shared text without the link: «message\n\n🎣 name». */
export function lakeShareMessage(message: string, lakeName: string): string {
  return `${message}\n\n🎣 ${lakeName}`;
}

/** What «Copiază» and «Distribuie» send: the message, a blank line, «🎣 name», a new line, the link. */
export function lakeShareText(message: string, lakeName: string, url: string): string {
  return `${lakeShareMessage(message, lakeName)}\n${url}`;
}
