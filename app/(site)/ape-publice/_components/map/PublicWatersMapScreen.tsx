'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolidIcon } from '@heroicons/react/20/solid';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Map as MlMap } from 'maplibre-gl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { Dialog } from '@/components/surfaces/Dialog';
import { EmptyState } from '@/components/surfaces/StateCard';
import { FilterButton, ListError } from '@/components/templates/T1';
import {
  boundsAround,
  MapControlButton,
  ROMANIA_BOUNDS,
  T2_EXPANDED,
  T2FilterChip,
  T2Layout,
  T2List,
  T2ListHeader,
  T2ListItem,
  T2MapCard,
  T2MapCluster,
  T2_FLOATING_BUTTON,
  T2MapPill,
  T2SearchPill,
  T2Spinner,
  T2Toolbar,
  useT2Frame,
  type T2SheetSnap,
} from '@/components/templates/T2';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  buildClusterIndex,
  claimedPublicWatersQuery,
  CLUSTER_MAX_ZOOM,
  clustersForViewport,
  clusterTapZoom,
  continuousZoom,
  countyApplyLabel,
  EXPAND_SMALL,
  findWaterAtPoint,
  MARKER_LIMIT,
  MARKER_TAP_RADIUS_PX,
  MIN_SHAPE_PX,
  parseRecentPublicWaters,
  projectGeometry,
  publicWaterByIdQuery,
  publicWaterCentroidsQuery,
  publicWaterCountiesQuery,
  publicWaterFilterToTypes,
  publicWaterName,
  publicWatersListTitle,
  publicWaterSubtitle,
  pushRecentPublicWater,
  RECENT_PUBLIC_WATERS_KEY,
  reduceSelection,
  regionForWater,
  regionToBounds,
  resolveBand,
  SHAPE_TAP_TOLERANCE_PX,
  sortWatersByArea,
  toClaimedPublicWatersMap,
  VIEWPORT_LIMIT,
  type HitCandidate,
  type LatLngBounds,
  type ProjectedGeometry,
  type PublicMapBand,
  type PublicSelection,
  type PublicWaterCluster,
  type PublicWaterFilter,
  type PublicWaterGeometry,
  type PublicWaterListItem,
  type PublicWaterType,
  type SelectionEvent,
  type SelectOrigin,
} from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { WaterKindSwitch } from '@/app/(site)/balti/_list/WaterKindSwitch';
import { plural } from '@/components/cards/format';
import { browserPublicWaters } from '../client-source';
import { DirectionsDialog } from '../detail/parts';
import { LakeIcon, RiverIcon } from '../icons';
import { MapMarker, WaterMap, type WaterBounds, type WaterFeature } from '../WaterMap';
import { CountyFilterBody } from './CountyFilter';
import { WaterPin } from './pins';
import type { WaterOutline } from './outline';
import { WaterRowCard } from './WaterRowCard';
import { SearchOverlay, type LocationProblem } from './SearchOverlay';
import { waterTrail } from '../trail';

/*
 * Ape publice — hartă și listă: fish app/(app)/(tabs)/lakes/index.tsx in «Ape publice» mode
 * (LakesResultsWithMap + features/public-waters/*) on T2 (parity public-waters.harta-ape).
 *
 *  - Two zoom bands with hysteresis (core resolveBand, fish's zoom = log2(360 / lng span)): below
 *    11.2 the centroids cluster (supercluster over all 5 309 waters, filtered by type + county;
 *    small clusters expand into icon pins from 8.5) and the list is the 150 largest waters in
 *    view; above it the shapes (≤ 1500 waters intersecting the view), small ones as pins, and the
 *    list is every water in view.
 *  - Every selection (map tap, pin, list row) goes through the claim map first (claimed → the
 *    lake page), then the selection machine (core reduceSelection): load → frame in amber → the
 *    preview card; closing restores the camera unless the user panned meanwhile.
 *  - No lake request ever fires here (c3): this screen reads only the public-waters dataset and
 *    the claim map.
 *  - Clusters are built in the map's own zoom (MapLibre's 512px world, which supercluster's 70px
 *    radius is measured in), the bands and their hysteresis in fish's (log2(360 / lng span)): on a
 *    375px phone fish's zoom runs ~0.45 above MapLibre's, on the 600px desktop pane ~0.2 below, so
 *    clustering in fish's zoom overlapped the bubbles on a phone and merged Romania into three on
 *    a desktop.
 *  - The map is optional: when it cannot show (no WebGL, tiles down) the list still loads, for
 *    Romania; a failed dataset read says so with a retry, never «nicio apă».
 */

type Kind = 'river' | 'lake';
const kindOf = (t: PublicWaterType): Kind => (t === 'river' ? 'river' : 'lake');

/** fish locate: 20 km around the user, then 5 km tighter per press down to 5 km. */
const LOCATE_KM = 20;
const LOCATE_STEP_KM = 5;

