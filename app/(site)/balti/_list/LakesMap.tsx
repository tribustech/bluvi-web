'use client';

import { ArrowUturnLeftIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolidIcon, StarIcon } from '@heroicons/react/20/solid';
import { formatDecimal, formatInt } from '@/components/cards';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { plural } from '@/components/cards/format';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { FilterBar, FilterButton, ListEmpty, ListError, ListFooter } from '@/components/templates/T1';
import {
  boundsAround,
  MapControlButton,
  T2BackLink,
  T2FilterChip,
  T2Layout,
  T2List,
  T2ListHeader,
  T2ListItem,
  T2Map,
  T2MapPill,
  T2SearchPill,
  T2_EXPANDED,
  T2_FLOATING_BUTTON,
  T2Toolbar,
  t2FocusTarget,
  type T2Bounds,
  type T2MapFocus,
  type T2SheetSnap,
  type T2MapProps,
} from '@/components/templates/T2';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  bboxToMapRegion,
  COUNTRY_OVERVIEW_REGION,
  getDistanceKm,
  getFocusSignature,
  getLakeFilterChips,
  getLakesSearchSummary,
  isRegionCenteredOn,
  lakeMapClustersQuery,
  lakeQuery,
  lakesFocusBboxQuery,
  lakesInBboxInfiniteQuery,
  nextLocateRadiusKm,
  regionToBbox,
  resolveMapFocusRegion,
  type Bbox,
  type LakeFilterSection,
  type LakeFilterValues,
  type LakeMapLakeNode,
  type LakesCommittedSearch,
  type MapRegion,
} from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import {
  CHIP_ICONS,
  clearDraftSection,
  draftHasSelection,
  filterPanelTitle,
  FiltersBody,
  FiltersFooter,
  useDraftCount,
  useFilterCatalogs,
} from './FiltersPanel';
import { distanceLabel } from './distance';
import { readErrorDescription, useFocusAfterRetry } from './errors';
import { imageSrc, lakePhotos } from './lakeImage';
import { track } from './analytics';
import { requestUserPosition, useLakesLocation, useLocationDialog, watchAutoDialog, type UserPosition } from './location';
import { LocationDialog } from './LocationDialog';
import { PinLakeCard, ResultCardsSkeleton, ResultLakeCard } from './ResultCards';
import { KitSheetCloseButton } from './PhoneSheet';
import { SearchLayer } from './SearchLayer';
import { LakesSearchRow } from './HomeHeader';
import { countLakeFilters, lakesMapQuery, parseLakesMapParams, withCatalogNames } from './url';

/*
 * lakes.results-map — fish features/lakes/components/LakesResultsWithMap.tsx (Bălți mode) on the T2
 * template: the map with the CMS's lakes, the list of the lakes in view (/lakes/in-bbox, 7 a page),
 * the search pill, «Filtre» and the chip rail, the pin card, «Locația mea», «Șterge filtre».
 *
 * Pins and clusters: fish asks /lakes/map-clusters for the visible bbox and zoom on every settle and
 * draws the server's clusters. T2Map clusters in the browser (supercluster — the algorithm the CMS
 * runs) over the points it is given, and has no way to draw server clusters, so the page asks
 * /lakes/map-clusters ONCE per filter set at a zoom where every lake is its own node (world bbox,
 * cached 60s like fish) and lets T2Map cluster them: the same bubbles (count, > 10 large) and a
 * cluster tap zooms at most 2 levels in — without a request per pan. The list stays per viewport,
 * as fish (the lakes in view, debounced 250 ms after the map stops).
 */

/** fish REGION_DEBOUNCE_MS. */
const REGION_DEBOUNCE_MS = 250;
/**
 * Every lake as its own node: Romania with a margin, past the CMS's cluster zoom. Not the world:
 * the CMS compares the bbox with the lakes' coordinates stored as TEXT (lake.coordinates lat/long),
 * so the comparison is lexicographic and a bound with another digit count («-180», «5») drops
 * every lake — two-digit bounds on both sides keep it right for Romania.
 * TODO(cms): cast the coordinates (or store numbers) in buildMapLakeFilters / in-bbox.
 */
const ALL_LAKES_BBOX: Bbox = { north: 49, south: 43, east: 31, west: 19 };
const ALL_LAKES_ZOOM = 22;

