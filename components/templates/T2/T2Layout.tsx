'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { T2FrameContext, T2LayoutBridgeContext, type T2SheetSnap } from './context';
import { T2_FLOATING_BUTTON } from './T2MapOverlay';
import { T2Panel, type T2PanelProps } from './T2Panel';
import { SHELL_EDGE_PAD } from '@/components/nav/shell';

/*
 * T2 «Listă cu hartă» (ROADMAP §4) — lakes, public waters, community venues.
 *
 * One DOM, two arrangements (CSS only, so the server render is already right at every width):
 *
 * - Phone (<768) — fish LakesResultsWithMap: the map fills the screen under the top bar; the
 *   toolbar (search pill + chip rail) floats over its top; the list is a bottom sheet with three
 *   rests: hidden · half (45%) · full (up to the toolbar). Panning the map hides it and a floating
 *   «Vezi lista (N)» brings it back; a selected pin's card replaces it.
 * - ≥768 — the toolbar is a band under the top bar; below it the map and the list side by side,
 *   each its own scroll (owner rule 7, ROADMAP §4b refinement 2026-10-06 — imobiliare.ro): the
 *   map on the LEFT, about half the width, from the window's left edge (maps take all the width);
 *   the list on the right, ONE horizontal card per row (T2List). The list stays first in the DOM
 *   (keyboard: «Sari la hartă»); only the grid places the map first.
 *
 * The template is full-bleed (it breaks out of the shell's 1744px column); the toolbar's content
 * lines up with the shell column at both edges, so it starts under the logo and ends under the top
 * bar's last action at every width.
 *
 * First paint: everything a phone needs at rest is CSS (sheet rests at 45% / below the toolbar,
 * the map controls and attribution placed by --t2-top / --t2-bottom), so the server render is
 * already right and nothing jumps when the measurements land. Measured pixels are used only while
 * dragging and for the map's programmatic framing; the sheet animates only after the first
 * measure, so mounting never does.
 *
 * Keyboard: the list comes first in the DOM, so «Sari la hartă» (first in the list region, shown on
 * focus) jumps past every card to the map, and «Sari la listă» (first in the map) jumps back. A
 * map the phone sheet covers completely (full rest) leaves the tab order.
 */

/** A skip link: visually hidden until focused, then a kit button floating at its region's corner. */
const SKIP_LINK = cn(
  'absolute left-4 z-overlay not-focus:sr-only',
  buttonClass({ variant: 'outline', size: 'compact', className: 'shadow-e2' }),
);

