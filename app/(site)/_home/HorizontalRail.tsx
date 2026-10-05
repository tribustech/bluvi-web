'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { iconButtonClass } from '@/components/nav/IconButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { announce, prepareAnnouncer, restoreFocusTo } from './announce';

/**
 * Below 1280 a rail runs to the screen edge: the page gutter (16 / 24, the shell's) is cancelled and
 * given back as padding and scroll padding, so the first card lines up with the page and the last
 * one scrolls to the edge. From 1280 it sits inside the main column, flush with it.
 */
export const RAIL_BLEED = '-mx-4 px-4 scroll-px-4 md:-mx-6 md:px-6 md:scroll-px-6 xl:mx-0 xl:px-0 xl:scroll-px-0';

/**
 * The rails' one layout rule (ROADMAP §4: grids auto-fill, more cards as the screen grows, never
 * wider ones). Below 768 a row of fixed slots (`width`) that scrolls. From 768 the slots are the
 * tracks of an auto-fill grid laid out in one row: as many `width`-wide tracks as the column holds,
 * sharing its free space — so a rail that fits ends on the column edge (or on the track grid every
 * rail shares), and one that does not keeps every card at `width` and scrolls. Every rail of the
 * page follows it; none caps or grows on its own.
 */
export type RailWidth = 160 | 200 | 224;

/** The slot width as the grid's track minimum (4px scale). */
const RAIL_TRACK: Record<RailWidth, string> = {
  160: '[--rail-w:--spacing(40)]',
  200: '[--rail-w:--spacing(50)]',
  224: '[--rail-w:--spacing(56)]',
};
const RAIL_GRID =
  'md:grid md:grid-flow-col md:grid-cols-[repeat(auto-fill,minmax(var(--rail-w),1fr))] md:auto-cols-[minmax(var(--rail-w),1fr)]';
/** Phone slot widths; from 768 the grid track sizes the slot. */
const WIDTH: Record<RailWidth, string> = { 160: 'w-40', 200: 'w-50', 224: 'w-56' };

/** The rail's list classes, shared with its loading row (RailSkeleton) so both lay out alike. */
export function railListClass(width: RailWidth) {
  return cn('flex gap-2.5 pt-1 pb-4 xl:gap-3.5', RAIL_TRACK[width], RAIL_GRID, RAIL_BLEED);
}

/**
 * The fish horizontal FlatList of the Acasă rails: bleeds to the screen edge (the page padding is
 * cancelled and given back as scroll padding), snaps per card, and asks for the next page when the
 * end comes near (fish `onEndReachedThreshold={0.7}`). Labelled as a list for screen readers.
 * With a mouse (fine pointer) previous/next arrows page through it — the scrollbar is hidden, so
 * without them a mouse has no visible way sideways; touch keeps the swipe only. The arrows live in
 * the section header (RailSection renders them from what this rail registers).
 */
export function HorizontalRail({
  label,
  width,
  children,
  onEndReached,
  footer,
  className,
}: {
  /** Accessible name of the list, e.g. «Concursuri live». */
  label: string;
  /** The slot width of its cards (RailItem / CardSkeleton / RailRetryItem pass the same). */
  width: RailWidth;
  children: ReactNode;
  onEndReached?: () => void;
  /** Extra item after the cards (the next-page skeleton, or its retry). */
  footer?: ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const listId = useId();
  const onEnd = useRef(onEndReached);
  useEffect(() => {
    onEnd.current = onEndReached;
  }, [onEndReached]);

  // The end is the list's LAST item (a grid has no room for a 1px sentinel: it would take a track).
  // Whenever the last item changes — a page of cards arrived, the next-page skeleton or retry came
  // or went — the new one is observed, and an observer reports its first state: an end still in
  // view after a page asks for the next one, without a scroll.
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onEnd.current?.();
      },
      {
        root,
        // ≈ fish's 0.7 threshold: start loading most of a viewport before the end.
        rootMargin: '0px 70% 0px 0px',
      }
    );
    let target: Element | null = null;
    const retarget = () => {
      const last = root.lastElementChild;
      if (last === target) return;
      if (target) io.unobserve(target);
      target = last;
      if (target) io.observe(target);
    };
    retarget();
    const mo = new MutationObserver(retarget);
    mo.observe(root, { childList: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  const edges = useRailEdges(scroller);
  const register = useContext(RailRegistry);
  useEffect(() => {
    register?.({ scroller, controls: listId, label, edges });
  }, [register, listId, label, edges]);
  useEffect(() => () => register?.(null), [register]);

  return (
    // pb-4 leaves room for the cards' shadow; -mb-3 gives it back, so the gap to the next block
    // is the page's own rhythm, not rhythm + shadow room.
    <div className="-mb-3">
      <ul
        ref={scroller}
        id={listId}
        aria-label={label}
        className={cn(
          railListClass(width),
          'snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // From 768, while more cards wait to the right, the cut card fades out over its last 32px:
          // it reads as «more», not as a card broken at the column edge.
          edges.next && 'md:[mask-image:linear-gradient(to_right,black_calc(100%-var(--spacing)*8),transparent)]',
          className
        )}
      >
        {children}
        {footer ? <li className="flex shrink-0 snap-start">{footer}</li> : null}
      </ul>
    </div>
  );
}

type Edges = { prev: boolean; next: boolean };

/** Whether the scroller has cards hidden before / after its viewport. */
function useRailEdges(scroller: RefObject<HTMLElement | null>): Edges {
  const [edges, setEdges] = useState<Edges>({ prev: false, next: false });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { prev: el.scrollLeft > 4, next: el.scrollLeft < max - 4 };
      setEdges((cur) => (cur.prev === next.prev && cur.next === next.next ? cur : next));
    };
    el.addEventListener('scroll', measure, { passive: true });
    // Also the first measure: a ResizeObserver reports the size it starts observing.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Cards arrive with the next page: the scroll width grows without a resize.
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scroller]);
  return edges;
}