/**
 * The no-anchor framing (all lakes, text, filters only): Romania itself, edge to edge in the map's
 * free band. fish's overview region (6°×10° around 45.94, 24.97 — lakes.results-map.c5) is a phone
 * framing; on a 1280+ map it left the country at ≈40% of the canvas and the lakes in a few small
 * bubbles. T2Map adds its own padding (the floating chrome + 16px).
 */
const ROMANIA_FIT: MapRegion = bboxToMapRegion({
  north: 48.3,
  south: 43.6,
  east: 29.7,
  west: 20.2,
});

/** `outer` holds all of `inner` (a hair of float slack). */
const bboxContains = (outer: Bbox, inner: Bbox) => {
  const e = 1e-6;
  return outer.north >= inner.north - e && outer.south <= inner.south + e && outer.east >= inner.east - e && outer.west <= inner.west + e;
};

const toBounds = (b: Bbox): T2Bounds => [b.west, b.south, b.east, b.north];
const toBbox = ([west, south, east, north]: T2Bounds): Bbox => ({
  north,
  south,
  east,
  west,
});

type MapPoint = { id: string; lat: number; lng: number; node: LakeMapLakeNode };

function distanceTo(user: UserPosition | null, to: { latitude: number; longitude: number } | null): string | null {
  if (!user || !to) return null;
  return distanceLabel(getDistanceKm(user, to));
}