function readRecents(): PublicWaterListItem[] {
  try {
    return parseRecentPublicWaters(window.localStorage.getItem(RECENT_PUBLIC_WATERS_KEY));
  } catch {
    return [];
  }
}
function writeRecents(list: PublicWaterListItem[] | null) {
  try {
    if (list) window.localStorage.setItem(RECENT_PUBLIC_WATERS_KEY, JSON.stringify(list));
    else window.localStorage.removeItem(RECENT_PUBLIC_WATERS_KEY);
  } catch {
    // private window: recents live only for this visit
  }
}

const toLatLngBounds = ([w, s, e, n]: WaterBounds): LatLngBounds => ({ minLat: s, minLng: w, maxLat: n, maxLng: e });
const boundsKey = (b: LatLngBounds) => [b.minLat, b.minLng, b.maxLat, b.maxLng].map((n) => n.toFixed(4)).join(',');

/** supercluster's radius as seen on screen (fish PublicWaterClusters: 70). */
const CLUSTER_RADIUS_PX = 80;

/**
 * supercluster clusters at whole zooms only, while the map sits between two (Romania fits at 4.65
 * on a phone, 5.8 in the desktop pane). Clustering at floor(zoom) with a radius shrunk by the
 * fractional part (in 0.1 steps) keeps the bubbles 70px apart ON SCREEN at every zoom and width:
 * never touching on a phone, never merging the country into three on a desktop.
 */
function clusterGrid(mlZoom: number): { zoom: number; frac: number } {
  let zoom = Math.floor(mlZoom);
  let frac = Math.round((mlZoom - zoom) * 10) / 10;
  if (frac >= 1) {
    zoom += 1;
    frac = 0;
  }
  return { zoom, frac };
}

/** `zoom`: fish's (bands, hysteresis, cluster taps); `mlZoom`: the map's (clustering). */
type View = { bounds: WaterBounds; zoom: number; mlZoom: number; widthPx: number };

