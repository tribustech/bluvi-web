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
import { MapIcon } from '@heroicons/react/24/outline';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { T2FrameContext, T2LayoutBridgeContext, type T2SheetSnap } from './context';
import { pickRest, type Rest } from './sheet';
import { T2_FLOATING_BUTTON } from './T2MapOverlay';
import { T2Panel, type T2PanelProps } from './T2Panel';
import { SHELL_EDGE_PAD } from '@/components/nav/shell';

/*
 * T2 «Listă cu hartă» (ROADMAP §4) — lakes, public waters, community venues.
 *
 * One DOM, two arrangements (CSS only, so the server render is already right at every width):
 *
 * - Phone (<768) — fish LakesResultsWithMap's look, Airbnb's map-search interaction (owner
 *   2026-10-10): the map fills the screen; the toolbar (search pill + chip rail) floats over its
 *   top; the list is a real bottom sheet with three rests — peek (the handle and the count, just
 *   above the tab bar) · half (45%) · full (up to the toolbar, the list scrolling inside). The
 *   handle area drags it with momentum to the nearest rest; on the list a vertical swipe moves the
 *   sheet until it is full, then scrolls the list, and pulling down from the list's top brings the
 *   sheet back down (the wheel does the same). The handle is a button that steps it up / down, and
 *   tabbing into a partly shown list opens it full. Panning the map drops it to its peek; at full a
 *   floating «Hartă» drops it too; a selected pin's card replaces it. Everything floating (the pin
 *   card, «Hartă», the map's corner controls) sits above the shell's bottom tab bar (--tabbar-h).
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
/** Gap between the floating toolbar and the expanded sheet / map content. */
const CHROME_GAP = 8;
/** One wheel gesture steps the sheet once: later ticks of the same inertia are ignored this long. */
const WHEEL_LOCK_MS = 450;

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
  /** «Vezi lista (12)» — the phone sheet handle's name at the peek (it opens the list). */
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
  const headRef = useRef<HTMLDivElement>(null);
  const tabbarRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ root: 0, toolbar: 0, detail: 0, head: 0, tabbar: 0 });
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
          head: headRef.current?.offsetHeight ?? 0,
          tabbar: tabbarRef.current?.offsetHeight ?? 0,
        };
        return (Object.keys(next) as (keyof typeof next)[]).every((k) => prev[k] === next[k]) ? prev : next;
      });
    measure();
    const ro = new ResizeObserver(measure);
    [rootRef, toolbarRef, detailRef, headRef, tabbarRef].forEach((r) => r.current && ro.observe(r.current));
    return () => ro.disconnect();
  }, [hasDetail]);

  // A selected pin's card and the sheet are never on screen together (fish).
  const closed = hasDetail;
  const snap: T2SheetSnap = sheetSnap;
  const toolbarBottom = size.toolbar + CHROME_GAP;
  // The rests as the height of sheet on screen, the strip under the tab bar included.
  const peekPx = size.head + size.tabbar;
  const halfPx = Math.max(Math.round(size.root * HALF), peekPx + 96);
  // At full the sheet's top meets the floating toolbar's bottom (fish).
  const fullPx = Math.max(size.root - size.toolbar, halfPx);
  const rests: Rest = { peek: peekPx, half: halfPx, full: fullPx };
  const restPx = rests[snap];

  /* ---------------------------------------------------------------- drag (phone) */
  // The visible height while a finger / the mouse holds the sheet; null at rest.
  const [dragPx, setDragPx] = useState<number | null>(null);
  const live = useRef({ split, closed, snap, rests, onSheetSnapChange });
  useEffect(() => {
    live.current = { split, closed, snap, rests, onSheetSnapChange };
  });
  const drag = useRef<{ y0: number; from: number; samples: { y: number; t: number }[]; moved: boolean } | null>(null);
  const startDrag = (y: number) => {
    drag.current = { y0: y, from: live.current.rests[live.current.snap], samples: [{ y, t: performance.now() }], moved: false };
  };
  const moveDrag = (y: number) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    d.samples.push({ y, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
    const { peek, full } = live.current.rests;
    let v = d.from - (y - d.y0);
    // Rubber band past the ends.
    if (v > full) v = full + (v - full) * 0.2;
    if (v < peek) v = peek - (peek - v) * 0.3;
    setDragPx(v);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return setDragPx(null);
    const last = d.samples[d.samples.length - 1]!;
    const first = d.samples.find((s) => last.t - s.t <= 100) ?? d.samples[0]!;
    const dt = Math.max(last.t - first.t, 1);
    const velocity = last.t - first.t > 0 ? (last.y - first.y) / dt : 0; // px/ms, + = down
    const visible = d.from - (last.y - d.y0);
    setDragPx(null);
    live.current.onSheetSnapChange(pickRest(visible, velocity, live.current.rests));
  };

  // The handle area: pointer events (touch and mouse). A move past 4px is a drag, else a tap on the
  // handle button.
  const pointer = useRef<{ y: number; id: number } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (split || closed) return;
    pointer.current = { y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p) return;
    if (!drag.current) {
      if (Math.abs(e.clientY - p.y) <= 4) return;
      startDrag(p.y);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    moveDrag(e.clientY);
  };
  const onPointerUp = () => {
    pointer.current = null;
    if (drag.current) endDrag();
  };
  // A drag that started on the handle button must not also click it.
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (dragPx !== null) e.stopPropagation();
  };

  // The list: below full a vertical swipe moves the sheet (the list does not scroll); at full the
  // list scrolls, and pulling down from its top takes the sheet down. Touch events, not pointer
  // events: the hand-off needs preventDefault on a live touchmove. The wheel steps the same way.
  useEffect(() => {
    const scroller = scrollRef.current;
    const section = sectionRef.current;
    if (!scroller || !section) return;
    let touch: { y0: number; mode: 'sheet' | 'scroll' | null } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const l = live.current;
      if (l.split || l.closed || e.touches.length !== 1) return;
      touch = { y0: e.touches[0]!.clientY, mode: null };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return;
      const y = e.touches[0]!.clientY;
      const dy = y - touch.y0;
      if (touch.mode === null) {
        if (Math.abs(dy) < 4) return;
        const l = live.current;
        touch.mode = l.snap !== 'full' || (scroller.scrollTop <= 0 && dy > 0) ? 'sheet' : 'scroll';
        if (touch.mode === 'sheet') startDrag(touch.y0);
      }
      if (touch.mode === 'sheet') {
        if (e.cancelable) e.preventDefault();
        moveDrag(y);
      }
    };
    const onTouchEnd = () => {
      if (touch?.mode === 'sheet') endDrag();
      touch = null;
    };
    let wheelUntil = 0;
    const onWheel = (e: WheelEvent) => {
      const l = live.current;
      if (l.split || l.closed || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const atTop = scroller.scrollTop <= 0;
      let next: T2SheetSnap | null = null;
      if (l.snap !== 'full') next = e.deltaY > 0 ? (l.snap === 'peek' ? 'half' : 'full') : l.snap === 'half' ? 'peek' : null;
      else if (atTop && e.deltaY < 0 && !scroller.contains(e.target as Node)) next = 'half';
      else if (atTop && e.deltaY < -40) next = 'half';
      if (l.snap !== 'full' || next) e.preventDefault();
      if (!next || performance.now() < wheelUntil) return;
      wheelUntil = performance.now() + WHEEL_LOCK_MS;
      l.onSheetSnapChange(next);
    };
    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd);
    scroller.addEventListener('touchcancel', onTouchEnd);
    section.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
      section.removeEventListener('wheel', onWheel);
    };
    // The handlers read `live`; the drag helpers only touch refs and a state setter.
  }, []);

  const dragging = dragPx !== null;
  const fullBar = snap === 'full' && !closed;
  /** The list body is off screen at the peek: out of the tab order (the handle stays). */
  const bodyInert = phone && (closed || snap === 'peek');

  const frame = split
    ? { split, top: 0, bottom: hasDetail ? size.detail + 16 : 0 }
    : {
        split,
        top: toolbarBottom,
        bottom: hasDetail ? size.detail + 16 + size.tabbar : snap === 'full' ? 0 : restPx,
      };

  // CSS geometry for the first paint (see the header). --t2-toolbar: the phone toolbar (pt-2 +
  // 48 pill + 8 + 52 chip rail = 116px) until measured. --t2-peek: the handle + the count row.
  // --t2-detail: the pin card, ~200px.
  const vars = {
    ...(size.toolbar ? { '--t2-toolbar': `${size.toolbar}px` } : null),
    ...(size.head ? { '--t2-peek': `${size.head}px` } : null),
    ...(size.detail ? { '--t2-detail': `${size.detail}px` } : null),
  } as CSSProperties;
  // From 1280 the pin card is docked left (380px of a wide map): the corner credit and the centred
  // states keep the full map height; below, the card spans the map and they sit above it.
  const bottomVar = hasDetail
    ? '[--t2-bottom:calc(var(--t2-detail)+var(--spacing)*4+var(--tabbar-h,0px))] md:[--t2-bottom:calc(var(--t2-detail)+var(--spacing)*4)] xl:[--t2-bottom:0px]'
    : snap === 'half'
      ? '[--t2-bottom:45%] md:[--t2-bottom:0px]'
      : snap === 'peek'
        ? '[--t2-bottom:calc(var(--t2-peek)+var(--tabbar-h,0px))] md:[--t2-bottom:0px]'
        : '[--t2-bottom:0px]';
  // The sheet's height on screen at its rest (CSS, so the first paint is right): it is always as
  // tall as at full and slides down by what is hidden.
  const sheetVar =
    snap === 'full'
      ? '[--t2-sheet:calc(100cqh-var(--t2-toolbar))]'
      : snap === 'half'
        ? '[--t2-sheet:max(45cqh,calc(var(--t2-peek)+var(--tabbar-h,0px)+var(--spacing)*24))]'
        : '[--t2-sheet:calc(var(--t2-peek)+var(--tabbar-h,0px))]';

  return (
    <T2FrameContext.Provider value={frame}>
      <T2LayoutBridgeContext.Provider value={bridge}>
      <div
        ref={rootRef}
        style={vars}
        className={cn(
          '[--t2-toolbar:calc(var(--spacing)*29)] [--t2-peek:calc(var(--spacing)*19)] [--t2-detail:calc(var(--spacing)*50)]',
          '[--t2-top:calc(var(--t2-toolbar)+var(--spacing)*2)] md:[--t2-top:0px]',
          bottomVar,
          // The phone sheet's geometry is in container units of this box (cqh).
          'max-md:[container-type:size]',
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
        {/* The shell's bottom tab bar height (0 without one, and from 768), measured for the drag. */}
        <div ref={tabbarRef} aria-hidden className="pointer-events-none absolute h-(--tabbar-h,0px) w-0 md:hidden" />

        {/* Toolbar: floating on a phone, a band from 768. */}
        <div
          ref={toolbarRef}
          // fish: at the full rest the chrome keeps floating over the map, the sheet's rounded top
          // just under it (no solid header bar).
          className={cn(
            'absolute inset-x-0 top-0 z-sticky border-b border-transparent px-4 pt-2',
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
          ref={sectionRef}
          id={listId}
          tabIndex={-1}
          aria-label={listLabel}
          inert={phone && closed}
          data-sheet-snap={closed ? 'closed' : snap}
          style={dragging ? { translate: `0 ${Math.round(fullPx - dragPx)}px` } : undefined}
          onFocus={(e) => {
            // Tabbing into a partly shown list opens it, so the focused card is on screen.
            if (!split && snap === 'half' && scrollRef.current?.contains(e.target) && e.target.matches(':focus-visible'))
              onSheetSnapChange('full');
          }}
          className={cn(
            // Above the map's own floating controls (z-above). At full its rounded top sits just
            // under the floating toolbar, the map showing round the chrome (fish).
            'absolute inset-x-0 bottom-0 z-sticky flex h-[calc(100cqh-var(--t2-toolbar))] flex-col bg-surface',
            sheetVar,
            // Closed: slid away, then hidden (visibility flips at the end of the slide), so its
            // handle is not announced while the pin card holds the screen.
            closed ? 'invisible translate-y-[calc(100%+var(--spacing)*4)] md:visible' : 'translate-y-[calc(100cqh-var(--t2-toolbar)-var(--t2-sheet))]',
            // The kit Sheet's top radius (card, 16): the Filtre sheet opens over this one.
            'rounded-t-card shadow-e2',
            measured && !dragging && 'transition-[translate,visibility] duration-(--duration-slow) ease-slow',
            'md:relative md:inset-auto md:z-auto md:col-start-2 md:row-start-2 md:h-auto md:translate-y-0 md:rounded-none md:bg-page md:shadow-none md:transition-none',
            'md:border-l md:border-hairline',
            'outline-none',
          )}
        >
          <a href={`#${mapId}`} onClick={(e) => skipTo(e, mapId, '.maplibregl-canvas')} className={cn(SKIP_LINK, 'top-2 md:top-3 md:left-6 xl:left-8')}>
            Sari la hartă
          </a>
          <div
            ref={headRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClickCapture={onClickCapture}
            data-t2-sheet-handle=""
            className={cn('shrink-0 cursor-grab touch-none select-none active:cursor-grabbing', 'md:cursor-auto md:touch-auto md:select-auto')}
          >
            {/* fish's handle (36×4) in a 48-wide button: it steps the sheet (peek → half → full → half). */}
            <button
              type="button"
              onClick={() => onSheetSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half')}
              aria-label={snap === 'peek' ? showListLabel : snap === 'full' ? 'Restrânge lista' : 'Extinde lista'}
              aria-expanded={snap !== 'peek'}
              aria-controls={`${listId}-body`}
              className="mx-auto flex h-6 w-16 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-accent md:hidden"
            >
              <span aria-hidden className="h-1 w-9 rounded-full bg-handle" />
            </button>
            <div
              className={cn(
                'border-b px-4 pb-3 md:pt-4 md:pb-2',
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
            id={`${listId}-body`}
            data-t2-scroll
            aria-busy={busy || undefined}
            inert={bodyInert}
            className={cn(
              'flex min-h-0 flex-1 flex-col overscroll-contain px-4 pt-1 pb-[calc(var(--tabbar-h,0px)+var(--spacing)*6)] md:overflow-y-auto md:pb-6',
              // Below full the list does not scroll: a vertical swipe moves the sheet (horizontal
              // photo strips still pan).
              snap === 'full' ? 'overflow-y-auto' : 'touch-pan-x overflow-y-hidden md:touch-auto',
              LIST_PAD,
            )}
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
          // Fully under the phone sheet at its full rest: out of the tab order.
          inert={phone && fullBar}
          className="absolute inset-0 outline-none max-md:isolate md:relative md:inset-auto md:col-start-1 md:row-start-2"
        >
          {!(phone && closed) ? (
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
              // Above the phone's tab bar; below 1280 the card spans the map with equal gutters,
              // from 1280 it docks left (380px).
              className="absolute inset-x-4 bottom-[calc(var(--tabbar-h,0px)+max(var(--spacing)*4,env(safe-area-inset-bottom)))] z-above md:bottom-4 xl:inset-x-auto xl:left-4 xl:w-95"
            >
              {detail}
            </div>
          ) : null}
        </div>

        {fullBar ? (
          // Airbnb's «Hartă»: at the full rest the map is one tap away, floating above the tab bar.
          // Phone only, by CSS.
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--tabbar-h,0px)+var(--spacing)*4)] z-overlay flex justify-center md:hidden">
            <button
              type="button"
              onClick={() => onSheetSnapChange('peek')}
              className={buttonClass({ variant: 'primary', className: cn('pointer-events-auto rounded-full!', T2_FLOATING_BUTTON) })}
            >
              <MapIcon aria-hidden className="size-5" />
              Hartă
            </button>
          </div>
        ) : null}

        {/* The modal phone Sheet only once the width is known to be a phone: mounted during hydration
            at 768+, its showModal() would race the dialog's and drop focus on <body>. */}
        {phone && panel ? <T2Panel {...panel} /> : null}
      </div>
      </T2LayoutBridgeContext.Provider>
    </T2FrameContext.Provider>
  );
}
