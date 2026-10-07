'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { cellNumber, readCell, type RankingRowData } from '@/components/ranking/model';
import { mainValueKey, rankingColumns } from './rankingColumns';

/*
 * Layout of the competition ranking table (CompetitionRankingTable.tsx, fish's column order:
 * Stand · Participant · values · Poziție sector · Poziție generală), applied on the element that
 * wraps it.
 *
 *  - Rows mark the pointer and the keyboard focus (duration-fast) ON THE CELLS: every cell but the
 *    Stand paints its own fill (fish's sector tints, the grey «nu se punctează», the gold biggest
 *    catch, the Best-N band, the solid green won cell), so a row background only ever showed in the
 *    narrow white Stand cell. The plain cells take the soft tint, every filled cell goes a clear step
 *    darker (a filter, so it sits on whatever fill the cell has; the viewer's row keeps its rules).
 *    A pressed row opens the angler (popover / sheet): the cue says the row is pressable.
 */
export const RANKING_TABLE_FIXES = [
  // Only the filter eases (a background transition would also ease the pinned cells' surface in
  // when the wide layout switches on).
  '[&_tbody_td]:transition-[filter] [&_tbody_th]:transition-[filter] [&_tbody_td]:duration-(--duration-fast) [&_tbody_th]:duration-(--duration-fast)',
  '[&_tbody_tr:hover>[data-fill]]:brightness-90 [&_tbody_tr:focus-visible>[data-fill]]:brightness-90',
  '[&_tbody_tr:not([data-me]):hover>*:not([data-fill])]:bg-soft-fill [&_tbody_tr:not([data-me]):focus-visible>*:not([data-fill])]:bg-soft-fill',
].join(' ');

/**
 * The table inside a card of its own: no second radius / shadow, only as wide as its columns (the
 * card's band of controls and legend never widen it, RankingView; ROADMAP §4b.16), and the header row keeps its own
 * colour (RANKING_HEAD, ROADMAP §4b.12) with a hairline under it. The first row drops its own top
 * hairline, so the line under the header is single — and it stays with the header when it sticks.
 */
export const EMBEDDED_TABLE = [
  '[&>[role=region]]:rounded-none [&>[role=region]]:shadow-none [&_thead_th]:rounded-none',
  '[&_thead_th]:border-b [&_thead_th]:border-hairline [&_tbody_tr:first-child>*]:border-t-transparent',
].join(' ');


/*
 * Layout of the general table, by whether it fits its card:
 *
 *  - it fits (data-wide=false): no inner scroll box at all — the region clips sideways instead of
 *    scrolling, so the header row sticks to the page under the top bar while the reader goes down
 *    every row.
 *  - it is wider (quality rankings: up to 23 catch columns; every table on a phone): the region
 *    scrolls sideways; the Stand stays pinned at the left (fish RankingTable: «the Stand column stays
 *    fixed while the other columns scroll», parity clasament.c22), with the Participant beside it
 *    when there is room, and the deciding columns (rankingPinKeys) pinned at the right, the pinned
 *    edges with a hairline; a right-edge fade while there is more to see when nothing is pinned at
 *    the right. fish's column ORDER is never changed (parity clasament c7–c13): a deciding column in
 *    the middle of the table («Cantitate» of a quantity ranking) is `sticky` with a right offset, so
 *    it waits at the right edge until the scroll brings its own place into view, then scrolls on
 *    with its neighbours. The kit marks those cells (RankingTable `pinRight` → `data-pin="r1…r4"`,
 *    by priority); the offsets are measured (useTablePins) and handed down as custom properties; a
 *    column that is not pinned has none, so its `position` falls back to static.
 */
const PINNED_RIGHT_MAX = 4;

/**
 * The server's (and the first paint's) guess, before anything is measured: a table with more catch
 * columns than this is drawn wide — the Stand pinned at the left, the deciding columns pinned at the
 * right on fixed 112px tracks — so the ranking's deciding numbers are on screen without JavaScript.
 * useTablePins then measures and replaces the guess.
 */
