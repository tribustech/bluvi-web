'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  VENUE_SEARCH_DEBOUNCE_MS,
  VENUE_SEARCH_MIN_CHARS,
  VENUE_SEARCH_RESULT_LIMIT,
  venueSearchKey,
  venueSearchLakesQuery,
  type LakeCard,
  type PublicWaterListItem,
} from '@/core/lakes';
import { browserPublicWaters } from '@/app/(site)/ape-publice/_components/client-source';
import { createBrowserTransport } from '@/lib/client/transport';

/*
 * fish services/queries/useVenueSearch.ts — the debounced venue search of the Partide pickers (the
 * Explorează venue filter here; «Începe o partidă» reuses it). Two sources on ONE 250ms debounce,
 * from 2 characters, 10 results each:
 *  - catalog lakes: /feed/lakes/search (core/lakes venueSearchLakesQuery, the card DTO, so rows get
 *    the lake photo);
 *  - public waters: fish's bundled ANAR SQLite, which on the web is the site's own JSON route
 *    /ape-publice/api/search, read and validated by core/lakes createHttpPublicWatersSource.
 * Below the minimum both are empty WITHOUT loading — never read as «no results».
 */

export type VenueSearch = {
  lakes: LakeCard[];
  waters: PublicWaterListItem[];
  /** The debounced term is searchable and an answer is on its way (or the term is still debouncing). */
  isLoading: boolean;
  /** Both sources failed for the current term. */
  isError: boolean;
  /** The catalog-lakes half failed for the current term (its rows are unknown, never «none»). */
  lakesError: boolean;
  /** The public-waters half failed for the current term (its rows are unknown, never «none»). */
  watersError: boolean;
  /** The term the results answer (trimmed). */
  settledTerm: string;
  /** Reads again whichever half failed (both when neither did). */
  retry: () => void;
  retryLakes: () => void;
  retryWaters: () => void;
};

export function useVenueSearch(term: string): VenueSearch {
  const t = useMemo(() => createBrowserTransport(), []);
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term), VENUE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [term]);

  const q = debounced.trim();
  const enabled = q.length >= VENUE_SEARCH_MIN_CHARS;
  const lakes = useQuery({ ...venueSearchLakesQuery(t, debounced), retry: false });
  const waters = useQuery({
    // Screen-local like fish's (venue search is not shared state): beside the lakes' key.
    queryKey: [...venueSearchKey(q.toLowerCase()), 'waters'] as const,
    queryFn: () => browserPublicWaters().searchPublicWaters(q, VENUE_SEARCH_RESULT_LIMIT),
    enabled,
    staleTime: Infinity,
    retry: false,
  });

  const debouncing = term.trim() !== q;
  const lakesError = enabled && lakes.isError;
  const watersError = enabled && waters.isError;
  const retryLakes = () => void lakes.refetch();
  const retryWaters = () => void waters.refetch();
  return {
    lakes: enabled ? (lakes.data?.data ?? []) : [],
    waters: enabled ? (waters.data ?? []) : [],
    isLoading: (enabled && (lakes.isFetching || waters.isFetching)) || (debouncing && term.trim().length >= VENUE_SEARCH_MIN_CHARS),
    isError: lakesError && watersError,
    lakesError,
    watersError,
    settledTerm: q,
    retry: () => {
      if (lakesError || !watersError) retryLakes();
      if (watersError || !lakesError) retryWaters();
    },
    retryLakes,
    retryWaters,
  };
}
