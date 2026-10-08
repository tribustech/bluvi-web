'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import { ExclamationTriangleIcon, FireIcon, MapPinIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { loadMaplibre } from '@/components/templates/T2/maplibre';
import { T2_MAP_STYLE } from '@/components/templates/T2/T2Map';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { fmtKg, MAP_MARKER_LABEL, type LocalEvent, type LocalMarker, type MapMarkerType } from '@/core/partide';
import { CREDITS, ROMANIA_CENTER, SATELLITE_STYLE, type Coord, type PickerMapType } from './MapPointPicker';

/*
 * The partidă map (parity partide.partida-jurnal.c9 / c10; fish features/partide/components/PartidaMap.tsx):
 * the trip's catches and the venue's markers on a real map, opened by the Jurnal's «Hartă».
 *  - Opens centred on the anchor over a fixed ~0.006° span (fish REGION_SPAN), on satellite imagery
 *    (fish `hybrid`) with a Hartă / Satelit switch; without an anchor it frames what it has to show,
 *    else Romania.
 *  - Catches (the Jurnal's filtered, non-blank, located events) drop as fish-glyph pins in the rod's
 *    colour, or — «Heatmap» — as 18 m circles (rose for a capture, amber for a scăpat).
 *  - Markers («Zonă tare», «Pat nadă», «Agățătură») are buttons: activating one hands back its id
 *    (the Jurnal asks «Ștergi reperul?»). A legend appears once there is a marker (fish).
 *  - Adding (when `onAddAt` is given): a long-press (touch) or a right-click (mouse) hands back that
 *    point; the keyboard path is «Adaugă reper», which uses the point under the centre cross.
 * fish also outlines the public water under the anchor (its offline ANAR database); the web has no
 * point-in-water index, so that decoration is left out.
 *
 * Two hosts: <PartidaMapDialog> (full screen on the phone, a large dialog from 768) and, from 1280,
 * the Jurnal's side panel (<PartidaMapView variant="panel">). MapLibre via the T2 loader; when it
 * cannot load (no WebGL, blocked tiles) the map says so and offers «Reîncearcă».
 */

/** fish REGION_SPAN: the latitude / longitude span the map opens at. */
const REGION_SPAN = 0.006;
/** fish heat circle radius, metres. */
const HEAT_RADIUS_M = 18;
/** Touch long-press (fish MapView onLongPress). */
const LONG_PRESS_MS = 550;

/**
 * After a touch long-press fired, the finger's lift still ends in a click — and by then a surface
 * (a sheet, a dialog backdrop) sits under the finger, so that ghost click would dismiss it at once.
 * Swallow the one click that follows the lift (capture phase, before anything sees it).
 */
function swallowGhostClick() {
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    done();
  };
  const done = () => {
    window.removeEventListener('click', stop, true);
    window.removeEventListener('pointerdown', done, true);
    window.clearTimeout(t);
  };
  // A new touch means no ghost is pending; a lift that produced no click must not eat a later one.
  const t = window.setTimeout(done, 10_000);
  window.addEventListener('click', stop, true);
  window.addEventListener('pointerdown', done, true);
}

const MARKER_TONE: Record<MapMarkerType, string> = {
  hardSpot: 'text-yellow-6',
  baited: 'text-success',
  snag: 'text-muted',
};

/** lucide «sprout» (fish's hardSpot glyph) — heroicons has none. */
function SproutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

export function MarkerTypeIcon({ type, className }: { type: MapMarkerType; className?: string }) {
  if (type === 'hardSpot') return <SproutIcon className={className} />;
  if (type === 'baited') return <FireIcon aria-hidden className={className} />;
  return <ExclamationTriangleIcon aria-hidden className={className} />;
}

export type PartidaMapProps = {
  /** The anchor (0,0 = none). */
  center: Coord;
  /** Located events (lat/lng set), already filtered by the caller. */
  captures: LocalEvent[];
  markers: LocalMarker[];
  /** Long-press / right-click / «Adaugă reper» → the point. Absent: no adding (ended partidă). */
  onAddAt?: (coord: Coord) => void;
  /** A marker was activated → its clientId (the caller confirms the delete). Absent: read-only. */
  onPressMarker?: (clientId: string) => void;
  onClose: () => void;
};

type MapState = 'loading' | 'ready' | 'failed';

const hasCoord = (c: Coord) => c.lat !== 0 || c.lng !== 0;

