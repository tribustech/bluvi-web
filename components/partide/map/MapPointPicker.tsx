'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { ViewfinderCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { loadMaplibre } from '@/components/templates/T2/maplibre';
import { T2_MAP_STYLE } from '@/components/templates/T2/T2Map';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * Map point picker (parity partide.partida.c19; fish components/MapPointPicker.tsx as the partidă
 * shell uses it for «Ajustează poziția»): the map moves under a fixed centre pin — «Trage harta ca
 * să muți pinul» — and «Confirmă locul» hands back the centre. Opens on the anchor at a close
 * zoom over satellite imagery (fish `initialDelta 0.0004`, `hybrid`), or on Romania, wide, on the
 * standard map when there is no anchor (fish `delta 5`, `standard`). A Hartă / Satelit switch
 * (fish MapTypeToggle: small ponds are often missing from the standard map), «Centrează pe
 * locația mea» (the browser's geolocation), «Închide». The measuring line fish draws for catch
 * placement (`originPoint`) is not part of this use.
 *
 * Full screen on the phone, a large dialog from 768. MapLibre via the T2 loader; the keyboard pans
 * (arrows) and zooms (+ / −) once the map has focus. When the map cannot load (no WebGL, tiles
 * blocked) the picker says so and offers «Reîncearcă»; «Confirmă locul» waits for a map.
 */

export type Coord = { lat: number; lng: number };
export type PickerMapType = 'standard' | 'satellite';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
    },
    places: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'places', type: 'raster', source: 'places' },
  ],
};

export const CREDITS: Record<PickerMapType, string> = {
  standard: 'OpenFreeMap © OpenMapTiles © OpenStreetMap',
  satellite: 'Imagini © Esri, Maxar, Earthstar Geographics',
};

/** fish latitudeDelta → zoom: 0.0004 ≈ 19 (a stand), 5 ≈ 6 (the country). */
export const ANCHOR_ZOOM = 18.5;
export const COUNTRY_ZOOM = 5.6;
/** The centre of Romania (fish's fallback `{ lat: 45.94, lng: 24.97 }`). */
export const ROMANIA_CENTER: Coord = { lat: 45.94, lng: 24.97 };

const LOAD_TIMEOUT_MS = 10_000;

export function MapPointPicker({
  open,
  title,
  center,
  initialZoom,
  initialMapType,
  pending = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  center: Coord;
  initialZoom: number;
  initialMapType: PickerMapType;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (coord: Coord) => void;
}) {
  const dialog = useModalDialog(open, () => !pending && onCancel(), { backdrop: false });
  const titleId = useId();
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      data-testid="map-point-picker"
      className={cn(
        'm-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-surface p-0 text-ink backdrop:bg-scrim',
        'md:m-auto md:h-[min(720px,calc(100dvh-64px))] md:w-[min(960px,calc(100vw-64px))] md:rounded-card md:shadow-e2',
        'open:flex open:flex-col',
      )}
    >
      {open ? <PickerBody key={`${center.lat},${center.lng}`} titleId={titleId} title={title} center={center} initialZoom={initialZoom} initialMapType={initialMapType} pending={pending} onCancel={onCancel} onConfirm={onConfirm} /> : null}
    </dialog>
  );
}

type MapState = { status: 'loading' } | { status: 'ready' } | { status: 'failed' };

