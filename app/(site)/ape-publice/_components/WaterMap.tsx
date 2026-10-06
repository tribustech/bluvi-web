'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { InformationCircleIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { FilterSpecification, GeoJSONSource, Map as MlMap, MapLibreEvent, MapMouseEvent, Marker as MlMarker } from 'maplibre-gl';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MapControlButton, T2_MAP_STYLE, T2MapPill } from '@/components/templates/T2';
import { useT2LayoutBridge } from '@/components/templates/T2/context';
import { loadMaplibre } from '@/components/templates/T2/maplibre';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { PublicWaterGeometry, PublicWaterType } from '@/core/lakes';

/*
 * The public-water map: the T2 map's base (MapLibre + OpenFreeMap Positron, the same controls,
 * attribution and failure states — components/templates/T2/T2Map.tsx) with what T2Map cannot do
 * yet: GeoJSON layers (rivers as lines, lakes as washed polygons, the amber selection) and taps on
 * the map itself (fish resolves taps on the MapView, not on the shapes). Composed locally because
 * the kit map exposes neither its instance nor custom layers.
 * TODO(kit): T2Map `layers` + `onMapClick` + `onReady(map)` — then this becomes a thin wrapper.
 *
 * Styling (fish PublicWatersLayer / SelectedWaterHighlight): the network in the accent indigo —
 * rivers 3px lines, lakes 2.5px outlines with an 18% wash; the selection in amber — rivers 6px,
 * lakes a 4.5px outline with a 25% amber wash (or the indigo wash, on the detail pages). Those are
 * fish's widths at close zoom (street level, ≥ 15); fitted wide (a whole lake or river at once) the
 * strokes thin out with the zoom, so the outline never swamps the shape it marks.
 * Colours come from the tokens at runtime (MapLibre paints with values, not classes); the kit has
 * no amber, so the selection takes `--color-rating` (amber-400). TODO(kit): a map-selection token.
 */

export type WaterBounds = [west: number, south: number, east: number, north: number];
export type WaterFeature = { id: number; type: PublicWaterType; geometry: PublicWaterGeometry };
export type MapReady = { map: MlMap; Marker: typeof MlMarker };
export type WaterPadding = number | { top: number; bottom: number; left: number; right: number };

/** No `load` by then (style host hanging): the map counts as failed (T2Map LOAD_TIMEOUT_MS). */
const LOAD_TIMEOUT_MS = 10_000;

/** fish's width at close zoom, thinned out when the map is fitted wide (zoom 8 → 12 → 15). */
function zoomWidth(riverClose: number, lakeClose: number, riverWide: number, lakeWide: number, riverMid: number, lakeMid: number) {
  const byKind = (river: number, lake: number) => ['case', ['==', ['get', 'kind'], 'river'], river, lake];
  return ['interpolate', ['linear'], ['zoom'], 8, byKind(riverWide, lakeWide), 12, byKind(riverMid, lakeMid), 15, byKind(riverClose, lakeClose)] as unknown as number;
}

const SRC_NETWORK = 'pw-network';
const SRC_SELECTED = 'pw-selected';

/**
 * A colour token's value, for MapLibre paint (which cannot read var()): every token is defined on
 * :root (app/globals.css), and the layers are only built in the browser, after the styles loaded.
 */
function token(name: `--color-${string}`): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toCollection(features: ReadonlyArray<WaterFeature>) {
  return {
    type: 'FeatureCollection' as const,
    features: features.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      properties: { id: f.id, kind: f.type === 'river' ? 'river' : 'lake' },
      geometry: f.geometry,
    })),
  };
}

