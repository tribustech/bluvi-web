'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { InformationCircleIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { Map as MlMap, Marker as MlMarker, MapLibreEvent } from 'maplibre-gl';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Supercluster from 'supercluster';
import { iconButtonClass } from '@/components/nav/IconButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useT2Frame, useT2LayoutBridge } from './context';
import { ROMANIA_BOUNDS, type T2Bounds, type T2LatLng, type T2MapPoint, type T2Viewport } from './geo';
import { loadMaplibre } from './maplibre';
import { CLUSTER_SIZE_PX, T2MapCluster, T2MapPin, T2UserDot, T2UserHalo } from './T2MapMarkers';
import { T2MapPill, T2Spinner } from './T2MapOverlay';

/*
 * Map library: MapLibre GL JS (BSD-3) with OpenFreeMap's «Positron» vector style — OpenStreetMap
 * data, no API key, no request quota, free for commercial use (https://openfreemap.org). Positron
 * is a quiet grey base, so the indigo pins carry the colour (fish uses the platform map).
 * The style's attribution is rendered by T2Map itself (see MapAttribution) so it can sit above the
 * phone sheet instead of under it.
 *
 * Pins are DOM markers rendered by React into MapLibre markers (portals): real <button>s with a
 * name, reachable by Tab, styled with the tokens. Clustering is supercluster (what MapLibre's own
 * GeoJSON clustering runs on) over the points the page passes; a page that clusters on the server
 * (fish /lakes/map-clusters) passes the server nodes as points and `cluster={false}`.
 */
export const T2_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

/** Clusters above this size use the large style (fish: count > 10 → red, else blue). */
const LARGE_CLUSTER = 10;
/** fish clusterTargetRegion: a cluster tap never zooms in more than 2 levels at once. */
const MAX_CLUSTER_ZOOM_STEP = 2;
/**
 * Pins and clusters are drawn this far apart before they merge (CSS px): the largest bubble plus an
 * 8px gap, so neighbouring bubbles never touch (a size change keeps them apart).
 */
const CLUSTER_RADIUS = CLUSTER_SIZE_PX.large + 8;
/** Past this zoom every point is its own pin. */
const CLUSTER_MAX_ZOOM = 13;
/** Breathing room around framed content, on top of what the layout covers. */
const FRAME_MARGIN = 48;
/**
 * The right side the floating control stack covers, plus a gap: 16 inset + 48 button (40 from 1280)
 * + 16. On a phone only «Locația mea» is there (no zoom buttons): 48 + 16.
 */
const CONTROLS_RIGHT = { split: 16 + 48 + 16, phone: 48 + 16 };
/**
 * No `load` by then (style or tile host hanging, never answering): the map counts as failed — the
 * «Reîncearcă» state shows and the page gets its viewport — instead of a blank canvas forever.
 */
const LOAD_TIMEOUT_MS = 10_000;

type ClusterNode = { kind: 'cluster'; key: string; clusterId: number; count: number; lat: number; lng: number };
type PointNode<P> = { kind: 'point'; key: string; point: P };
type MapNode<P> = ClusterNode | PointNode<P>;

export type T2MapFocus = {
  /** Change the key to re-run the same framing (fish focus nonce). */
  key: string | number;
  bounds: T2Bounds;
  maxZoom?: number;
};

