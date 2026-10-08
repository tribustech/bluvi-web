// Ported from fish `features/partide/helpers/venueSearch.ts` (pure).
// Pure venue-search merge logic for the "Începe o partidă" flow. Maps the two venue sources
// (private catalog lakes + bundled public waters) into a single ordered list of selectable venues.
import type { LakeCard } from '../../lakes/schemas';
import { getLakeLocationSubtitle } from '../../lakes/domain/search';
import { PUBLIC_WATER_TYPE_LABEL } from '../../lakes/domain/publicWaterDetail';
import { publicWaterLocationLabel, type PublicWaterListItem } from '../../lakes/domain/publicWaters';

/** The venue the angler picked, in a shape the start screen can turn into a `VenueRef`. */
export type VenueSelection =
  | {
      kind: 'lake';
      lakeId: string;
      name: string;
      locality: string | null;
      coordinates: { lat: number; lng: number } | null;
    }
  | {
      kind: 'publicWater';
      linkCode: string;
      name: string;
      typeLabel: string;
      center: { lat: number; lng: number };
    }
  | { kind: 'pin'; coord: { lat: number; lng: number }; name: string };

/** First card image thumbnail (thumbnail preferred, full url fallback), or null. */
export function lakeCardThumb(lake: Pick<LakeCard, 'images'>): string | null {
  const img = lake.images?.[0];
  return img?.thumbnailUrl ?? img?.url ?? null;
}

/** «Râu · Ilfov» — the public water's row subtitle (type label + location label). */
export function publicWaterTypeLine(w: Pick<PublicWaterListItem, 'type' | 'county' | 'countyIds'>): string {
  return [PUBLIC_WATER_TYPE_LABEL[w.type], publicWaterLocationLabel(w)].filter(Boolean).join(' · ');
}

/**
 * Merge catalog lakes + public waters into one ordered selection list: lakes first (catalog venues
 * take priority), then public waters. Public waters with a null `linkCode` are excluded — without a
 * stable code there is no ref to persist on the session. The card DTO carries no coordinates, so a
 * lake's `coordinates` is null here (the screen resolves it via `getLake` on select).
 */
export function mergeVenueResults(lakes: LakeCard[], waters: PublicWaterListItem[]): VenueSelection[] {
  const lakeSelections: VenueSelection[] = lakes.map(lake => ({
    kind: 'lake',
    lakeId: lake.documentId,
    name: lake.name,
    locality: getLakeLocationSubtitle(lake, { includeAddress: false }),
    coordinates: null,
  }));

  const waterSelections: VenueSelection[] = waters
    .filter((w): w is PublicWaterListItem & { linkCode: string } => w.linkCode !== null)
    .map(w => ({
      kind: 'publicWater',
      linkCode: w.linkCode,
      name: w.name ?? 'Apă publică',
      typeLabel: publicWaterTypeLine(w),
      center: { lat: w.centerLat, lng: w.centerLng },
    }));

  return [...lakeSelections, ...waterSelections];
}