/** Adds the network + selection sources and layers once, under the base map's labels. */
function ensureLayers(map: MlMap, selectedFill: 'amber' | 'indigo') {
  if (map.getSource(SRC_NETWORK)) return;
  const accent = token('--color-accent');
  const amber = token('--color-rating');
  const empty = { type: 'FeatureCollection' as const, features: [] };
  map.addSource(SRC_NETWORK, { type: 'geojson', data: empty });
  map.addSource(SRC_SELECTED, { type: 'geojson', data: empty });
  const beforeId = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
  const isLake = (): FilterSpecification => ['==', ['get', 'kind'], 'lake'];
  map.addLayer(
    { id: 'pw-net-fill', type: 'fill', source: SRC_NETWORK, filter: isLake(), paint: { 'fill-color': accent, 'fill-opacity': 0.18 } },
    beforeId,
  );
  map.addLayer(
    {
      id: 'pw-net-line',
      type: 'line',
      source: SRC_NETWORK,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': accent, 'line-width': zoomWidth(3, 2.5, 1.5, 1.25, 2.5, 2) },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: 'pw-sel-fill',
      type: 'fill',
      source: SRC_SELECTED,
      filter: isLake(),
      paint: selectedFill === 'amber' ? { 'fill-color': amber, 'fill-opacity': 0.25 } : { 'fill-color': accent, 'fill-opacity': 0.18 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: 'pw-sel-line',
      type: 'line',
      source: SRC_SELECTED,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': amber, 'line-width': zoomWidth(6, 4.5, 2.5, 2, 4.5, 3.5) },
    },
    beforeId,
  );
}

export type WaterMapProps = {
  /** Accessible name of the map («Hartă ape publice»). */
  label: string;
  initialBounds: WaterBounds;
  /** Padding when framing `initialBounds` (px, or per side) — or a function read when the map is
   * built (in the browser), for a padding that depends on the screen (the hero's overlays). */
  initialPadding?: WaterPadding | (() => WaterPadding);
  /** false: a still picture (the detail hero) — no pan, zoom or keyboard; no controls. */
  interactive?: boolean;
  /** The network drawn in indigo (rivers + lakes). */
  network?: ReadonlyArray<WaterFeature>;
  /** The selected / shown water, in amber. */
  selected?: WaterFeature | null;
  selectedFill?: 'amber' | 'indigo';
  /** Zoom buttons from 768 (phones pinch). Default: with `interactive`. */
  zoomButtons?: boolean;
  /** Extra floating buttons under the zoom stack (locate). */
  controls?: ReactNode;
  /** The map's top inset for its floating controls (CSS length; T2 passes var(--t2-top)). */
  controlsTop?: string;
  /** Markers rendered into the map (clusters, pins), given the ready map. */
  markers?: (ready: MapReady) => ReactNode;
  onReady?: (map: MlMap) => void;
  onMoveStart?: (userGesture: boolean) => void;
  onMoveEnd?: (map: MlMap, userGesture: boolean) => void;
  /** A click / tap on the map itself (not on a marker). */
  onMapClick?: (e: { lng: number; lat: number; x: number; y: number }, map: MlMap) => void;
  /** «Se încarcă harta…» while the library and style load. */
  loadingStatus?: boolean;
  /** Says «Lista rămâne disponibilă» when the map cannot show (T2). */
  listAvailable?: boolean;
  /** The map cannot show (no WebGL, tiles down) — or can again after «Reîncearcă». */
  onUnavailableChange?: (unavailable: boolean) => void;
  /** `auto`: the «ⓘ» chip on a phone, the full line from 768 (an interactive map); `full`: the
   * line at every width; `none`: the page draws <MapAttribution> itself (over a link covering the
   * map, which would otherwise swallow the chip). Default: by `interactive`. */
  attribution?: 'auto' | 'full' | 'none';
  className?: string;
};

type MapState = { status: 'loading' } | ({ status: 'ready'; initialCenter: string } & MapReady) | { status: 'unsupported' } | { status: 'failed' };

export function WaterMap({
  label,
  initialBounds,
  initialPadding = 48,
  interactive = true,
  network,
  selected = null,
  selectedFill = 'amber',
  zoomButtons = interactive,
  controls,
  controlsTop = '0px',
  markers,
  onReady,
  onMoveStart,
  onMoveEnd,
  onMapClick,
  loadingStatus = true,
  listAvailable = false,
  onUnavailableChange,
  attribution = interactive ? 'auto' : 'full',
  className,
}: WaterMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const cbs = useRef({ onReady, onMoveStart, onMoveEnd, onMapClick, onUnavailableChange });
  useLayoutEffect(() => {
    cbs.current = { onReady, onMoveStart, onMoveEnd, onMapClick, onUnavailableChange };
  });
  const startRef = useRef({ initialBounds, initialPadding, interactive, label, selectedFill });

  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let timeout = 0;
    (async () => {
      let lib: Awaited<ReturnType<typeof loadMaplibre>>;
      try {
        lib = await loadMaplibre();
      } catch {
        if (!cancelled) setState({ status: 'failed' });
        return;
      }
      if (cancelled || !containerRef.current) return;
      const start = startRef.current;
      const padding = typeof start.initialPadding === 'function' ? start.initialPadding() : start.initialPadding;
      try {
        map = new lib.Map({
          container: containerRef.current,
          style: T2_MAP_STYLE,
          bounds: start.initialBounds,
          fitBoundsOptions: { padding },
          attributionControl: false,
          interactive: start.interactive,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          minZoom: 4,
          maxZoom: 18,
        });
      } catch {
        setState({ status: 'unsupported' });
        return;
      }
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
      timeout = window.setTimeout(() => {
        if (!loaded && !cancelled) fail();
      }, LOAD_TIMEOUT_MS);
      map.touchZoomRotate.disableRotation();
      const canvas = map.getCanvas();
      if (start.interactive) {
        canvas.setAttribute('aria-label', `${start.label}. Folosește săgețile pentru a muta harta și + / − pentru zoom.`);
      } else {
        // A still picture: not a focus stop, named by the button over it.
        canvas.removeAttribute('tabindex');
        canvas.setAttribute('aria-hidden', 'true');
      }
      let userGesture = false;
      map.on('movestart', (e: MapLibreEvent<unknown>) => {
        userGesture = Boolean(e.originalEvent);
        cbs.current.onMoveStart?.(userGesture);
      });
      map.on('moveend', () => {
        if (map) cbs.current.onMoveEnd?.(map, userGesture);
      });
      map.on('click', (e: MapMouseEvent) => {
        // A marker's own button handled it (markers live inside the map's container).
        if ((e.originalEvent?.target as Element | null)?.closest?.('.maplibregl-marker')) return;
        if (map) cbs.current.onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat, x: e.point.x, y: e.point.y }, map);
      });
      const m = map;
      map.once('style.load', () => {
        localiseLabels(m);
        ensureLayers(m, start.selectedFill);
      });
      map.once('load', () => {
        if (cancelled || loaded) return;
        loaded = true;
        window.clearTimeout(timeout);
        ensureLayers(m, start.selectedFill);
        // The container may have been laid out after the map was built: frame again at its size.
        m.resize();
        m.fitBounds(start.initialBounds, { padding, animate: false });
        const c = m.getCenter();
        setState({ status: 'ready', map: m, Marker: lib.Marker, initialCenter: `${c.lng.toFixed(4)},${c.lat.toFixed(4)}` });
        // e2e only (dev builds; NODE_ENV is inlined, so production drops it): the camera the
        // harta-ape band / cluster / tap / restore tests drive and read (`.maplibregl-map`.__map).
        if (process.env.NODE_ENV !== 'production' && containerRef.current) {
          (containerRef.current as HTMLDivElement & { __map?: MlMap }).__map = m;
        }
        cbs.current.onReady?.(m);
      });
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map?.remove();
    };
  }, [attempt]);

  const map = state.status === 'ready' ? state.map : null;
  const unavailable = state.status === 'unsupported' || state.status === 'failed';

  const { setMapUnavailable } = useT2LayoutBridge();
  useEffect(() => {
    setMapUnavailable(unavailable);
    cbs.current.onUnavailableChange?.(unavailable);
    return () => setMapUnavailable(false);
  }, [unavailable, setMapUnavailable]);

  // The data layers follow the props.
  useEffect(() => {
    const src = map?.getSource(SRC_NETWORK) as GeoJSONSource | undefined;
    src?.setData(toCollection(network ?? []));
  }, [map, network]);
  useEffect(() => {
    const src = map?.getSource(SRC_SELECTED) as GeoJSONSource | undefined;
    src?.setData(toCollection(selected ? [selected] : []));
  }, [map, selected]);

  return (
    <div
      className={cn('relative isolate size-full overflow-clip bg-soft-fill', className)}
      // Test hooks (e2e harta.c4): what the selection layers draw once the map is up.
      data-map-status={state.status}
      data-selected-water={map && selected ? selected.id : undefined}
      data-selected-style={map && selected ? `outline-amber wash-${selectedFill}` : undefined}
      // e2e harta.s5: where the first frame landed («lng,lat»), read once when the map is up.
      data-initial-center={state.status === 'ready' ? state.initialCenter : undefined}
    >
      <div ref={containerRef} className="size-full" />

      {unavailable ? (
        <div className="absolute inset-x-0 top-(--t2-top,0px) bottom-(--t2-bottom,0px) flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p role="status" className="max-w-80 t-body text-muted">
            {state.status === 'failed' ? 'Harta nu s-a putut încărca.' : 'Harta nu se poate afișa în acest browser.'}
            {listAvailable ? ' Lista rămâne disponibilă.' : null}
          </p>
          {state.status === 'failed' && interactive ? (
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
        <div className="pointer-events-none absolute inset-x-0 top-(--t2-top,0px) bottom-(--t2-bottom,0px) z-overlay flex items-center justify-center opacity-100 transition-opacity delay-700 duration-(--duration-medium) starting:opacity-0">
          <T2MapPill busy>Se încarcă harta…</T2MapPill>
        </div>
      ) : null}

      {state.status === 'ready' && markers ? markers(state) : null}

      {unavailable || !(zoomButtons || controls) ? null : (
        <div
          inert={!map}
          style={{ top: `calc(${controlsTop} + var(--spacing) * 3)` }}
          className={cn('absolute right-4 z-overlay flex flex-col gap-2', !map && '[&_button]:text-faint')}
        >
          {zoomButtons ? (
            <div className="hidden flex-col overflow-hidden rounded-control bg-surface shadow-e2 md:flex">
              <MapControlButton label="Mărește" onClick={() => map?.zoomIn()}>
                <PlusIcon aria-hidden />
              </MapControlButton>
              <span aria-hidden className="mx-2 h-px bg-hairline" />
              <MapControlButton label="Micșorează" onClick={() => map?.zoomOut()}>
                <MinusIcon aria-hidden />
              </MapControlButton>
            </div>
          ) : null}
          {controls}
        </div>
      )}

      {unavailable || attribution === 'none' ? null : <MapAttribution mode={attribution} />}
    </div>
  );
}

/** Place names in Romanian (T2Map localiseLabels). */
function localiseLabels(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (!field || !JSON.stringify(field).includes('name:latin')) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ro'], ['get', 'name:latin'], ['get', 'name']]);
  }
}

