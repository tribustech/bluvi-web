'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { mainValueKey, rankingColumns } from './rankingColumns';

/*
 * Layout of the competition ranking table (CompetitionRankingTable.tsx, fish's column order:
 * Stand · Participant · values · Poziție sector · Poziție generală), applied on the element that
 * wraps it.
 *
 *  - Rows mark the pointer (duration-fast), so one angler can be followed across a wide row: the
 *    plain Stand cell takes the soft tint, every filled cell (`data-fill`: fish's sector tints, the
 *    grey «nu se punctează», the gold biggest catch, the Best-N band) goes a step darker.
 */
export const RANKING_TABLE_FIXES = [
  // The white Stand cell (and every cell without a fill of its own) takes the soft tint; the
  // filled cells (fish's sector tints, the grey, the gold, the Best-N band) a step darker.
  '[&_tbody_tr]:transition-colors [&_tbody_tr]:duration-(--duration-fast) [&_tbody_tr:not(.bg-accent-tint):hover]:bg-soft-fill',
  '[&_tbody_tr:hover>[data-fill]]:brightness-95',
  // Wide tables paint every cell (the pinned ones cover what scrolls under them): tint the plain cells too.
  '[&[data-wide=true]_tbody_tr:not(.bg-accent-tint):hover>*:not([data-fill])]:bg-soft-fill',
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
 *  - it is wider (quality rankings: up to 23 catch columns): the region scrolls sideways; the Stand
 *    stays pinned at the left (fish RankingTable: «the Stand column stays fixed while the other
 *    columns scroll», parity clasament.c22), with the Participant beside it when there is room, and
 *    the deciding totals (the columns after the last catch, at most four) pinned at the right, each
 *    pinned edge with a hairline; a right-edge fade while there is more to see when nothing is
 *    pinned at the right. The pinned offsets are measured (useTablePins) and handed down as custom
 *    properties; a column that is not pinned has none, so its `position` falls back to static.
 */
const PINNED_RIGHT_MAX = 4;

/**
 * The server's (and the first paint's) guess, before anything is measured: a table with more catch
 * columns than this is drawn wide — the Stand pinned at the left, the deciding totals pinned at the
 * right on fixed 112px tracks — so the ranking's deciding numbers are on screen without JavaScript.
 * useTablePins then measures and replaces the guess.
 */
const WIDE_GUESS_CATCHES = 8;
/** Each pinned total's width until measured: spacing 28 (112px). */
const STATIC_TOTAL_STEPS = 28;

/** The pinned totals' fixed tracks while the guess stands (data-static-pins = how many). */
export const STATIC_PINS_LAYOUT = [
  '[&[data-static-pins="1"]_tr>*:nth-last-child(-n+1)]:w-28',
  '[&[data-static-pins="2"]_tr>*:nth-last-child(-n+2)]:w-28',
  '[&[data-static-pins="3"]_tr>*:nth-last-child(-n+3)]:w-28',
  '[&[data-static-pins="4"]_tr>*:nth-last-child(-n+4)]:w-28',
].join(' ');

/**
 * The deciding totals pinned at the right: every column after the last catch, at most four. A table
 * without catch columns (quantity, quality…) has nothing after a catch: its deciding columns are the
 * ranking's main value and «Poziție generală» (Loc) — pinned when they close the table, as the
 * phone orders them (MobileRanking decidingLast), so the value and the place are on the first screen.
 */
function trailingOf(columns: ReadonlyArray<ColumnDefinition>): { catches: number; trailing: number } {
  const kinds = rankingColumns(columns).map(c => c.kind);
  const lastCatch = Math.max(kinds.lastIndexOf('catch'), kinds.lastIndexOf('tier'));
  const catches = kinds.filter(k => k === 'catch').length;
  if (lastCatch !== -1) return { catches, trailing: Math.min(PINNED_RIGHT_MAX, kinds.length - lastCatch - 1) };
  const deciding = new Set(['generalPosition', mainValueKey(columns)]);
  let trailing = 0;
  while (trailing < 2 && trailing < columns.length && deciding.has(columns[columns.length - 1 - trailing].key)) trailing++;
  return { catches, trailing };
}

/**
 * How much of the card the pinned blocks may take before a total is let go: 60% leaves the catches
 * room to scroll. A table without catch columns keeps its two deciding columns up to 75% (at 375:
 * Stand 76 + value 84 + Loc 80 of a 343px card), the capped name still beside them.
 */
const PINNED_SHARE = 0.6;
const PINNED_SHARE_NO_CATCHES = 0.75;

const HAIRLINE_LEFT = 'inset 1px 0 0 var(--color-hairline)';
const HAIRLINE_RIGHT = 'inset -1px 0 0 var(--color-hairline)';
/** While columns scroll under a pinned block, its edge also casts a soft shadow over them. */
const SHADE = 'color-mix(in srgb, var(--color-ink) 18%, transparent)';
const SHADOW_LEFT = `${HAIRLINE_LEFT}, -8px 0 8px -8px ${SHADE}`;
const SHADOW_RIGHT = `${HAIRLINE_RIGHT}, 8px 0 8px -8px ${SHADE}`;

export type TablePins = {
  wide: boolean;
  fade: boolean;
  style: Record<string, string>;
  /** Set while the pins are the unmeasured guess (staticPins): how many totals sit on fixed tracks. */
  staticCount?: number;
};

/** The pins before the first measure (server render, first paint, no JavaScript): see WIDE_GUESS_CATCHES. */
export function staticPins(columns: ReadonlyArray<ColumnDefinition>): TablePins {
  const { catches, trailing } = trailingOf(columns);
  if (catches <= WIDE_GUESS_CATCHES) return { wide: false, fade: false, style: {} };
  const step = (n: number) => `calc(var(--spacing) * ${n})`;
  const style: Record<string, string> = {
    '--pin-l1-pos': 'sticky',
    '--pin-l1-edge': HAIRLINE_RIGHT,
    '--pin-l2-pos': 'static',
    '--pin-l2': 'auto',
    '--pin-l2-edge': 'none',
  };
  for (let n = 1; n <= trailing; n++) {
    style[`--pin-r${n}-pos`] = 'sticky';
    style[`--pin-r${n}`] = step(STATIC_TOTAL_STEPS * (n - 1));
    style[`--pin-r${n}-edge`] = n === trailing ? HAIRLINE_LEFT : 'none';
  }
  return { wide: true, fade: trailing === 0, style, staticCount: trailing || undefined };
}

// Written out (Tailwind only sees literal class names): the last four columns, by distance from the end.
const PIN_RIGHT = [
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(1)]:[position:var(--pin-r1-pos,static)] [&[data-wide=true]_tr>*:nth-last-child(1)]:right-(--pin-r1) [&[data-wide=true]_tr>*:nth-last-child(1)]:[box-shadow:var(--pin-r1-edge)]',
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(2)]:[position:var(--pin-r2-pos,static)] [&[data-wide=true]_tr>*:nth-last-child(2)]:right-(--pin-r2) [&[data-wide=true]_tr>*:nth-last-child(2)]:[box-shadow:var(--pin-r2-edge)]',
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(3)]:[position:var(--pin-r3-pos,static)] [&[data-wide=true]_tr>*:nth-last-child(3)]:right-(--pin-r3) [&[data-wide=true]_tr>*:nth-last-child(3)]:[box-shadow:var(--pin-r3-edge)]',
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(4)]:[position:var(--pin-r4-pos,static)] [&[data-wide=true]_tr>*:nth-last-child(4)]:right-(--pin-r4) [&[data-wide=true]_tr>*:nth-last-child(4)]:[box-shadow:var(--pin-r4-edge)]',
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
  '[&[data-wide=true]_tbody_tr>*:not([data-fill])]:bg-surface [&[data-wide=true]_tbody_tr.bg-accent-tint>*:not([data-fill])]:bg-accent-tint',
  '[&[data-wide=true]_tbody_tr>*:nth-child(1)]:[position:var(--pin-l1-pos,static)] [&[data-wide=true]_tr>*:nth-child(1)]:left-0',
  '[&[data-wide=true]_tbody_tr>*:nth-child(2)]:[position:var(--pin-l2-pos,static)] [&[data-wide=true]_tr>*:nth-child(2)]:left-(--pin-l2)',
  '[&[data-wide=true]_thead_th:nth-child(-n+2)]:z-sticky',
  '[&[data-wide=true]_tr>*:nth-child(1)]:[box-shadow:var(--pin-l1-edge)] [&[data-wide=true]_tr>*:nth-child(2)]:[box-shadow:var(--pin-l2-edge)]',
  PIN_RIGHT,
  // Nothing pinned at the right: fade the right edge while there are columns past it.
  '[&[data-fade=true]>[role=region]]:[mask-image:linear-gradient(to_left,transparent,black_--spacing(8))]',
].join(' ');

