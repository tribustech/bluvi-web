// Ported from fish `features/partide/community/venuePartideHref.ts` (pure).
import type { CommunityVenueDTO } from '../schemas';

/**
 * Where a live venue card's footer goes: the venue's own partide page.
 *
 * Derived from the venue's identity rather than from `lakeId`, which is null
 * for every public water. The public-water code is read back out of `key`
 * (`water:<code>`), where `<code>` is the ANAR `linkCode` that
 * `useResolvedPublicWater` — and therefore `/public-waters/[id]` — accepts.
 *
 * `null` means there is nowhere to go: a manual `pin` venue has no page, and a
 * row missing its identifier must not be sent to `/lakes/undefined/partide`.
 * Callers fall back to opening the leading partidă.
 */
export function venuePartideHref(venue: Pick<CommunityVenueDTO, 'key' | 'venueType' | 'lakeId'>): string | null {
  if (venue.venueType === 'lake') {
    return venue.lakeId ? `/lakes/${venue.lakeId}/partide` : null;
  }
  if (venue.venueType === 'publicWater') {
    const code = venue.key.startsWith('water:') ? venue.key.slice('water:'.length) : '';
    return code ? `/public-waters/${encodeURIComponent(code)}/partide` : null;
  }
  return null;
}