const noSubscribe = () => () => {};
/** False in the server render and the hydration pass, true after: the breakpoint is only known then. */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * Where a keyboard user lands after an action that removes the control they used («Vezi lista»,
 * «Șterge filtre»): the list's heading (T2ListHeader, tabIndex -1), else the first control of the
 * list (an empty state's button), else the list region itself.
 */
function focusList(listId: string) {
  const region = document.getElementById(listId);
  const target =
    region?.querySelector<HTMLElement>('h2[tabindex]') ?? region?.querySelector<HTMLElement>('[data-t2-scroll] :is(a, button)') ?? region;
  target?.focus({ preventScroll: true });
}

/** Focus the element `id` names (or its focus target), without the page scrolling to it. */
function skipTo(e: MouseEvent<HTMLAnchorElement>, id: string, inner?: string) {
  e.preventDefault();
  const region = document.getElementById(id);
  const target = (inner ? region?.querySelector<HTMLElement>(inner) : null) ?? region;
  target?.focus({ preventScroll: true });
}

/** Left padding that aligns with the shell column (nav/shell.tsx SHELL_EDGE_PAD, next to SHELL_MAX). */
export const ALIGN_LEFT = SHELL_EDGE_PAD;
/**
 * The same on the right: the shell column's right edge (SHELL_EDGE_PAD mirrored — the same 436, so
 * change them together). TODO(kit): a SHELL_EDGE_PAD_END next to SHELL_EDGE_PAD in nav/shell.tsx.
 */
const ALIGN_RIGHT = 'md:pr-6 xl:pr-[max(var(--spacing)*8,calc((100vw_-_var(--spacing)*436)/2_+_var(--spacing)*8))]';
/**
 * The list column's sides from 768 (header and scroller): the gutter on the left (the map's edge),
 * ALIGN_RIGHT on the right — the column runs to the window's edge, so its cards end on the shell
 * column under the toolbar's last control, not on the window's 32px edge.
 */
const LIST_PAD = cn('md:pl-6 xl:pl-8', ALIGN_RIGHT);

/** fish RESULTS_SHEET_FRACTION: the sheet opens at 40–45% of the screen. */
const HALF = 0.45;
/** Released below this share of the half height, the sheet hides. */
const HIDE_BELOW = 0.5;
/** Gap between the floating toolbar and the expanded sheet / map content. */
const CHROME_GAP = 8;

export type T2LayoutProps = {
  /** Search + filters (T2Toolbar, which carries the page's h1). Floats over the map on a phone, a band from 768. */
  toolbar: ReactNode;
  /** The list's heading row (T2ListHeader): the sheet's drag area on a phone. Null when the list failed. */
  listHeader: ReactNode;
  /** The list content: T2List of items, or a skeleton / empty / error state. */
  list: ReactNode;
  /** Accessible name of the list region («Rezultate»). */
  listLabel: string;
  /** The map (T2Map). */
  map: ReactNode;
  /** Pills centred at the top of the map: «Se încarcă…», «Șterge filtre». Silent (see `announcement`). */
  mapStatus?: ReactNode;
  /**
   * What the one live region says («122 de bălți în această zonă», «Se încarcă rezultatele»).
   * Spoken ~500ms after it settles, so a pan does not re-announce on every frame.
   */
  announcement?: string;
  /** The selected item's card (T2MapCard), floating at the bottom of the map. Hides the phone sheet. */
  detail?: ReactNode;
  /** The filters surface: a sheet on a phone, a dialog from 768 (never a column over the list). */
  panel?: T2PanelProps | null;
  /** Phone sheet rest; ignored from 768. */
  sheetSnap: T2SheetSnap;
  onSheetSnapChange: (snap: T2SheetSnap) => void;
  /** «Vezi lista (12)» — the phone button that brings the hidden list back. */
  showListLabel: string;
  /**
   * Change it to move focus to the list's heading once the list has re-rendered — after an action
   * that unmounts the control the user activated («Șterge filtre», «Vezi toată România»).
   */
  listFocusKey?: string | number | null;
  /** The list is loading or refreshing: its scroller is aria-busy. */
  busy?: boolean;
  /** Sizing. Default: fill a T2Viewport (or any flex column with a height). */
  className?: string;
};

export function T2Layout({
  toolbar,
  listHeader,
  list,
  listLabel,
  map,
  mapStatus,
  announcement = '',
  detail,
  panel,
  sheetSnap,
  onSheetSnapChange,
  showListLabel,
  listFocusKey = null,
  busy = false,
  className = 'min-h-0 flex-1',
}: T2LayoutProps) {
  const breakpoint = useBreakpoint();
  const split = breakpoint !== 'mobile';
  // useBreakpoint answers «mobile» on the server and in the hydration pass. Anything that changes
  // behaviour (inert, the modal phone Sheet, skip links) waits for the real answer; what only
  // changes the look is CSS, right at every width from the first paint.
  const hydrated = useHydrated();
  const phone = hydrated && !split;
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const bridge = useMemo(() => ({ setMapUnavailable }), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ root: 0, toolbar: 0, detail: 0 });
  const listId = useId();
  const mapId = useId();
  // The list header gets its hairline once the list under it scrolls: cards slide under an edge,
  // not under nothing.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { root });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);
  const measured = size.root > 0;
  const hasDetail = detail != null && detail !== false;

  // Focus the list once it has re-rendered for the action that asked for it.
  const [focusTick, setFocusTick] = useState(0);
  const lastFocusKey = useRef(listFocusKey);
  useEffect(() => {
    if (listFocusKey === lastFocusKey.current) return;
    lastFocusKey.current = listFocusKey;
    setFocusTick((n) => n + 1);
  }, [listFocusKey]);
  useEffect(() => {
    if (!focusTick) return;
    // After the paint that lifts `inert` off the list (the phone sheet coming back).
    const id = requestAnimationFrame(() => focusList(listId));
    return () => cancelAnimationFrame(id);
  }, [focusTick, listId]);

  // One live region, always mounted, updated after the state settles.
  const [spoken, setSpoken] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setSpoken(announcement), 500);
    return () => window.clearTimeout(t);
  }, [announcement]);

  // Measure what the sheet and the map framing depend on.
  useLayoutEffect(() => {
    const measure = () =>
      setSize((prev) => {
        const next = {
          root: rootRef.current?.clientHeight ?? 0,
          toolbar: toolbarRef.current?.offsetHeight ?? 0,
          detail: detailRef.current?.offsetHeight ?? 0,
        };
        return prev.root === next.root && prev.toolbar === next.toolbar && prev.detail === next.detail ? prev : next;
      });
    measure();
    const ro = new ResizeObserver(measure);
    [rootRef, toolbarRef, detailRef].forEach((r) => r.current && ro.observe(r.current));
    return () => ro.disconnect();
  }, [hasDetail]);

  // A selected pin's card and the sheet are never on screen together (fish).
  const snap: T2SheetSnap = hasDetail ? 'hidden' : sheetSnap;
  const toolbarBottom = size.toolbar + CHROME_GAP;
  const halfPx = Math.round(size.root * HALF);
  // At full the sheet meets the toolbar, which turns into a solid header bar (fish: the chrome
  // becomes a header) — no strip of map labels between them.
  const fullPx = Math.max(size.root - size.toolbar, halfPx);
  const restPx = snap === 'full' ? fullPx : halfPx;

  // Drag (phone): the header row moves the sheet; release picks the nearest rest.
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const [dragPx, setDragPx] = useState<number | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (split) return;
    drag.current = { y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) > 4) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (d.moved) setDragPx(dy);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved || dragPx === null) return setDragPx(null);
    const h = restPx - dragPx;
    setDragPx(null);
    if (h < halfPx * HIDE_BELOW) return onSheetSnapChange('hidden');
    onSheetSnapChange(Math.abs(h - fullPx) < Math.abs(h - halfPx) ? 'full' : 'half');
  };

  const dragging = dragPx !== null;
  const sheetPx = dragging ? Math.min(fullPx, Math.max(0, restPx - dragPx)) : restPx;
  /** Phone sheet hidden — the look (CSS, overridden from 768) and, once the width is known, inert. */
  const sheetHidden = snap === 'hidden';
  const fullBar = snap === 'full' && !hasDetail;

  const frame = split
    ? { split, top: 0, bottom: hasDetail ? size.detail + 16 : 0 }
    : {
        split,
        top: toolbarBottom,
        bottom: hasDetail ? size.detail + 16 : snap === 'half' ? halfPx : 0,
      };

  // CSS geometry for the first paint (see the header). --t2-toolbar: the phone toolbar (pt-2 +
  // 48 pill + 8 + 52 chip rail = 116px) until measured. --t2-detail: the pin card, ~200px.
  const vars = {
    ...(size.toolbar ? { '--t2-toolbar': `${size.toolbar}px` } : null),
    ...(size.detail ? { '--t2-detail': `${size.detail}px` } : null),
  } as CSSProperties;
  // From 1280 the pin card is docked left (380px of a wide map): the corner credit and the centred
  // states keep the full map height; below, the card spans the map and they sit above it.
  const bottomVar = hasDetail
    ? '[--t2-bottom:calc(var(--t2-detail)+var(--spacing)*4)] xl:[--t2-bottom:0px]'
    : snap === 'half'
      ? '[--t2-bottom:45%] md:[--t2-bottom:0px]'
      : '[--t2-bottom:0px]';

  return (
    <T2FrameContext.Provider value={frame}>
      <T2LayoutBridgeContext.Provider value={bridge}>
      <div
        ref={rootRef}
        style={vars}
        className={cn(
          '[--t2-toolbar:calc(var(--spacing)*29)] [--t2-detail:calc(var(--spacing)*50)]',
          '[--t2-top:calc(var(--t2-toolbar)+var(--spacing)*2)] md:[--t2-top:0px]',
          bottomVar,
          'relative isolate mx-[calc(50%-50vw)] w-screen overflow-clip bg-page',
          // Map | list, half each at every width (rule 7, imobiliare.ro): the split is the window's
          // centre — the shell column's centre too — so at 1920 the list is not a narrow strip
          // beside a wide map. The list never narrower than a horizontal card needs; its cards end
          // on the shell column like the toolbar above (LIST_PAD takes the margin past 1744), and
          // the card's photo grows with it (LakeRowCard), so a wide card has no empty band.
          'md:grid md:grid-cols-[minmax(0,1fr)_minmax(--spacing(96),50%)] md:grid-rows-[auto_minmax(0,1fr)]',
          className,
        )}
      >
        <p role="status" className="sr-only">
          {spoken}
        </p>

        {/* Toolbar: floating on a phone, a band from 768. */}
        <div
          ref={toolbarRef}
          // A solid header bar at the sheet's full rest: the controls' floating shadows drop (T2_SOLID_E0).
          data-solid={(!split && fullBar) || undefined}
          className={cn(
            'absolute inset-x-0 top-0 z-sticky border-b border-transparent px-4 pt-2',
            'transition-[background-color,border-color] duration-(--duration-slow) ease-slow',
            fullBar && 'border-hairline bg-surface',
            // From 768 a band on the page ground (the list header's, so list ↔ map changes nothing),
            // its content on the shell column at both edges (the top bar's logo … its last action),
            // while the map and the list below stay full-bleed.
            'md:static md:transition-none md:col-span-2 md:border-b md:border-hairline md:bg-page md:py-3',
            ALIGN_LEFT,
            ALIGN_RIGHT,
          )}
        >
          {toolbar}
        </div>

        {/* List: the bottom sheet on a phone, the right column from 768. */}
        <section
          id={listId}
          tabIndex={-1}
          aria-label={listLabel}
          inert={phone && sheetHidden}
          style={dragging ? { height: sheetPx } : undefined}
          className={cn(
            // Above the map's own floating controls (z-above) when expanded. At full it meets the
            // solid toolbar: only the toolbar's hairline separates them, no shadow band over it.
            'absolute inset-x-0 bottom-0 z-sticky flex flex-col bg-surface',
            // The kit Sheet's top radius (card, 16): the Filtre sheet opens over this one.
            snap === 'full' ? 'h-[calc(100%-var(--t2-toolbar))] rounded-none shadow-none' : 'h-[45%] rounded-t-card shadow-e2',
            measured && !dragging && 'transition-[height,translate,border-radius] duration-(--duration-slow) ease-slow',
            sheetHidden && 'translate-y-[calc(100%+var(--spacing)*4)]',
            'md:relative md:inset-auto md:z-auto md:col-start-2 md:row-start-2 md:h-auto md:translate-y-0 md:rounded-none md:bg-page md:shadow-none md:transition-none',
            'md:border-l md:border-hairline',
            'outline-none',
          )}
        >
          <a href={`#${mapId}`} onClick={(e) => skipTo(e, mapId, '.maplibregl-canvas')} className={cn(SKIP_LINK, 'top-2 md:top-3 md:left-6 xl:left-8')}>
            Sari la hartă
          </a>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={cn('shrink-0 cursor-grab touch-none select-none active:cursor-grabbing', 'md:cursor-auto md:touch-auto md:select-auto')}
          >
            <button
              type="button"
              onClick={() => onSheetSnapChange(snap === 'full' ? 'half' : 'full')}
              aria-label={snap === 'full' ? 'Restrânge lista' : 'Extinde lista'}
              aria-expanded={snap === 'full'}
              className="mx-auto mt-2 flex h-4 w-12 items-center justify-center rounded-full md:hidden"
            >
              <span aria-hidden className="h-1 w-9 rounded-full bg-handle" />
            </button>
            <div
              className={cn(
                'border-b px-4 pb-2 md:pt-4',
                LIST_PAD,
                'transition-[border-color] duration-(--duration-fast) ease-fast',
                scrolled ? 'border-hairline' : 'border-transparent',
              )}
            >
              {/* The row keeps its height without a header (empty / error): states start on its line. */}
              {listHeader ?? <div aria-hidden className="min-h-8" />}
            </div>
          </div>
          <div
            ref={scrollRef}
            data-t2-scroll
            aria-busy={busy || undefined}
            className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-1 pb-6', LIST_PAD)}
          >
            <div ref={sentinelRef} aria-hidden className="h-px shrink-0" />
            {list}
          </div>
          {/* From 768 the filters dialog (T2Panel docked = the kit Dialog, modal, in the top layer).
              CSS, not `split`, decides where it shows: the server render (breakpoint unknown) is right. */}
          {panel?.open ? (
            <div className="hidden md:contents">
              <T2Panel {...panel} docked />
            </div>
          ) : null}
        </section>

        {/* Map: full screen on a phone, the left column from 768. */}
        <div
          id={mapId}
          tabIndex={-1}
          // Fully under the phone sheet at its full rest: out of the tab order (as the hidden sheet is).
          inert={phone && fullBar}
          className="absolute inset-0 outline-none md:relative md:inset-auto md:col-start-1 md:row-start-2"
        >
          {!(phone && sheetHidden) ? (
            <a
              href={`#${listId}`}
              onClick={(e) => skipTo(e, listId)}
              className={cn(SKIP_LINK, 'top-[calc(var(--t2-top)+var(--spacing)*3)]')}
            >
              Sari la listă
            </a>
          ) : null}
          {map}

          {mapStatus && !mapUnavailable ? (
            <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--t2-top)+var(--spacing)*3)] z-above flex justify-center gap-2 px-16 *:pointer-events-auto">
              {mapStatus}
            </div>
          ) : null}

          {hasDetail ? (
            <div
              ref={detailRef}
              // Below 1280 the card spans the map with equal gutters; from 1280 it docks left (380px).
              className="absolute inset-x-4 bottom-[max(var(--spacing)*4,env(safe-area-inset-bottom))] z-above md:bottom-4 xl:inset-x-auto xl:left-4 xl:w-95"
            >
              {detail}
            </div>
          ) : null}

          {snap === 'hidden' && !hasDetail ? (
            // Phone only, by CSS (not `split`), so the server render never paints it at 768+.
            // Clear of the attribution chip's row at the bottom edge.
            <div className="absolute inset-x-0 bottom-[max(var(--spacing)*10,env(safe-area-inset-bottom))] z-above flex justify-center md:hidden">
              <button
                type="button"
                onClick={() => {
                  onSheetSnapChange('half');
                  // The button goes with the hidden rest: land on the list it brought back.
                  setFocusTick((n) => n + 1);
                }}
                // The kit primary (radius 10), floating.
                className={buttonClass({ variant: 'primary', className: T2_FLOATING_BUTTON })}
              >
                {showListLabel}
              </button>
            </div>
          ) : null}
        </div>

        {/* The modal phone Sheet only once the width is known to be a phone: mounted during hydration
            at 768+, its showModal() would race the dialog's and drop focus on <body>. */}
        {phone && panel ? <T2Panel {...panel} /> : null}
      </div>
      </T2LayoutBridgeContext.Provider>
    </T2FrameContext.Provider>
  );
}
