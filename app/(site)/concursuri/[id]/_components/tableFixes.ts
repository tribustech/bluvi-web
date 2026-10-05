'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { ColumnDefinition } from '@/core/competitions';
import { toWebColumns } from '@/components/ranking/columns';

/*
 * Page-side corrections to the kit RankingTable (components/ranking/RankingTable.tsx), applied on
 * the element that wraps it. TODO(kit): move each into RankingTable itself (and RankingRow for the
 * penalty ink), then delete this file — this task may only touch the competition page.
 *
 *  - Gutters: only the last column has a right padding, so neighbouring right-aligned weights ran
 *    into one another («7,5577,3316,931»). Every right-aligned cell and header button gets 12px at
 *    its end and 8px at its start (a wide table squeezes its columns to their content).
 *  - Place column 76px with an 8px end gap, so a tied «=19» never touches the stand («=19D2»); the
 *    Stand header's sort chevron gets 12px before «Pescar».
 *  - «Nu se punctează» cells (catch columns past the sector's minimum) keep the kit's grey fill and
 *    stay empty, as fish draws them (parity competition-page.clasament.c21).
 *  - The penalty Tag (kit Badge `yellow`, #CA8A04 on #FFFDEC = 2.86:1) is drawn in the warning
 *    status ink (7:1).
 */
export const RANKING_TABLE_FIXES = [
  '[&_tbody_td.text-right:not(:last-child)]:pr-3 [&_tbody_td.text-right]:pl-2',
  '[&_thead_th:not(:last-child)_button.justify-end]:pr-3 [&_thead_th_button.justify-end]:pl-2',
  '[&_thead_th:first-child]:w-19 [&_tbody_th:first-child]:w-19 [&_tbody_th:first-child]:pr-2',
  '[&_thead_th:nth-child(2)_button]:pr-3',
  '[&_.text-badge-yellow-fg]:text-status-warning-fg',
].join(' ');

/**
 * The kit table inside a card of its own: no second radius / shadow, and the header row on the
 * card's white with a hairline under it (the kit's page-grey header melted into the page around a
 * card that has only an inset hairline). The first row drops its own top hairline, so the line
 * under the header is single — and it stays with the header when it sticks. TODO(kit): an `embedded` prop.
 */
export const EMBEDDED_TABLE = [
  '[&>[role=region]]:rounded-none [&>[role=region]]:shadow-none [&_thead_th]:rounded-none',
  '[&_thead_th]:bg-surface [&_thead_th]:border-b [&_thead_th]:border-hairline [&_tbody_tr:first-child>*]:border-t-transparent',
].join(' ');

/*
 * Layout of the general table, by whether it fits its card:
 *
 *  - it fits (data-wide=false): no inner scroll box at all — the region clips sideways instead of
 *    scrolling (`overflow-x: clip` does not make a scroll container), so the header row sticks to
 *    the page under the 64px top bar while the reader goes down every row.
 *  - it is wider (quality rankings: up to 23 catch columns): the region scrolls sideways; Loc,
 *    Stand and Pescar stay pinned at the left and the deciding totals (the columns after the last
 *    catch) at the right, each pinned edge with a hairline, and a right-edge fade while there is
 *    more to see when nothing is pinned at the right. The pinned offsets are measured
 *    (useTablePins) and handed down as custom properties; a column that is not pinned has none,
 *    so its `position` / `left` / `right` fall back to the kit's own.
 */
const PINNED_RIGHT_MAX = 4;

// Written out (Tailwind only sees literal class names): the last four columns, by distance from the end.
const PIN_RIGHT = [
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(1)]:[position:var(--pin-r1-pos)] [&[data-wide=true]_tr>*:nth-last-child(1)]:right-(--pin-r1) [&[data-wide=true]_tr>*:nth-last-child(1)]:[box-shadow:var(--pin-r1-edge)]',
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(2)]:[position:var(--pin-r2-pos)] [&[data-wide=true]_tr>*:nth-last-child(2)]:right-(--pin-r2) [&[data-wide=true]_tr>*:nth-last-child(2)]:[box-shadow:var(--pin-r2-edge)]',
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(3)]:[position:var(--pin-r3-pos)] [&[data-wide=true]_tr>*:nth-last-child(3)]:right-(--pin-r3) [&[data-wide=true]_tr>*:nth-last-child(3)]:[box-shadow:var(--pin-r3-edge)]',
  '[&[data-wide=true]_tbody_tr>*:nth-last-child(4)]:[position:var(--pin-r4-pos)] [&[data-wide=true]_tr>*:nth-last-child(4)]:right-(--pin-r4) [&[data-wide=true]_tr>*:nth-last-child(4)]:[box-shadow:var(--pin-r4-edge)]',
].join(' ');