export type T2MapProps<P extends T2MapPoint> = {
  /** Accessible name of the map region («Hartă bălți»). */
  label: string;
  points: ReadonlyArray<P>;
  /** Accessible name of one pin («Balta Alesteu»). */
  pointLabel: (point: P) => string;
  selectedId?: string | null;
  /** The point whose list row is hovered / focused: drawn raised so the eye finds it. */
  highlightedId?: string | null;
  onSelect?: (point: P) => void;
  /**
   * A pin is hovered / focused (id) or left (null): the page highlights its list card — the
   * reverse of `highlightedId` (owner rule 7: card ↔ marker).
   */
  onPointHover?: (id: string | null) => void;
  /** Accessible name of a cluster («12 bălți — mărește harta aici»). */
  clusterLabel?: (count: number) => string;
  /** Merge nearby points into counted clusters (default true). */
  cluster?: boolean;
  /** Framed at load. Default: Romania. */
  initialBounds?: T2Bounds;
  /** Programmatic framing (zoom out to the country, centre on the user, a search result). */
  focus?: T2MapFocus | null;
  /** After every settle (debounce it in the page if it fetches). */
  onViewportChange?: (viewport: T2Viewport) => void;
  /** The user started a pan / zoom (phone: fish hides the list). */
  onUserMoveStart?: () => void;
  userLocation?: T2LatLng | null;
  /** Extra floating buttons under zoom (locate). */
  controls?: ReactNode;
  /**
   * The map's chrome only — no MapLibre instance: the controls (disabled) and the attribution over
   * the empty ground, exactly where the live map puts them. For a Suspense fallback / first load,
   * so the live map does not make the controls pop in when it replaces it.
   */
  placeholder?: boolean;
  /** Show «Se încarcă harta…» while the map loads (off when the page shows its own loading status). */
  loadingStatus?: boolean;
  /**
   * Drawn right over the base map, under the markers and the floating controls (a first-load
   * shimmer): inside the map's isolated layer, so the controls stay opaque over it.
   */
  veil?: ReactNode;
  /**
   * The list beside the map has content. When the map cannot show, its note says «Lista rămâne
   * disponibilă» only then (default true).
   */
  listAvailable?: boolean;
  /** Dev/demo: behave as if the style host failed (the «map unavailable» state). */
  forceUnavailable?: boolean;
  className?: string;
};

type MapState =
  | { status: 'loading' }
  | { status: 'ready'; map: MlMap; Marker: typeof MlMarker }
  | { status: 'unsupported' }
  /** The library chunk, the style or its tiles failed before the first render. */
  | { status: 'failed' };

