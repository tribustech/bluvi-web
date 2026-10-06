'use client';

import { PhotoIcon } from '@heroicons/react/24/outline';
import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * The photo masonry of the lake gallery and the catches page — fish FlashList `masonry` +
 * `optimizeItemArrangement` (each tile in the shorter column). Web: an explicit CSS grid, tiles in
 * the DOM in the data's order (the reading and Tab order), each placed in the shortest column so
 * far. Placement depends only on the tiles before it, so a page of 20 appended at the end never
 * moves a tile already on screen. Columns auto-fill (~220px tracks, 2 at least — fish's two on a
 * phone, more as the page widens: the full-width rule, never wider tiles).
 *
 * Few photos (a small lake: 1–4): never more columns than photos, and the grid is capped at ~360px
 * a column, so two photos read as a gallery row of proper tiles — not two 220px thumbnails in the
 * corner of a 1400px band.
 *
 * Ratios: a tile is placed and drawn at its photo's ratio CLAMPED to [4:5, 3:2] (tileRatio) —
 * object-cover crops the rest, the lightbox shows the original — so a 9:16 phone screenshot is
 * never a tower that breaks the column rhythm.
 *
 * No layout shift (CLS): the placement needs the grid's width, which the server does not know. So
 * before the first measure the tiles are in the DOM (crawlers, the images start loading) but
 * INVISIBLE, under a skeleton drawn with the SAME column rule as the measured layout
 * (columnsTemplate ⇔ useMasonry's count); when the placement lands, the skeleton goes and the
 * placed tiles appear — nothing visible ever moves from one geometry to another.
 * TODO(kit): a Masonry in components/ui — forked with ape-publice CatchGrid.
 */

const TRACK_PX = 220;
/** A column's widest step while there are fewer photos than the width would hold. */
const WIDE_PX = 360;
const GAP_PX = 8;
/** A column's width in row units: a tile's height is placed to 1/UNITS of the column width. */
const UNITS = 40;

/** The ratio band a tile is placed and drawn at (width / height): 4:5 portrait → 3:2 landscape. */
export const RATIO_MIN = 4 / 5;
export const RATIO_MAX = 3 / 2;
/** A photo without a known ratio (or a failed one): fish's 4:3. */
export const DEFAULT_RATIO = 4 / 3;

/** `ratio` (width / height) clamped to the tile band; unknown → 4:3. */
export function tileRatio(ratio: number | null | undefined): number {
  if (!ratio || !(ratio > 0) || !Number.isFinite(ratio)) return DEFAULT_RATIO;
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio));
}

/** Columns are never more than the photos (two at least, fish's phone pair). */
const spanOf = (count: number) => Math.max(2, count);

/** The grid's cap for `count` photos: ~360px a column, so few photos are tiles, never a thin strip. */
const capOf = (count: number) => spanOf(count) * WIDE_PX + (spanOf(count) - 1) * GAP_PX;

/**
 * The CSS twin of useMasonry's column count, for the pre-measure grid and the skeleton: ~220px
 * tracks, at least two (min(220, half) on a phone), at most `count` (each track ≥ 1/count).
 */
function columnsTemplate(count: number): string {
  const n = spanOf(count);
  return `repeat(auto-fill, minmax(max(min(${TRACK_PX}px, calc(50% - ${GAP_PX / 2}px)), calc((100% - ${(n - 1) * GAP_PX}px) / ${n})), 1fr))`;
}