export const GENERAL_TABLE_LAYOUT = [
  // Fits: the header follows the page (below the top bar, 64px from 768).
  '[&[data-wide=false]>[role=region]]:overflow-x-clip [&[data-wide=false]>[role=region]]:overflow-y-visible',
  '[&[data-wide=false]_thead_th]:top-16',
  // Fits, from 1280: the spare width goes to the numbers, not into a gap after every name — each
  // column after Loc / Stand / Pescar takes an equal share (a percentage never forces the table
  // wider than its card, so it cannot flip it into the wide layout).
  'xl:[&[data-wide=false]_thead_th:nth-child(n+4)]:w-[11%]',
  // Wide: the pinned cells cover what scrolls under them.
  '[&[data-wide=true]_tbody_tr>*]:bg-surface [&[data-wide=true]_tbody_tr.bg-accent-tint>*]:bg-accent-tint',
  // …except the grey «nu se punctează» cells, which keep their fill (parity clasament.c21).
  '[&[data-wide=true]_tbody_tr>td.bg-soft-fill]:bg-soft-fill',
  '[&[data-wide=true]_tbody_tr>*:nth-child(-n+3)]:[position:var(--pin-l-pos)]',
  '[&[data-wide=true]_tbody_tr>*:nth-child(1)]:left-0 [&[data-wide=true]_thead_th:nth-child(1)]:left-0',
  '[&[data-wide=true]_tr>*:nth-child(2)]:left-(--pin-l2) [&[data-wide=true]_tr>*:nth-child(3)]:left-(--pin-l3)',
  '[&[data-wide=true]_thead_th:nth-child(-n+3)]:z-sticky',
  '[&[data-wide=true]_tr>*:nth-child(2)]:[box-shadow:var(--pin-l2-edge)] [&[data-wide=true]_tr>*:nth-child(3)]:[box-shadow:var(--pin-l3-edge)]',
  PIN_RIGHT,
  // Nothing pinned at the right: fade the right edge while there are columns past it.
  '[&[data-fade=true]>[role=region]]:[mask-image:linear-gradient(to_left,transparent,black_--spacing(8))]',
].join(' ');

const HAIRLINE_LEFT = 'inset 1px 0 0 var(--color-hairline)';
const HAIRLINE_RIGHT = 'inset -1px 0 0 var(--color-hairline)';

export type TablePins = { wide: boolean; fade: boolean; style: Record<string, string> };

/**
 * Measures the kit table inside `ref` (its first `[role=region]`): whether it is wider than its card,
 * and, when it is, the left offsets of Stand / Pescar and the right offsets of the trailing total
 * columns. Re-measured on resize and when the columns or rows change; the fade follows the scroll.
 */
export function useTablePins(
  ref: RefObject<HTMLElement | null>,
  columns: ReadonlyArray<ColumnDefinition>,
  rowCount: number,
): TablePins {
  const [pins, setPins] = useState<TablePins>({ wide: false, fade: false, style: {} });

  useEffect(() => {
    const host = ref.current;
    const region = host?.querySelector<HTMLElement>('[role=region]');
    const head = region?.querySelector<HTMLTableRowElement>('thead tr');
    if (!host || !region || !head) return;
    const web = toWebColumns(columns);
    const lastCatch = web.map(c => c.kind).lastIndexOf('catch');
    // The deciding totals: every column after the last catch (none without catch columns).
    const trailing = lastCatch === -1 ? 0 : Math.min(PINNED_RIGHT_MAX, web.length - lastCatch - 1);

    const measure = () => {
      const wide = region.scrollWidth > region.clientWidth + 1;
      const atEnd = region.scrollLeft + region.clientWidth >= region.scrollWidth - 1;
      if (!wide) {
        setPins(p => (p.wide || p.fade ? { wide: false, fade: false, style: {} } : p));
        return;
      }
      const cells = [...head.children] as HTMLElement[];
      const widths = cells.map(c => c.getBoundingClientRect().width);
      const room = region.clientWidth;
      // Left: Loc + Stand always; Pescar too while the pinned sides leave half the card to scroll.
      let right = trailing;
      const rightWidth = (n: number) => widths.slice(widths.length - n).reduce((a, b) => a + b, 0);
      const left2 = widths[0] + widths[1];
      while (right > 0 && left2 + rightWidth(right) > room * 0.6) right--;
      const pinName = left2 + widths[2] + rightWidth(right) <= room * 0.6;
      const style: Record<string, string> = {
        '--pin-l-pos': 'sticky',
        '--pin-l2': `${widths[0]}px`,
        '--pin-l2-edge': pinName ? 'none' : HAIRLINE_RIGHT,
        '--pin-l3': pinName ? `${left2}px` : 'auto',
        '--pin-l3-edge': pinName ? HAIRLINE_RIGHT : 'none',
      };
      let offset = 0;
      for (let n = 1; n <= right; n++) {
        style[`--pin-r${n}-pos`] = 'sticky';
        style[`--pin-r${n}`] = `${offset}px`;
        style[`--pin-r${n}-edge`] = n === right ? HAIRLINE_LEFT : 'none';
        offset += widths[widths.length - n];
      }
      const next = { wide: true, fade: right === 0 && !atEnd, style };
      setPins(p => (p.wide && p.fade === next.fade && JSON.stringify(p.style) === JSON.stringify(style) ? p : next));
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