/** The map canvas of T2: base map, clustered pins, zoom controls, attribution. */
export function T2Map<P extends T2MapPoint>({
  label,
  points,
  pointLabel,
  selectedId = null,
  highlightedId = null,
  onSelect,
  onPointHover,
  clusterLabel = (count) => `${count} locuri — mărește harta aici`,
  cluster = true,
  initialBounds = ROMANIA_BOUNDS,
  focus = null,
  onViewportChange,
  onUserMoveStart,
  userLocation = null,
  controls,
  placeholder = false,
  loadingStatus = true,
  veil,
  listAvailable = true,
  forceUnavailable = false,
  className,
}: T2MapProps<P>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>(() => (forceUnavailable ? { status: 'failed' } : { status: 'loading' }));
  /** Bumped by «Reîncearcă» to build the map again. */
  const [attempt, setAttempt] = useState(0);
  const frame = useT2Frame();
  const frameRef = useRef(frame);
  const padding = useCallback(() => {
    const f = frameRef.current;
    // Right: clear of the floating zoom / locate stack, so nothing framed lands under it.
    return {
      top: f.top + FRAME_MARGIN,
      bottom: f.bottom + FRAME_MARGIN,
      left: FRAME_MARGIN,
      right: f.split ? CONTROLS_RIGHT.split : CONTROLS_RIGHT.phone,
    };
  }, []);

  // Latest callbacks without re-binding map listeners.
  const onViewportRef = useRef(onViewportChange);
  const onUserMoveStartRef = useRef(onUserMoveStart);
  useLayoutEffect(() => {
    frameRef.current = frame;
    onViewportRef.current = onViewportChange;
    onUserMoveStartRef.current = onUserMoveStart;
  });
  const initialBoundsRef = useRef(initialBounds);
  /**
   * A point selected at mount (a shared link, the demo's «Pin selectat») is framed instantly, before
   * the first viewport report — so a page scoping its list to the viewport renders it once, for the
   * framed area, instead of the start bounds first and a reflow after the camera moves.
   */
  const pendingFrameRef = useRef(selectedId != null);
  const reportViewport = useCallback((m: MlMap) => {
    const b = m.getBounds();
    onViewportRef.current?.({ bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: m.getZoom(), userGesture: false });
  }, []);

  // Create the map once. maplibre-gl touches `window` at import, so it loads in the browser only.
  useEffect(() => {
    if (placeholder || (forceUnavailable && attempt === 0)) return;
    let cancelled = false;
    let map: MlMap | null = null;
    let timeout = 0;
    (async () => {
      let lib: Awaited<ReturnType<typeof loadMaplibre>>;
      try {
        lib = await loadMaplibre();
      } catch {
        // Chunk load failure (offline, a new deploy): loadMaplibre forgets it, so a retry re-imports.
        if (!cancelled) setState({ status: 'failed' });
        return;
      }
      if (cancelled || !containerRef.current) return;
      try {
        map = new lib.Map({
          container: containerRef.current,
          style: T2_MAP_STYLE,
          bounds: initialBoundsRef.current,
          fitBoundsOptions: { padding: padding() },
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          minZoom: 4,
          maxZoom: 18,
        });
      } catch {
        // No WebGL (old device, disabled GPU): the list still works.
        setState({ status: 'unsupported' });
        return;
      }
      // An error while the style is still loading (style host unreachable, blocked) leaves a blank
      // canvas forever: say so. Later errors (one tile) are MapLibre's to retry.
      let loaded = false;
      const fail = () => {
        loaded = true;
        window.clearTimeout(timeout);
        map?.remove();
        map = null;
        setState({ status: 'failed' });
      };
      map.on('error', () => {
        if (loaded || cancelled || map?.isStyleLoaded()) return;
        fail();
      });
      // A host that never answers sends no `error` either: bound the wait.
      timeout = window.setTimeout(() => {
        if (!loaded && !cancelled) fail();
      }, LOAD_TIMEOUT_MS);
      map.touchZoomRotate.disableRotation();
      map.getCanvas().setAttribute('aria-label', `${label}. Folosește săgețile pentru a muta harta și + / − pentru zoom.`);
      let userGesture = false;
      map.on('movestart', (e: MapLibreEvent<unknown>) => {
        userGesture = Boolean(e.originalEvent);
        if (userGesture) onUserMoveStartRef.current?.();
      });
      map.on('moveend', () => {
        if (!map) return;
        const b = map.getBounds();
        onViewportRef.current?.({
          bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          zoom: map.getZoom(),
          userGesture,
        });
      });
      const m = map;
      map.once('style.load', () => localiseLabels(m));
      map.once('load', () => {
        if (cancelled || loaded) return;
        loaded = true;
        window.clearTimeout(timeout);
        setState({ status: 'ready', map: m, Marker: lib.Marker });
        // With a selection to frame, its (instant) move reports the first viewport.
        if (!pendingFrameRef.current) reportViewport(m);
      });
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map?.remove();
    };
    // The label only names the canvas; a new label must not rebuild the map. `attempt` rebuilds it.
    // `placeholder` never turns into a live map in place (the page swaps the tree).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const map = state.status === 'ready' ? state.map : null;
  const unavailable = state.status === 'unsupported' || state.status === 'failed';

  // Tell the layout: while the map cannot show, the page's own pills over it (loading, «Bălțile nu
  // s-au încărcat») step aside — the map's note is the one message there.
  const { setMapUnavailable } = useT2LayoutBridge();
  useEffect(() => {
    setMapUnavailable(unavailable);
    return () => setMapUnavailable(false);
  }, [unavailable, setMapUnavailable]);

  // No map (blocked style host, no WebGL): no `moveend` will ever come, so report the framing the
  // page asked for — a page that waits for the first viewport (a list scoped to it) can go on.
  useEffect(() => {
    if (!unavailable) return;
    const [west, south, east, north] = initialBoundsRef.current;
    onViewportRef.current?.({ bounds: [west, south, east, north], zoom: Number.NaN, userGesture: false });
  }, [unavailable]);

  // Programmatic framing.
  const focusKey = focus?.key;
  useEffect(() => {
    if (!map || !focus) return;
    map.fitBounds(focus.bounds, { padding: padding(), maxZoom: focus.maxZoom ?? 14 });
    // Only a new key re-frames; the bounds object may be rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusKey]);

  // Clustering. The selected point is left out of the index the map draws, so the lifted pin never
  // sits on a bubble that still counts it (a cluster of one left becomes a pin). A highlighted (list
  // hover) point is NOT lifted: drawn at its place it covered the bubble around it and hid its count.
  // It is raised when it stands alone, else the bubble that holds it takes the highlight ring.
  // `fullIndex` holds every point: it answers «which cluster hides this point» for the framing below.
  const liftedKey = selectedId ?? '';
  const fullIndex = useMemo(() => (cluster ? buildIndex(points) : null), [points, cluster]);
  const index = useMemo(() => {
    if (!cluster) return null;
    const lifted = new Set(liftedKey.split('|'));
    return liftedKey ? buildIndex(points.filter((p) => !lifted.has(p.id))) : fullIndex;
  }, [points, cluster, liftedKey, fullIndex]);
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);

  // A selection (from the list, or at load) brings its pin into view, zoomed in far enough that it
  // stands alone — no bubble around it (fish animateToRegion on the pin).
  const selected = useMemo(() => points.find((p) => p.id === selectedId) ?? null, [points, selectedId]);
  const selectedKey = selected?.id;
  useEffect(() => {
    if (!map) return;
    const instant = pendingFrameRef.current;
    pendingFrameRef.current = false;
    if (!selected) {
      if (instant) reportViewport(map);
      return;
    }
    const pad = padding();
    const at = map.project([selected.lng, selected.lat]);
    const canvas = map.getCanvas();
    const inside =
      at.x >= pad.left && at.x <= canvas.clientWidth - pad.right && at.y >= pad.top && at.y <= canvas.clientHeight - pad.bottom;
    const zoom = fullIndex ? Math.min(standAloneZoom(fullIndex, selected, map.getZoom()), map.getMaxZoom()) : map.getZoom();
    if (!inside || zoom > map.getZoom()) {
      const camera = { center: [selected.lng, selected.lat] as [number, number], zoom, padding: pad };
      if (instant) map.jumpTo(camera);
      else map.easeTo(camera);
    } else if (instant) reportViewport(map);
    // Only a new selection re-frames (not a new `points` array with the same lake in it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedKey, fullIndex, padding, reportViewport]);

  // `lifted`: the ids left out of the index these nodes came from. A point stays drawn as a lifted
  // pin until nodes from the new index include it, so a deselected pin is never unmounted for a
  // frame (its <button> keeps focus; the pin card hands focus back to it on Escape).
  const [{ list: nodes, lifted: nodesLifted }, setNodes] = useState<{ list: MapNode<P>[]; lifted: string }>({ list: [], lifted: '' });
  useEffect(() => {
    if (!map) return;
    let frameId = 0;
    // null, not '': an empty result («zzzz», filters excluding every lake) has the signature '' and
    // must still replace the nodes of the previous run.
    let signature: string | null = null;
    const compute = () => {
      frameId = 0;
      const b = map.getBounds();
      const zoom = Math.floor(map.getZoom());
      let next: MapNode<P>[];
      if (!index) {
        next = points.map((p) => ({ kind: 'point', key: p.id, point: p }));
      } else {
        // A little outside the view so pins do not pop in at the edges while panning.
        const w = b.getWest();
        const e = b.getEast();
        const s = b.getSouth();
        const n = b.getNorth();
        const dx = (e - w) * 0.15;
        const dy = (n - s) * 0.15;
        next = index.getClusters([w - dx, s - dy, e + dx, n + dy], zoom).flatMap((f): MapNode<P>[] => {
          const [lng, lat] = f.geometry.coordinates;
          const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string };
          if (props.cluster && props.cluster_id != null) {
            return [{ kind: 'cluster', key: `c${props.cluster_id}`, clusterId: props.cluster_id, count: props.point_count ?? 0, lat, lng }];
          }
          const point = props.id ? byId.get(props.id) : undefined;
          return point ? [{ kind: 'point', key: point.id, point }] : [];
        });
      }
      const sig = `${liftedKey}#${next.map((n) => n.key).join('|')}`;
      if (sig !== signature) {
        signature = sig;
        setNodes({ list: next, lifted: liftedKey });
      }
    };
    const schedule = () => {
      if (!frameId) frameId = requestAnimationFrame(compute);
    };
    compute();
    map.on('move', schedule);
    return () => {
      map.off('move', schedule);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [map, index, points, byId, liftedKey]);

  const zoomIntoCluster = (node: ClusterNode) => {
    if (!map || !index) return;
    const expansion = index.getClusterExpansionZoom(node.clusterId);
    map.easeTo({ center: [node.lng, node.lat], zoom: Math.min(expansion, map.getZoom() + MAX_CLUSTER_ZOOM_STEP), padding: padding() });
  };

  const shownIds = new Set(nodes.flatMap((n) => (n.kind === 'point' ? [n.point.id] : [])));
  // The bubble that holds the highlighted point (when it is not a pin of its own at this zoom).
  const hotCluster =
    index && highlightedId && highlightedId !== selectedId && !shownIds.has(highlightedId)
      ? (nodes.find(
          (n): n is ClusterNode =>
            n.kind === 'cluster' && index.getLeaves(n.clusterId, Infinity).some((leaf) => leaf.properties.id === highlightedId),
        )?.key ?? null)
      : null;
  // The selected / highlighted point is always drawn as a pin (it is not in `index`).
  const extras = [selectedId, ...nodesLifted.split('|')]
    .filter((id, i, all): id is string => !!id && all.indexOf(id) === i && !shownIds.has(id))
    .flatMap((id) => {
      const p = byId.get(id);
      return p ? [p] : [];
    });

  return (
    // `isolate`: the markers' layers stay inside the map, under the page chrome over it.
    <div className={cn('relative isolate size-full overflow-clip bg-soft-fill', className)}>
      {/* maplibre-gl.css makes the container `position: relative`, so it is sized, not inset. */}
      <div ref={containerRef} className="size-full" />
      {veil ? <div className="pointer-events-none absolute inset-0">{veil}</div> : null}

      {unavailable ? (
        // Inside the band the phone chrome leaves free (toolbar above, sheet below), so «Reîncearcă»
        // is never under the sheet.
        // The status is the sentence only: the live region does not wrap the button.
        <div className="absolute inset-x-0 top-(--t2-top,0px) bottom-(--t2-bottom,0px) flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p role="status" className="max-w-80 t-body text-muted">
            {state.status === 'failed' ? 'Harta nu s-a putut încărca.' : 'Harta nu se poate afișa în acest browser.'}
            {listAvailable ? ' Lista rămâne disponibilă.' : null}
          </p>
          {state.status === 'failed' ? (
            <Button
              variant="secondary"
              onClick={() => {
                setState({ status: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              Reîncearcă
            </Button>
          ) : null}
        </div>
      ) : null}

      {state.status === 'loading' && loadingStatus ? (
        // Quiet, and only once the wait is noticeable (a normal load is done before it fades in).
        <div className="pointer-events-none absolute inset-x-0 z-overlay top-(--t2-top,0px) bottom-(--t2-bottom,0px) flex items-center justify-center opacity-100 transition-opacity delay-700 duration-(--duration-medium) starting:opacity-0">
          <T2MapPill busy>Se încarcă harta…</T2MapPill>
        </div>
      ) : null}

      {state.status === 'ready' && (
        <>
          {/* The halo under every bubble and pin; the dot over the bubbles and plain pins (z-above),
              under the selected / highlighted pin (z-sticky) — a count under it stays legible. */}
          {userLocation && (
            <MapMarker state={state} at={userLocation} interactive={false}>
              <T2UserHalo />
            </MapMarker>
          )}
          {userLocation && (
            <MapMarker state={state} at={userLocation} interactive={false} overClusters>
              <T2UserDot />
            </MapMarker>
          )}
          {/*
            One keyed list: a point keeps its key (its id) whether it is drawn from the cluster index
            or lifted out of it (selected / highlighted), so its marker and <button> survive the
            selection — focus stays on the pin, and the pin card can hand it back on Escape.
          */}
          {[...nodes, ...extras.map((point): PointNode<P> => ({ kind: 'point', key: point.id, point }))].map((node) =>
            node.kind === 'cluster' ? (
              <MapMarker key={node.key} state={state} at={node} raised={node.key === hotCluster}>
                <T2MapCluster
                  label={clusterLabel(node.count)}
                  count={node.count}
                  large={node.count > LARGE_CLUSTER}
                  highlighted={node.key === hotCluster}
                  onClick={() => zoomIntoCluster(node)}
                />
              </MapMarker>
            ) : (
              <MapMarker
                key={node.key}
                state={state}
                at={node.point}
                anchor="bottom"
                raised={node.point.id === selectedId || node.point.id === highlightedId}
              >
                <T2MapPin
                  id={node.point.id}
                  label={pointLabel(node.point)}
                  selected={node.point.id === selectedId}
                  highlighted={node.point.id === highlightedId}
                  onClick={() => onSelect?.(node.point)}
                  onHover={onPointHover ? (on) => onPointHover(on ? node.point.id : null) : undefined}
                />
              </MapMarker>
            ),
          )}
        </>
      )}

      {/*
        Zoom (+ page controls): top right, below whatever floats over the map on a phone. Placed by
        T2Layout's CSS variables (--t2-top / --t2-bottom), so the server render is already right.
        Inert until the map is ready; gone when it cannot show.
      */}
      {unavailable ? null : (
        <div
          inert={!map}
          // Until the map is ready the controls dim their glyphs, not their surface (opaque + e2).
          className={cn(
            'absolute top-[calc(var(--t2-top,0px)+var(--spacing)*3)] right-4 z-overlay flex flex-col gap-2',
            !map && '[&_button]:text-faint',
          )}
        >
          {/* Phones pinch to zoom (fish has no zoom buttons); the buttons start at 768. */}
          <div className="hidden flex-col overflow-hidden rounded-control bg-surface shadow-e2 md:flex">
            <MapControlButton label="Mărește" onClick={() => map?.zoomIn()}>
              <PlusIcon aria-hidden />
            </MapControlButton>
            <span aria-hidden className="mx-2 h-px bg-hairline" />
            <MapControlButton label="Micșorează" onClick={() => map?.zoomOut()}>
              <MinusIcon aria-hidden />
            </MapControlButton>
          </div>
          {controls}
        </div>
      )}

      {unavailable ? null : <MapAttribution />}
    </div>
  );
}

function buildIndex(points: ReadonlyArray<T2MapPoint>) {
  const sc = new Supercluster<{ id: string }>({ radius: CLUSTER_RADIUS, maxZoom: CLUSTER_MAX_ZOOM });
  sc.load(
    points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { id: p.id },
    })),
  );
  return sc;
}

/**
 * The lowest zoom (≥ `from`) at which `point` is its own pin in `index`: while a cluster holds it,
 * step to that cluster's expansion zoom. Past CLUSTER_MAX_ZOOM every point stands alone.
 */
function standAloneZoom(index: Supercluster<{ id: string }>, point: T2MapPoint, from: number): number {
  let zoom = from;
  for (let guard = 0; guard < 20 && Math.floor(zoom) <= CLUSTER_MAX_ZOOM; guard++) {
    const z = Math.floor(zoom);
    // A bubble is drawn at its points' centre, not on the point: check the leaves of every bubble
    // near it.
    const near = index.getClusters(boundsNear(point, z), z).filter((f) => (f.properties as { cluster?: boolean }).cluster);
    const owner = near.find((f) => {
      const id = (f.properties as { cluster_id: number }).cluster_id;
      return index.getLeaves(id, Infinity).some((leaf) => leaf.properties.id === point.id);
    });
    if (!owner) return zoom;
    zoom = Math.max(z + 1, index.getClusterExpansionZoom((owner.properties as { cluster_id: number }).cluster_id));
  }
  return Math.max(zoom, from);
}

/** A box around `p` wide enough to hold any bubble that may have absorbed it at zoom `z`. */
function boundsNear(p: T2LatLng, z: number): T2Bounds {
  // CLUSTER_RADIUS px at zoom z, in degrees of longitude (512px tiles), doubled for slack.
  const deg = ((CLUSTER_RADIUS * 2) / (512 * 2 ** z)) * 360;
  return [p.lng - deg, p.lat - deg, p.lng + deg, p.lat + deg];
}

/**
 * Place names in Romanian: Positron prints «latin + local script» («Sofia София»); the map shows
 * `name:ro`, else the Latin name, else the local one. Road numbers (`ref`) are left alone.
 */
function localiseLabels(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (!field || !JSON.stringify(field).includes('name:latin')) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ro'], ['get', 'name:latin'], ['get', 'name']]);
  }
}

/**
 * A square floating map button (zoom, locate): the kit icon button (IconButton — 48, 40 from 1280,
 * a 24px icon slot, soft-fill hover, pressed .8) squared off to sit in a stack, on an opaque surface.
 * `pressed` (a toggle that is on: «Locația mea» while the user is shown) is the accent tint + ink,
 * the same «on» as the kit's selected segment. Disabled dims the glyph, never the surface — the
 * map must not show through a floating control. `busy` swaps the icon for a spinner and keeps the
 * button focusable (aria-disabled), so presses while busy are ignored, not queued.
 */
export function MapControlButton({
  label,
  onClick,
  disabled,
  pressed,
  busy = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onClick();
      }}
      disabled={disabled}
      className={iconButtonClass({
        // `!`: cn() does not merge, and the stack's container owns the rounding.
        className: cn(
          'rounded-none! bg-surface focus-visible:-outline-offset-2',
          'aria-pressed:bg-accent-tint aria-pressed:text-accent-ink aria-pressed:hover:bg-accent-tint-2 aria-pressed:hover:text-accent-ink',
          'disabled:cursor-default disabled:text-faint disabled:hover:bg-surface disabled:hover:text-faint aria-busy:cursor-progress',
        ),
      })}
    >
      {busy ? <T2Spinner className="size-6" /> : children}
    </button>
  );
}

/**
 * OpenFreeMap / OpenMapTiles / OpenStreetMap credit — required by the tile licence. On a phone it
 * is MapLibre's compact control: a 24px «ⓘ» chip in the 16px gutter (44px hit area) that shows the
 * credits on tap, so a full-width strip never covers the map labels over the sheet. From 768 the
 * credits are always shown, in the corner.
 */
function MapAttribution() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="absolute right-4 bottom-[calc(var(--t2-bottom,0px)+var(--spacing)*2)] z-overlay flex items-center gap-1 md:right-2 md:bottom-[calc(var(--t2-bottom,0px)+var(--spacing))]">
      <p id={id} className={cn('rounded-badge bg-surface px-1.5 py-0.5 t-micro text-ink-2 md:block', open ? 'block' : 'hidden')}>
        <a className="hover:underline" href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>{' '}
        <a className="hover:underline" href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">
          © OpenMapTiles
        </a>{' '}
        <a className="hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? 'Ascunde sursele hărții' : 'Sursele hărții'}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-ink-2 shadow-e1 md:hidden',
          'after:absolute after:-inset-2.5 after:content-[""] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <InformationCircleIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/**
 * One MapLibre marker whose content React renders (portal). MapLibre owns the position (a CSS
 * transform it updates on every frame), React owns what is inside.
 */
function MapMarker({
  state,
  at,
  anchor = 'center',
  raised = false,
  overClusters = false,
  interactive = true,
  children,
}: {
  state: Extract<MapState, { status: 'ready' }>;
  at: T2LatLng;
  /** Which part of the content sits on the coordinate: a pin's tip, a bubble's centre. */
  anchor?: 'center' | 'bottom';
  raised?: boolean;
  /** Above the bubbles and plain pins, under the raised ones (the user's position). */
  overClusters?: boolean;
  interactive?: boolean;
  children: ReactNode;
}) {
  const [element] = useState(() => {
    const el = document.createElement('div');
    if (!interactive) el.style.pointerEvents = 'none';
    return el;
  });
  const markerRef = useRef<MlMarker | null>(null);
  const { map, Marker } = state;
  const { lat, lng } = at;

  useEffect(() => {
    const marker = new Marker({ element, anchor }).setLngLat([lng, lat]).addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // Position updates go through setLngLat below; only a new map re-creates the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, Marker, element, anchor]);

  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat]);
  }, [lng, lat]);

  useEffect(() => {
    // Marker layers (inside T2Map's isolated root): plain pins and bubbles auto · the user's
    // position z-above · raised pins z-sticky · the floating controls z-overlay over all of them.
    element.classList.toggle('z-sticky', raised);
    element.classList.toggle('z-above', overClusters && !raised);
  }, [element, raised, overClusters]);

  return createPortal(children, element);
}
