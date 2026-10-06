'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
 * tracks of a grid laid out in one row: as many `width`-wide tracks as the column holds,
 * sharing its free space — so a rail that fits ends on the column edge (or on the track grid every
 * rail shares), and one that does not keeps every card at `width` and scrolls. Every rail of the
 * page follows it; none caps or grows on its own.
 */
export type RailWidth = 160 | 200 | 224;

/*
 * From 768 every slot is one page track wide — (room − (n − 1) × gap) / n for the n whole slots the
 * room holds at `width` or more — computed in CSS, never measured: the room is the main column (a
 * size container; the rail's bleed gives the gutter back as padding, so its content box is exactly
 * that column), and n is set by container steps per slot width and gap (RAIL_STEPS:
 * n × width + (n − 1) × gap ≤ room). The server's HTML therefore already has the final track — no
 * shift when the page hydrates — a page always ends on a whole card flush with the column edge, and
 * the arrows move exactly one page.
 */
const RAIL_GRID =
  'md:grid md:grid-flow-col md:auto-cols-[calc((100cqw-(var(--rail-n)-1)*var(--rail-gap))/var(--rail-n))] [--rail-n:1] [--rail-gap:--spacing(2.5)] xl:[--rail-gap:--spacing(3.5)]';
/**
 * The container steps of RAIL_GRID: below 1280 the gap is 10, from 1280 14 (n × w + (n − 1) × gap).
 * Literal class strings, so Tailwind reads them.
 */
const RAIL_STEPS: Record<RailWidth, string> = {
  160:
    'max-xl:@min-[330px]:[--rail-n:2] max-xl:@min-[500px]:[--rail-n:3] max-xl:@min-[670px]:[--rail-n:4] max-xl:@min-[840px]:[--rail-n:5] max-xl:@min-[1010px]:[--rail-n:6] max-xl:@min-[1180px]:[--rail-n:7] ' +
    'xl:@min-[334px]:[--rail-n:2] xl:@min-[508px]:[--rail-n:3] xl:@min-[682px]:[--rail-n:4] xl:@min-[856px]:[--rail-n:5] xl:@min-[1030px]:[--rail-n:6] xl:@min-[1204px]:[--rail-n:7] xl:@min-[1378px]:[--rail-n:8] xl:@min-[1552px]:[--rail-n:9]',
  200:
    'max-xl:@min-[410px]:[--rail-n:2] max-xl:@min-[620px]:[--rail-n:3] max-xl:@min-[830px]:[--rail-n:4] max-xl:@min-[1040px]:[--rail-n:5] ' +
    'xl:@min-[414px]:[--rail-n:2] xl:@min-[628px]:[--rail-n:3] xl:@min-[842px]:[--rail-n:4] xl:@min-[1056px]:[--rail-n:5] xl:@min-[1270px]:[--rail-n:6] xl:@min-[1484px]:[--rail-n:7]',
  224:
    'max-xl:@min-[458px]:[--rail-n:2] max-xl:@min-[692px]:[--rail-n:3] max-xl:@min-[926px]:[--rail-n:4] max-xl:@min-[1160px]:[--rail-n:5] ' +
    'xl:@min-[462px]:[--rail-n:2] xl:@min-[700px]:[--rail-n:3] xl:@min-[938px]:[--rail-n:4] xl:@min-[1176px]:[--rail-n:5] xl:@min-[1414px]:[--rail-n:6] xl:@min-[1652px]:[--rail-n:7]',
};
/** Phone slot widths; from 768 the grid track sizes the slot. */
const WIDTH: Record<RailWidth, string> = { 160: 'w-40', 200: 'w-50', 224: 'w-56' };

