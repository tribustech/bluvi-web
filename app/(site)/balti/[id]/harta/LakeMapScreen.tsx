'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MlMap, Marker as MlMarker, StyleSpecification } from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon, InformationCircleIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { CardShell, CardTitle } from '@/components/cards/CardShell';
import { CatchIcon, FishIcon, ScaleIcon } from '@/components/icons/brand';
import { SHELL_EDGE_LEFT } from '@/components/nav/shell';
import { FOCUS_RING } from '@/components/templates/T1';
import { MapControlButton, T2_ALIGN_LEFT, T2BackLink, T2MapPill, T2MapPin, T2Viewport } from '@/components/templates/T2';
import { loadMaplibre } from '@/components/templates/T2/maplibre';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { standStatsByLakeIdQuery, type StandStats } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { DirectionsDialog } from '../_components/LakeDialogs';
import { FocusAfterRetry } from '../_components/RetryFocus';
import { firstReadFailed, SubListError } from '../_sub/states';
import { rankKg } from '../_sub/stats';
import { useBack } from '../_sub/useBack';

/*
 * Hartă baltă — fish app/(app)/lakes/[lakeId]/map.tsx → LakeMap + useLakeMap + LakeStandPins /
 * LakeStandPin + LakeStandsCarousel / LakeStandCard (parity lakes.map), in T2's frame and controls:
 *  - c1 satellite with roads and place names (fish mapType «hybrid»: «standing pins are only
 *    meaningful against the water and the bank you can actually recognise») centred on the lake at
 *    close zoom (fish delta 0.0034° ≈ zoom 17), the floating back control (T2BackLink);
 *  - c2 no coordinates: «Coordonatele bălții nu sunt disponibile»;
 *  - c3 the lake's pin: its callout «Navighează către locație» opens Direcții (Google Maps / Waze /
 *    Apple Maps — the lake page's dialog, fish NavigationSheet);
 *  - c4 a pin per stand with coordinates (stand stats; the kit T2MapPin, selection = T2's accent
 *    halo, as on /balti), the first stand selected at first;
 *  - c5 the stand cards (every stand, as fish's carousel): «Stand {nume}», «Cea mai mare captură»,
 *    «Calitate», «Capturi» («N/A» when missing; kg always with two decimals);
 *  - c6 a pin selects its stand, centres the map on it and brings its card into view; moving the
 *    cards (scroll, the arrows, a card) selects that stand, centres its pin and shows its callout;
 *  - c7 a stand pin's callout «Navighează către locație» opens Direcții to that stand.
 * Layout: the back square and the lake's title chip top left, on the shell's left edge from 1280
 * (T2's align constant, like the logo and the breadcrumb). Below 1280 the cards are a carousel at
 * the bottom (centred on a phone, from the left edge from 768) with «‹ N din M ›» as one segmented
 * control above them; from 1280 they dock as a scrolling column (T2's panel width) on the same left
 * edge. The camera's padding is measured from what floats over the map (the column / the carousel,
 * the zoom stack, the title row), so a centred stand always lands in the open part. Zoom is T2's
 * control stack (from 768; phones pinch). The stands read has its own skeleton and the kit error
 * card in the cards' slot; the map has T2's states (the delayed busy pill, «Reîncearcă») and the
 * stand cards stay usable when the imagery fails.
 * Imagery: Esri World Imagery + its transportation and boundaries/places reference layers (raster,
 * no key; owner to confirm the licence for production — see the batch notes). T2Map has no style
 * prop, so this page drives MapLibre itself and copies T2Map's pieces (zoom stack, states,
 * attribution chip). TODO(kit): T2Map `style` prop + free-form markers (React children at a
 * coordinate, the callout), an exported MapAttribution with a `sources` prop, and a lake variant of
 * T2MapPin — then this page moves onto T2Map and the copies go (this unit may only touch the lake
 * pages).
 */

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: {
      type: 'raster',
      tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagini © Esri, Maxar, Earthstar Geographics',
    },
    roads: { type: 'raster', tiles: [`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
    places: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'roads', type: 'raster', source: 'roads' },
    { id: 'places', type: 'raster', source: 'places' },
  ],
};

/** fish latitudeDelta 0.0034 on a phone ≈ zoom 17; a stand: delta 0.001 ≈ zoom 18. */
const LAKE_ZOOM = 17;
const STAND_ZOOM = 18;
/**
 * No `load` by then (a tile host hanging): the map counts as failed instead of a blank canvas — but
 * only when no satellite tile arrived at all; a slow connection whose imagery is coming in keeps
 * its working map.
 */
const LOAD_TIMEOUT_MS = 10_000;
/** The air between what floats over the map and a stand centred by the camera. */
const CAMERA_GAP = 16;

type Coords = { lat: number; lng: number };
type Callout = 'lake' | string | null;
/** How the stand list is laid out at this width: phone carousel · tablet carousel · docked column. */
type Mode = 'center' | 'start' | 'panel';

const modeNow = (): Mode =>
  window.matchMedia('(min-width: 1280px)').matches ? 'panel' : window.matchMedia('(min-width: 768px)').matches ? 'start' : 'center';

type Padding = { top: number; bottom: number; left: number; right: number };

/**
 * What floats over the map, measured (never restated from the classes): the docked column's right
 * edge (from 1280) or the carousel's top (below it), the zoom stack's left edge, the title row's
 * bottom — so a centred stand lands in the open part of the map whatever those classes say.
 */
function measurePadding(frame: HTMLElement, slot: HTMLElement | null, zoom: HTMLElement | null, head: HTMLElement | null): Padding {
  const box = frame.getBoundingClientRect();
  const visible = (el: HTMLElement | null) => (el && el.getClientRects().length ? el.getBoundingClientRect() : null);
  const s = visible(slot);
  const z = visible(zoom);
  const h = visible(head);
  const right = z ? Math.max(0, box.right - z.left + CAMERA_GAP) : 0;
  if (modeNow() === 'panel') return { top: 0, bottom: 0, left: s ? Math.max(0, s.right - box.left + CAMERA_GAP) : 0, right };
  return {
    top: h ? Math.max(0, h.bottom - box.top + CAMERA_GAP) : 0,
    bottom: s ? Math.max(0, box.bottom - s.top + CAMERA_GAP) : 0,
    left: 0,
    right,
  };
}

/** «1 stand», «12 standuri», «21 de standuri» (Romanian: «de» from 20). */
const standsCount = (n: number) => (n === 1 ? '1 stand' : n % 100 >= 20 || (n > 0 && n % 100 === 0) ? `${n} de standuri` : `${n} standuri`);

const hasCoords = (s: StandStats): s is StandStats & { coordinates: { latitude: number; longitude: number } } =>
  s.coordinates.latitude != null && s.coordinates.longitude != null && !!s.coordinates.latitude && !!s.coordinates.longitude;

export function LakeMapScreen({ lakeId, lakeName, coords }: { lakeId: string; lakeName: string; coords: Coords | null }) {
  const back = useBack(routes.lake(lakeId));
  const title = `Hartă ${lakeName}`;
  if (!coords) {
    return (
      <MapFrame title={title} lakeName={lakeName} lakeId={lakeId} onBack={back}>
        <div className="flex h-full items-center justify-center bg-soft-fill px-6" data-testid="map-no-coordinates">
          <p className="text-center t-body-strong text-ink">Coordonatele bălții nu sunt disponibile</p>
        </div>
      </MapFrame>
    );
  }
  return <StandsMap lakeId={lakeId} lakeName={lakeName} coords={coords} title={title} onBack={back} />;
}

/**
 * The map's frame: T2Viewport (the window under the shell's chrome, never a page scroll; the shell
 * column gives the width — full width up to 1680), the h1 (sr-only), the map area, and the title
 * row over it: T2's back square and a floating chip with the lake's name (the h1 is sr-only, and a
 * phone has no breadcrumb — the screen must still say which lake it is). The row sits on the shell's
 * left edge from 1280 (T2's ALIGN_LEFT — the logo's, the breadcrumb's, /balti/harta's back square).
 * The back square is T2BackLink to the lake (a real link: new tab, copy), while a plain click goes
 * back in history when the previous page is the site's (useBack).
 */
export function MapFrame({
  title,
  lakeName,
  caption = 'Hartă',
  lakeId,
  onBack,
  headRef,
  children,
  overlay,
}: {
  title: string;
  /** The chip's name; none while the lake is read (the chip then is not drawn). */
  lakeName?: string;
  caption?: string;
  lakeId?: string;
  onBack?: () => void;
  headRef?: Ref<HTMLDivElement>;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const onClickCapture = (e: MouseEvent) => {
    if (!onBack || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onBack();
  };
  return (
    <T2Viewport>
      <h1 id="harta-balta-titlu" className="sr-only">
        {title}
      </h1>
      <div className="relative min-h-0 flex-1 overflow-clip">
        {children}
        <div className={cn('pointer-events-none absolute inset-x-0 top-4 z-overlay flex items-center gap-2 pr-20 pl-4', T2_ALIGN_LEFT)} data-testid="map-head">
          <div ref={headRef} className="pointer-events-auto flex min-w-0 items-center gap-2">
            <div className="shrink-0" onClickCapture={onClickCapture} data-testid="map-back">
              <T2BackLink href={lakeId ? routes.lake(lakeId) : routes.lakes()} label="Înapoi" />
            </div>
            {lakeName ? (
              // Visual: the h1 above names the page for assistive tech.
              <p
                aria-hidden
                className="flex h-12 min-w-0 max-w-[60vw] items-center gap-1.5 rounded-control bg-surface px-3 shadow-e2 xl:h-10"
                data-testid="map-title"
              >
                <span className="min-w-0 truncate t-body-strong text-ink">{lakeName}</span>
                <span className="shrink-0 t-caption text-muted">· {caption}</span>
              </p>
            ) : null}
          </div>
        </div>
        {overlay}
      </div>
    </T2Viewport>
  );
}

type MapState = { status: 'loading' } | { status: 'ready'; map: MlMap; Marker: typeof MlMarker } | { status: 'failed' };

function StandsMap({ lakeId, lakeName, coords, title, onBack }: { lakeId: string; lakeName: string; coords: Coords; title: string; onBack: () => void }) {
  const t = useMemo(() => createBrowserTransport(), []);
  // `initialData: []` would count as a fresh answer (the client's default staleTime) and the browser
  // would never read the stands after a failed server prefetch: date the placeholder at 0 (stale).
  const standsQ = useQuery({ ...standStatsByLakeIdQuery(t, lakeId), initialDataUpdatedAt: 0 });
  // The query starts from `initialData: []` (success before any read): a real answer is one the
  // server or the browser got. Once there, a later failed background refetch keeps the cards.
  const answeredNow = standsQ.isSuccess && standsQ.isFetched;
  const [got, setGot] = useState(answeredNow);
  if (answeredNow && !got) setGot(true);
  const answered = got || answeredNow;
  const standsFailed = firstReadFailed(standsQ, answered);
  const standsPending = !answered && !standsFailed;
  const stands = useMemo(() => (answered ? standsQ.data : []), [answered, standsQ.data]);
  const placed = useMemo(() => stands.filter(hasCoords), [stands]);

  const container = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<MapState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  /** «Reîncearcă» was pressed: focus follows the map back (loading status → canvas). */
  const retried = useRef(false);
  // c4: the first stand is selected at first (fish useState(stands[0]?.standId)).
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked ?? stands[0]?.standId ?? null;
  const [callout, setCallout] = useState<Callout>(null);
  const [directions, setDirections] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const cards = useRef<HTMLUListElement>(null);
  /** A selection made by the cards' own scrolling must not scroll them again. */
  const fromScroll = useRef(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let map: MlMap | null = null;
    let timer = 0;
    (async () => {
      try {
        const lib = await loadMaplibre();
        if (cancelled) return;
        map = new lib.Map({
          container: el,
          style: SATELLITE_STYLE,
          center: [coords.lng, coords.lat],
          zoom: LAKE_ZOOM,
          maxZoom: 20,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          // The credits are the kit's chip (MapAttribution below), not MapLibre's own control.
          attributionControl: false,
        });
        map.touchZoomRotate.disableRotation();
        map.getCanvas().setAttribute('aria-label', `${title}. Folosește săgețile pentru a muta harta și + / − pentru zoom.`);
        const m = map;
        let loaded = false;
        const fail = () => {
          loaded = true;
          window.clearTimeout(timer);
          map?.remove();
          map = null;
          if (!cancelled) setState({ status: 'failed' });
        };
        // The imagery IS the page: when no satellite tile arrives before the first render (host
        // blocked or down), say so instead of a dark canvas with pins.
        let imageryOk = 0;
        let imageryFailed = 0;
        m.on('sourcedata', e => {
          if (e.sourceId === 'imagery' && (e as { tile?: unknown }).tile) imageryOk += 1;
        });
        m.on('error', e => {
          if ((e as { sourceId?: string }).sourceId === 'imagery') imageryFailed += 1;
        });
        const ready = () => {
          loaded = true;
          window.clearTimeout(timer);
          if (frameRef.current) m.setPadding(measurePadding(frameRef.current, slotRef.current, zoomRef.current, headRef.current));
          m.jumpTo({ center: [coords.lng, coords.lat] });
          setState({ status: 'ready', map: m, Marker: lib.Marker });
        };
        // `load` waits for every first tile of three sources: on a slow connection it can come
        // late while the imagery is arriving fine — fail only when no satellite tile arrived.
        timer = window.setTimeout(() => {
          if (loaded || cancelled) return;
          if (imageryOk === 0) fail();
          else ready();
        }, LOAD_TIMEOUT_MS);
        m.once('load', () => {
          if (cancelled || loaded) return;
          if (imageryOk === 0 && imageryFailed > 0) return fail();
          ready();
        });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      map?.remove();
    };
  }, [coords.lat, coords.lng, attempt, title]);

  const map = state.status === 'ready' ? state.map : null;

  // What floats over the map changes with the width and with the stands' read (skeleton → cards):
  // keep the camera's padding measured from it.
  useEffect(() => {
    if (!map) return;
    const update = () => {
      if (frameRef.current) map.setPadding(measurePadding(frameRef.current, slotRef.current, zoomRef.current, headRef.current));
    };
    update();
    const ro = new ResizeObserver(update);
    for (const el of [frameRef.current, slotRef.current, zoomRef.current, headRef.current]) if (el) ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [map, standsPending, standsFailed, stands.length]);

  // After a retry, focus stays in the map frame: on the loading status, then on the map itself.
  useEffect(() => {
    if (!retried.current) return;
    if (state.status === 'loading') loadingRef.current?.focus({ preventScroll: true });
    else if (state.status === 'ready') {
      retried.current = false;
      state.map.getCanvas().focus({ preventScroll: true });
    } else retried.current = false;
  }, [state]);

  const centreOn = useCallback(
    (s: StandStats) => {
      if (map && hasCoords(s)) map.easeTo({ center: [s.coordinates.longitude, s.coordinates.latitude], zoom: Math.max(map.getZoom(), STAND_ZOOM), duration: 500 });
    },
    [map],
  );

  /** Bring a stand's card into view: centred (phone), at the left edge (768+), into the column (1280+). */
  const reveal = useCallback((standId: string) => {
    const strip = cards.current;
    const card = strip?.querySelector<HTMLElement>(`[data-stand="${CSS.escape(standId)}"]`);
    if (!strip || !card) return;
    const mode = modeNow();
    if (mode === 'panel') {
      const top = card.offsetTop;
      const bottom = top + card.offsetHeight;
      if (top < strip.scrollTop || bottom > strip.scrollTop + strip.clientHeight) strip.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
      return;
    }
    const wanted = mode === 'center' ? card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2 : card.offsetLeft - 16;
    const left = Math.min(Math.max(0, wanted), strip.scrollWidth - strip.clientWidth);
    // The card already sits there (e.g. its own pin pressed): no scroll comes, so no settle to skip —
    // a pending skip would swallow the next swipe's selection (c6).
    if (Math.abs(left - strip.scrollLeft) < 1) return;
    fromScroll.current = true;
    strip.scrollTo({ left, behavior: 'smooth' });
  }, []);

  /** c6 — a pin: select its stand, centre on it, bring its card into view. */
  const selectFromPin = (s: StandStats) => {
    setPicked(s.standId);
    setCallout(s.standId);
    centreOn(s);
    reveal(s.standId);
  };

  /** c6 — the cards: select that stand, centre its pin, show its callout. */
  const selectFromCards = useCallback(
    (s: StandStats) => {
      setPicked(s.standId);
      setCallout(hasCoords(s) ? s.standId : null);
      centreOn(s);
    },
    [centreOn],
  );

  // Below 1280: the card at the strip's anchor (its centre on a phone, its left edge from 768) once
  // its scrolling settles is the selected stand. The docked column (1280+) selects by press only.
  useEffect(() => {
    const strip = cards.current;
    if (!strip || !stands.length) return;
    let timer = 0;
    const settle = () => {
      if (fromScroll.current) {
        fromScroll.current = false;
        return;
      }
      const mode = modeNow();
      if (mode === 'panel') return;
      const anchor = mode === 'center' ? strip.scrollLeft + strip.clientWidth / 2 : strip.scrollLeft + 16;
      let best: HTMLElement | null = null;
      let dist = Infinity;
      for (const el of strip.querySelectorAll<HTMLElement>('[data-stand]')) {
        const at = mode === 'center' ? el.offsetLeft + el.clientWidth / 2 : el.offsetLeft;
        const d = Math.abs(at - anchor);
        if (d < dist) {
          dist = d;
          best = el;
        }
      }
      const s = best ? stands.find(x => x.standId === best.dataset.stand) : undefined;
      if (s && s.standId !== selectedId) selectFromCards(s);
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 140);
    };
    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      strip.removeEventListener('scroll', onScroll);
    };
  }, [stands, selectedId, selectFromCards]);

  const step = (dir: -1 | 1) => {
    const i = stands.findIndex(s => s.standId === selectedId);
    const next = stands[Math.min(stands.length - 1, Math.max(0, i + dir))];
    if (!next) return;
    selectFromCards(next);
    reveal(next.standId);
  };
  const selectedIndex = stands.findIndex(s => s.standId === selectedId);
  const counter = selectedIndex >= 0 ? `${selectedIndex + 1} din ${stands.length}` : `${stands.length} standuri`;

  /** No stand has a pin: the pager and the per-card badge would move nothing on the map. */
  const nonePlaced = placed.length === 0;
  const counterId = useId();
  const standsSlot = standsFailed ? (
    <StandsSlot ref={slotRef}>
      <div className="mx-4 xl:mx-0">
        <SubListError
          testId="stands-error"
          title="Nu am putut încărca standurile."
          onRetry={() => {
            if (!standsQ.isFetching) void standsQ.refetch();
          }}
          retrying={standsQ.isFetching}
          attempt={standsQ.errorUpdateCount}
          retryKey={STANDS_RETRY}
        />
      </div>
    </StandsSlot>
  ) : standsPending ? (
    <StandsSlot ref={slotRef}>
      <div role="status" className="flex flex-col gap-2" data-testid="stands-skeleton">
        <span className="sr-only">Se încarcă standurile…</span>
        <span aria-hidden className="mx-4 h-12 w-44 animate-shimmer rounded-control md:w-40 xl:mx-0 xl:h-10" />
        <span aria-hidden className="flex gap-3 overflow-hidden px-4 xl:flex-col xl:gap-2 xl:px-0">
          {[0, 1].map(i => (
            <span key={i} className="h-29 w-[min(--spacing(80),calc(100vw-(--spacing(16))))] shrink-0 animate-shimmer rounded-card xl:w-full" />
          ))}
        </span>
      </div>
    </StandsSlot>
  ) : stands.length ? (
    <StandsSlot ref={slotRef} label="Standuri" testId="stand-cards" id={STANDS_ID}>
      <FocusAfterRetry retry={STANDS_RETRY} target={STANDS_ID} />
      {nonePlaced ? (
        // No pin to step through: one quiet note instead of the pager and a badge on every card.
        <p className="mx-4 self-start rounded-control bg-surface px-3 py-2 t-caption text-ink-2 shadow-e2 xl:mx-0" data-testid="stands-unplaced">
          Standurile nu sunt încă marcate pe hartă
        </p>
      ) : (
        // «‹ N din M ›»: one segmented control (the counter between the arrows, one height).
        <div className="flex px-4 xl:px-0">
          <p aria-live="polite" className="sr-only">
            {selectedIndex >= 0 ? `Standul ${stands[selectedIndex].name}, ${counter}` : counter}
          </p>
          <div role="group" aria-labelledby={counterId} className="flex items-stretch overflow-hidden rounded-control bg-surface shadow-e2">
            <MapControlButton label="Standul anterior" onClick={() => step(-1)} disabled={selectedIndex <= 0}>
              <ChevronLeftIcon aria-hidden />
            </MapControlButton>
            <span aria-hidden className="my-2 w-px bg-hairline" />
            <span id={counterId} className="flex items-center px-2 t-label whitespace-nowrap text-ink tabular-nums" data-testid="stands-counter">
              {counter}
            </span>
            <span aria-hidden className="my-2 w-px bg-hairline" />
            <MapControlButton label="Standul următor" onClick={() => step(1)} disabled={selectedIndex >= stands.length - 1}>
              <ChevronRightIcon aria-hidden />
            </MapControlButton>
          </div>
        </div>
      )}
      <ul
        ref={cards}
        className={cn(
          'relative flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pt-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // A phone centres the card (fish carousel); from 768 the strip starts at the left gutter.
          'px-[max(--spacing(4),calc(50%-(--spacing(40))))] md:scroll-px-4 md:px-4',
          // From 1280 a scrolling column docked over the map's left side; its end fades out (more
          // below) and keeps 16px of air, also for a card brought into view by the arrows.
          'xl:min-h-0 xl:flex-1 xl:snap-none xl:flex-col xl:gap-2 xl:overflow-y-auto xl:scroll-pb-4 xl:px-0.5 xl:pt-0.5 xl:pb-4 xl:[scrollbar-width:thin]',
          'xl:[mask-image:linear-gradient(to_bottom,var(--color-ink)_calc(100%-var(--spacing)*8),transparent)]',
        )}
      >
        {stands.map(s => (
          <li
            key={s.standId}
            data-stand={s.standId}
            className="w-[min(--spacing(80),calc(100vw-(--spacing(16))))] shrink-0 snap-center md:snap-start xl:w-full"
          >
            <StandCard stand={s} selected={s.standId === selectedId} unplacedBadge={!nonePlaced} onSelect={() => selectFromCards(s)} />
          </li>
        ))}
      </ul>
    </StandsSlot>
  ) : null;

  return (
    <MapFrame
      title={title}
      lakeName={lakeName}
      caption={answered && stands.length ? standsCount(stands.length) : 'Hartă'}
      lakeId={lakeId}
      onBack={onBack}
      headRef={headRef}
      overlay={
        <>
          {/* The stand cards stay when the imagery fails: their figures are a separate read. */}
          {standsSlot}
          {directions ? (
            <DirectionsDialog
              lake={{ name: directions.name, coordinates: { lat: String(directions.lat), long: String(directions.lng) } }}
              open
              onClose={() => setDirections(null)}
            />
          ) : null}
        </>
      }
    >
      {/* MapLibre makes its container position:relative — the absolute frame is a wrapper. */}
      <div ref={frameRef} className="absolute inset-0 bg-navy">
        <div ref={container} role="region" aria-label={title} className="size-full" data-testid="lake-map" data-map-status={state.status} />
      </div>
      {state.status === 'loading' ? (
        <>
          {/* T2Map's loading: the busy pill, quiet, only once the wait is noticeable. The sr-only
              status holds focus after «Reîncearcă» (then the canvas takes it). */}
          <p ref={loadingRef} tabIndex={-1} role="status" className="sr-only">
            Se încarcă harta…
          </p>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-100 transition-opacity delay-700 duration-(--duration-medium) starting:opacity-0">
            <T2MapPill busy>Se încarcă harta…</T2MapPill>
          </div>
        </>
      ) : null}
      {state.status === 'failed' ? (
        // T2Map's «map unavailable» state (its copy and role), clear of the stand cards: at the top
        // below 1280 (the cards are at the bottom), right of the docked column from 1280.
        <div
          className="absolute inset-0 flex flex-col items-center justify-start gap-4 bg-soft-fill px-8 pt-24 text-center md:pt-28 xl:justify-center xl:pt-8 xl:pl-112"
          data-testid="map-failed"
        >
          <p role="status" className="max-w-80 t-body text-muted">
            Harta nu s-a putut încărca.{stands.length ? ' Standurile rămân disponibile.' : null}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              retried.current = true;
              setState({ status: 'loading' });
              setAttempt(a => a + 1);
            }}
          >
            Reîncearcă
          </Button>
        </div>
      ) : null}
      {/* Zoom: T2's control stack, top right, from 768 (phones pinch — fish has no zoom buttons).
          TODO(kit): T2Map with a `style` prop renders this and the attribution itself. */}
      {state.status === 'failed' ? null : (
        <div
          ref={zoomRef}
          inert={!map}
          className={cn('absolute top-4 right-4 z-overlay hidden flex-col overflow-hidden rounded-control bg-surface shadow-e2 md:flex', !map && '[&_button]:text-faint')}
        >
          <MapControlButton label="Mărește" onClick={() => map?.zoomIn()}>
            <PlusIcon aria-hidden />
          </MapControlButton>
          <span aria-hidden className="mx-2 h-px bg-hairline" />
          <MapControlButton label="Micșorează" onClick={() => map?.zoomOut()}>
            <MinusIcon aria-hidden />
          </MapControlButton>
        </div>
      )}
      {state.status === 'failed' ? null : <MapAttribution />}
      {state.status === 'ready' ? (
        <>
          <MapMarker map={state.map} Marker={state.Marker} at={coords}>
            <PinWithCallout
              kind="lake"
              label={`${lakeName}: adresa bălții`}
              callout={callout === 'lake'}
              onNavigate={() => setDirections({ name: lakeName, ...coords })}
            >
              <LakePin label={`${lakeName}: adresa bălții`} selected={callout === 'lake'} onClick={() => setCallout(c => (c === 'lake' ? null : 'lake'))} />
            </PinWithCallout>
          </MapMarker>
          {placed.map(s => (
            <MapMarker key={s.standId} map={state.map} Marker={state.Marker} at={{ lat: s.coordinates.latitude, lng: s.coordinates.longitude }} raised={s.standId === selectedId}>
              <PinWithCallout
                kind="stand"
                label={`Stand ${s.name}`}
                selected={s.standId === selectedId}
                callout={callout === s.standId}
                onNavigate={() => setDirections({ name: `Stand ${s.name}`, lat: s.coordinates.latitude, lng: s.coordinates.longitude })}
              >
                <T2MapPin id={s.standId} label={`Stand ${s.name}`} selected={s.standId === selectedId} onClick={() => selectFromPin(s)} />
              </PinWithCallout>
            </MapMarker>
          ))}
        </>
      ) : null}
    </MapFrame>
  );
}

const STANDS_ID = 'standuri-harta';
/** The stands' retry (FocusAfterRetry): focus lands on the cards once they replace the error. */
const STANDS_RETRY = 'map-stands';

/**
 * The imagery's credits — a copy of T2Map's MapAttribution (TODO(kit): export it with a `sources`
 * prop): on a phone a 24px «ⓘ» chip (44px hit area) that shows the credits on tap, from 768 the
 * credits always shown in the corner.
 */
function MapAttribution() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="absolute right-4 bottom-2 z-overlay flex items-center gap-1 md:right-2 md:bottom-1">
      <p id={id} className={cn('rounded-badge bg-surface px-1.5 py-0.5 t-micro text-ink-2 md:block', open ? 'block' : 'hidden')} data-testid="map-attribution">
        <a className="hover:underline" href="https://www.esri.com/" target="_blank" rel="noreferrer">
          Imagini © Esri, Maxar, Earthstar Geographics
        </a>
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? 'Ascunde sursele hărții' : 'Sursele hărții'}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface text-ink-2 shadow-e1 md:hidden',
          "after:absolute after:-inset-2.5 after:content-['']",
          FOCUS_RING,
        )}
      >
        <InformationCircleIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/**
 * Where the stand list floats: the bottom band below 1280 (clear of the attribution chip), a column
 * docked over the map's left side from 1280 (under the back square). The skeleton and the error
 * card take the same slot, so nothing moves when the stands land.
 */
function StandsSlot({ label, testId, id, ref, children }: { label?: string; testId?: string; id?: string; ref?: Ref<HTMLElement>; children: ReactNode }) {
  return (
    <section
      ref={ref}
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-label={label ?? 'Standuri'}
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-[max(--spacing(10),env(safe-area-inset-bottom))] z-overlay flex flex-col gap-2 outline-none *:pointer-events-auto md:bottom-12',
        // From 1280 a column on the shell's left edge (the back square's: SHELL_EDGE_LEFT + the 32px
        // gutter), as wide as T2's docked card (380).
        'xl:right-auto xl:top-18 xl:bottom-0 xl:ml-8 xl:w-95',
        SHELL_EDGE_LEFT,
      )}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

/** A React subtree as a MapLibre marker anchored by its bottom (the pin's tip on the coordinate). */
function MapMarker({ map, Marker, at, raised = false, children }: { map: MlMap; Marker: typeof MlMarker; at: Coords; raised?: boolean; children: ReactNode }) {
  const [el] = useState(() => document.createElement('div'));
  useEffect(() => {
    const marker = new Marker({ element: el, anchor: 'bottom' }).setLngLat([at.lng, at.lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, Marker, el, at.lat, at.lng]);
  useEffect(() => {
    // The selected stand's pin (and its callout) above its neighbours (T2Map's raised layer).
    el.classList.toggle('z-sticky', raised);
  }, [el, raised]);
  return createPortal(children, el);
}

/** fish's callout «Navighează către locație» above a pin (c3, c7): its own button. */
function PinWithCallout({
  kind,
  label,
  selected = false,
  callout,
  onNavigate,
  children,
}: {
  kind: 'lake' | 'stand';
  label: string;
  selected?: boolean;
  callout: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center" data-testid={kind === 'lake' ? 'lake-pin' : 'stand-pin'} data-selected={selected || undefined}>
      {callout ? (
        <button
          type="button"
          onClick={onNavigate}
          className={cn('mb-1.5 flex items-center gap-1.5 rounded-control bg-surface px-3 py-2 t-label whitespace-nowrap text-accent-ink shadow-e2 hover:bg-soft-fill', FOCUS_RING)}
          data-testid="pin-callout"
        >
          <MapPinIcon aria-hidden className="size-4" />
          Navighează către locație
          <span className="sr-only"> ({label})</span>
        </button>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The lake's address pin: T2MapPin's shape (44 target, 32 badge with the 2px ring, the tip on the
 * coordinate, the same accent halo when its callout is open) in navy with the map-pin glyph, so it
 * reads as «the lake», not as one more stand.
 */
function LakePin({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-end outline-none',
        'origin-bottom transition-transform duration-(--duration-fast) ease-select',
        selected ? 'scale-125' : 'hover:scale-110',
      )}
    >
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-full border-2 border-on-accent bg-navy text-lavender shadow-e2',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
          selected && 'ring-4 ring-accent-tint-2',
        )}
      >
        <MapPinIcon aria-hidden className="size-4.5" />
      </span>
      <span aria-hidden className="-mt-1.5 size-2.5 rotate-45 rounded-badge bg-navy" />
    </button>
  );
}

/*
 * A stand's card — fish LakeStandCard (c5) on the kit card (CardShell, elevated over the map): «N/A»
 * when a figure is missing; every kg with the rankings' two decimals («12,00», «3,70»).
 */

const kgOrNa = (kg: number | null | undefined) => (kg ? `${rankKg(kg)} kg` : 'N/A');

function StandCard({ stand, selected, unplacedBadge, onSelect }: { stand: StandStats; selected: boolean; unplacedBadge: boolean; onSelect: () => void }) {
  return (
    <div
      className={cn('rounded-card outline-2 transition-[outline-color] duration-(--duration-fast)', selected ? 'outline-accent' : 'outline-transparent', 'has-focus-visible:outline-accent')}
      data-testid="stand-card"
      data-selected={selected || undefined}
    >
      <CardShell elevated className="gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle as="h2" className="t-heading text-ink">
            {/* The whole card selects the stand (the button's hit area covers it). */}
            <button
              type="button"
              onClick={onSelect}
              aria-pressed={selected}
              className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              Stand {stand.name}
            </button>
          </CardTitle>
          {/* Only when some stands have pins and this one has not (none placed: one note above). */}
          {unplacedBadge && !hasCoords(stand) ? <span className="t-micro text-muted">fără pin pe hartă</span> : null}
        </div>
        <dl className="flex flex-col gap-1 t-body text-ink-2">
          <Row icon={<FishIcon aria-hidden size={16} />} label="Cea mai mare captură" value={kgOrNa(stand.biggestFish)} />
          <Row icon={<ScaleIcon aria-hidden size={16} />} label="Calitate" value={kgOrNa(stand.quality)} />
          <Row icon={<CatchIcon aria-hidden size={16} />} label="Capturi" value={stand.totalCatchesCount != null ? String(stand.totalCatchesCount) : 'N/A'} />
        </dl>
      </CardShell>
    </div>
  );
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <dt className="flex items-center gap-1">
        <span className="mr-0.5 text-accent-ink">{icon}</span>
        {label}:
      </dt>
      <dd className="t-body-strong text-ink tabular-nums">{value}</dd>
    </div>
  );
}
