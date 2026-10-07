'use client';

import { Suspense, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  communityActiveInfiniteQuery,
  communityHistoryInfiniteQuery,
  endReachedTarget,
  filterHistoryRows,
  filterVenues,
  type CommunityHistorySessionDTO,
  type CommunityVenueDTO,
  type FilterVenuesOptions,
  type SelectedVenue,
} from '@/core/partide';
import { lakeQuery, publicWaterName } from '@/core/lakes';
import { dedupeByKey } from '@/core/social/domain/profileHistory';
import { browserPublicWaters } from '@/app/(site)/ape-publice/_components/client-source';
import { FilterBar, FilterChipToggle, useListUrlState } from '@/components/templates/T1';
import { VenueFilterDialog, type VenueFilterOption } from '@/components/partide/venue/VenueFilterDialog';
import { readRecentVenueSearches } from '@/components/partide/venue/recentVenueSearches';
import { createBrowserTransport } from '@/lib/client/transport';
import { ExploreList, type ExploreData } from './ExploreList';
import { LiveChip, VenueChip } from './parts';
import { DEFAULT_PLACE, EMPTY_FETCH_LIMIT, isDefaultPlace, placeFromParams, placeToParams, type ExploreChip, type ExplorePlace } from './place';

/*
 * Partide · Explorează — fish features/partide/scenes/CommunityScene.tsx (parity partide.exploreaza),
 * template T1 under the hub's chrome: the horizontal filter bar (owner rule 2) — LIVE, «Cu
 * notificări», «Prieteni», the venue chip — over ALL public partide, live («ÎN DIRECT») then finished
 * («ÎNCHEIATE»), loading more as the end of the list nears.
 *
 * State (fish: local useState) lives in the URL here (./place.ts) and starts from it. The static
 * page carries live page 1 and finished page 1 of the unfiltered view (./state.ts, hydrated); the
 * URL is read in the browser (useSearchParams, behind Suspense — its fallback is the unfiltered
 * screen itself, so the prerendered HTML has the list). A venue changes both query keys (c4); the
 * chips filter the pages already loaded (core communityView). Per-user filtering (the follows) is
 * read under its own Suspense (./ExploreList.tsx), so the public list never waits for the session.
 */

export function ExploreRoot() {
  return (
    <Suspense fallback={<ExploreScreen initial={DEFAULT_PLACE} syncUrl={false} />}>
      <ExploreFromUrl />
    </Suspense>
  );
}

function ExploreFromUrl() {
  const params = useSearchParams();
  // Read once: from here on the screen owns the place and mirrors it into the URL.
  const [initial] = useState(() => placeFromParams(params));
  return <ExploreScreen initial={initial} syncUrl />;
}

const noSubscribe = () => () => {};