const WIDE_GUESS_CATCHES = 8;
/** Each pinned column's width until measured: spacing 28 (112px). */
const STATIC_TOTAL_STEPS = 28;

/** The pinned columns' fixed tracks while the guess stands (data-static-pins = how many, by priority). */
export const STATIC_PINS_LAYOUT = [
  '[&[data-static-pins="1"]_[data-pin=r1]]:w-28',
  '[&[data-static-pins="2"]_[data-pin=r1]]:w-28 [&[data-static-pins="2"]_[data-pin=r2]]:w-28',
  '[&[data-static-pins="3"]_[data-pin=r1]]:w-28 [&[data-static-pins="3"]_[data-pin=r2]]:w-28 [&[data-static-pins="3"]_[data-pin=r3]]:w-28',
  '[&[data-static-pins="4"]_[data-pin]]:w-28',
].join(' ');

/**
 * The value a ranking is decided on, as a column key: «Puncte total» for the point rankings, else
 * the main value (Cantitate, Calitate, Medie — rankingColumns mainValueKey). bestOfTiers has none of
 * them — each row's own Best N decides (its green cell): the Best-N column that decided the most
 * rows stands for the block (the most green cells, then the most values, then the smaller N, which
 * more anglers reach); without rows, the smallest Best N.
 */
export function decidingKey(columns: ReadonlyArray<ColumnDefinition>, rows?: ReadonlyArray<RankingRowData>): string | undefined {
  if (columns.some(c => c.key === 'totalPoints')) return 'totalPoints';
  const main = mainValueKey(columns);
  if (main) return main;
  const tiers = columns.filter(c => /^tier\d+$/.test(c.key)).map(c => c.key);
  const score = (key: string) => {
    const wins = rows?.filter(r => readCell(r[key]).isTierWin).length ?? 0;
    const values = rows?.filter(r => (cellNumber(r[key]) ?? 0) > 0).length ?? 0;
    return wins * 10_000 + values;
  };
  // Stable on ties: the tiers come ascending (Best 3 … Best 9), so the first best score is the smaller N.
  return tiers.reduce<string | undefined>((best, key) => (best === undefined || score(key) > score(best) ? key : best), undefined);
}

/**
 * The columns pinned at the right when the table scrolls sideways, by priority (r1 first): «Poziție
 * generală», the deciding value (decidingKey), then the totals after the last catch, from the right
 * (a type without catch columns has none) — at most four. The measure keeps a prefix of this list
 * (what fits); the offsets follow the columns' own order.
 */
export function rankingPinKeys(columns: ReadonlyArray<ColumnDefinition>, rows?: ReadonlyArray<RankingRowData>): string[] {
  const kinds = rankingColumns(columns).map(c => c.kind);
  const lastCatch = Math.max(kinds.lastIndexOf('catch'), kinds.lastIndexOf('tier'));
  const trailing = lastCatch === -1 ? [] : columns.slice(lastCatch + 1).map(c => c.key).reverse();
  const wanted = ['generalPosition', decidingKey(columns, rows), ...trailing].filter((k): k is string => !!k && columns.some(c => c.key === k));
  return [...new Set(wanted)].slice(0, PINNED_RIGHT_MAX);
}

/**
 * How much of the card the Stand and the right-pinned block may take before a pinned column is let
 * go: 75% (at 375: Stand 76 + the deciding value 84 + Loc 80 of a 343px card, the capped name beside
 * them). The Participant is pinned too only while everything pinned stays under 60%.
 */
const PINNED_SHARE = 0.75;
const PINNED_SHARE_NAME = 0.6;