export function LakesMap() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useMemo(() => createBrowserTransport(), []);
  const phone = useBreakpoint() === 'mobile';
  const location = useLakesLocation();
  const user = location.state === 'granted' ? location.position : null;

  /* ------------------------------------------------------------------ the URL state */
  const queryString = params.toString();
  const urlState = useMemo(() => parseLakesMapParams(new URLSearchParams(queryString)), [queryString]);
  const catalogs = useFilterCatalogs(t);
  const filters: LakeFilterValues = useMemo(
    () => ({
      ...urlState.filters,
      selectedFacilities: withCatalogNames(urlState.filters.selectedFacilities, catalogs.facilityOptions),
      selectedFish: withCatalogNames(urlState.filters.selectedFish, catalogs.fishOptions),
    }),
    [urlState.filters, catalogs.facilityOptions, catalogs.fishOptions],
  );
  // Nearby: the user's position joins the search (never the URL).
  const search: LakesCommittedSearch = useMemo(
    () =>
      urlState.search.mode === 'nearby' && user
        ? {
            ...urlState.search,
            latitude: user.latitude,
            longitude: user.longitude,
          }
        : urlState.search,
    [urlState.search, user],
  );
  const hasAnyFilter = Boolean(search.mode) || countLakeFilters(filters) > 0;

  /** The map edits its own URL (no new history entry: «Înapoi» still leaves for the Bălți home). */
  const replaceState = useCallback(
    (next: { search?: LakesCommittedSearch; filters?: LakeFilterValues }) => {
      const q = lakesMapQuery({
        search: next.search ?? search,
        filters: next.filters ?? filters,
      });
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [router, pathname, search, filters],
  );

  /* ------------------------------------------------------------------ location */
  // The location dialog, and the search's «În jurul meu» hand-off into it (shared with the home).
  const locationDialog = useLocationDialog({ closeSearch: () => setSearchOpen(false), commit: (next) => commitSearch(next) });
  const openDialog = locationDialog.open;
  // Nearby opened from a link or a reload: read the position (the permission was given before).
  useEffect(() => {
    if (urlState.search.mode !== 'nearby' || !location.known || location.locating || user) return;
    if (location.state === 'granted' || location.state === 'never_asked') void requestUserPosition();
  }, [urlState.search.mode, location.known, location.locating, location.state, user]);
  // fish: the permission dialog opens by itself once per session when the map opens while location
  // is denied (c20; the flag lives in ./location.ts, so home → map → lake → map does not re-open it).
  useEffect(() => watchAutoDialog('denied', () => openDialog('permission')), [openDialog]);

  /* ------------------------------------------------------------------ viewport */
  const [viewport, setViewport] = useState<{
    bbox: Bbox;
    region: MapRegion;
  } | null>(null);
  const debounce = useRef(0);
  /**
   * «Caută în zona hărții» (owner rule 7, imobiliare.ro / Airbnb): on (the default, fish's
   * behaviour) the list follows the map; off, the list stays on its area and a move leaves the new
   * one pending behind «Caută în această zonă». From 768 only: a phone pan hides the list (c19).
   */
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  const [pendingViewport, setPendingViewport] = useState<{ bbox: Bbox; region: MapRegion } | null>(null);
  /** The map's last zoom (analytics params). */
  const zoomRef = useRef<number | null>(null);
  /**
   * The framing just applied (its bbox is already the list's viewport): the map's own settles on it
   * — bounds that contain it, the padding around the fit, a resize — must not start a second read
   * of the same area under another key (fish keeps the focus region until the user moves). Cleared
   * by the user's first touch of the map: a drag, the wheel, a key, a control (zoom, locate).
   */
  const framedBbox = useRef<Bbox | null>(null);
  /** The map has reported its viewport once (the view analytics wait for its zoom). */
  const [mapReported, setMapReported] = useState(false);
  useEffect(() => () => window.clearTimeout(debounce.current), []);
  const onViewportChange = useCallback<NonNullable<T2MapProps<MapPoint>['onViewportChange']>>((v) => {
    zoomRef.current = v.zoom;
    setMapReported(true);
    window.clearTimeout(debounce.current);
    const bbox = toBbox(v.bounds);
    const framed = framedBbox.current;
    if (framed && bboxContains(bbox, framed)) return;
    framedBbox.current = null;
    debounce.current = window.setTimeout(() => {
      const next = { bbox, region: bboxToMapRegion(bbox) };
      if (followRef.current) setViewport(next);
      else setPendingViewport(next);
    }, REGION_DEBOUNCE_MS);
  }, []);
  const setFollowing = (on: boolean) => {
    followRef.current = on;
    setFollow(on);
    if (on && pendingViewport) {
      setViewport(pendingViewport);
      setPendingViewport(null);
    }
  };
  const searchHere = () => {
    if (!pendingViewport) return;
    setViewport(pendingViewport);
    setPendingViewport(null);
  };

  /* ------------------------------------------------------------------ focus */
  const focusBbox = useQuery(
    lakesFocusBboxQuery(t, {
      countyId: search.mode === 'county' ? search.countyId : null,
      cityId: search.mode === 'city' ? search.cityId : null,
    }),
  );
  const resolvedRegion = resolveMapFocusRegion({
    committedSearch: search,
    countyBbox: focusBbox.data?.bbox ?? null,
    countyBboxFailed: focusBbox.isError || (focusBbox.isSuccess && !focusBbox.data.bbox),
    userLocation: user,
    locating: search.mode === 'nearby' && (!location.known || location.locating),
  });
  const focusRegion = resolvedRegion === COUNTRY_OVERVIEW_REGION ? ROMANIA_FIT : resolvedRegion;
  const [nonce, setNonce] = useState(0);
  const signature = getFocusSignature(search, nonce);
  /** The first region framed: the map is built on it (no Romania-then-jump on a county link). */
  const [initialRegion, setInitialRegion] = useState<MapRegion | null>(null);
  if (!initialRegion && focusRegion) setInitialRegion(focusRegion);
  const [appliedSignature, setAppliedSignature] = useState<string | null>(null);
  const [focus, setFocus] = useState<T2MapFocus | null>(null);
  // A new framing (a new search, «Șterge filtre», the same search again): the map moves there and
  // the focused region is the list's viewport right away (fish setDebouncedRegion(focusRegion)).
  if (focusRegion && appliedSignature !== signature) {
    setAppliedSignature(signature);
    setFocus({
      key: signature,
      bounds: toBounds(regionToBbox(focusRegion)),
      maxZoom: 15,
    });
    setViewport({ bbox: regionToBbox(focusRegion), region: focusRegion });
    setPendingViewport(null);
  }
  // …and a settle armed before it must not overwrite that region, nor the map's settles on it.
  const appliedBbox = viewport && appliedSignature ? viewport.bbox : null;
  const appliedBboxRef = useRef(appliedBbox);
  useEffect(() => {
    appliedBboxRef.current = appliedBbox;
  });
  useEffect(() => {
    framedBbox.current = appliedBboxRef.current;
    return () => window.clearTimeout(debounce.current);
  }, [appliedSignature]);
  /** fish isFocusReady (c8): a geographic search's first requests wait for its framing. */
  const focusReady = search.mode == null || appliedSignature === signature;

  /* ------------------------------------------------------------------ analytics (c25) */
  // fish lakes_map_results_focus_applied: each framing applied.
  useEffect(() => {
    if (!appliedSignature || !focusRegion) return;
    track('lakes_map_results_focus_applied', {
      mode: search.mode ?? 'none',
      county_id: search.countyId,
      city_id: search.cityId,
      lake_id: search.lakeId,
      latitude: focusRegion.latitude,
      longitude: focusRegion.longitude,
    });
    // Once per applied signature (the region and search are the ones it was applied with).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSignature]);
  // fish lakes_map_results_view: once, when the first framing is ready and the map has reported.
  const viewLogged = useRef(false);
  useEffect(() => {
    if (viewLogged.current || !focusReady || !viewport || !mapReported || zoomRef.current == null) return;
    viewLogged.current = true;
    track('lakes_map_results_view', {
      ...viewport.bbox,
      zoom: zoomRef.current,
      search_mode: search.mode ?? 'none',
    });
  }, [focusReady, viewport, mapReported, search.mode]);

  /* ------------------------------------------------------------------ data */
  const clusters = useQuery(
    lakeMapClustersQuery(t, {
      bbox: ALL_LAKES_BBOX,
      zoom: ALL_LAKES_ZOOM,
      filters,
      committedSearch: search,
      enabled: true,
    }),
  );
  const points = useMemo<MapPoint[]>(
    () =>
      (clusters.data?.data ?? []).flatMap((n) =>
        n.type === 'lake'
          ? [
              {
                id: n.documentId,
                lat: n.coordinate.latitude,
                lng: n.coordinate.longitude,
                node: n,
              },
            ]
          : [],
      ),
    [clusters.data],
  );
  const list = useInfiniteQuery(
    lakesInBboxInfiniteQuery(t, {
      bbox: viewport?.bbox ?? null,
      filters,
      committedSearch: search,
      enabled: focusReady && viewport !== null,
    }),
  );
  const listLakes = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  const total = list.data?.pages[0]?.meta.total ?? 0;
  // A failure stays said until a page lands: a new viewport key after a failed read starts its own
  // retries with no error yet, and must not bring the skeleton back over the error card.
  const [listFailed, setListFailed] = useState(false);
  if (list.isError && !listFailed) setListFailed(true);
  if (list.data && listFailed) setListFailed(false);
  const listError = list.isError || (listFailed && !list.data);
  const firstLoad = list.data === undefined && !listError;
  const armRetryFocus = useFocusAfterRetry(Boolean(list.data), () =>
    [...document.querySelectorAll<HTMLElement>('h2')].find(
      (h) => h.textContent?.includes('în această zonă') && h.getClientRects().length > 0,
    ) ?? null,
  );
  const refreshing = (list.isFetching && !list.isFetchingNextPage && !firstLoad) || (clusters.isFetching && !!clusters.data);

  /* ------------------------------------------------------------------ selection + sheet */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // The reverse direction: a hovered pin highlights its list card (rule 7, card ↔ marker).
  const [pinHoverId, setPinHoverId] = useState<string | null>(null);
  const [sheetSnap, setSheetSnap] = useState<T2SheetSnap>('half');
  const selectedNode = points.find((p) => p.id === selectedId)?.node ?? null;
  // A pin without photos borrows them from the lake page's data (fish selectedLakeFull).
  const needsImages = !!selectedNode && selectedNode.images.length === 0;
  const selectedFull = useQuery(lakeQuery(t, selectedId ?? '', { enabled: needsImages }));
  const selectedPhotos = selectedNode
    ? selectedNode.images.length
      ? selectedNode.images.slice(0, 3).map(imageSrc)
      : (selectedFull.data?.images ?? []).slice(0, 3).map(imageSrc)
    : [];
  // A selection that leaves the results (filters changed) has no node any more: no card, no pin.
  const shownSelectedId = selectedNode ? selectedId : null;

  /* ------------------------------------------------------------------ filters panel */
  const [panel, setPanel] = useState<LakeFilterSection | null>(null);
  const [draft, setDraft] = useState<LakeFilterValues>(filters);
  const count = useDraftCount(t, search, draft, panel !== null);
  // fish: the list leaves while the panel is open and comes back where it was (c24).
  const snapBeforePanel = useRef<T2SheetSnap | null>(null);
  const openPanel = (section: LakeFilterSection) => {
    if (panel === null) {
      setDraft(filters);
      if (phone) {
        snapBeforePanel.current = sheetSnap;
        setSheetSnap('hidden');
      }
    }
    setPanel(section);
  };
  const closePanel = () => {
    setPanel(null);
    if (snapBeforePanel.current) setSheetSnap(snapBeforePanel.current);
    snapBeforePanel.current = null;
  };

  /* ------------------------------------------------------------------ actions */
  const [listFocusKey, setListFocusKey] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  /** fish handleClearAll (c20): all lakes, no filters, back to the country overview. */
  const clearAll = () => {
    track('lakes_map_clear_filters');
    setSelectedId(null);
    setSheetSnap('half');
    setNonce((n) => n + 1);
    setListFocusKey(Date.now());
    router.replace(pathname, { scroll: false });
  };
  const commitSearch = (next: LakesCommittedSearch) => {
    setSearchOpen(false);
    setSelectedId(null);
    // Re-applying the same search re-centres the map (fish focus nonce, c7).
    if (lakesMapQuery({ search: next, filters }) === queryString) setNonce((n) => n + 1);
    else replaceState({ search: next });
  };

  const locateKm = useRef<number | null>(null);
  const [locateBusy, setLocateBusy] = useState(false);
  /** fish handleLocatePress (c21). */
  const locate = async () => {
    track('lakes_map_results_locate_me', { permission_state: location.state });
    if (location.state === 'services_off') return openDialog('services_off');
    if (location.state === 'denied') return openDialog('permission');
    let at = user;
    if (!at) {
      setLocateBusy(true);
      const r = await requestUserPosition();
      setLocateBusy(false);
      // fish: a refused prompt ends here; so does a prompt never answered (./location.ts watchdog).
      if (r.state === 'denied' || r.state === 'never_asked') return;
      if (!r.position) return openDialog('services_off');
      at = r.position;
    }
    const centered = viewport ? isRegionCenteredOn(viewport.region, at) : false;
    const km = nextLocateRadiusKm({
      previousKm: locateKm.current,
      centeredOnUser: centered,
      nearbyRadiusKm: search.radiusKm,
    });
    locateKm.current = km;
    setFocus({
      key: `me-${Date.now()}`,
      bounds: boundsAround({ lat: at.latitude, lng: at.longitude }, km),
    });
  };

  /* ------------------------------------------------------------------ list */
  // The price per lake (in-bbox carries none): every lake node of every /lakes/map-clusters read
  // (one per filter set, every lake its own node — ALL_LAKES_ZOOM, so no lake hides in a server
  // cluster), merged into an index that only grows: a price, once known, never leaves its card as
  // the user zooms, pans or changes filters. While the first read is in flight the price line holds
  // a bone (rule 4), so the cards keep their height when it lands.
  // TODO(cms): priceMin / priceMax on the in-bbox DTO, then read the price from the list itself.
  const [priceById, setPriceById] = useState<ReadonlyMap<string, { min: number | null; max: number | null }>>(() => new Map());
  const [pricesFrom, setPricesFrom] = useState<unknown>(null);
  if (clusters.data && clusters.data !== pricesFrom) {
    setPricesFrom(clusters.data);
    const next = new Map(priceById);
    for (const n of clusters.data.data) {
      if (n.type === 'lake' && (n.priceMin != null || n.priceMax != null)) next.set(n.documentId, { min: n.priceMin ?? null, max: n.priceMax ?? null });
    }
    setPriceById(next);
  }
  const pricesPending = pricesFrom === null && !clusters.isError;
  const countTitle = `${plural(total, 'baltă', 'bălți')} în această zonă`;
  let listBody;
  let announcement = '';
  if (firstLoad) {
    listBody = <ResultCardsSkeleton />;
    announcement = 'Se încarcă rezultatele';
  } else if (listError && !listLakes.length) {
    listBody = (
      <div className="grid flex-1 place-items-center">
        <ListError
          title="Nu am putut încărca bălțile"
          description={readErrorDescription(list.error)}
          onRetry={() => {
            armRetryFocus();
            void list.refetch();
          }}
          retrying={list.isFetching}
          retryLabel="Încearcă din nou"
          attempt={Math.max(1, list.errorUpdateCount)}
        />
      </div>
    );
  } else if (!listLakes.length) {
    // fish c17: «0 bălți în această zonă» + how to see some — the template's empty state.
    listBody = (
      <div className="grid flex-1 place-items-center">
        <ListEmpty title="Nicio baltă în această zonă" description="Mărește harta sau modifică filtrele pentru a vedea bălțile." />
      </div>
    );
    announcement = `${countTitle}. Mărește harta sau modifică filtrele pentru a vedea bălțile.`;
  } else {
    listBody = (
      <>
        <T2List label="Bălți" stale={refreshing}>
          {listLakes.map((lake) => {
            const c = lake.coordinates
              ? {
                  latitude: Number(lake.coordinates.lat),
                  longitude: Number(lake.coordinates.long),
                }
              : null;
            return (
              <T2ListItem
                key={lake.documentId}
                id={lake.documentId}
                selected={lake.documentId === shownSelectedId}
                highlighted={lake.documentId === pinHoverId}
                onHighlight={setHighlightedId}
              >
                <ResultLakeCard
                  lake={lake}
                  photos={lakePhotos(lake, 6)}
                  distanceLabel={distanceTo(user, c)}
                  price={priceById.get(lake.documentId) ?? null}
                  priceLoading={pricesPending}
                />
              </T2ListItem>
            );
          })}
        </T2List>
        <ListFooter
          hasMore={!!list.hasNextPage}
          loadingMore={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
          error={list.isFetchNextPageError}
          shown={listLakes.length}
          total={total}
          noun="bălți"
          errorLabel="Nu am putut încărca mai multe bălți."
        />
      </>
    );
    announcement = countTitle;
  }
  if (refreshing && !firstLoad) announcement = 'Se încarcă rezultatele';
  if (clusters.isError && !clusters.isFetching)
    announcement = `${announcement ? `${announcement}. ` : ''}Bălțile nu s-au încărcat pe hartă.`;

  /* ------------------------------------------------------------------ toolbar */
  const railFilters = panel !== null ? draft : filters;
  const summary = getLakesSearchSummary(search);
  const searchPlaceholder = !search.mode;
  const clearLabel = 'Șterge filtre';
  /**
   * The quick chips, in fish's order (c3). From 1024 the desktop search row's pill holds «Pești»
   * (Specie) and «Regim»: the bar under it (`data-pill-row`) hides those two there — no control twice
   * in one header.
   */
  const chips = getLakeFilterChips(railFilters).map((chip) => (
      <T2FilterChip
        key={chip.key}
        label={chip.label}
        value={chipValue(chip.key, railFilters)}
        active={chip.active}
        icon={CHIP_ICONS[chip.key]}
        kind={chip.key === 'booking' ? 'toggle' : 'menu'}
        expanded={chip.key === 'booking' ? undefined : panel === chip.key}
        onClick={() => {
          // Rezervări flips in place (c4); every other chip opens its section.
          if (chip.key !== 'booking') return openPanel(chip.key);
          if (panel !== null) setDraft((d) => ({ ...d, bookableOnly: !d.bookableOnly }));
          else
            replaceState({
              filters: { ...filters, bookableOnly: !filters.bookableOnly },
            });
        }}
        className={chip.key === 'regime' || chip.key === 'fish' ? 'lg:[[data-pill-row]_&]:hidden' : undefined}
      />
    ));
  const searchLabel = searchPlaceholder ? 'Caută bălți, lacuri' : `Caută bălți, lacuri. Acum: ${summary}`;
  const toolbar = (
    <T2Toolbar
      title="Hartă bălți"
      // Phone: fish MapChrome — the back square, the floating search pill, the «Filtre» square and
      // the chip rail.
      leading={<T2BackLink href={routes.lakes()} label="Înapoi la Bălți" />}
      search={<T2SearchPill summary={summary} placeholder={searchPlaceholder} searchLabel={searchLabel} onSearch={() => setSearchOpen(true)} />}
      filtersButton={
        <FilterButton
          count={countLakeFilters(railFilters)}
          expanded={panel === 'all'}
          desktopHidden={false}
          onClick={() => openPanel('all')}
          className={cn(T2_EXPANDED, 'shadow-e2!', '[[data-solid]_&]:shadow-e0!')}
        />
      }
      filterCount={countLakeFilters(railFilters)}
      onReset={clearAll}
      canReset={hasAnyFilter && panel === null}
      filters={chips}
      desktop={
        // From 768 the Bălți list's own search row (LakesSearchRow, owner rules 6 and 7): the same
        // switch, pill («where», «Specie», «Regim»), «Filtre» and, in the slot «Arată harta» holds
        // on the list, «Arată lista» — at the list header's height (its top padding). Under it, in
        // the categories' slot, the quick chips the pill does not hold and «Resetează».
        <div data-pill-row="" className="flex flex-col gap-3 pt-2">
          <LakesSearchRow
            ready
            view="map"
            onSearch={() => setSearchOpen(true)}
            searchLabel={searchLabel}
            summary={searchPlaceholder ? null : summary}
            onSection={openPanel}
            sectionExpanded={panel === 'fish' || panel === 'regime' ? panel : null}
            sectionValues={{ fish: chipValue('fish', railFilters), regime: chipValue('regime', railFilters) }}
            onFilters={() => openPanel('all')}
            filtersExpanded={panel === 'all'}
            filterCount={countLakeFilters(railFilters)}
            showToggle
            switcherHrefs={{ balti: routes.lakesMap() }}
          />
          <FilterBar label="Filtre" onReset={clearAll} canReset={hasAnyFilter && panel === null}>
            {chips}
          </FilterBar>
        </div>
      }
    />
  );

  /* ------------------------------------------------------------------ map */
  const releaseFraming = () => {
    framedBbox.current = null;
  };
  const followControl = (
    // From 768 (a phone pan hides the list instead, c19).
    <span className="flex items-center gap-2 max-md:hidden">
      <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-surface pr-3.5 pl-3 t-label text-ink shadow-e2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent">
        <input
          type="checkbox"
          checked={follow}
          onChange={(e) => setFollowing(e.target.checked)}
          className="size-4 cursor-pointer accent-accent outline-none"
        />
        Caută în zona hărții
      </label>
      {!follow && pendingViewport ? (
        <Button variant="primary" size="compact" icon={<MagnifyingGlassIcon />} onClick={searchHere} className={cn('rounded-full', T2_FLOATING_BUTTON)}>
          Caută în această zonă
        </Button>
      ) : null}
    </span>
  );
  const statusPill = clusters.isError ? (
    // The pins failed: said in the live region (`announcement`) and retried from here — a real
    // control, not the silent pill (the list beside the map still works).
    <span className="flex items-center gap-1 rounded-full bg-surface py-1 pr-1 pl-3.5 shadow-e2">
      <span className="t-label text-status-warning-fg">Bălțile nu s-au încărcat pe hartă</span>
      <Button
        variant="ghost"
        size="compact"
        aria-busy={clusters.isFetching || undefined}
        onClick={() => {
          if (!clusters.isFetching) void clusters.refetch();
        }}
        className="rounded-full text-accent-ink"
      >
        {clusters.isFetching ? 'Se încarcă…' : 'Încearcă din nou'}
      </Button>
    </span>
  ) : refreshing ? (
    <T2MapPill busy>Se încarcă…</T2MapPill>
  ) : hasAnyFilter && panel === null ? (
    // Phone: «Șterge filtre» floats over the map (fish LakesResultsClearFiltersPill); from 768 it
    // is in the toolbar.
    <span className="md:hidden">
      <Button variant="ghost" icon={<ArrowUturnLeftIcon />} onClick={clearAll} className={cn('bg-surface text-ink', T2_FLOATING_BUTTON)}>
        {clearLabel}
      </Button>
    </span>
  ) : null;
  const mapStatus = (
    <>
      {followControl}
      {statusPill}
    </>
  );

  // Keyed: T2Map never turns a placeholder into a live map in place (it builds MapLibre once).
  const map = initialRegion ? (
    // fish lakes_map_results_cluster_tap: T2Map zooms a cluster itself, so the tap is read here.
    // TODO(kit): an onClusterPress on T2Map with the cluster id and the zoom it lands on.
    <div
      className="contents"
      onPointerDownCapture={releaseFraming}
      onWheelCapture={releaseFraming}
      onKeyDownCapture={releaseFraming}
      onClickCapture={(e) => {
        const label = (e.target as Element).closest('button[aria-label$="mărește harta aici"]')?.getAttribute('aria-label');
        if (label)
          track('lakes_map_results_cluster_tap', {
            count: Number(label.match(/\d+/)?.[0] ?? 0),
            zoom_before: zoomRef.current,
          });
      }}
    >
      <T2Map<MapPoint>
        key="live"
        label="Hartă bălți"
        points={points}
        pointLabel={(p) => p.node.name}
        pointBadge={pinBadge}
        clusterLabel={(n) => `${plural(n, 'baltă', 'bălți')} — mărește harta aici`}
        selectedId={shownSelectedId}
        highlightedId={highlightedId}
        onPointHover={setPinHoverId}
        onSelect={(p) => {
          track('lakes_map_results_pin_tap', {
            lake_id: p.id,
            zoom: zoomRef.current,
          });
          setSelectedId(p.id);
        }}
        initialBounds={toBounds(regionToBbox(initialRegion))}
        focus={focus}
        userLocation={user ? { lat: user.latitude, lng: user.longitude } : null}
        loadingStatus={!firstLoad}
        veil={firstLoad ? <div aria-hidden className="size-full animate-shimmer opacity-80 md:opacity-40" /> : null}
        listAvailable={!listError}
        onViewportChange={onViewportChange}
        onUserMoveStart={() => {
          locateKm.current = null;
          framedBbox.current = null;
          // Phone only: panning hides the list; «Vezi lista (N)» brings it back (c19).
          if (phone) setSheetSnap((s) => (s === 'full' ? s : 'hidden'));
        }}
        controls={
          <div className="overflow-hidden rounded-control shadow-e2">
            <MapControlButton label="Locația mea" pressed={!!user} busy={locateBusy || location.locating} onClick={() => void locate()}>
              {user ? (
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
    </div>
  ) : (
    // The county / city box is still resolving (c8): the map's chrome, no camera yet.
    <T2Map<MapPoint>
      key="placeholder"
      label="Hartă bălți"
      points={[]}
      pointLabel={(p) => p.node.name}
      placeholder
      veil={<div aria-hidden className="size-full animate-shimmer opacity-80 md:opacity-40" />}
    />
  );

  const detail = selectedNode ? (
    <PinLakeCard
      lake={selectedNode}
      photos={selectedPhotos}
      distanceLabel={distanceTo(user, selectedNode.coordinate)}
      onClose={() => setSelectedId(null)}
      returnFocusTo={() => t2FocusTarget(selectedNode.documentId)}
    />
  ) : null;

  const filterSection = panel ?? 'all';

  return (
    <>
      <SetBreadcrumb trail={[{ label: 'Bălți', href: routes.lakes() }, { label: 'Hartă' }]} />
      <T2Layout
        toolbar={toolbar}
        listLabel="Rezultate"
        listHeader={listError && !listLakes.length ? null : <T2ListHeader title={countTitle} loading={firstLoad} stale={refreshing} />}
        list={listBody}
        busy={firstLoad || refreshing}
        listFocusKey={listFocusKey}
        map={map}
        mapStatus={mapStatus}
        announcement={announcement}
        detail={detail}
        sheetSnap={sheetSnap}
        onSheetSnapChange={setSheetSnap}
        // The count only once known: «(0)» while the first page loads or after a failure reads «no lakes».
        showListLabel={list.data ? `Vezi lista (${total})` : 'Vezi lista'}
        panel={{
          open: panel !== null,
          onClose: closePanel,
          returnFocusTo: () =>
            [...document.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"][aria-label^="Filtre"]')].find(
              (b) => b.getClientRects().length > 0,
            ) ?? null,
          title: filterPanelTitle(filterSection),
          children: (
            <>
              {/* The phone sheet's «Închide» X (lakes.filters.c9); hidden from 768 (the Dialog has its own). */}
              <KitSheetCloseButton onClose={closePanel} />
              <FiltersBody section={filterSection} draft={draft} setDraft={setDraft} committed={filters} catalogs={catalogs} />
            </>
          ),
          footer: (
            <FiltersFooter
              canClear={draftHasSelection(filterSection, draft)}
              onClear={() => setDraft((d) => clearDraftSection(filterSection, d))}
              count={count}
              onApply={() => {
                closePanel();
                setSelectedId(null);
                replaceState({ filters: draft });
              }}
            />
          ),
        }}
      />

      <SearchLayer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onCommit={commitSearch}
        onLocationBlocked={locationDialog.onLocationBlocked}
      />

      <LocationDialog mode={locationDialog.mode} onClose={locationDialog.close} onRetry={locationDialog.onRetry} />
    </>
  );
}

/**
 * A pin's pill (owner rule 7, imobiliare.ro's price pins): the lowest price when the CMS has one
 * («45 lei»), else the rating when the lake has reviews («★ 4,8»), else the fish badge.
 */
function pinBadge(p: MapPoint) {
  const price = p.node.priceMin ?? p.node.priceMax;
  if (price != null) return `${formatInt(price)} lei`;
  const r = p.node.reviewsMeta;
  if (r && r.count > 0 && r.overall != null) {
    return (
      <>
        <StarIcon aria-hidden className="size-3.5 text-rating" />
        {formatDecimal(r.overall, 1, 1)}
      </>
    );
  }
  return null;
}

/**
 * A menu chip's chosen value (T1: the choice replaces the question): «Crap», «Crap +1»; the rating
 * tier's label is the chip's own label already.
 */
function chipValue(key: string, f: LakeFilterValues): string | null {
  const names =
    key === 'regime' ? f.selectedRegimes.map((v) => v.name) : key === 'facilities' ? f.selectedFacilities.map((v) => v.name) : key === 'fish' ? f.selectedFish.map((v) => v.name) : [];
  if (!names.length) return null;
  return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
}
