'use client';

import { useQuery } from '@tanstack/react-query';
import { ownedLakesQuery } from '@/core/booking';
import { useOperatorTransport } from './useOperatorTransport';

/** fish operator screens' header when the lake is not in the owned list (or the list failed). */
export const OWNED_LAKE_FALLBACK = 'Balta';

/**
 * The lake's name for an operator header (fish: `useOwnedLakes().data?.find(l => l.documentId ===
 * lakeId)?.name ?? 'Balta'`), from the shared owned-lakes query (core booking.ownedLakesQuery, the
 * same key the picker and Acasă read — one request per page).
 *
 * Returns `undefined` while the list is still loading (owner rule 4: never paint «Balta» and then
 * swap it — render a title skeleton), the lake's name once it answered, or «Balta» when the lake
 * is not in the list or the read failed.
 */
export function useOwnedLakeName(lakeId: string): string | undefined {
  const t = useOperatorTransport();
  const { data, isPending, isError } = useQuery(ownedLakesQuery(t));
  if (isPending && !isError) return undefined;
  return data?.find((l) => l.documentId === lakeId)?.name ?? OWNED_LAKE_FALLBACK;
}