/** The opening frame: the anchor's span, else everything shown, else Romania. */
function openingBounds(center: Coord, captures: LocalEvent[], markers: LocalMarker[]): [[number, number], [number, number]] | null {
  const pts: Coord[] = hasCoord(center) ? [center] : [...captures.map(c => ({ lat: c.lat as number, lng: c.lng as number })), ...markers];
  if (!pts.length) return null;
  const lats = pts.map(p => p.lat);
  const lngs = pts.map(p => p.lng);
  const h = REGION_SPAN / 2;
  return [
    [Math.min(...lngs) - h, Math.min(...lats) - h],
    [Math.max(...lngs) + h, Math.max(...lats) + h],
  ];
}

/** Metres per CSS pixel at `zoom` on `lat` (web mercator, 512px tiles in MapLibre). */
const metresPerPixel = (lat: number, zoom: number) => (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);

function catchTitle(c: LocalEvent): string {
  if (c.outcome === 'lost') return `Scăpat${c.rodLabel ? ` · ${c.rodLabel}` : ''}`;
  return c.weightKg ? `${fmtKg(c.weightKg)} kg${c.species ? ` · ${c.species}` : ''}` : (c.species ?? c.rodLabel ?? 'Captură');
}

/** fish PinBadge: the fish glyph on the rod's colour, a lollipop whose tip is the point. */
function CatchPin({ c }: { c: LocalEvent }) {
  const title = catchTitle(c);
  return (
    <span role="img" aria-label={title} title={title} data-testid="partida-map-catch" className="flex flex-col items-center drop-shadow-md">
      <span className="flex size-7 items-center justify-center rounded-full border-2 border-on-photo-scrim text-on-photo-scrim" style={{ backgroundColor: c.rodColor ?? 'var(--color-indigo-5)' }}>
        <FishIcon className="size-4" />
      </span>
      <span aria-hidden className="h-2 w-0.5 rounded-b-full" style={{ backgroundColor: c.rodColor ?? 'var(--color-indigo-5)' }} />
    </span>
  );
}

function HeatDot({ c }: { c: LocalEvent }) {
  return (
    <span
      aria-hidden
      data-testid="partida-map-heat"
      className={cn('block rounded-full', c.outcome === 'capture' ? 'bg-live/25' : 'bg-yellow-5/25')}
      style={{ width: 'calc(var(--heat-r, 15px) * 2)', height: 'calc(var(--heat-r, 15px) * 2)' }}
    />
  );
}

function MarkerPin({ m, onPress }: { m: LocalMarker; onPress?: (clientId: string) => void }) {
  const label = m.label || MAP_MARKER_LABEL[m.type];
  const pin = (
    <>
      <span className={cn('flex size-8 items-center justify-center rounded-full border-2 bg-surface shadow-e2', MARKER_TONE[m.type], 'border-current')}>
        <MarkerTypeIcon type={m.type} className="size-4.5" />
      </span>
      <span aria-hidden className={cn('-mt-1 size-2 rotate-45 bg-current', MARKER_TONE[m.type])} />
    </>
  );
  return onPress ? (
    <button
      type="button"
      data-testid="partida-map-marker"
      data-type={m.type}
      aria-label={`${label} — șterge reperul`}
      title={label}
      onClick={e => {
        e.stopPropagation();
        onPress(m.clientId);
      }}
      className="flex cursor-pointer flex-col items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {pin}
    </button>
  ) : (
    <span role="img" aria-label={label} title={label} data-testid="partida-map-marker" data-type={m.type} className="flex flex-col items-center">
      {pin}
    </span>
  );
}