const HAIRLINE_LEFT = 'inset 1px 0 0 var(--color-hairline)';
const HAIRLINE_RIGHT = 'inset -1px 0 0 var(--color-hairline)';
/** While columns scroll under a pinned block, its edge also casts a soft shadow over them. */
const SHADE = 'color-mix(in srgb, var(--color-ink) 18%, transparent)';
const SHADOW_RIGHT = `${HAIRLINE_RIGHT}, 8px 0 8px -8px ${SHADE}`;
const SHADOW_LEFT = `${HAIRLINE_LEFT}, -8px 0 8px -8px ${SHADE}`;

export type TablePins = {
  wide: boolean;
  fade: boolean;
  style: Record<string, string>;
  /** Set while the pins are the unmeasured guess (staticPins): how many columns sit on fixed tracks. */
  staticCount?: number;
  /** The right pins in use («r1 r2»), for the host's `data-pinned` (their header cells' layer). */
  pinned?: string;
};

/** Right to left in the columns' own order; each keeps its priority number (data-pin=r1…). */
function byPlace(columns: ReadonlyArray<ColumnDefinition>, keys: ReadonlyArray<string>) {
  return keys.map((key, i) => ({ n: i + 1, at: columns.findIndex(c => c.key === key) })).sort((a, b) => b.at - a.at);
}

/** The pins before the first measure (server render, first paint, no JavaScript): see WIDE_GUESS_CATCHES. */
export function staticPins(columns: ReadonlyArray<ColumnDefinition>, rows?: ReadonlyArray<RankingRowData>): TablePins {
  const catches = rankingColumns(columns).filter(c => c.kind === 'catch').length;
  if (catches <= WIDE_GUESS_CATCHES) return { wide: false, fade: false, style: {} };
  const keys = rankingPinKeys(columns, rows);
  const step = (n: number) => `calc(var(--spacing) * ${n})`;
  const style: Record<string, string> = {
    '--pin-l1-pos': 'sticky',
    '--pin-l1-edge': HAIRLINE_RIGHT,
    '--pin-l2-pos': 'static',
    '--pin-l2': 'auto',
    '--pin-l2-edge': 'none',
  };
  const order = byPlace(columns, keys);
  order.forEach(({ n }, i) => {
    style[`--pin-r${n}-pos`] = 'sticky';
    style[`--pin-r${n}`] = step(STATIC_TOTAL_STEPS * i);
    style[`--pin-r${n}-edge`] = i === order.length - 1 ? HAIRLINE_LEFT : 'none';
  });
  return { wide: true, fade: keys.length === 0, style, staticCount: keys.length || undefined, pinned: order.map(o => `r${o.n}`).join(' ') };
}

/*
 * Written out (Tailwind only sees literal class names): the four right pins, by priority (data-pin).
 * Layers inside the isolated region: a pinned body cell on the left (Stand, Participant) over a
 * right-pinned one scrolling past it (z-above); the header row over the body (z-sticky); a pinned
 * header cell at the right, while pinned (the host's data-pinned), over the header cells under it (z-overlay);
 * the left-pinned header corner over everything (z-toast).
 */
const PIN_RIGHT = [
  '[&[data-wide=true]_tbody_tr>[data-pin=r1]]:[position:var(--pin-r1-pos,static)] [&[data-wide=true]_tr>[data-pin=r1]]:right-(--pin-r1) [&[data-wide=true]_tr>[data-pin=r1]]:[box-shadow:var(--pin-r1-edge)] [&[data-pinned~=r1]_thead_th[data-pin=r1]]:z-overlay',
  '[&[data-wide=true]_tbody_tr>[data-pin=r2]]:[position:var(--pin-r2-pos,static)] [&[data-wide=true]_tr>[data-pin=r2]]:right-(--pin-r2) [&[data-wide=true]_tr>[data-pin=r2]]:[box-shadow:var(--pin-r2-edge)] [&[data-pinned~=r2]_thead_th[data-pin=r2]]:z-overlay',
  '[&[data-wide=true]_tbody_tr>[data-pin=r3]]:[position:var(--pin-r3-pos,static)] [&[data-wide=true]_tr>[data-pin=r3]]:right-(--pin-r3) [&[data-wide=true]_tr>[data-pin=r3]]:[box-shadow:var(--pin-r3-edge)] [&[data-pinned~=r3]_thead_th[data-pin=r3]]:z-overlay',
  '[&[data-wide=true]_tbody_tr>[data-pin=r4]]:[position:var(--pin-r4-pos,static)] [&[data-wide=true]_tr>[data-pin=r4]]:right-(--pin-r4) [&[data-wide=true]_tr>[data-pin=r4]]:[box-shadow:var(--pin-r4-edge)] [&[data-pinned~=r4]_thead_th[data-pin=r4]]:z-overlay',
].join(' ');

