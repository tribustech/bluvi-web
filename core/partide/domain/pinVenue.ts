// Ported from fish `features/partide/helpers/pinVenue.ts` (pure, dependencies injected).
// Resolves a dropped map pin onto a known venue so a partidă gets attributed to the right place
// while the dropped PIN stays the angler's anchor (fishing spot). Priority:
//   (a) a catalog Lake within 400m of the pin -> lake venue
//   (b) else a public-water hit at the pin whose ANAR linkCode is CLAIMED by a Lake (the claimed
//       map) -> that Lake (fetched for name/locality)
//   (c) else the public-water hit itself -> publicWater venue
//   (d) else a plain pin (name preserved, county resolved by the caller)
// All network tiers are best-effort: any throw falls through to the next tier so a flaky
// connection never blocks starting a partidă.
import type { LakeDetail, LakeIndexEntry } from '../../lakes/schemas';
import { getLakeLocationSubtitle } from '../../lakes/domain/search';
import { publicWaterLocationLabel, type PublicWaterListItem } from '../../lakes/domain/publicWaters';
import type { LatLng } from './castGeometry';
import { NEARBY_LAKE_RADIUS_M, nearestLakeWithin } from './nearbyWater';
import type { VenueSelection } from './venueSearch';

/** fish WATER_HIT_TOLERANCE_DEG — ~200 m around the pin. */
export const WATER_HIT_TOLERANCE_DEG = 0.002;

export type PinVenueDeps = {
  /** The public water at the point (fish's SQLite hit-test; the web's /partide/incepe/api/apa-la-punct). */
  getWaterAtPoint: (lat: number, lng: number, toleranceDeg: number) => Promise<PublicWaterListItem | null>;
  /** The whole lean lakes index — same cached payload the suggestions scan. */
  getLakesIndex: () => Promise<LakeIndexEntry[]>;
  getLake: (id: string) => Promise<Pick<LakeDetail, 'name' | 'cityRef' | 'countyRef' | 'county'>>;
  /** ANAR linkCode → the lakeId that claims it (core/lakes toClaimedPublicWatersMap). */
  claimedMap: Map<string, string>;
};

/** Nearest catalog lake to `coord` within NEARBY_LAKE_RADIUS_M, or null. Best-effort: any failure → null. */
async function findNearbyLake(coord: LatLng, deps: PinVenueDeps): Promise<LakeIndexEntry | null> {
  try {
    return nearestLakeWithin(coord, await deps.getLakesIndex(), NEARBY_LAKE_RADIUS_M);
  } catch {
    return null;
  }
}

function lakeSelection(coord: LatLng, lakeId: string, name: string, locality: string | null): VenueSelection {
  return { kind: 'lake', lakeId, name, locality, coordinates: coord };
}

/**
 * Resolve a dropped pin to the most specific known venue, falling back to a plain pin. `name` is
 * only used for the plain-pin fallback (d); resolved venues (a/b/c) keep their own names. A
 * resolved lake / water carries the PIN coordinate in `coordinates` / `center` (never the venue's
 * own location): it seeds the anchor.
 */
export async function resolvePinVenue(coord: LatLng, name: string, deps: PinVenueDeps): Promise<VenueSelection> {
  // (a) nearby catalog lake wins outright.
  const nearbyLake = await findNearbyLake(coord, deps);
  if (nearbyLake) return lakeSelection(coord, nearbyLake.documentId, nearbyLake.name, nearbyLake.locality);

  // (b) / (c) a public-water hit at the pin.
  let water: PublicWaterListItem | null = null;
  try {
    water = await deps.getWaterAtPoint(coord.lat, coord.lng, WATER_HIT_TOLERANCE_DEG);
  } catch {
    water = null;
  }

  if (water?.linkCode) {
    const claimedLakeId = deps.claimedMap.get(water.linkCode);
    if (claimedLakeId) {
      try {
        const detail = await deps.getLake(claimedLakeId);
        return lakeSelection(coord, claimedLakeId, detail.name, getLakeLocationSubtitle(detail, { includeAddress: false }));
      } catch {
        // Claim lookup failed — fall through to the unclaimed-water tier below.
      }
    }
    return {
      kind: 'publicWater',
      linkCode: water.linkCode,
      name: water.name ?? 'Apă publică',
      typeLabel: publicWaterLocationLabel(water) ?? '',
      center: coord,
    };
  }

  // (d) nothing matched — plain pin, name preserved.
  return { kind: 'pin', coord, name };
}