/** The rail's list classes, shared with its loading row (RailSkeleton) so both lay out alike. */
export function railListClass(width: RailWidth) {
  return cn('flex gap-(--rail-gap) pt-1 pb-4', RAIL_GRID, RAIL_STEPS[width], RAIL_BLEED);
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
          // 768–1279 the rail bleeds to the screen edge: the next card's start shows in the 24px
          // gutter, and fades out there — an intentional peek («more»), never a cut card. From
          // 1280 the page ends flush on a whole card (the arrows say there is more).
          edges.next && 'md:max-xl:[mask-image:linear-gradient(to_right,black_calc(100%-var(--spacing)*6),transparent)]',
          // Keyboard focus on a card: its stretched link draws the ring on ::after OUTSIDE the card
          // (kit CardShell outline-offset-2), which this scroller clips. Drawn inside instead.
          // TODO(kit): CardShell's CardTitle should draw it inside (offset −2) everywhere.
          '[&_a]:focus-visible:after:outline-offset-[-2px]',
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

const noSubscribe = () => () => {};

/**
 * A rail's infinite-query read as the server rendered it while the page hydrates: the first page
 * only, no next-page fetch or error. Acasă mounts every rail twice (the stacked and the column
 * compositions, one `display: none`), each behind its own boundary, and they share one query. On a
 * wide screen a rail's end is in view at once, so the copy that hydrates first asks for page 2;
 * the other copy then hydrated with 20 cards (and a loading slot) against the server's 10 — a
 * hydration error from 1680 up. Once hydrated (or on a client-side mount) it is the live read.
 */
export function useRailRead<P>(q: {
  data?: { pages: P[] };
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}): { pages: P[] | undefined; fetchingNext: boolean; nextError: boolean } {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pages = q.data?.pages;
  if (hydrated) return { pages, fetchingNext: q.isFetchingNextPage, nextError: q.isFetchNextPageError };
  return { pages: pages?.slice(0, 1), fetchingNext: false, nextError: false };
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
export function RailArrows({ rail }: { rail: RailHandle | null }) {
  // Rendered from the server HTML on: the header cluster has its final width before the rail is
  // measured (no shift on hydration). Until the rail reports an overflow the pair is
  // `invisible` — kept in the layout, out of the tab order and the accessibility tree.
  const edges = rail?.edges ?? { prev: false, next: false };
  const shown = edges.prev || edges.next;

  const page = (dir: -1 | 1) => {
    const el = rail?.scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // One page: the room plus the gap after its last card (the next page starts on a whole card).
    const cs = getComputedStyle(el);
    const room = el.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight);
    const step = room + (Number.parseFloat(cs.columnGap) || 0);
    el.scrollBy({ left: dir * Math.max(step, 160), behavior: reduce ? 'auto' : 'smooth' });
  };

  const arrow = (dir: -1 | 1) => {
    const enabled = dir === -1 ? edges.prev : edges.next;
    return (
      <button
        type="button"
        aria-controls={rail?.controls}
        aria-label={`${rail?.label ?? 'Listă'}: ${dir === -1 ? 'înapoi' : 'înainte'}`}
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
    // The pair never makes the heading row taller than its t-title2 line, so arriving after
    // hydration shifts nothing: 40 − 2 × 9 = 22 below 1280, 40 − 2 × 7 = 26 from 1280. From 768
    // only: in a phone-width header they would squeeze the title to a word or two.
    <div aria-hidden={!shown || undefined} className={cn('-my-2.25 hidden items-center gap-2 md:pointer-fine:flex xl:-my-1.75', !shown && 'invisible')}>
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
 * From 768, the rail's last slot: «Vezi toate …» as a ghost card at the cards' own height (icon,
 * the count, an arrow) linking to the list. A rail shorter than its column's tracks (three live
 * competitions on a four-track 1920 column) ends on it instead of an empty track under a far-right
 * «Vezi toate»; a longer rail ends its scroll on it. The cards are never stretched. Not on a phone,
 * where the section header's «Vezi toate» is fish's one way on.
 */
export function RailEndCard({
  href,
  label,
  caption,
  icon,
  heightClass,
}: {
  href: string;
  label: string;
  /** Under the label: the count («24 de concursuri»). */
  caption?: string;
  icon: ReactNode;
  heightClass: string;
}) {
  return (
    <li className="hidden shrink-0 snap-start md:flex">
      <Link
        href={href}
        className={cn(
          'group flex w-full flex-col items-center justify-center gap-3 rounded-card border border-dashed border-hairline p-4 text-center',
          'transition-colors duration-(--duration-fast) ease-fast hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
          heightClass,
        )}
      >
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
          {icon}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="t-body-strong text-accent-ink">{label}</span>
          {caption ? <span className="t-caption text-muted">{caption}</span> : null}
        </span>
        <ArrowRightIcon aria-hidden className="size-5 text-accent-ink transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" />
      </Link>
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
