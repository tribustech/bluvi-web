'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLakes, lakesIndexQuery } from '@/core/lakes';
import { buildNearbySuggestions, buildVenueSections, partideHistoryQuery, recentVenueSessionOf, type VenueSuggestion } from '@/core/partide';
import type { Transport } from '@/core/transport';
import { browserPublicWaters } from '../../../ape-publice/_components/client-source';
import type { Coord } from './model';
import type { StartLocationState } from './location';

/*
 * fish features/partide/helpers/useVenueSuggestions.ts — the three suggestion sections of the venue
 * step, built by core buildVenueSections:
 *  - «Aproape de tine»: the lean lakes index (/feed/lakes/index, edge-cached, 6 h) + the 5 nearest
 *    public waters (/ape-publice/api/nearest — fish's bundled SQLite), within 150 km;
 *  - «Folosite recent»: the viewer's own partide (/feed/sessions/mine, core partideHistoryQuery).
 *    fish reads its in-memory session store, which since the online rewrite holds only the live
 *    partidă (its TODO(partide-coop) names this list as the source) — the web reads the list;
 *  - «Sugestii»: 10 catalog lakes (/feed/lakes/search page 1) shuffled, only when both are empty.
 * Every failure degrades to an emptier section, never an error (fish).
 */

const NEARBY_WATERS_LIMIT = 5;
const RANDOM_POOL_SIZE = 10;

export type VenueSuggestionsState = {
  isLoading: boolean;
  nearby: VenueSuggestion[];
  recent: VenueSuggestion[];
  random: VenueSuggestion[];
};

/** A small seeded RNG (mulberry32): one shuffle per mount, stable across re-renders. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function useVenueSuggestions(t: Transport, location: { state: StartLocationState; origin: Coord | null }): VenueSuggestionsState {
  const origin = location.origin;
  const index = useQuery({ ...lakesIndexQuery(t, { enabled: !!origin }), retry: false });
  const waters = useQuery({
    queryKey: ['partide', 'start', 'nearestWaters', origin ? `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}` : null] as const,
    queryFn: () => browserPublicWaters().nearestWatersTo(origin!.lat, origin!.lng, NEARBY_WATERS_LIMIT),
    enabled: !!origin,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const history = useQuery({ ...partideHistoryQuery(t), retry: false });

  const nearby = useMemo(
    () => (origin ? buildNearbySuggestions(index.data ?? [], waters.data ?? [], origin) : []),
    [origin, index.data, waters.data],
  );
  const sessions = useMemo(() => (history.data?.data ?? []).flatMap(item => recentVenueSessionOf(item) ?? []), [history.data]);

  const locationSettled = location.state !== 'checking';
  const nearbySettled = !origin || ((index.isFetched || index.isError) && (waters.isFetched || waters.isError));
  const historySettled = history.isFetched || history.isError;
  const needRandom = locationSettled && nearbySettled && historySettled && nearby.length === 0 && sessions.length === 0;
  const pool = useQuery({
    queryKey: ['partide', 'start', 'randomLakes'] as const,
    queryFn: () => getLakes(t, { page: 1, pageSize: RANDOM_POOL_SIZE }).then(r => r.data),
    enabled: needRandom,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));

  const sections = useMemo(
    () => buildVenueSections({ nearby, sessions, randomPool: pool.data ?? [], random: seeded(seed) }),
    [nearby, sessions, pool.data, seed],
  );
  const isLoading = !locationSettled || !nearbySettled || !historySettled || (needRandom && !(pool.isFetched || pool.isError));
  return { isLoading, ...sections };
}