/** `ratios` are width / height (fish `aspectRatio`), already clamped by the caller (tileRatio). */
export function useMasonry(ratios: number[]) {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    setWidth(el.clientWidth);
    observer.current = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    observer.current.observe(el);
  }, []);
  const count = ratios.length;
  const gridPx = width ? Math.min(width, capOf(count)) : 0;
  const columns = Math.min(spanOf(count), Math.max(2, Math.floor((gridPx + GAP_PX) / (TRACK_PX + GAP_PX))));
  const colPx = gridPx ? (gridPx - GAP_PX * (columns - 1)) / columns : 0;
  const rowPx = colPx / UNITS;
  const gapUnits = rowPx ? Math.max(1, Math.round(GAP_PX / rowPx)) : 0;
  const key = ratios.join(',');
  const places = useMemo(() => {
    const tops = Array.from({ length: columns }, () => 0);
    return ratios.map(r => {
      const col = tops.indexOf(Math.min(...tops));
      const span = Math.ceil((1 / tileRatio(r)) * UNITS) + gapUnits;
      const row = tops[col];
      tops[col] += span;
      return { col, row, span };
    });
    // `key` stands for `ratios` (a new array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, columns, gapUnits]);
  return [ref, { columns, rowPx, places, gridPx }] as const;
}

/** The grid; see the header for the pre-measure state. `ratioOf` is the tile's clamped ratio. */
export function MasonryGrid<T>({
  items,
  ratioOf,
  keyOf,
  label,
  children,
  testId,
  skeletonLabel,
}: {
  items: T[];
  ratioOf: (item: T) => number;
  keyOf: (item: T) => string;
  label: string;
  children: (item: T, index: number) => ReactNode;
  testId?: string;
  /** What the pre-measure skeleton announces. */
  skeletonLabel?: string;
}) {
  const [ref, m] = useMasonry(items.map(ratioOf));
  const placed = m.rowPx > 0;
  const cap: CSSProperties = { maxWidth: `${capOf(items.length)}px` };
  return (
    <div ref={ref} className="relative">
      <ul
        aria-label={label}
        data-testid={testId}
        data-columns={placed ? m.columns : undefined}
        className={cn('grid gap-x-2', !placed && 'invisible gap-y-2')}
        style={
          placed
            ? { ...cap, gridTemplateColumns: `repeat(${m.columns}, minmax(0, 1fr))`, gridAutoRows: `${m.rowPx}px` }
            : { ...cap, gridTemplateColumns: columnsTemplate(items.length) }
        }
      >
        {items.map((item, i) => {
          const at = m.places[i];
          return (
            <li
              key={keyOf(item)}
              className="self-start"
              style={placed && at ? { gridColumn: at.col + 1, gridRow: `${at.row + 1} / span ${at.span}` } : undefined}
            >
              {children(item, i)}
            </li>
          );
        })}
      </ul>
      {placed ? null : (
        <div className="absolute inset-x-0 top-0 h-full overflow-hidden">
          <MasonrySkeleton label={skeletonLabel} count={items.length} />
        </div>
      )}
    </div>
  );
}

const SKELETON_HEIGHTS = [5, 3.5, 5, 4, 3.5, 5, 4, 5, 3.5, 4.5, 5, 4];

/**
 * fish GalleryMasonrySkeleton: staggered grey tiles in the masonry's own columns (two on a phone,
 * as many ~220px tracks as fit), so the skeleton, the first paint and the placed grid have one
 * column count at every width. `count`: the photos it stands for, when known (few photos → their
 * own columns and cap).
 */
export function MasonrySkeleton({ label = 'Se încarcă fotografiile…', count }: { label?: string; count?: number }) {
  const heights = count ? SKELETON_HEIGHTS.slice(0, Math.max(2, count)) : SKELETON_HEIGHTS;
  const n = count ?? SKELETON_HEIGHTS.length * 4;
  return (
    <div role="status" data-testid="masonry-skeleton">
      <span className="sr-only">{label}</span>
      <ul aria-hidden className="grid items-start gap-2" style={{ maxWidth: `${capOf(n)}px`, gridTemplateColumns: columnsTemplate(n) }}>
        {heights.map((h, i) => (
          <li key={i}>
            <span className="block w-full animate-shimmer rounded-card" style={{ aspectRatio: `4 / ${h}` }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * An <img>'s `ref` that reports a photo which ALREADY failed before React hydrated: the tiles come
 * with the HTML, so a rendition that 404s fast fires its `error` event before React attaches
 * `onError` — the tile kept the browser's broken image. On mount, a finished image with no pixels
 * is a failed one (a lazy image still waiting is not `complete`).
 */
export function failedBeforeHydration(onBroken: () => void) {
  return (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) onBroken();
  };
}

/**
 * A tile's photo that failed to load (a CMS rendition that 404s): the tile's soft fill with a
 * muted photo glyph — never the browser's broken-image icon under a caption. The tile takes 4:3
 * (the screens report it to the masonry, so the column re-flows).
 */
export function BrokenPhoto({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('flex size-full items-center justify-center bg-soft-fill text-muted', className)}>
      <PhotoIcon className="size-8" />
    </span>
  );
}