/** A React node mounted into a MapLibre marker element (the map owns its position). */
type Mounted = { marker: MlMarker; root: Root };

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-full bg-surface p-[3px] shadow-e2">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-3 t-label focus-visible:outline-2 focus-visible:outline-accent',
            value === o.value ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The map itself, filling its host. `variant`: `dialog` draws the close button over the map (the
 * full-screen phone surface); `panel` leaves the chrome to the host (the Jurnal's side panel).
 */
export function PartidaMapView({ center, captures, markers, onAddAt, onPressMarker, onClose, variant, title = 'Hartă', titleId }: PartidaMapProps & { variant: 'dialog' | 'panel'; title?: string; titleId?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [state, setState] = useState<MapState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<'pins' | 'heat'>('pins');
  const [mapType, setMapType] = useState<PickerMapType>('satellite');
  const firstType = useRef(mapType);
  const addRef = useRef(onAddAt);
  useEffect(() => {
    addRef.current = onAddAt;
  }, [onAddAt]);
  const anchorLat = hasCoord(center) ? center.lat : (captures[0]?.lat ?? markers[0]?.lat ?? ROMANIA_CENTER.lat);

  /* ── the map ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let map: MlMap | null = null;
    let press = 0;
    setState('loading');
    (async () => {
      try {
        const lib = await loadMaplibre();
        if (cancelled) return;
        const bounds = openingBounds(center, captures, markers);
        map = new lib.Map({
          container: el,
          style: firstType.current === 'satellite' ? SATELLITE_STYLE : T2_MAP_STYLE,
          ...(bounds ? { bounds, fitBoundsOptions: { padding: 24, maxZoom: 19 } } : { center: [ROMANIA_CENTER.lng, ROMANIA_CENTER.lat] as [number, number], zoom: 5.6 }),
          maxZoom: 20,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
        });
        map.touchZoomRotate.disableRotation();
        map.getCanvas().setAttribute('aria-label', `${title}. Folosește săgețile pentru a muta harta și + / − pentru zoom.`);
        const m = map;
        mapRef.current = m;
        const heat = () => el.style.setProperty('--heat-r', `${Math.max(4, HEAT_RADIUS_M / metresPerPixel(anchorLat, m.getZoom()))}px`);
        heat();
        m.on('zoom', heat);
        // Right-click (mouse) — and the long-press of browsers that report it as a context menu.
        m.on('contextmenu', e => {
          e.preventDefault();
          addRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
        // Touch long-press (iOS Safari reports no context menu): one finger held still.
        m.on('touchstart', e => {
          window.clearTimeout(press);
          if (e.points.length !== 1 || !addRef.current) return;
          const at = e.lngLat;
          press = window.setTimeout(() => {
            if (!addRef.current) return;
            swallowGhostClick();
            addRef.current({ lat: at.lat, lng: at.lng });
          }, LONG_PRESS_MS);
        });
        const cancelPress = () => window.clearTimeout(press);
        m.on('touchmove', cancelPress);
        m.on('touchend', cancelPress);
        m.on('touchcancel', cancelPress);
        m.on('movestart', cancelPress);
        // HTML overlays need only the map's transform, not its tiles: usable at once (a blocked or
        // slow base map still shows the catches and markers, and «Adaugă reper» works).
        setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(press);
      mapRef.current = null;
      map?.remove();
    };
    // Built once per attempt; the overlays below follow the data, the switch swaps the style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  /* ── overlays: catches (pins or heat) and markers ──────────────────── */
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => setMapReady(state === 'ready' && !!mapRef.current), [state]);
  useEffect(() => {
    const m = mapRef.current;
    if (!mapReady || !m) return;
    let cancelled = false;
    const mounted: Mounted[] = [];
    void loadMaplibre().then(lib => {
      if (cancelled) return;
      const add = (lat: number, lng: number, node: ReactNode, anchor: 'bottom' | 'center') => {
        const el = document.createElement('div');
        const root = createRoot(el);
        root.render(node);
        mounted.push({ marker: new lib.Marker({ element: el, anchor }).setLngLat([lng, lat]).addTo(m), root });
      };
      for (const c of captures) {
        if (c.lat == null || c.lng == null) continue;
        add(c.lat, c.lng, mode === 'pins' ? <CatchPin c={c} /> : <HeatDot c={c} />, mode === 'pins' ? 'bottom' : 'center');
      }
      for (const mk of markers) add(mk.lat, mk.lng, <MarkerPin m={mk} onPress={onPressMarker} />, 'bottom');
    });
    return () => {
      cancelled = true;
      for (const { marker, root } of mounted) {
        marker.remove();
        // Unmount after the commit that removed the element (React forbids a sync unmount mid-render).
        queueMicrotask(() => root.unmount());
      }
    };
  }, [mapReady, captures, markers, mode, onPressMarker]);

  const switchType = (next: PickerMapType) => {
    setMapType(next);
    mapRef.current?.setStyle(next === 'satellite' ? SATELLITE_STYLE : T2_MAP_STYLE);
  };
  const addAtCentre = () => {
    const c = mapRef.current?.getCenter();
    if (c) onAddAt?.({ lat: c.lat, lng: c.lng });
  };

  const located = captures.filter(c => c.lat != null && c.lng != null).length;

  return (
    <div className="relative min-h-0 flex-1 bg-navy" data-testid="partida-map" data-state={state} data-mode={mode} data-captures={located} data-markers={markers.length}>
      {/* maplibre-gl.css makes the map container `position: relative`: it fills an inset box instead. */}
      <div className="absolute inset-0">
        <div ref={container} className="size-full" />
      </div>
      {state === 'failed' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-page p-6 text-center">
          <p className="t-heading">Harta nu s-a putut încărca.</p>
          <p className="t-body text-muted">Verifică conexiunea și reîncearcă.</p>
          <Button variant="outline" onClick={() => setAttempt(a => a + 1)}>
            Reîncearcă
          </Button>
        </div>
      ) : (
        <>
          {/* top row: close (dialog), the hint, Pini / Heatmap */}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            {variant === 'dialog' ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Închide harta"
                className="pointer-events-auto flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-e2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <XMarkIcon aria-hidden className="size-5" />
              </button>
            ) : (
              <span />
            )}
            {variant === 'dialog' ? (
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : null}
            <div className="pointer-events-auto">
              <Segmented
                label="Afișare capturi"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'pins', label: 'Pini', icon: <MapPinIcon aria-hidden className="size-3.5" /> },
                  { value: 'heat', label: 'Heatmap', icon: <FireIcon aria-hidden className="size-3.5" /> },
                ]}
              />
            </div>
          </div>
          {onAddAt ? (
            <>
              {/* The point «Adaugă reper» uses. */}
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-1/2">
                <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-surface/90 shadow-e1" />
                <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-surface/90 shadow-e1" />
              </span>
              <p className="pointer-events-none absolute inset-x-0 top-16 mx-auto w-fit max-w-[calc(100%-24px)] rounded-control bg-navy/80 px-3 py-1.5 text-center t-caption text-lavender">
                <span className="md:hidden">Ține apăsat ca să pui un reper</span>
                <span className="max-md:hidden">Clic dreapta ca să pui un reper</span>
              </p>
            </>
          ) : null}
          {/* bottom row: add + legend left, map type right */}
          <div className="pointer-events-none absolute inset-x-3 bottom-6 flex items-end justify-between gap-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex min-w-0 flex-col items-start gap-2">
              {markers.length > 0 ? (
                <ul aria-label="Legendă" data-testid="partida-map-legend" className="pointer-events-auto flex max-w-full flex-wrap gap-x-2.5 gap-y-1 rounded-card bg-surface/92 px-3 py-2 shadow-e1">
                  {(['hardSpot', 'baited', 'snag'] as const).map(t => (
                    <li key={t} className="flex items-center gap-1.25 t-caption text-ink-2">
                      <MarkerTypeIcon type={t} className={cn('size-3.5', MARKER_TONE[t])} />
                      {MAP_MARKER_LABEL[t]}
                    </li>
                  ))}
                  <li className="flex items-center gap-1.25 t-caption text-ink-2">
                    <FishIcon aria-hidden className="size-3.5 text-live" />
                    Capturi
                  </li>
                </ul>
              ) : null}
              {onAddAt ? (
                <button
                  type="button"
                  onClick={addAtCentre}
                  disabled={state !== 'ready'}
                  className="pointer-events-auto flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3.5 t-label whitespace-nowrap text-ink shadow-e2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress disabled:opacity-60"
                >
                  <PlusIcon aria-hidden className="size-4" />
                  Adaugă reper
                </button>
              ) : null}
            </div>
            <div className="pointer-events-auto">
              <Segmented
                label="Tipul hărții"
                value={mapType}
                onChange={switchType}
                options={[
                  { value: 'standard', label: 'Hartă' },
                  { value: 'satellite', label: 'Satelit' },
                ]}
              />
            </div>
          </div>
          <p className="pointer-events-none absolute right-1 bottom-0.5 max-w-[calc(100%-8px)] truncate rounded-badge bg-surface/85 px-1.5 py-px t-micro text-ink-2">{CREDITS[mapType]}</p>
        </>
      )}
    </div>
  );
}

/** fish's slide-up Modal: the whole screen on the phone, a large dialog from 768. */
export function PartidaMapDialog({ open, ...props }: PartidaMapProps & { open: boolean }) {
  const dialog = useModalDialog(open, props.onClose);
  const titleId = useId();
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      data-testid="partida-map-dialog"
      className={cn(
        'm-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-navy p-0 text-ink backdrop:bg-scrim',
        'md:m-auto md:h-[min(760px,calc(100dvh-64px))] md:w-[min(1040px,calc(100vw-64px))] md:rounded-card md:shadow-e2',
        'open:flex open:flex-col',
      )}
    >
      {open ? <PartidaMapView {...props} variant="dialog" titleId={titleId} /> : null}
    </dialog>
  );
}
