'use client';

import {
  ArrowPathRoundedSquareIcon,
  ArrowUturnLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
  Squares2X2Icon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolidIcon, StarIcon as StarSolidIcon } from '@heroicons/react/20/solid';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { LakeCard } from '@/components/cards';
import { formatDecimal, formatInt, plural } from '@/components/cards/format';
import { Pill } from '@/components/cards/parts';
import { TextInput } from '@/components/forms/TextInput';
import { FishIcon } from '@/components/icons/brand';
import { Dialog } from '@/components/surfaces/Dialog';
import { ErrorState } from '@/components/surfaces/StateCard';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import {
  ChoiceChips,
  FilterButton,
  FilterSection,
  FilterSwitch,
  ListEmpty,
  ListError,
  ListFooter,
  ListSearch,
} from '@/components/templates/T1';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  EMPTY_LAKE_FILTERS,
  formatNearbyDistanceKm,
  getDistanceKm,
  getLakeFilterChips,
  getRatingTierOptionLabel,
  getRegimeOptions,
  RATING_TIER_ORDER,
  type LakeFilterSection,
  type LakeFilterValue,
  type LakeFilterValues,
  type LakeRatingTier,
} from '@/core/lakes';
import { routes } from '@/lib/routes';
import {
  boundsAround,
  boundsContain,
  MapControlButton,
  ROMANIA_BOUNDS,
  T2BackLink,
  T2CheckChips,
  T2FilterChip,
  T2Layout,
  T2List,
  T2ListHeader,
  T2ListItem,
  T2ListSkeleton,
  T2Map,
  T2MapCard,
  T2MapPill,
  T2RailAction,
  T2SearchPill,
  T2_EXPANDED,
  T2_FLOATING_BUTTON,
  T2Toolbar,
  t2FocusTarget,
  type T2Bounds,
  type T2LatLng,
  type T2MapFocus,
  type T2SheetSnap,
} from '@/components/templates/T2';
import type { DemoLake } from './data';
import type { DemoState } from './states';

/*
 * The first user of T2: fish «Hartă bălți» (lakes.results-map, /balti/harta) on real local CMS data.
 * Viewport, clustering and filters run in the browser here (see data.ts for why).
 */

/** Mirrors the CMS `minRatingForTier` (src/api/lake/utils/rating-tier.ts). */
const TIER_MIN: Record<LakeRatingTier, number> = { excellent: 4.5, very_good: 4, good: 3.5, acceptable: 3 };

/** «Locația mea» frames min(radius, 20) km around the user (fish locate)… */
const LOCATE_KM = 20;
/** …and each press while still centred there zooms in 5 km, down to 5 km (parity c21). */
const LOCATE_STEP_KM = 5;

/** A fixed point for the «located» state (Piața Unirii, București): screenshots need no permission. */
const DEMO_USER: T2LatLng = { lat: 44.4268, lng: 26.1025 };

const CHIP_ICON: Record<Exclude<LakeFilterSection, 'all'>, ReactNode> = {
  regime: <ArrowPathRoundedSquareIcon aria-hidden />,
  facilities: <Squares2X2Icon aria-hidden />,
  rating: <StarIcon aria-hidden />,
  booking: <CalendarDaysIcon aria-hidden />,
  // Outline, like the heroicons beside it (Fundații §05: outline in controls, solid only for
  // presence): the brand fish silhouette stroked at ~1px, the 24/outline weight at 16px.
  // TODO(kit): a FishOutlineIcon in components/icons/brand (this task may only touch T2).
  fish: <FishIcon aria-hidden fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinejoin="round" />,
};

/** Cards per list page (fish lakesInBbox: 7, then infinite scroll). */
const PAGE_SIZE = 7;

/** fish nearby mode: the default radius («În jurul meu · 50km»). */
const NEARBY_KM = 50;

/** «0 results in viewport» (fish c17): the map starts over the Black Sea, off the coast. */
const SEA_BOUNDS: T2Bounds = [30.4, 43.3, 31.4, 43.9];

