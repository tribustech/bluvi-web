import { formatNearbyDistanceKm } from '@/core/lakes';

/**
 * fish formatNearbyDistanceKm (one decimal under 10 km, rounded above — lakes.home.c13) with the
 * Romanian decimal comma, the separator every other number on the page uses («★ 4,5»).
 */
export function distanceLabel(km: number | null | undefined): string | null {
  return km == null ? null : (formatNearbyDistanceKm(km)?.replace('.', ',') ?? null);
}