function ExploreScreen({ initial, syncUrl }: { initial: ExplorePlace; syncUrl: boolean }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [liveOnly, setLiveOnly] = useState(initial.liveOnly);
  const [chip, setChip] = useState<ExploreChip>(initial.chip);
  // fish selectedVenue carries its own name (a picked lake may have no live partidă to name it);
  // a venue arriving from the URL has only its key until the name is read (below).
  const [venue, setVenue] = useState<{ key: string; name: string | null } | null>(
    initial.venueKey ? { key: initial.venueKey, name: null } : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const venueKey = venue?.key ?? null;
  const venueKeys = useMemo(() => (venueKey ? [venueKey] : []), [venueKey]);

  const place: ExplorePlace = { liveOnly, chip, venueKey };
  useListUrlState(syncUrl ? placeToParams(place) : {});

  const live = useInfiniteQuery(communityActiveInfiniteQuery(t, venueKeys));
  const history = useInfiniteQuery(communityHistoryInfiniteQuery(t, venueKeys));
  // c16 — fish hasLoadedLiveOnceRef: the full skeleton only until live page 1 has answered once;
  // a later key change (a venue picked or cleared) never blanks the list again.
  const [liveLoadedOnce, setLiveLoadedOnce] = useState(false);
  if (live.isSuccess && !liveLoadedOnce) setLiveLoadedOnce(true);

  // Every live venue loaded so far, deduplicated (fish liveRowsAllRaw): the picker's «Cu partide acum».
  const liveAll = useMemo(() => dedupeByKey(live.data?.pages.flatMap(p => p.data) ?? [], v => v.key), [live.data]);
  const historyAll = useMemo(() => dedupeByKey(history.data?.pages.flatMap(p => p.data) ?? [], r => r.documentId), [history.data]);

  const venueName = useVenueName(t, venue, liveAll, historyAll, !live.isPending && !history.isPending);

  // c10 — consecutive fetches that added no visible row; reset whenever a filter changes.
  const [streak, setStreak] = useState(0);
  const filterSig = `${chip}|${venueKey}|${liveOnly}`;
  const [streakSig, setStreakSig] = useState(filterSig);
  if (filterSig !== streakSig) {
    setStreakSig(filterSig);
    setStreak(0);
  }

  const loadMore = useCallback(
    async (opts: FilterVenuesOptions, manual: boolean) => {
      const target = endReachedTarget({ liveOnly, liveHasNextPage: !!live.hasNextPage, historyHasNextPage: !!history.hasNextPage });
      if (target === 'none') return;
      if (!manual && streak >= EMPTY_FETCH_LIMIT) return;
      let before: number;
      let after: number;
      if (target === 'live') {
        if (live.isFetchingNextPage) return;
        const count = (pages: { data: CommunityVenueDTO[] }[] | undefined) =>
          filterVenues(dedupeByKey(pages?.flatMap(p => p.data) ?? [], v => v.key), opts).length;
        before = count(live.data?.pages);
        const result = await live.fetchNextPage();
        after = count(result.data?.pages);
      } else {
        if (history.isFetchingNextPage) return;
        const count = (pages: { data: CommunityHistorySessionDTO[] }[] | undefined) =>
          filterHistoryRows(dedupeByKey(pages?.flatMap(p => p.data) ?? [], r => r.documentId), opts).length;
        before = count(history.data?.pages);
        const result = await history.fetchNextPage();
        after = count(result.data?.pages);
      }
      setStreak(s => (after > before ? 0 : s + 1));
    },
    [liveOnly, live, history, streak],
  );

  const reset = () => {
    setChip('active');
    setVenue(null);
    setLiveOnly(false);
  };
  // c2 — mutually exclusive; the active one again returns to the unfiltered state.
  const toggleChip = (target: Exclude<ExploreChip, 'active'>) => setChip(prev => (prev === target ? 'active' : target));

  const liveOptions = useMemo<VenueFilterOption[]>(
    () => liveAll.map(v => ({ value: v.key, name: v.name, helper: v.locality, imageUrl: v.imageUrl })),
    [liveAll],
  );

  const data: ExploreData = {
    place,
    live,
    liveFirstLoad: live.isPending && !liveLoadedOnce,
    history,
    liveAll,
    historyAll,
    streak,
    loadMore,
    onSeeAllLive: () => setLiveOnly(true),
    onClearFilters: reset,
  };

  return (
    <div className="flex flex-col gap-4 md:gap-5" data-testid="explore-screen">
      <FilterBar label="Filtre partide" onReset={reset} canReset={!isDefaultPlace(place)} resetLabel="Șterge filtrele">
        <LiveChip pressed={liveOnly} onChange={setLiveOnly} />
        <FilterChipToggle label="Cu notificări" pressed={chip === 'urmarite'} onChange={() => toggleChip('urmarite')} />
        <FilterChipToggle label="Prieteni" pressed={chip === 'prieteni'} onChange={() => toggleChip('prieteni')} />
        <VenueChip venueKey={venueKey} name={venueName} expanded={pickerOpen} onClick={() => setPickerOpen(true)} />
      </FilterBar>

      <ExploreList {...data} />

      <VenueFilterDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedKey={venueKey}
        liveOptions={liveOptions}
        onSelect={(v: SelectedVenue | null) => {
          setVenue(v ? { key: v.key, name: v.name } : null);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

/**
 * The venue chip's label: the picked name; for a venue from the URL, the name remembered with the
 * recent picks, else the one a loaded row carries, else the lake / public water read by its id or
 * code. undefined while unknown (the chip shows a bone); a venue that cannot be read is «Locul ales».
 */
function useVenueName(
  t: ReturnType<typeof createBrowserTransport>,
  venue: { key: string; name: string | null } | null,
  liveAll: CommunityVenueDTO[],
  historyAll: CommunityHistorySessionDTO[],
  rowsSettled: boolean,
): string | null | undefined {
  const key = venue?.key ?? null;
  // Browser storage, read after hydration (the server has none): null on the server snapshot.
  const remembered = useSyncExternalStore(
    noSubscribe,
    () => (key ? (readRecentVenueSearches().find(p => p.key === key)?.name ?? null) : null),
    () => null,
  );
  const fromRows = key ? (liveAll.find(v => v.key === key)?.name ?? historyAll.find(r => r.venue.key === key)?.venue.name ?? null) : null;
  const known = venue?.name ?? remembered ?? fromRows;
  // Only once the browser's storage has been read and the rows have answered: a read is the last resort.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const lookup = hydrated && rowsSettled && !known;
  const lakeId = key?.startsWith('lake:') ? key.slice(5) : null;
  const waterCode = key?.startsWith('water:') ? key.slice(6) : null;
  const lake = useQuery({ ...lakeQuery(t, lakeId ?? ''), enabled: lookup && !!lakeId, retry: false });
  const water = useQuery({
    queryKey: ['partide', 'venue-name', key],
    queryFn: async () => {
      const w = await browserPublicWaters().getPublicWaterByLinkCode(waterCode as string);
      if (!w) throw new Error('unknown water');
      return publicWaterName(w);
    },
    enabled: lookup && !!waterCode,
    staleTime: Infinity,
    retry: false,
  });
  if (!venue) return null;
  if (known) return known;
  if (lakeId) return lake.data?.name ?? (lake.isError ? 'Locul ales' : undefined);
  return water.data ?? (water.isError ? 'Locul ales' : undefined);
}