/** The county / city most lakes are in: what «bbox-failed» searches for (fish c6). */
function busiestPlace(lakes: DemoLake[]): string {
  const counts = new Map<string, number>();
  for (const l of lakes) {
    for (const part of l.location.split(/\s*[,·]\s*/)) {
      if (part.length > 2) counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Ilfov';
}

function normalise(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function countFilters(f: LakeFilterValues) {
  return f.selectedFish.length + f.selectedRegimes.length + f.selectedFacilities.length + (f.ratingTier ? 1 : 0) + (f.bookableOnly ? 1 : 0);
}

function matches(lake: DemoLake, f: LakeFilterValues, query: string, withinKm?: (lake: DemoLake) => boolean): boolean {
  if (withinKm && !withinKm(lake)) return false;
  if (query && !normalise(`${lake.name} ${lake.location}`).includes(normalise(query))) return false;
  if (f.selectedRegimes.length && !f.selectedRegimes.some((r) => r.name === lake.regime)) return false;
  if (f.selectedFish.length && !f.selectedFish.some((s) => lake.species.includes(s.name))) return false;
  if (f.selectedFacilities.length && !f.selectedFacilities.every((s) => lake.facilities.includes(s.name))) return false;
  if (f.ratingTier && (lake.rating ?? 0) < TIER_MIN[f.ratingTier]) return false;
  if (f.bookableOnly && !lake.bookable) return false;
  return true;
}

function valuesOf(names: string[]): LakeFilterValue[] {
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ro')).map((n) => ({ id: n, name: n, documentId: n }));
}

/**
 * The «Pin selectat» lake: the one with the most to show (rating, booking, a price, photos) —
 * Chita Lake on the local CMS — so the state shows the full card.
 */
function richestLake(lakes: DemoLake[]): DemoLake | undefined {
  const score = (l: DemoLake) =>
    (/chita/i.test(l.name) ? 10 : 0) + (l.rating != null ? 4 : 0) + (l.bookable ? 2 : 0) + (l.priceMin != null ? 2 : 0) + Math.min(l.photos.length, 3);
  return lakes.reduce<DemoLake | undefined>((best, l) => (!best || score(l) > score(best) ? l : best), undefined);
}

/**
 * LakeCard's price, for the pin card's signature number (same t-stat + «RON / tură» markup).
 * TODO(kit): export LakeCard's price formatting and its LakeRating / LakePrice parts from
 * components/cards/LakeCard.tsx so these copies go (this task may only touch T2).
 */
function priceLabel(l: DemoLake): string | null {
  if (l.priceMin != null && l.priceMax != null && l.priceMax !== l.priceMin) return `${formatInt(l.priceMin)}–${formatInt(l.priceMax)}`;
  const one = l.priceMin ?? l.priceMax;
  return one != null ? formatInt(one) : null;
}

/** «3,4 km», «12 km» — fish formatNearbyDistanceKm with the Romanian decimal comma. */
function distanceLabel(km: number): string | null {
  return formatNearbyDistanceKm(km)?.replace('.', ',') ?? null;
}

/** `outer` holds all of `inner` (a little slack: fitBounds pads the frame it was asked for). */
function containsBounds(outer: T2Bounds, inner: T2Bounds, slack = 0.05): boolean {
  return (
    outer[0] <= inner[0] + slack && outer[1] <= inner[1] + slack && outer[2] >= inner[2] - slack && outer[3] >= inner[3] - slack
  );
}

function initialFilters(state: DemoState): LakeFilterValues {
  if (state !== 'filtered') return EMPTY_LAKE_FILTERS;
  return { ...EMPTY_LAKE_FILTERS, selectedRegimes: [getRegimeOptions()[0]], bookableOnly: true };
}

export function LakesMapDemo({
  state,
  forced = false,
  lakes,
  bookingKnown = true,
  cardsKnown = true,
  staticMap = false,
}: {
  state: DemoState;
  /**
   * `state` is what the URL asked for (not what the CMS turned it into): «Reîncearcă» on a forced
   * error / partial state leaves it for the real results, so the recovery path can be seen.
   */
  forced?: boolean;
  lakes: DemoLake[];
  /** The booking read answered (else «Rezervări» is unavailable, not «no lake bookable»). */
  bookingKnown?: boolean;
  /** The card read answered (else species / facilities are unavailable, not «none»). */
  cardsKnown?: boolean;
  /**
   * First paint (the Suspense fallback and ?state=loading): the map's chrome with no MapLibre
   * instance (the real one is built once, when the data lands).
   */
  staticMap?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const split = useBreakpoint() !== 'mobile';
  const [retrying, startRetry] = useTransition();
  /** A forced demo state recovers by leaving it; the real failure re-reads the CMS. */
  const retry = () => startRetry(() => (forced ? router.replace(pathname) : router.refresh()));
  const partialNoticeId = useId();
  const loading = state === 'loading';
  const failed = state === 'error';
  const fetching = state === 'fetching';
  const data = useMemo(() => (state === 'empty' ? [] : lakes), [state, lakes]);
  /** Nothing to search, filter or locate: the first page has not arrived, it failed, or it is empty. */
  const noData = loading || failed || data.length === 0;

  const [filters, setFilters] = useState<LakeFilterValues>(() => initialFilters(state));
  const [query, setQuery] = useState(() => (state === 'no-match' ? 'zzzz' : state === 'bbox-failed' ? busiestPlace(lakes) : ''));
  /** fish nearby mode: lakes within this radius of the user, nearest first. */
  const [nearbyKm, setNearbyKm] = useState<number | null>(state === 'nearby' ? NEARBY_KM : null);
  // «located» / «nearby» start framed on the user (not Romania, then a jump), so the list does not
  // reshuffle. «bbox-failed»: the county's box did not resolve — the Romania overview (fish c6).
  const [startBounds] = useState<T2Bounds>(() =>
    state === 'located'
      ? boundsAround(DEMO_USER, LOCATE_KM)
      : state === 'nearby'
        ? boundsAround(DEMO_USER, NEARBY_KM)
        : state === 'viewport-empty'
          ? SEA_BOUNDS
          : ROMANIA_BOUNDS,
  );
  const [bounds, setBounds] = useState<T2Bounds>(startBounds);
  // fish c8: a viewport-scoped list waits for the map's real viewport (not just the box asked for),
  // so the first cards are already the right ones. Romania holds every lake, so only the states
  // that start elsewhere, and «selected» (the map frames the pin on its own, closer in), wait.
  const [viewportKnown, setViewportKnown] = useState(startBounds === ROMANIA_BOUNDS && state !== 'selected');
  const [selectedId, setSelectedId] = useState<string | null>(() => (state === 'selected' ? (richestLake(lakes)?.id ?? null) : null));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState<T2SheetSnap>(state === 'list-hidden' ? 'hidden' : state === 'list-full' ? 'full' : 'half');
  const [panel, setPanel] = useState<LakeFilterSection | null>(state === 'filters-open' ? 'all' : null);
  const [draft, setDraft] = useState<LakeFilterValues>(filters);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [userLocation, setUserLocation] = useState<T2LatLng | null>(state === 'located' || state === 'nearby' ? DEMO_USER : null);
  const [focus, setFocus] = useState<T2MapFocus | null>(null);
  /** Km framed around the user while the map is still centred there (a pan forgets it). */
  const [locateKm, setLocateKm] = useState<number | null>(state === 'located' ? LOCATE_KM : null);
  const [locating, setLocating] = useState(state === 'locating');
  const [locationProblem, setLocationProblem] = useState<'denied' | 'unavailable' | null>(
    state === 'location-denied' ? 'denied' : state === 'location-unavailable' ? 'unavailable' : null,
  );

  /** Changing it moves focus to the list once it re-renders (T2Layout `listFocusKey`). */
  const [listFocusKey, setListFocusKey] = useState<number | null>(null);

  const panelOpen = panel !== null;
  // With the user's position (fish c12/c23): every lake carries its distance and the list is nearest first.
  const distanceKm = useMemo(
    () =>
      userLocation
        ? new Map(
            data.map((l) => [l.id, getDistanceKm({ latitude: userLocation.lat, longitude: userLocation.lng }, { latitude: l.lat, longitude: l.lng })]),
          )
        : null,
    [data, userLocation],
  );
  const withinKm = useMemo(
    () => (nearbyKm != null && distanceKm ? (l: DemoLake) => (distanceKm.get(l.id) ?? Infinity) <= nearbyKm : undefined),
    [nearbyKm, distanceKm],
  );
  const filtered = useMemo(() => data.filter((l) => matches(l, filters, query, withinKm)), [data, filters, query, withinKm]);
  const visible = useMemo(() => {
    const inView = filtered.filter((l) => boundsContain(bounds, l));
    return distanceKm ? inView.sort((a, b) => (distanceKm.get(a.id) ?? 0) - (distanceKm.get(b.id) ?? 0)) : inView;
  }, [filtered, bounds, distanceKm]);
  const distanceOf = (id: string) => {
    const km = distanceKm?.get(id);
    return km == null ? null : distanceLabel(km);
  };
  const selected = filtered.find((l) => l.id === selectedId) ?? null;
  const filterCount = countFilters(filters);
  const hasQuery = query.trim().length > 0;
  const hasAnyFilter = filterCount > 0 || hasQuery || nearbyKm != null;

  const facilityOptions = useMemo(() => valuesOf(lakes.flatMap((l) => l.facilities)), [lakes]);
  const fishOptions = useMemo(() => valuesOf(lakes.flatMap((l) => l.species)), [lakes]);
  const draftCount = useMemo(() => data.filter((l) => matches(l, draft, query, withinKm)).length, [data, draft, query, withinKm]);

  /* ----------------------------------------------------------------------------- paging */
  // fish lakesInBbox: 7 cards a page, more as the list scrolls; a new question starts at page 1.
  const [pages, setPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(state === 'more-loading');
  const [moreError, setMoreError] = useState(state === 'more-error');
  const pageKey = JSON.stringify([filters, query, nearbyKm, bounds]);
  const [pagedFor, setPagedFor] = useState(pageKey);
  if (pagedFor !== pageKey) {
    setPagedFor(pageKey);
    setPages(1);
  }
  const moreTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(moreTimer.current), []);
  const loadMore = () => {
    if (loadingMore) return;
    setMoreError(false);
    setLoadingMore(true);
    // Demo: the whole set is in memory; a real page is a /lakes/in-bbox request.
    moreTimer.current = window.setTimeout(() => {
      setPages((n) => n + 1);
      setLoadingMore(false);
    }, 400);
  };

  /** Opening the panel starts a draft from the applied filters; switching section keeps the draft. */
  const openPanel = (section: LakeFilterSection) => {
    if (!panelOpen) setDraft(filters);
    setPanel(section);
  };
  // Both unmount the button that ran them: focus goes to the list they changed (T2Layout).
  const clearAll = () => {
    setFilters(EMPTY_LAKE_FILTERS);
    setQuery('');
    setNearbyKm(null);
    setSelectedId(null);
    setFocus({ key: `clear-${Date.now()}`, bounds: ROMANIA_BOUNDS });
    setListFocusKey(Date.now());
  };
  const showRomania = () => {
    setFocus({ key: `ro-${Date.now()}`, bounds: ROMANIA_BOUNDS });
    setListFocusKey(Date.now());
  };

  const frameUser = (at: T2LatLng, km: number) => {
    setLocateKm(km);
    setFocus({ key: `me-${Date.now()}`, bounds: boundsAround(at, km) });
  };
  const locate = () => {
    if (locating) return;
    // Still centred on the user: zoom in one step (fish), no new position request.
    if (userLocation && locateKm != null) return frameUser(userLocation, Math.max(LOCATE_STEP_KM, locateKm - LOCATE_STEP_KM));
    if (!('geolocation' in navigator)) return setLocationProblem('unavailable');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(at);
        frameUser(at, LOCATE_KM);
      },
      (err) => {
        setLocating(false);
        // 1: permission denied → how to allow it; 2 (unavailable) / 3 (timeout) → try again.
        setLocationProblem(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const countTitle =
    nearbyKm != null
      ? `${plural(visible.length, 'baltă', 'bălți')} pe o rază de ${nearbyKm} km`
      : `${plural(visible.length, 'baltă', 'bălți')} în această zonă`;
  const settling = !viewportKnown && !noData;
  /** First load: skeletons and the header shimmer. A refresh (`fetching`) keeps the last answer, faded. */
  const firstLoad = loading || settling;

  // What excludes every lake, in words (the empty state's title and what the live region says).
  const quoted = `„${query.trim()}”`;
  const noMatchTitle =
    nearbyKm != null && !hasQuery && !filterCount
      ? `Nicio baltă pe o rază de ${nearbyKm} km`
      : hasQuery && filterCount
        ? `Nicio baltă nu se potrivește căutării ${quoted} și filtrelor alese`
        : hasQuery
          ? `Nicio baltă nu se potrivește căutării ${quoted}`
          : 'Nicio baltă nu se potrivește filtrelor alese';
  const noMatchDescription =
    hasQuery && !filterCount
      ? 'Verifică scrierea sau caută după județ ori localitate.'
      : hasQuery
        ? 'Schimbă căutarea sau renunță la o parte din filtre.'
        : nearbyKm != null && !filterCount
          ? 'Mută harta ca să vezi bălțile din alte zone.'
          : 'Renunță la o parte din filtre ca să vezi mai multe bălți.';
  const viewportHint = hasAnyFilter
    ? 'Micșorează sau mută harta ori modifică filtrele pentru a vedea bălțile.'
    : 'Micșorează sau mută harta pentru a vedea bălțile.';
  const emptyTitle = 'Nu există încă bălți pe hartă';

  /* ----------------------------------------------------------------------------- list content */
  // An empty / error state has no card around it (fish: plain centred text) and sits in the middle
  // of the free list height — in the phone sheet and in the column from 768 alike.
  const bare = (state: ReactNode) => (
    <div className="grid flex-1 place-items-center *:w-full *:bg-transparent *:px-2 *:shadow-none">{state}</div>
  );
  // The live region says what the list shows: one branch picks both.
  let list: ReactNode;
  let announcement: string;
  if (firstLoad) {
    list = <T2ListSkeleton />;
    announcement = 'Se încarcă rezultatele';
  } else if (failed) {
    list = bare(<ListError title="Nu am putut încărca bălțile" onRetry={retry} retrying={retrying} retryLabel="Reîncearcă" />);
    // ListError is its own alert.
    announcement = '';
  } else if (!data.length) {
    // Nothing anywhere (a CMS with no lakes yet): no action would change that, so none is offered.
    list = bare(<ListEmpty title={emptyTitle} description="Bălțile apar aici pe măsură ce sunt adăugate în Bluvi." />);
    announcement = emptyTitle;
  } else if (!filtered.length) {
    // The filters / search exclude every lake in the country: moving the map cannot help.
    list = bare(
      <ListEmpty
        title={noMatchTitle}
        description={noMatchDescription}
        action={
          <Button variant="secondary" icon={<ArrowUturnLeftIcon />} onClick={clearAll}>
            {hasQuery && !filterCount && nearbyKm == null ? 'Șterge căutarea' : 'Șterge filtre'}
          </Button>
        }
      />,
    );
    announcement = noMatchTitle;
  } else if (!visible.length) {
    // fish c17: «0 bălți în această zonă» + how to get some — there are lakes, just not in view.
    // «Vezi toată România» only when the map does not already show it (else it would do nothing).
    const romaniaInView = containsBounds(bounds, ROMANIA_BOUNDS);
    list = bare(
      <ListEmpty
        title={countTitle}
        description={viewportHint}
        action={
          !romaniaInView ? (
            <Button variant="secondary" onClick={showRomania}>
              Vezi toată România
            </Button>
          ) : hasAnyFilter ? (
            <Button variant="secondary" icon={<ArrowUturnLeftIcon />} onClick={clearAll}>
              Șterge filtre
            </Button>
          ) : null
        }
      />,
    );
    announcement = `${countTitle}. ${viewportHint}`;
  } else {
    const selectedAt = selectedId ? visible.findIndex((l) => l.id === selectedId) : -1;
    // A pin selected on the map past the loaded pages brings its page in (the list reveals it).
    const shown = visible.slice(0, Math.max(pages * PAGE_SIZE, selectedAt + 1));
    list = (
      <>
        {!bookingKnown || !cardsKnown ? (
          // Missing enrichment is said, not hidden: cards without species or «Rezervare online»
          // would otherwise read as «none» / «not bookable».
          <div id={partialNoticeId} className="mb-3">
            <ErrorState
              title="Unele detalii (specii, facilități, rezervări) nu s-au încărcat."
              description="Bălțile și harta sunt la zi; filtrele lor sunt indisponibile momentan."
              action={
                <Button
                  variant="secondary"
                  size="compact"
                  aria-disabled={retrying || undefined}
                  aria-busy={retrying || undefined}
                  onClick={() => {
                    if (!retrying) retry();
                  }}
                >
                  {retrying ? 'Se reîncarcă…' : 'Reîncearcă'}
                </Button>
              }
            />
          </div>
        ) : null}
        <T2List label="Bălți" stale={fetching}>
          {shown.map((lake) => (
            <T2ListItem key={lake.id} id={lake.id} selected={lake.id === selectedId} onHighlight={setHighlightedId}>
              <LakeCard
                name={lake.name}
                locationLabel={[distanceOf(lake.id), lake.location].filter(Boolean).join(' · ')}
                species={lake.species.slice(0, 3)}
                rating={lake.rating}
                priceMin={lake.priceMin}
                priceMax={lake.priceMax}
                onlineBooking={bookingKnown && lake.bookable}
                imageSrc={lake.photos[0]}
                href={routes.lake(lake.id)}
              />
            </T2ListItem>
          ))}
        </T2List>
        <ListFooter
          hasMore={shown.length < visible.length}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          error={moreError}
          shown={shown.length}
          total={visible.length}
          noun="bălți"
          errorLabel="Nu am putut încărca mai multe bălți."
        />
      </>
    );
    announcement = countTitle;
  }
  if (fetching && !firstLoad) announcement = 'Se încarcă rezultatele';

  /* ----------------------------------------------------------------------------- toolbar */
  // While the panel is open the rail shows and edits the draft (the panel's «Aplică» commits it).
  const railValues = panelOpen ? draft : filters;
  const chips = (
    <>
      {getLakeFilterChips(railValues).map((chip) => (
        <T2FilterChip
          key={chip.key}
          label={chip.label}
          count={chip.badgeCount}
          active={chip.active}
          icon={CHIP_ICON[chip.key]}
          kind={chip.key === 'booking' ? 'toggle' : 'menu'}
          expanded={chip.key === 'booking' ? undefined : panel === chip.key}
          // A read that failed cannot filter: the chip says so instead of answering «no lake».
          disabled={chip.key === 'booking' ? !bookingKnown : (chip.key === 'fish' || chip.key === 'facilities') && !cardsKnown}
          describedBy={partialNoticeId}
          onClick={() => {
            if (chip.key !== 'booking') return openPanel(chip.key);
            if (panelOpen) setDraft((d) => ({ ...d, bookableOnly: !d.bookableOnly }));
            else setFilters((f) => ({ ...f, bookableOnly: !f.bookableOnly }));
          }}
        />
      ))}
    </>
  );

  // The same words at every width: a filter of this map, not the site search (the top bar's).
  const placeholder = 'Filtrează bălțile de pe hartă…';
  const summary = nearbyKm != null ? `În jurul meu · ${nearbyKm} km` : query.trim();
  const clearLabel = 'Șterge filtre';
  const toolbar = (
    <T2Toolbar
      title="Hartă bălți"
      disabled={noData}
      leading={<T2BackLink href={routes.lakes()} label="Înapoi la Bălți" />}
      search={
        <>
          {/* Phone: fish MapChrome's pill opens the search. From 768: the field types in place. */}
          <div className="md:hidden">
            <T2SearchPill
              summary={summary || placeholder}
              placeholder={!summary}
              searchLabel={summary ? `Filtrează bălțile de pe hartă: ${summary}` : 'Filtrează bălțile de pe hartă'}
              onSearch={() => {
                setSearchDraft(query);
                setSearchOpen(true);
              }}
            />
          </div>
          <ListSearch
            className="hidden md:block"
            label="Filtrează bălțile de pe hartă după nume, județ sau localitate"
            placeholder={placeholder}
            committed={query}
            onCommit={(v) => {
              setQuery(v);
              setSelectedId(null);
            }}
            onClear={() => setQuery('')}
          />
        </>
      }
      filtersButton={
        // The T1 button at every width (icon only on a phone, floating there; the rail's first item
        // from 1280), with the «open» look while the panel is open.
        <FilterButton
          count={countFilters(railValues)}
          expanded={panel === 'all'}
          desktopHidden={false}
          onClick={() => openPanel('all')}
          className={cn(T2_EXPANDED, 'max-md:shadow-e2!', '[[data-solid]_&]:shadow-e0!')}
        />
      }
      filters={chips}
      // The panel has its own «Resetează»; while it is open this would edit the applied filters
      // behind the draft, so it steps aside.
      trailing={
        hasAnyFilter && !panelOpen ? (
          <Button variant="ghost" icon={<ArrowUturnLeftIcon />} onClick={clearAll}>
            {clearLabel}
          </Button>
        ) : null
      }
      railTrailing={
        hasAnyFilter && !panelOpen ? (
          <T2RailAction icon={<ArrowUturnLeftIcon aria-hidden />} onClick={clearAll}>
            {clearLabel}
          </T2RailAction>
        ) : null
      }
    />
  );

  /* ----------------------------------------------------------------------------- map */
  const map = (
    <T2Map
      label="Hartă bălți"
      points={noData ? [] : filtered}
      pointLabel={(l) => l.name}
      clusterLabel={(n) => `${plural(n, 'baltă', 'bălți')} — mărește harta aici`}
      selectedId={selectedId}
      highlightedId={highlightedId}
      onSelect={(l) => setSelectedId(l.id)}
      initialBounds={startBounds}
      placeholder={staticMap}
      loadingStatus={!loading && !fetching}
      forceUnavailable={state === 'map-failed'}
      listAvailable={!failed && !loading}
      // fish c18: until the first page arrives a results skeleton covers the map (a phone sees only
      // the map); from 768 a lighter veil — the list column carries the skeleton. Inside the map's
      // layer, under the markers and the floating controls, which stay opaque over it.
      veil={loading ? <div aria-hidden className="size-full animate-shimmer opacity-80 md:opacity-40" /> : null}
      focus={focus}
      userLocation={userLocation}
      onViewportChange={(v) => {
        setBounds(v.bounds);
        setViewportKnown(true);
      }}
      onUserMoveStart={() => {
        setLocateKm(null);
        // Phone only (fish hides the sheet on a pan): from 768 there is no sheet to hide, and a
        // «hidden» set there would greet a later phone-width window with a list nobody hid.
        if (!split) setSheetSnap((s) => (s === 'full' ? s : 'hidden'));
      }}
      controls={
        <div className="overflow-hidden rounded-control shadow-e2">
          <MapControlButton
            label="Locația mea"
            pressed={!!userLocation}
            busy={locating}
            disabled={noData}
            onClick={locate}
          >
            {/* Fundații §05: solid 20 only for presence — the user IS shown. */}
            {userLocation ? (
              <span className="flex">
                <MapPinSolidIcon aria-hidden className="size-5" />
              </span>
            ) : (
              <MapPinIcon aria-hidden />
            )}
          </MapControlButton>
        </div>
      }
    />
  );

  const mapStatus =
    loading || fetching ? (
      <T2MapPill busy>Se încarcă…</T2MapPill>
    ) : failed ? (
      <T2MapPill tone="warning">Bălțile nu s-au încărcat</T2MapPill>
    ) : hasAnyFilter ? (
      // Phone: the action floats over the map as a kit button (radius 10, opaque, e2).
      <span className="md:hidden">
        <Button variant="ghost" icon={<ArrowUturnLeftIcon />} onClick={clearAll} className={cn('bg-surface text-ink', T2_FLOATING_BUTTON)}>
          {clearLabel}
        </Button>
      </span>
    ) : null;

  const price = selected ? priceLabel(selected) : null;
  // The rating as the list card shows it (LakeCard markup: right end of the title row, 14px solid
  // star, t-control, one decimal), so one lake reads the same in both halves of the selection.
  const rating =
    selected?.rating != null ? (
      // Baseline-aligned (T2MapCard's title row): the numerals carry the baseline, the star centres.
      <p className="flex shrink-0 items-baseline gap-0.75 t-control text-ink">
        <StarSolidIcon aria-hidden className="size-3.5 self-center text-rating" />
        <span className="sr-only">Rating </span>
        <span>{formatDecimal(selected.rating, 1, 1)}</span>
      </p>
    ) : null;
  // The signature number as on the card (t-stat + t-label unit). Not SignatureNumber size="stat":
  // that is the 40px StatTile number, twice the card's.
  const stat = price ? (
    <p className="flex items-baseline gap-1">
      <span className="t-stat text-ink">{price}</span>
      <span className="t-label text-muted">RON / tură</span>
    </p>
  ) : null;
  // The caption exactly as the list card builds it (LakeCard: place · species), on one line.
  const selectedMeta = selected
    ? [[distanceOf(selected.id), selected.location].filter(Boolean).join(' · '), selected.species.slice(0, 3).join(', ')]
        .filter(Boolean)
        .join(' · ')
    : '';
  const detail = selected ? (
    <T2MapCard
      title={selected.name}
      href={routes.lake(selected.id)}
      onClose={() => setSelectedId(null)}
      returnFocusTo={() => t2FocusTarget(selected.id)}
      media={<PhotoStrip photos={selected.photos} bookable={bookingKnown && selected.bookable} />}
      titleAside={rating}
      meta={selectedMeta ? <span className="truncate">{selectedMeta}</span> : null}
      stat={stat}
      actions={
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
          target="_blank"
          rel="noreferrer"
          className={buttonClass({ variant: 'secondary', size: 'compact' })}
        >
          Direcții
        </a>
      }
    />
  ) : null;

  return (
    <>
      <T2Layout
        toolbar={toolbar}
        listLabel="Rezultate"
        listHeader={
          failed || (!firstLoad && !visible.length) ? null : (
            <T2ListHeader title={countTitle} loading={firstLoad} stale={fetching} />
          )
        }
        list={list}
        busy={firstLoad || fetching || retrying}
        listFocusKey={listFocusKey}
        map={map}
        mapStatus={mapStatus}
        announcement={announcement}
        detail={detail}
        sheetSnap={sheetSnap}
        onSheetSnapChange={setSheetSnap}
        showListLabel={`Vezi lista (${visible.length})`}
        panel={{
          open: panelOpen,
          onClose: () => setPanel(null),
          returnFocusTo: () =>
            [...document.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"][aria-label^="Filtre"]')].find(
              (b) => b.getClientRects().length > 0,
            ) ?? null,
          title: 'Filtre',
          subtitle: 'Se aplică pe hartă și în listă',
          children: (
            <FiltersBody
              draft={draft}
              setDraft={setDraft}
              section={panel ?? 'all'}
              facilityOptions={facilityOptions}
              fishOptions={fishOptions}
              bookingKnown={bookingKnown}
              cardsKnown={cardsKnown}
            />
          ),
          footer: (
            // Phone: «Aplică» fills the sheet's width. From 768 both sit together on the right,
            // sized to their labels.
            <div className="flex items-center gap-3 md:justify-end">
              <Button variant="ghost" onClick={() => setDraft(EMPTY_LAKE_FILTERS)} disabled={countFilters(draft) === 0}>
                Resetează
              </Button>
              <Button
                className="flex-1 md:flex-none"
                onClick={() => {
                  setFilters(draft);
                  setPanel(null);
                }}
              >
                {`Aplică · ${plural(draftCount, 'baltă', 'bălți')}`}
              </Button>
            </div>
          ),
        }}
      />

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Filtrează bălțile"
        closeButton
        actions={
          <>
            <Button variant="ghost" onClick={() => setSearchOpen(false)}>
              Renunță
            </Button>
            <Button
              onClick={() => {
                setQuery(searchDraft.trim());
                setNearbyKm(null);
                setSelectedId(null);
                setSearchOpen(false);
              }}
            >
              Filtrează
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(searchDraft.trim());
            setNearbyKm(null);
            setSelectedId(null);
            setSearchOpen(false);
          }}
        >
          <TextInput
            label="Baltă, județ sau localitate"
            placeholder="Numele bălții, județul sau localitatea"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            autoFocus
            helper="Demo: filtrează după nume și localitate. Căutarea reală e lakes.search (M1)."
          />
        </form>
      </Dialog>

      <Dialog
        open={locationProblem === 'denied'}
        onClose={() => setLocationProblem(null)}
        title="Găsește bălți aproape de tine"
        description="Activează localizarea ca să îți arătăm bălțile din apropiere. Permite accesul la locație din bara de adrese a browserului (iconița de lângă adresă), apoi apasă din nou pe „Locația mea”."
        closeButton
        actions={<Button onClick={() => setLocationProblem(null)}>Am înțeles</Button>}
      />

      <Dialog
        open={locationProblem === 'unavailable'}
        onClose={() => setLocationProblem(null)}
        title="Nu am putut afla locația"
        description="Încearcă din nou. Dacă nu merge, verifică dacă localizarea e pornită pe dispozitiv."
        closeButton
        actions={
          <>
            <Button variant="ghost" onClick={() => setLocationProblem(null)}>
              Renunță
            </Button>
            <Button
              onClick={() => {
                setLocationProblem(null);
                locate();
              }}
            >
              Încearcă din nou
            </Button>
          </>
        }
      />
    </>
  );
}

/**
 * fish LakeMapPinCard: up to 3 photos — the first large, the others stacked beside it — with the
 * list card's photo pill («Rezervare online», CardPhoto's place: bottom-2.5 left-2.5).
 */
function PhotoStrip({ photos, bookable }: { photos: string[]; bookable: boolean }) {
  const pill = bookable ? (
    <Pill tone="light" className="absolute bottom-2.5 left-2.5">
      Rezervare online
    </Pill>
  ) : null;
  // h-33: the list card's photo band (CardPhoto, 132px), so both halves of a selection match.
  if (!photos.length) return <div className="relative h-33 bg-soft-fill">{pill}</div>;
  return (
    <div className={cn('relative grid h-33 gap-0.5', photos.length > 1 ? 'grid-cols-[2fr_1fr]' : 'grid-cols-1')}>
      <div className="relative row-span-2">
        <Image src={photos[0]} alt="" fill sizes="(min-width: 768px) 260px, 66vw" className="object-cover" />
      </div>
      {photos.slice(1, 3).map((src) => (
        <div key={src} className={cn('relative', photos.length === 2 && 'row-span-2')}>
          <Image src={src} alt="" fill sizes="(min-width: 768px) 130px, 33vw" className="object-cover" />
        </div>
      ))}
      {pill}
    </div>
  );
}

/**
 * Filter panel body: one block per section (fish LakeFilterPickerSheet), with the kit filter
 * controls T1 uses (FilterSection legends, ChoiceChips / checkbox chips, FilterSwitch), so «Filtre»
 * looks and behaves the same in T1 and T2. Hierarchy: panel title (t-title2) → section legend
 * (t-label, muted, uppercase) → choices.
 */
function FiltersBody({
  draft,
  setDraft,
  section,
  facilityOptions,
  fishOptions,
  bookingKnown,
  cardsKnown,
}: {
  draft: LakeFilterValues;
  setDraft: (next: LakeFilterValues) => void;
  section: LakeFilterSection;
  facilityOptions: LakeFilterValue[];
  fishOptions: LakeFilterValue[];
  bookingKnown: boolean;
  cardsKnown: boolean;
}) {
  const toggle = (key: 'selectedRegimes' | 'selectedFacilities' | 'selectedFish', v: LakeFilterValue) => {
    const has = draft[key].some((x) => x.id === v.id);
    setDraft({ ...draft, [key]: has ? draft[key].filter((x) => x.id !== v.id) : [...draft[key], v] });
  };
  const show = (s: LakeFilterSection) => section === 'all' || section === s;
  const none = <p className="t-caption text-muted">Nicio opțiune momentan.</p>;
  /** The read behind the section failed: unknown, not empty. */
  const unavailable = <p className="t-caption text-muted">Indisponibil momentan. Celelalte filtre funcționează.</p>;
  return (
    <div className="flex flex-col gap-7 pt-3">
      {show('regime') && (
        <FilterSection title="Regim">
          <T2CheckChips options={getRegimeOptions()} selected={draft.selectedRegimes} onToggle={(o) => toggle('selectedRegimes', o)} />
        </FilterSection>
      )}
      {show('rating') && (
        <FilterSection title="Rating">
          <ChoiceChips<LakeRatingTier | 'any'>
            name="rating"
            options={[
              { value: 'any', label: 'Oricare' },
              ...RATING_TIER_ORDER.map((tier) => ({ value: tier, label: getRatingTierOptionLabel(tier) })),
            ]}
            value={draft.ratingTier ?? 'any'}
            onChange={(v) => setDraft({ ...draft, ratingTier: v === 'any' ? null : v })}
          />
        </FilterSection>
      )}
      {section === 'all' && (
        <FilterSection title="Rezervări">
          <FilterSwitch
            label="Doar cu rezervare online"
            description={bookingKnown ? 'Bălțile unde poți rezerva un loc din Bluvi.' : 'Indisponibil momentan.'}
            checked={bookingKnown && draft.bookableOnly}
            disabled={!bookingKnown}
            onChange={(bookableOnly) => setDraft({ ...draft, bookableOnly })}
          />
        </FilterSection>
      )}
      {show('facilities') && (
        <FilterSection title="Facilități">
          {!cardsKnown ? (
            unavailable
          ) : facilityOptions.length ? (
            <T2CheckChips options={facilityOptions} selected={draft.selectedFacilities} onToggle={(o) => toggle('selectedFacilities', o)} />
          ) : (
            none
          )}
        </FilterSection>
      )}
      {show('fish') && (
        <FilterSection title="Pești">
          {!cardsKnown ? (
            unavailable
          ) : fishOptions.length ? (
            <T2CheckChips options={fishOptions} selected={draft.selectedFish} onToggle={(o) => toggle('selectedFish', o)} />
          ) : (
            none
          )}
        </FilterSection>
      )}
    </div>
  );
}