/**
 * Fits: the header row follows the page, under the 64px top bar AND the competition's sticky route
 * tabs (44px, DetailBand `sticky`) — 108 from 768. The full-ranking dialog has no tabs.
 */
export const STICKY_HEAD_PAGE = '[&[data-wide=false]_thead_th]:top-27';
export const STICKY_HEAD_DIALOG = '[&[data-wide=false]_thead_th]:top-16';

export const GENERAL_TABLE_LAYOUT = [
  // Fits: the header follows the page (its offset: STICKY_HEAD_PAGE / STICKY_HEAD_DIALOG).
  '[&[data-wide=false]>[role=region]]:overflow-x-clip [&[data-wide=false]>[role=region]]:overflow-y-visible',
  // Fits: every column is its own content's width (ROADMAP §4b.16, components/ranking/RankingTable
  // WIDTH) and the card is only as wide as the table and its band of controls (RankingView).
  // Wide: the pinned cells cover what scrolls under them (the filled cells are opaque already).
  '[&[data-wide=true]>[role=region]]:isolate',
  '[&[data-wide=true]_tbody_tr>*:not([data-fill])]:bg-surface [&[data-wide=true]_tbody_tr[data-me]>*:not([data-fill])]:bg-accent-tint',
  '[&[data-wide=true]_tbody_tr>*:nth-child(1)]:[position:var(--pin-l1-pos,static)] [&[data-wide=true]_tr>*:nth-child(1)]:left-0',
  '[&[data-wide=true]_tbody_tr>*:nth-child(2)]:[position:var(--pin-l2-pos,static)] [&[data-wide=true]_tr>*:nth-child(2)]:left-(--pin-l2)',
  '[&[data-wide=true]_tbody_tr>*:nth-child(-n+2)]:z-above [&[data-wide=true]_thead_th]:z-sticky [&[data-wide=true]_thead_th:nth-child(-n+2)]:z-toast',
  '[&[data-wide=true]_tr>*:nth-child(1)]:[box-shadow:var(--pin-l1-edge)] [&[data-wide=true]_tr>*:nth-child(2)]:[box-shadow:var(--pin-l2-edge)]',
  PIN_RIGHT,
  // Below 768, while the name is not pinned: it takes exactly the room between the Stand and the
  // right-pinned block (--name-fill, measured), so the first screen never shows a column cut by the
  // pin (half its digits, «8,3…»); unmeasured, the kit's 104px cap.
  'max-md:[&[data-wide=true]_tr>*:nth-child(2)]:w-[var(--name-fill,calc(var(--spacing)*26))] max-md:[&[data-wide=true]_tr>*:nth-child(2)]:min-w-[var(--name-fill,calc(var(--spacing)*26))] max-md:[&[data-wide=true]_tr>*:nth-child(2)]:max-w-[var(--name-fill,calc(var(--spacing)*26))]',
  // Nothing pinned at the right: fade the right edge while there are columns past it.
  '[&[data-fade=true]>[role=region]]:[mask-image:linear-gradient(to_left,transparent,black_--spacing(8))]',
].join(' ');