function PickerBody({
  titleId,
  title,
  center,
  initialZoom,
  initialMapType,
  pending,
  onCancel,
  onConfirm,
}: {
  titleId: string;
  title: string;
  center: Coord;
  initialZoom: number;
  initialMapType: PickerMapType;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (coord: Coord) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [state, setState] = useState<MapState>({ status: 'loading' });
  const [mapType, setMapType] = useState<PickerMapType>(initialMapType);
  const [point, setPoint] = useState<Coord>(center);
  const [attempt, setAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const firstStyle = useRef(initialMapType);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let map: MlMap | null = null;
    let timer = 0;
    setState({ status: 'loading' });
    (async () => {
      try {
        const lib = await loadMaplibre();
        if (cancelled) return;
        map = new lib.Map({
          container: el,
          style: firstStyle.current === 'satellite' ? SATELLITE_STYLE : T2_MAP_STYLE,
          center: [center.lng, center.lat],
          zoom: initialZoom,
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
        const sync = () => {
          const c = m.getCenter();
          setPoint({ lat: c.lat, lng: c.lng });
        };
        m.on('move', sync);
        let settled = false;
        timer = window.setTimeout(() => {
          if (settled || cancelled) return;
          settled = true;
          // The base map is slow or blocked: the picker still works on whatever has drawn.
          setState({ status: 'ready' });
        }, LOAD_TIMEOUT_MS);
        m.once('load', () => {
          if (cancelled || settled) return;
          settled = true;
          window.clearTimeout(timer);
          setState({ status: 'ready' });
        });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      mapRef.current = null;
      map?.remove();
    };
    // The map is built once per attempt; the switch below swaps its style in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const switchType = (next: PickerMapType) => {
    setMapType(next);
    mapRef.current?.setStyle(next === 'satellite' ? SATELLITE_STYLE : T2_MAP_STYLE);
  };

  const locate = () => {
    if (locating) return;
    setLocateError(null);
    if (!('geolocation' in navigator)) {
      setLocateError('Nu ți-am găsit poziția.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        mapRef.current?.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: Math.max(mapRef.current.getZoom(), 16) });
      },
      () => {
        setLocating(false);
        setLocateError('Nu ți-am găsit poziția. Permite accesul la locație pentru Bluvi din setările browserului.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const ready = state.status === 'ready';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-lat={point.lat.toFixed(6)} data-lng={point.lng.toFixed(6)} data-state={state.status} data-testid="map-point-picker-body">
      <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-3">
        <button
          type="button"
          onClick={() => !pending && onCancel()}
          aria-label="Închide"
          className="-ml-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
        >
          <XMarkIcon aria-hidden className="size-5" />
        </button>
        <h2 id={titleId} className="min-w-0 flex-1 truncate t-title2">
          {title}
        </h2>
        <div role="group" aria-label="Tipul hărții" className="flex shrink-0 rounded-control bg-soft-fill p-[3px]">
          {(
            [
              { value: 'standard', label: 'Hartă' },
              { value: 'satellite', label: 'Satelit' },
            ] as const
          ).map(o => (
            <button
              key={o.value}
              type="button"
              aria-pressed={mapType === o.value}
              onClick={() => switchType(o.value)}
              className={cn(
                'min-h-9 cursor-pointer rounded-control px-3 t-label focus-visible:outline-2 focus-visible:outline-accent',
                mapType === o.value ? 'bg-surface text-ink shadow-e1' : 'text-ink-2 hover:text-ink',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-page">
        <div ref={container} className="absolute inset-0" />
        {state.status === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="t-heading">Harta nu s-a putut încărca.</p>
            <p className="t-body text-muted">Verifică conexiunea și reîncearcă.</p>
            <Button variant="outline" onClick={() => setAttempt(a => a + 1)}>
              Reîncearcă
            </Button>
          </div>
        ) : (
          <>
            {/* The pin: its tip on the map's centre. */}
            <MapPinIcon aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-full text-accent drop-shadow-md" />
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full bg-accent ring-2 ring-surface" />
            <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-navy/80 px-3 py-1.5 t-caption text-lavender">Trage harta ca să muți pinul</p>
            <button
              type="button"
              onClick={locate}
              aria-label="Centrează pe locația mea"
              aria-busy={locating || undefined}
              className="absolute right-4 bottom-4 flex size-12 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-e2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-busy:cursor-progress"
            >
              <ViewfinderCircleIcon aria-hidden className={cn('size-6', locating && 'animate-pulse')} />
            </button>
            <p className="absolute bottom-1 left-2 rounded-badge bg-surface/85 px-1.5 py-0.5 t-micro text-ink-2">{CREDITS[mapType]}</p>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-hairline px-4 pt-3 pb-[max(--spacing(4),env(safe-area-inset-bottom))] md:flex-row md:items-center md:justify-between">
        <p className="t-caption text-muted tabular-nums" aria-live="polite">
          {locateError ?? (
            <>
              <span className="sr-only">Poziția aleasă: </span>
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </>
          )}
        </p>
        <Button
          variant="success"
          className="md:min-w-56"
          aria-disabled={!ready || pending || undefined}
          aria-busy={pending || undefined}
          data-testid="map-point-picker-confirm"
          onClick={() => {
            if (!ready || pending) return;
            const c = mapRef.current?.getCenter();
            onConfirm(c ? { lat: c.lat, lng: c.lng } : point);
          }}
        >
          {pending ? 'Se salvează…' : 'Confirmă locul'}
        </Button>
      </div>
    </div>
  );
}