export function PublicWatersMapScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const src = browserPublicWaters();
  const t = useMemo(() => createBrowserTransport(), []);

  /* ---------------------------------------------------------------------------- filters */
  const [filter, setFilter] = useState<PublicWaterFilter>('lake');
  const [counties, setCounties] = useState<number[]>([]);
  const types = useMemo(() => publicWaterFilterToTypes(filter), [filter]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [countyTerm, setCountyTerm] = useState('');
  const countiesQuery = useQuery({ ...publicWaterCountiesQuery(src), enabled: panelOpen || counties.length > 0 });

  /* ---------------------------------------------------------------------------- viewport */
  const mapRef = useRef<MlMap | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [band, setBand] = useState<PublicMapBand>('clusters');
  const bounds = view ? toLatLngBounds(view.bounds) : null;
  const bKey = bounds ? boundsKey(bounds) : '';
  const frameRef = useRef({ split: false, top: 0, bottom: 0 });

  const onMoveEnd = useCallback((map: MlMap) => {
    const b = map.getBounds();
    const next: WaterBounds = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const zoom = continuousZoom(next[2] - next[0]);
    setView({ bounds: next, zoom, mlZoom: map.getZoom(), widthPx: map.getCanvas().clientWidth || 1 });
    setBand((prev) => resolveBand(prev, zoom));
  }, []);

  // No map (no WebGL, the tile host down): the list still lists the largest waters of Romania.
  const onMapUnavailable = useCallback((unavailable: boolean) => {
    if (!unavailable) return;
    setView((v) => {
      if (v) return v;
      const widthPx = Math.max(window.innerWidth, 1);
      const zoom = continuousZoom(ROMANIA_BOUNDS[2] - ROMANIA_BOUNDS[0]);
      return { bounds: ROMANIA_BOUNDS, zoom, mlZoom: zoom + Math.log2(widthPx / 512), widthPx };
    });
    setBand('clusters');
  }, []);

  /* ---------------------------------------------------------------------------- data */
  const claimed = useQuery(claimedPublicWatersQuery(t));
  const claimMap = useMemo(() => toClaimedPublicWatersMap(claimed.data ?? []), [claimed.data]);
  const centroids = useQuery(publicWaterCentroidsQuery(src));
  const typeById = useMemo(() => new Map((centroids.data ?? []).map((c) => [c.id, c.type])), [centroids.data]);
  const countiesKey = counties.join(',');
  const grid = view ? clusterGrid(view.mlZoom) : null;
  const index = useMemo(
    () =>
      centroids.data && grid
        ? buildClusterIndex(centroids.data, { maxZoom: CLUSTER_MAX_ZOOM, radius: CLUSTER_RADIUS_PX / 2 ** grid.frac }, types, counties)
        : null,
    // countiesKey stands for `counties` (a new array with the same ids must not rebuild the index);
    // grid?.frac for the grid (the index is rebuilt only when the fractional step changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centroids.data, types, countiesKey, grid?.frac],
  );
  const clusters = useMemo(() => {
    if (band !== 'clusters' || !index || !bounds || !view || !grid) return [];
    // fish's «expand small clusters from 8.5» is in fish's zoom: the same moment in the grid's.
    const minZoom = EXPAND_SMALL.minZoom + (grid.zoom - view.zoom);
    return clustersForViewport(index, bounds, grid.zoom, { expandSmall: { minZoom, maxCount: EXPAND_SMALL.maxCount } });
    // bKey stands for `bounds`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band, index, bKey, view?.zoom, grid?.zoom]);
  const markers = useQuery({
    queryKey: ['public-waters', 'source', 'markers', bKey, filter, countiesKey],
    queryFn: () => src.getMarkerWatersInViewport(bounds as LatLngBounds, { types, counties, limit: MARKER_LIMIT }),
    enabled: band === 'clusters' && !!bounds,
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const rows = useQuery({
    queryKey: ['public-waters', 'source', 'viewport', bKey, filter, countiesKey],
    queryFn: () => src.getWaterRowsInViewport(bounds as LatLngBounds, { types, counties, limit: VIEWPORT_LIMIT }),
    enabled: band === 'geometry' && !!bounds,
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const rowList = useMemo(() => (band === 'geometry' ? (rows.data ?? []) : []), [band, rows.data]);
  const markerList = useMemo(() => (band === 'clusters' ? (markers.data ?? []) : []), [band, markers.data]);
  const geometryLoading = band === 'geometry' && rows.isFetching;

  // Geometry store (fish geometryStore): only the ids not yet in memory are fetched.
  const [geoms, setGeoms] = useState<ReadonlyMap<number, { geometry: PublicWaterGeometry; projected: ProjectedGeometry }>>(() => new Map());
  useEffect(() => {
    const missing = rowList.map((r) => r.id).filter((id) => !geoms.has(id));
    if (!missing.length) return;
    let active = true;
    (async () => {
      for (let i = 0; i < missing.length && active; i += 300) {
        try {
          const got = await src.getGeometriesByIds(missing.slice(i, i + 300));
          if (!active) return;
          setGeoms((prev) => {
            const next = new Map(prev);
            for (const g of got) next.set(g.id, { geometry: g.geometry, projected: projectGeometry(g.geometry) });
            return next;
          });
        } catch {
          // a failed chunk stays missing; the next pan asks again
        }
      }
    })();
    return () => {
      active = false;
    };
    // `geoms` is read for what is missing; a new store must not re-run the fetch it caused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowList, src]);

  // Shapes vs small-water pins (fish MIN_SHAPE_PX): the water's bbox projected to screen px.
  const { shapes, smallPins } = useMemo(() => {
    const shapes: WaterFeature[] = [];
    const smallPins: PublicWaterCluster[] = [];
    if (!view) return { shapes, smallPins };
    const pxPerDeg = view.widthPx / Math.max(view.bounds[2] - view.bounds[0], 1e-9);
    for (const r of rowList) {
      const cos = Math.max(Math.cos((r.centerLat * Math.PI) / 180), 0.1);
      const px = Math.max(r.bboxSpanLng * pxPerDeg, (r.bboxSpanLat * pxPerDeg) / cos);
      const g = geoms.get(r.id);
      if (px < MIN_SHAPE_PX) smallPins.push({ key: `p${r.id}`, count: 1, centerLat: r.centerLat, centerLng: r.centerLng, singleId: r.id });
      else if (g) shapes.push({ id: r.id, type: r.type, geometry: g.geometry });
    }
    return { shapes, smallPins };
  }, [rowList, geoms, view]);

  const linkCodeById = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const w of markerList) m.set(w.id, w.linkCode);
    for (const w of rowList) m.set(w.id, w.linkCode);
    return m;
  }, [markerList, rowList]);

  /* ---------------------------------------------------------------------------- sheet */
  const [sheetSnap, setSheetSnap] = useState<T2SheetSnap>('half');
  const split = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 768px)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  );

  /* ---------------------------------------------------------------------------- selection */
  const [selection, setSelection] = useState<PublicSelection<WaterBounds>>({ status: 'none' });
  const selRef = useRef(selection);
  const currentBounds = (): WaterBounds => {
    const b = mapRef.current?.getBounds();
    return b ? [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] : ROMANIA_BOUNDS;
  };

  const frameWater = useCallback((geometry: PublicWaterGeometry, centerLat: number, centerLng: number) => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    // After the paint that shows the card, so its height is known to the layout.
    requestAnimationFrame(() => {
      const f = frameRef.current;
      const region = regionForWater(geometry, { latitude: centerLat, longitude: centerLng }, {
        widthPx: canvas.clientWidth,
        heightPx: canvas.clientHeight,
        topObscuredPx: f.top,
        bottomObscuredPx: f.bottom || (f.split ? 0 : 200),
      });
      map.fitBounds(regionToBounds(region), { padding: 0 });
    });
  }, []);

  const dispatch = useCallback(
    (ev: SelectionEvent<WaterBounds>) => {
      const tr = reduceSelection(selRef.current, ev);
      selRef.current = tr.selection;
      setSelection(tr.selection);
      if (tr.camera?.kind === 'frame') frameWater(tr.camera.water.geometry, tr.camera.water.centerLat, tr.camera.water.centerLng);
      if (tr.camera?.kind === 'restore') mapRef.current?.fitBounds(tr.camera.region, { padding: 0 });
    },
    [frameWater],
  );

  const rerouteIfClaimed = useCallback(
    (linkCode: string | null | undefined) => {
      const lakeId = linkCode ? claimMap.get(linkCode) : undefined;
      if (!lakeId) return false;
      router.push(routes.lake(lakeId));
      return true;
    },
    [claimMap, router],
  );

  const select = useCallback(
    (id: number, origin: SelectOrigin) => {
      if (rerouteIfClaimed(linkCodeById.get(id))) return;
      const before = selRef.current;
      dispatch({ type: 'SELECT_WATER', id, origin, currentRegion: currentBounds() });
      if (before.status !== 'none' && before.id === id) return;
      qc.fetchQuery(publicWaterByIdQuery(src, id)).then(
        (water) => {
          if (!water) return dispatch({ type: 'WATER_LOAD_FAILED', id });
          // The claim map may know a water only its full record names (a centroid pin).
          if (rerouteIfClaimed(water.linkCode)) return dispatch({ type: 'EXIT' });
          dispatch({ type: 'WATER_LOADED', id, water });
        },
        () => dispatch({ type: 'WATER_LOAD_FAILED', id }),
      );
    },
    [dispatch, linkCodeById, qc, rerouteIfClaimed, src],
  );
  const closePreview = useCallback(() => dispatch({ type: 'CLOSE_PREVIEW' }), [dispatch]);

  /* ---------------------------------------------------------------------------- hover (rule 7) */
  // A card under the pointer (or focused) lights its pin / shape on the map, and a pin or shape
  // under the pointer lights its card: one id, both halves (T2ListItem highlighted ↔ WaterPin halo).
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [directionsFor, setDirectionsFor] = useState<{ lat: number; lng: number } | null>(null);
  const previewing = selection.status === 'previewing' ? selection.water : null;

  /* ---------------------------------------------------------------------------- map gestures */
  // Card → marker at the cluster zooms (rule 7): at Romania's zoom every water sits in a cluster,
  // so the cluster holding the hovered water takes the ring (its leaves, read once per hover).
  const hoveredClusterKey = useMemo(() => {
    if (hoveredId == null || band !== 'clusters' || !index) return null;
    for (const c of clusters) {
      if (c.singleId != null || !c.key.startsWith('c')) continue;
      try {
        if (index.getLeaves(Number(c.key.slice(1)), Infinity).some((leaf) => leaf.properties.id === hoveredId)) return c.key;
      } catch {
        // a cluster id from an index that was just rebuilt: no ring rather than a wrong one
      }
    }
    return null;
  }, [hoveredId, band, index, clusters]);
  const pressCluster = (c: PublicWaterCluster) => {
    if (c.singleId != null) return select(c.singleId, 'pin');
    const map = mapRef.current;
    if (!map || !view) return;
    // Browsing, like a pan: the list steps aside so the zoom target is not behind it.
    setSheetSnap('hidden');
    // The index answers in the map's (integer) zoom; the tap rule (and its cap at the geometry band)
    // is fish's.
    const shift = view.mlZoom - view.zoom;
    const target = clusterTapZoom(c.expansionZoom != null ? c.expansionZoom - shift : undefined, view.zoom);
    const width = map.getCanvas().clientWidth || 1;
    map.easeTo({ center: [c.centerLng, c.centerLat], zoom: target - Math.log2(512 / width) });
  };

  const onMapClick = (e: { lng: number; lat: number; x: number; y: number }, map: MlMap) => {
    const near = (lat: number, lng: number) => {
      const p = map.project([lng, lat]);
      return Math.abs(p.x - e.x) <= MARKER_TAP_RADIUS_PX && Math.abs(p.y - e.y) <= MARKER_TAP_RADIUS_PX;
    };
    // The selected water's own pin re-frames it.
    if (previewing && near(previewing.centerLat, previewing.centerLng)) {
      return frameWater(previewing.geometry, previewing.centerLat, previewing.centerLng);
    }
    const candidates = band === 'clusters' ? clusters : smallPins;
    let best: PublicWaterCluster | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const p = map.project([c.centerLng, c.centerLat]);
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (near(c.centerLat, c.centerLng) && d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return pressCluster(best);
    if (band === 'clusters') return closePreview();
    const b = map.getBounds();
    const tol = Math.max((b.getEast() - b.getWest()) * (SHAPE_TAP_TOLERANCE_PX / (map.getCanvas().clientWidth || 1)), 0.0005);
    const hitCandidates: HitCandidate[] = [];
    for (const r of rowList) {
      const g = geoms.get(r.id);
      if (g) hitCandidates.push({ id: r.id, geometry: g.projected });
    }
    const hit = findWaterAtPoint(hitCandidates, e.lat, e.lng, tol);
    if (hit == null) return closePreview();
    select(hit, 'map');
  };

  /* ---------------------------------------------------------------------------- locate */
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locateKm, setLocateKm] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationProblem, setLocationProblem] = useState<LocationProblem | null>(null);
  const frameUser = (at: { lat: number; lng: number }, km: number) => {
    setLocateKm(km);
    mapRef.current?.fitBounds(boundsAround(at, km), { padding: 0 });
  };
  const locate = () => {
    if (locating) return;
    if (userLocation && locateKm != null) return frameUser(userLocation, Math.max(LOCATE_STEP_KM, locateKm - LOCATE_STEP_KM));
    if (!('geolocation' in navigator)) return setLocationProblem('services_off');
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
        setLocationProblem(err.code === err.PERMISSION_DENIED ? 'permission' : 'services_off');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  /* ---------------------------------------------------------------------------- search */
  const [searchOpen, setSearchOpen] = useState(false);
  const [recents, setRecents] = useState<PublicWaterListItem[]>([]);
  const openSearch = () => {
    setRecents(readRecents());
    setSearchOpen(true);
  };
  const selectFromSearch = (w: PublicWaterListItem) => {
    const next = pushRecentPublicWater(readRecents(), w);
    writeRecents(next);
    setRecents(next);
    setSearchOpen(false);
    const lakeId = w.linkCode ? claimMap.get(w.linkCode) : undefined;
    router.push(lakeId ? routes.lake(lakeId) : routes.publicWater(w.id));
  };

  /* ---------------------------------------------------------------------------- list */
  const listWaters = band === 'clusters' ? markerList : rowList;
  const sorted = useMemo(() => sortWatersByArea<PublicWaterListItem | (typeof markerList)[number]>(listWaters), [listWaters]);
  const count = listWaters.length;
  const listLoading = band === 'geometry' ? rows.isFetching : markers.isFetching;
  // The cards' media: each listed water's outline (outline.ts), one light read per list — not the
  // full geometries (~5 MB for the 150 largest). Until it lands (or if it fails) the type glyph.
  const outlineIds = useMemo(() => listWaters.map((w) => w.id).sort((a, b) => a - b).slice(0, 150).join(','), [listWaters]);
  const outlines = useQuery({
    queryKey: ['public-waters', 'outlines', outlineIds],
    queryFn: async () => {
      const res = await fetch(`/ape-publice/api/outlines?ids=${outlineIds}`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`ape-publice outlines: HTTP ${res.status}`);
      return new Map(((await res.json()) as ({ id: number } & WaterOutline)[]).map(({ id, ...o }) => [id, o]));
    },
    enabled: outlineIds.length > 0,
    staleTime: Infinity,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const listQuery = band === 'geometry' ? rows : markers;

  // A failed dataset read is not an empty area: no «nicio apă», no 0 — a retry of the failed reads.
  const failed = band === 'geometry' ? [rows].filter((q) => q.isError && !q.data) : [markers, centroids].filter((q) => q.isError && !q.data);
  const dataError = failed.length > 0;
  const retrying = failed.some((q) => q.isFetching);
  const retryData = () => {
    if (retrying) return;
    for (const q of failed) void q.refetch();
  };

  const title = publicWatersListTitle({ band, count, loading: geometryLoading });
  const firstLoad = !view || (count === 0 && listLoading && !dataError);
  const empty = count === 0 && listQuery.isSuccess && !dataError;
  const loadingId = selection.status === 'loading' ? selection.id : null;
  const loadingName = (() => {
    if (loadingId == null) return null;
    const w = listWaters.find((x) => x.id === loadingId);
    return w ? publicWaterName(w) : 'apa';
  })();
  // The kit T2 list header (/balti/harta's): the shimmer on first load, the last title muted while
  // a pan refreshes; the count beside it from 768 where the title does not carry it. None over the
  // error card, as on /balti/harta (the card names the failure).
  const listHeader =
    dataError && count === 0 ? null : (
      <T2ListHeader
        title={title}
        loading={firstLoad}
        stale={listLoading && count > 0}
        // fish's title keeps its words (parity c-title); the count beside it reads as words too,
        // «150 de ape», never a bare number (as /balti/harta's «130 de bălți…»).
        trailing={
          band === 'clusters' && count > 0 ? (
            <span className="t-label text-muted" aria-hidden>
              {plural(count, 'apă', 'ape')}
            </span>
          ) : undefined
        }
      />
    );
  const retryButton = (
    <Button
      variant="secondary"
      aria-busy={retrying || undefined}
      aria-disabled={retrying || undefined}
      onClick={retryData}
      className={T2_FLOATING_BUTTON}
    >
      {retrying ? 'Se încarcă…' : 'Încearcă din nou'}
    </Button>
  );
  // First load: fish's spinner (c23) in the list's place. A failed read: the kit list error,
  // /balti/harta's card. Nothing in the area: the kit empty card.
  const list = firstLoad ? (
    <p role="status" className="flex items-center justify-center gap-2 py-6 t-caption text-muted">
      <T2Spinner className="size-5" />
      <span className="sr-only">Se încarcă apele</span>
    </p>
  ) : dataError && count === 0 ? (
    <div className="grid flex-1 place-items-center *:w-full *:bg-transparent *:shadow-none">
      <ListError title="Nu am putut încărca apele" onRetry={retryData} retrying={retrying} retryLabel="Încearcă din nou" />
    </div>
  ) : empty ? (
    <EmptyState title="Nicio apă publică în această zonă." />
  ) : (
    <T2List label="Ape publice" stale={listLoading}>
      {sorted.map((w) => {
        const lakeId = w.linkCode ? claimMap.get(w.linkCode) : undefined;
        return (
          <T2ListItem
            key={w.id}
            id={String(w.id)}
            selected={selection.status !== 'none' && selection.id === w.id}
            highlighted={hoveredId === w.id}
            onHighlight={(id) => setHoveredId(id == null ? null : Number(id))}
          >
            {/* The horizontal card (rule 7): the outline / glyph, the surface, where and what, Direcții and «Vezi apa». */}
            <WaterRowCard
              id={w.id}
              name={w.name}
              type={w.type}
              county={w.county}
              countyIds={w.countyIds}
              areaKm2={w.areaKm2}
              outline={outlines.data?.get(w.id) ?? null}
              busy={loadingId === w.id}
              href={lakeId ? routes.lake(lakeId) : routes.publicWater(w.id)}
              claimed={!!lakeId}
              onSelect={() => select(w.id, 'list')}
              onDirections={() => setDirectionsFor({ lat: w.centerLat, lng: w.centerLng })}
            />
          </T2ListItem>
        );
      })}
    </T2List>
  );

  /* ---------------------------------------------------------------------------- toolbar */
  const chooseType = (f: PublicWaterFilter) => {
    if (f === filter) return;
    setFilter(f);
  };
  const openCounties = () => {
    setDraft(new Set(counties));
    setCountyTerm('');
    setPanelOpen(true);
  };
  // The search header starts with the Bălți / Ape publice switch (owner rules 6–7, as /balti and
  // imobiliare.ro): the two halves of one list read as one screen. From 768 it leads the toolbar's
  // row (T2Toolbar `switcher`, the h1 then for screen readers only); on a phone it floats as its
  // own row above the search pill — the pill + «Filtre» need the row's width.
  const toolbar = (
    <div className="flex flex-col gap-2">
      <div className="flex md:hidden [&>nav]:w-full [&>nav]:shadow-e2 [[data-solid]_&>nav]:shadow-e0">
        <WaterKindSwitch current="ape" />
      </div>
    <T2Toolbar
      title="Ape publice"
      switcher={<WaterKindSwitch current="ape" />}
      // The Bălți header's anatomy from 768 (owner rule 6, LakesMap): [switch][search] on one row,
      // then the FilterBar under it — «Filtre» leading, Lacuri / Râuri / Județe — at every width, so
      // switching segments moves nothing. «Filtre» opens the one filter panel there is (Județe).
      stacked
      onOpenFilters={openCounties}
      filterCount={counties.length}
      filtersExpanded={panelOpen}
      onReset={() => setCounties([])}
      canReset={counties.length > 0}
      search={
        // In the solid toolbar (from 768) the field sits flat on its hairline, not floating.
        <div className="contents md:[&>button]:shadow-none!">
          <T2SearchPill summary="Caută un râu sau lac" placeholder searchLabel="Caută un râu sau lac" onSearch={openSearch} />
        </div>
      }
      filtersButton={
        // Phone: the pill's filter icon (c4). From 768 the «Județe» chip opens the same panel and
        // carries the count — one control for one job.
        <FilterButton
          count={counties.length}
          expanded={panelOpen}
          onClick={openCounties}
          className={cn(T2_EXPANDED, 'max-md:shadow-e2! md:hidden', '[[data-solid]_&]:shadow-e0!')}
        />
      }
      filters={
        <>
          <T2FilterChip label="Lacuri" kind="toggle" active={filter === 'lake'} icon={<LakeIcon aria-hidden />} onClick={() => chooseType('lake')} />
          <T2FilterChip label="Râuri" kind="toggle" active={filter === 'river'} icon={<RiverIcon aria-hidden />} onClick={() => chooseType('river')} />
          <T2FilterChip
            label="Județe"
            kind="menu"
            count={counties.length}
            active={counties.length > 0}
            expanded={panelOpen}
            onClick={openCounties}
          />
        </>
      }
    />
    </div>
  );

  /* ---------------------------------------------------------------------------- map */
  const kindFor = (id: number): Kind => kindOf(typeById.get(id) ?? (filter === 'river' ? 'river' : 'natural_lake'));
  const pinLabel = (id: number) => {
    const w = listWaters.find((x) => x.id === id);
    return `${w ? publicWaterName(w) : kindFor(id) === 'river' ? 'Râu' : 'Lac'} — selectează pe hartă`;
  };
  const map = (
    <>
      <FrameReader
        onFrame={(f) => {
          frameRef.current = f;
        }}
      />
      <WaterMap
        label="Hartă ape publice"
        initialBounds={ROMANIA_BOUNDS}
        initialPadding={16}
        network={band === 'geometry' ? shapes : []}
        selected={previewing ? { id: previewing.id, type: previewing.type, geometry: previewing.geometry } : null}
        highlighted={hoveredId}
        onFeatureHover={setHoveredId}
        controlsTop="var(--t2-top,0px)"
        listAvailable
        onUnavailableChange={onMapUnavailable}
        onReady={(m) => {
          mapRef.current = m;
          // Romania in the part of the map the user sees (phone: under the toolbar, above the sheet).
          const f = frameRef.current;
          m.fitBounds(ROMANIA_BOUNDS, { padding: { top: f.top + 16, bottom: f.bottom + 16, left: 16, right: f.split ? 72 : 16 }, animate: false });
          onMoveEnd(m);
        }}
        onMoveStart={(user) => {
          if (!user) return;
          setLocateKm(null);
          if (!split) setSheetSnap((s) => (s === 'full' ? s : 'hidden'));
          dispatch({ type: 'USER_PANNED' });
        }}
        onMoveEnd={(m) => onMoveEnd(m)}
        onMapClick={onMapClick}
        controls={
          <div className="overflow-hidden rounded-control shadow-e2">
            <MapControlButton label="Locația mea" pressed={!!userLocation} busy={locating} onClick={locate}>
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
        markers={(ready) => (
          <>
            {(band === 'clusters' ? clusters : smallPins).map((c) =>
              c.singleId == null ? (
                <MapMarker key={c.key} ready={ready} lat={c.centerLat} lng={c.centerLng} raised={hoveredClusterKey === c.key}>
                  <T2MapCluster
                    label={`${c.count} ape — mărește harta aici`}
                    count={c.count}
                    large={c.count > 10}
                    highlighted={hoveredClusterKey === c.key}
                    onClick={() => pressCluster(c)}
                  />
                </MapMarker>
              ) : c.singleId === previewing?.id ? null : (
                <MapMarker key={c.key} ready={ready} lat={c.centerLat} lng={c.centerLng} raised={hoveredId === c.singleId}>
                  <WaterPin
                    id={c.singleId}
                    kind={kindFor(c.singleId)}
                    label={pinLabel(c.singleId)}
                    busy={loadingId === c.singleId}
                    highlighted={hoveredId === c.singleId}
                    onHover={setHoveredId}
                    onClick={() => pressCluster(c)}
                  />
                </MapMarker>
              ),
            )}
            {userLocation ? (
              <MapMarker ready={ready} lat={userLocation.lat} lng={userLocation.lng}>
                <span aria-hidden className="pointer-events-none block size-4.5 rounded-full border-3 border-surface bg-status-info-fg shadow-e2" />
              </MapMarker>
            ) : null}
            {previewing ? (
              <MapMarker key={`sel-${previewing.id}`} ready={ready} lat={previewing.centerLat} lng={previewing.centerLng} raised>
                <WaterPin
                  id={previewing.id}
                  kind={kindOf(previewing.type)}
                  label={`${publicWaterName(previewing)} — reîncadrează pe hartă`}
                  selected
                  onClick={() => frameWater(previewing.geometry, previewing.centerLat, previewing.centerLng)}
                />
              </MapMarker>
            ) : null}
          </>
        )}
      />
    </>
  );

  const mapStatus = dataError ? (
    <div className="flex flex-col items-center gap-2">
      <T2MapPill tone="warning">Apele nu s-au încărcat</T2MapPill>
      {retryButton}
    </div>
  ) : band === 'geometry' && geometryLoading && rowList.length === 0 ? (
    <T2MapPill busy>Se încarcă apele…</T2MapPill>
  ) : null;

  const detail = previewing ? (
    <T2MapCard
      title={publicWaterName(previewing)}
      href={routes.publicWater(previewing.id)}
      onClose={closePreview}
      closeLabel="Închide"
      // Room for the card's ✕ (it sits over the title row when there is no photo).
      titleAside={<span aria-hidden className="w-8 shrink-0" />}
      meta={
        <>
          <span className="truncate">{publicWaterSubtitle(previewing)}</span>
          {/* The whole card is the link (its title); this is its visible label, not a second target. */}
          <span aria-hidden className="t-label text-accent-ink">
            Vezi detalii ›
          </span>
        </>
      }
    />
  ) : null;

  const announcement = loadingName
    ? `Se încarcă ${loadingName}…`
    : firstLoad
      ? 'Se încarcă apele'
      : dataError
        ? 'Nu am putut încărca apele. Verifică conexiunea și încearcă din nou.'
        : count
          ? `${title}: ${count}`
          : empty
            ? 'Nicio apă publică în această zonă.'
            : '';

  return (
    <>
      <SetBreadcrumb trail={waterTrail()} />
      <T2Layout
        toolbar={toolbar}
        listLabel="Ape publice în zonă"
        listHeader={listHeader}
        list={list}
        busy={listLoading}
        map={map}
        mapStatus={mapStatus}
        announcement={announcement}
        detail={detail}
        sheetSnap={sheetSnap}
        onSheetSnapChange={setSheetSnap}
        showListLabel={`Vezi lista (${count})`}
        panel={{
          open: panelOpen,
          onClose: () => setPanelOpen(false),
          title: 'Județe',
          subtitle: 'Se aplică pe hartă și în listă',
          // The opener on screen: the phone pill's «Filtre», or the «Județe» chip from 768.
          returnFocusTo: () =>
            [...document.querySelectorAll<HTMLElement>('button[aria-label^="Filtre"], button[aria-label^="Județe"]')].find((b) => b.getClientRects().length > 0) ?? null,
          children: (
            <CountyFilterBody
              counties={countiesQuery.data ?? []}
              status={countiesQuery.status}
              retrying={countiesQuery.isFetching}
              onRetry={() => void countiesQuery.refetch()}
              draft={draft}
              onToggle={(id) =>
                setDraft((d) => {
                  const n = new Set(d);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              onClear={() => setDraft(new Set())}
              term={countyTerm}
              onTerm={setCountyTerm}
            />
          ),
          footer: (
            <div className="flex items-center gap-3 md:justify-end">
              <Button variant="ghost" onClick={() => setPanelOpen(false)}>
                Anulează
              </Button>
              {/* Nothing to apply until the counties are here (an error would apply an empty draft). */}
              {countiesQuery.isSuccess ? (
                <Button
                  className="flex-1 md:flex-none"
                  onClick={() => {
                    setCounties([...draft].sort((a, b) => a - b));
                    setPanelOpen(false);
                  }}
                >
                  {countyApplyLabel(draft.size)}
                </Button>
              ) : null}
            </div>
          ),
        }}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        recents={recents}
        onClearRecents={() => {
          writeRecents(null);
          setRecents([]);
        }}
        onSelect={selectFromSearch}
        onLocationBlocked={(p) => {
          setSearchOpen(false);
          setLocationProblem(p);
        }}
      />

      <DirectionsDialog open={directionsFor != null} onClose={() => setDirectionsFor(null)} lat={directionsFor?.lat ?? null} lng={directionsFor?.lng ?? null} />

      <Dialog
        open={locationProblem === 'permission'}
        onClose={() => setLocationProblem(null)}
        title="Găsește ape aproape de tine"
        description="Activează localizarea ca să îți arătăm apele publice din apropiere. Permite accesul la locație din bara de adrese a browserului (iconița de lângă adresă), apoi încearcă din nou."
        closeButton
        actions={<Button onClick={() => setLocationProblem(null)}>Am înțeles</Button>}
      />
      <Dialog
        open={locationProblem === 'services_off'}
        onClose={() => setLocationProblem(null)}
        title="Nu am putut afla locația"
        description="Verifică dacă localizarea e pornită pe dispozitiv, apoi încearcă din nou."
        closeButton
        actions={<Button onClick={() => setLocationProblem(null)}>Am înțeles</Button>}
      />
    </>
  );
}

/** Keeps the layout's frame (what the toolbar / sheet / card cover) for the camera's framing. */
function FrameReader({ onFrame }: { onFrame: (f: { split: boolean; top: number; bottom: number }) => void }) {
  const frame = useT2Frame();
  useLayoutEffect(() => {
    onFrame(frame);
  });
  return null;
}