/**
 * Measures the table inside `ref` (its first `[role=region]`): whether it is wider than its card,
 * and, when it is, the left offset of Participant and the right offsets of the pinned columns
 * (rankingPinKeys, as the kit marked them). Re-measured on resize and when the columns or rows
 * change; the edges follow the scroll.
 */
export function useTablePins(
  ref: RefObject<HTMLElement | null>,
  columns: ReadonlyArray<ColumnDefinition>,
  rowCount: number,
  /** The rows (bestOfTiers: which Best N decided the most of them, rankingPinKeys). */
  rows?: ReadonlyArray<RankingRowData>,
): TablePins {
  // The first paint (and the server's HTML) carries the guess; the measure below replaces it.
  const [pins, setPins] = useState<TablePins>(() => staticPins(columns, rows));

  useEffect(() => {
    const host = ref.current;
    const region = host?.querySelector<HTMLElement>('[role=region]');
    const head = region?.querySelector<HTMLTableRowElement>('thead tr');
    if (!host || !region || !head) return;
    const keys = rankingPinKeys(columns, rows);

    const measure = () => {
      const wide = region.scrollWidth > region.clientWidth + 1;
      const atEnd = region.scrollLeft + region.clientWidth >= region.scrollWidth - 1;
      const scrolled = region.scrollLeft > 1;
      const leftEdge = scrolled ? SHADOW_RIGHT : HAIRLINE_RIGHT;
      if (!wide) {
        setPins(p => (p.wide || p.fade || p.staticCount ? { wide: false, fade: false, style: {} } : p));
        return;
      }
      const cells = [...head.children] as HTMLElement[];
      const widths = cells.map(c => c.getBoundingClientRect().width);
      const widthOf = (key: string) => widths[columns.findIndex(c => c.key === key)] ?? 0;
      const room = region.clientWidth;
      // The right pins by priority, while they and the Stand stay within PINNED_SHARE of the card.
      let count = keys.length;
      const rightWidth = (n: number) => keys.slice(0, n).reduce((a, k) => a + widthOf(k), 0);
      while (count > 0 && widths[0] + rightWidth(count) > room * PINNED_SHARE) count--;
      const pinName = widths[0] + widths[1] + rightWidth(count) <= room * PINNED_SHARE_NAME;
      const style: Record<string, string> = {
        '--pin-l1-pos': 'sticky',
        '--pin-l1-edge': pinName ? 'none' : leftEdge,
        '--pin-l2-pos': pinName ? 'sticky' : 'static',
        '--pin-l2': pinName ? `${widths[0]}px` : 'auto',
        '--pin-l2-edge': pinName ? leftEdge : 'none',
      };
      // The name fills what the Stand and the right pins leave (GENERAL_TABLE_LAYOUT, phone only).
      if (!pinName && count > 0) style['--name-fill'] = `${Math.max(0, Math.floor(room - widths[0] - rightWidth(count)))}px`;
      const order = byPlace(columns, keys.slice(0, count));
      let offset = 0;
      order.forEach(({ n }, i) => {
        style[`--pin-r${n}-pos`] = 'sticky';
        style[`--pin-r${n}`] = `${offset}px`;
        style[`--pin-r${n}-edge`] = i === order.length - 1 ? (atEnd ? HAIRLINE_LEFT : SHADOW_LEFT) : 'none';
        offset += widthOf(keys[n - 1]);
      });
      const pinned = order.map(o => `r${o.n}`).join(' ');
      const next = { wide: true, fade: count === 0 && !atEnd, style, pinned };
      setPins(p =>
        p.wide && !p.staticCount && p.fade === next.fade && p.pinned === pinned && JSON.stringify(p.style) === JSON.stringify(style) ? p : next,
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(region);
    const table = region.querySelector('table');
    if (table) ro.observe(table);
    region.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      region.removeEventListener('scroll', measure);
    };
  }, [ref, columns, rowCount, rows]);

  return pins;
}