/**
 * The tile credits (OpenFreeMap / OpenMapTiles / OpenStreetMap — required by the tile licence) and
 * the dataset's (ANAR, CC BY 4.0 — parity public-waters.b.attribution: wherever the dataset is
 * shown). T2Map's MapAttribution: a 24px «ⓘ» chip on a phone, always shown from 768 (`auto`); the
 * chip at every width (`compact`: the still hero, whose page repeats the credits in Locație); the
 * line at every width (`full`).
 */
export function MapAttribution({ mode, className }: { mode: 'auto' | 'compact' | 'full'; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const compact = mode !== 'full';
  // `compact` everywhere: the chip stays the toggle from 768 too, the line only when opened.
  const always = mode === 'compact';
  return (
    <div
      className={cn(
        'absolute right-4 bottom-[calc(var(--t2-bottom,0px)+var(--spacing)*2)] z-overlay flex items-center gap-1',
        !always && 'md:right-2 md:bottom-[calc(var(--t2-bottom,0px)+var(--spacing))]',
        className,
      )}
    >
      <p id={id} className={cn('rounded-badge bg-surface px-1.5 py-0.5 t-micro text-ink-2', !always && 'md:block', open || !compact ? 'block' : 'hidden')}>
        <a className="hover:underline" href="https://data.gov.ro" target="_blank" rel="noreferrer">
          Date: ANAR (CC BY 4.0)
        </a>{' '}
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
      {compact ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={open ? 'Ascunde sursele hărții' : 'Sursele hărții'}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-ink-2 shadow-e1',
            !always && 'md:hidden',
            'after:absolute after:-inset-2.5 after:content-[""] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <InformationCircleIcon aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * One MapLibre marker whose content React renders (T2Map MapMarker): MapLibre owns the position,
 * React the content. `raised` lifts it over the others (the selected pin).
 */
export function MapMarker({
  ready,
  lat,
  lng,
  raised = false,
  children,
}: {
  ready: MapReady;
  lat: number;
  lng: number;
  raised?: boolean;
  children: ReactNode;
}) {
  const [element] = useState(() => document.createElement('div'));
  const markerRef = useRef<MlMarker | null>(null);
  const { map, Marker } = ready;
  useEffect(() => {
    const marker = new Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // Position updates go through setLngLat below; only a new map re-creates the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, Marker, element]);
  useEffect(() => {
    markerRef.current?.setLngLat([lng, lat]);
  }, [lng, lat]);
  useEffect(() => {
    element.classList.toggle('z-sticky', raised);
  }, [element, raised]);
  return createPortal(children, element);
}