/**
 * Measures the table inside `ref` (its first `[role=region]`): whether it is wider than its card,
 * and, when it is, the left offset of Participant and the right offsets of the trailing total
 * columns. Re-measured on resize and when the columns or rows change; the fade follows the scroll.
 */
export function useTablePins(
  ref: RefObject<HTMLElement | null>,
  columns: ReadonlyArray<ColumnDefinition>,
  rowCount: number,
): TablePins {
  // The first paint (and the server's HTML) carries the guess; the measure below replaces it.
  const [pins, setPins] = useState<TablePins>(() => staticPins(columns));

  useEffect(() => {
    const host = ref.current;
    const region = host?.querySelector<HTMLElement>('[role=region]');
    const head = region?.querySelector<HTMLTableRowElement>('thead tr');
    if (!host || !region || !head) return;
    const { trailing } = trailingOf(columns);
    const share = rankingColumns(columns).some(c => c.kind === 'catch' || c.kind === 'tier') ? PINNED_SHARE : PINNED_SHARE_NO_CATCHES;

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
      const room = region.clientWidth;
      // Left: the Stand always; the Participant too while the pinned sides leave 40% of the card to scroll.
      // The totals at the right: while they and the Stand stay within `share` of the card.
      let right = trailing;
      const rightWidth = (n: number) => widths.slice(widths.length - n).reduce((a, b) => a + b, 0);
      while (right > 0 && widths[0] + rightWidth(right) > room * share) right--;
      const pinName = widths[0] + widths[1] + rightWidth(right) <= room * PINNED_SHARE;
      const style: Record<string, string> = {
        '--pin-l1-pos': 'sticky',
        '--pin-l1-edge': pinName ? 'none' : leftEdge,
        '--pin-l2-pos': pinName ? 'sticky' : 'static',
        '--pin-l2': pinName ? `${widths[0]}px` : 'auto',
        '--pin-l2-edge': pinName ? leftEdge : 'none',
      };
      let offset = 0;
      for (let n = 1; n <= right; n++) {
        style[`--pin-r${n}-pos`] = 'sticky';
        style[`--pin-r${n}`] = `${offset}px`;
        style[`--pin-r${n}-edge`] = n === right ? (atEnd ? HAIRLINE_LEFT : SHADOW_LEFT) : 'none';
        offset += widths[widths.length - n];
      }
      const next = { wide: true, fade: right === 0 && !atEnd, style };
      setPins(p => (p.wide && !p.staticCount && p.fade === next.fade && JSON.stringify(p.style) === JSON.stringify(style) ? p : next));
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
  }, [ref, columns, rowCount]);

  return pins;
}