/** What a rail tells its section, so the section header can carry the rail's arrows. */
export type RailHandle = { scroller: RefObject<HTMLElement | null>; controls: string; label: string; edges: Edges };

/** Provided by RailSection: the rail inside it registers here (null on unmount). */
export const RailRegistry = createContext<((rail: RailHandle | null) => void) | null>(null);

/**
 * Previous / next for a horizontal scroller, fine pointers from 768 only, in the section
 * header beside «Vezi toate» (RailSection) — never over the cards, where they covered names and
 * dates. Each press moves one visible page; the scroller's snap then settles on a card edge. The
 * pair shows only when the rail overflows; the arrow at its end is aria-disabled (it keeps focus).
 * The kit icon button (Fundații §07) at its 1280 size, 40 — arrows only exist for a mouse — on the
 * surface, the chevron in the 24 outline slot (§05).
 */
export function RailArrows({ rail }: { rail: RailHandle }) {
  const { scroller, controls, label, edges } = rail;
  if (!edges.prev && !edges.next) return null;

  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.85, 160), behavior: reduce ? 'auto' : 'smooth' });
  };

  const arrow = (dir: -1 | 1) => {
    const enabled = dir === -1 ? edges.prev : edges.next;
    return (
      <button
        type="button"
        aria-controls={controls}
        aria-label={`${label}: ${dir === -1 ? 'înapoi' : 'înainte'}`}
        aria-disabled={!enabled || undefined}
        onClick={() => {
          if (enabled) page(dir);
        }}
        className={iconButtonClass({
          size: 'size-10',
          className: cn('bg-surface shadow-e0', !enabled && 'cursor-default text-faint hover:bg-surface hover:text-faint active:opacity-100'),
        })}
      >
        {dir === -1 ? <ChevronLeftIcon aria-hidden /> : <ChevronRightIcon aria-hidden />}
      </button>
    );
  };

  return (
    // -my-1.5 keeps the heading row at its t-title2 line height (40 − 28 = 2 × 6). From 768 only:
    // in a phone-width header they would squeeze the title to a word or two.
    <div className="-my-1.5 hidden items-center gap-2 md:pointer-fine:flex">
      {arrow(-1)}
      {arrow(1)}
    </div>
  );
}

/** One card slot in a rail: the phone's fixed width, the grid's track from 768; snaps. */
export function RailItem({ width, children }: { width: RailWidth; children: ReactNode }) {
  return (
    <li className={cn('flex shrink-0 snap-start md:w-auto', WIDTH[width])}>
      <div className="w-full">{children}</div>
    </li>
  );
}

/**
 * Grey card placeholder (fish moti Skeleton in the rails). `heightClass` is the card's own height
 * class (each card exports it), so a skeleton and its card can never disagree.
 */
export function CardSkeleton({ width, heightClass }: { width: RailWidth; heightClass: string }) {
  return <div aria-hidden className={cn('shrink-0 rounded-card bg-soft-fill animate-shimmer', WIDTH[width], 'md:w-full', heightClass)} />;
}

/**
 * The next page failed: the slot of the next card says so (an alert: a reader scrolling the rail is
 * told loading stopped) and retries it in place. One retry at a time: while it runs the button stays
 * mounted and focused (aria-disabled, «Se încarcă…»), never swapped for a skeleton under the focus.
 * When the retry works this slot unmounts: focus moves to the first card that arrived (else the
 * rail) and «Au fost încărcate mai multe.» is announced.
 */
export function RailRetryItem({
  width,
  heightClass,
  onRetry,
  retrying = false,
}: {
  width: RailWidth;
  heightClass: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Set on a retry: the list and how many cards it held, to find the first new one afterwards.
  const asked = useRef<{ list: HTMLElement; before: number } | null>(null);

  useEffect(() => {
    prepareAnnouncer();
    return () => {
      const a = asked.current;
      if (!a) return;
      announce('Au fost încărcate mai multe.');
      const first = a.list.children[a.before];
      restoreFocusTo(first?.querySelector<HTMLElement>('a[href]') ?? a.list);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn('flex shrink-0 flex-col items-center justify-center gap-3 rounded-card bg-surface p-4 text-center shadow-e0', WIDTH[width], 'md:w-full', heightClass)}
    >
      <p role="alert" className="t-body text-ink-2">
        Nu am putut încărca mai multe.
      </p>
      <Button
        variant="secondary"
        size="compact"
        aria-disabled={retrying || undefined}
        onClick={() => {
          if (retrying) return;
          const li = ref.current?.closest('li');
          const list = li?.parentElement;
          if (li && list) asked.current = { list, before: Array.prototype.indexOf.call(list.children, li) };
          onRetry();
        }}
      >
        {retrying ? 'Se încarcă…' : 'Încearcă din nou'}
      </Button>
    </div>
  );
}
