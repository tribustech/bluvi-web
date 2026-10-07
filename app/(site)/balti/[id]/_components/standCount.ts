import { lakeBookingState, type LakeDetail } from '@/core/lakes';
import { formatCount } from '@/core/realtime/chat/format';

/**
 * The lake's stand count — ONE source of truth for every surface (the summary card, the phone
 * «Caracteristici», the phone bar, the map's list card): a lake that books online counts the
 * stands one can book (its stands list); any other lake the CMS «N locuri» (numberOfSeats). Never
 * both on one page.
 */
export function lakeStandCount(lake: Pick<LakeDetail, 'stands' | 'numberOfSeats'> & Parameters<typeof lakeBookingState>[0]): {
  count: number;
  bookable: boolean;
} | null {
  if (lakeBookingState(lake) === 'enabled' && lake.stands.length > 0) return { count: lake.stands.length, bookable: true };
  return lake.numberOfSeats != null && lake.numberOfSeats > 0 ? { count: lake.numberOfSeats, bookable: false } : null;
}

/** «1 stand rezervabil», «19 standuri rezervabile», «21 de standuri rezervabile» (owner rule 20). */
export const bookableStandsLabel = (n: number) => formatCount(n, 'stand rezervabil', 'standuri rezervabile');
