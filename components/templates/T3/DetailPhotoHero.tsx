import Image from 'next/image';
import type { ReactNode } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { DetailPhotoStrip } from './DetailPhotoStrip';
import { DetailPhotoShowAll, DetailPhotoTileButton, DetailPhotoViewer } from './DetailPhotoViewer';

/*
 * T3 photo hero — fish LakeHero (lake, public water).
 *  - Phone: full bleed, 300px, every photo in a swipeable strip (scroll snap, the fish carousel),
 *    the fish gradient (dark top for the chips, dark bottom for the pills) and four overlay slots.
 *  - From 768: the Airbnb photo grid (owner rule 1, ROADMAP §4b) under the title row, inside the
 *    gutters, radius 16 (rounded-card), 8px between tiles: one large photo and up to four small.
 *    `fill` tops a short set up with more tiles (the lake: community catch photos, else its map —
 *    one photo NEVER spans the width, the owner's «full-width photo»). Fewer tiles degrade
 *    gracefully — 1: the photo on two thirds and a quiet tile beside it ·
 *    2: two halves · 3: the large one + two stacked · 4: the large one, two small, one wide ·
 *    5+: the large one + a 2 × 2 of small. ONE height whatever the count — 320 / 360 (1024) /
 *    400 (1280) / 480 (1440), and from 1024 never more than the window leaves once the title row,
 *    the chips and the summary card's price + main action are counted (owner rule 1: the first
 *    screen says what it costs and how to book — 368 at 1440×900, 268 at 1280×800; 240 at least)
 *    — so the skeleton never guesses. Only the bottom overlays stay (the header carries back /
 *    share there).
 *  - `viewer`: every grid tile opens the kit Lightbox on its photo and «Vezi toate fotografiile (N)»
 *    (2+ photos) on the first, from 768; the phone keeps the swipe. A page whose gallery holds more
 *    than the hero's photos (the lake: + the catches) passes `showAll={false}` and puts its own
 *    link (SHOW_ALL_CLASS) in `bottomEnd` — ONE control from 768, never a pill beside a button.
 *  - No photo: on the phone a token placeholder (soft fill, a photo icon, «Nicio fotografie încă»),
 *    never a stretched stock bitmap — 300px, the back / share chips need a ground. From 768 nothing
 *    at all (the header carries back / share there; an empty slab would only push the body down).
 *    The root carries `data-empty` then, and the overlays are not on a photo: give them the `page`
 *    ground (white surface, e0, ink), not the photo scrim — the slot renderers know `photos.length`.
 *  - The heights live in one place, `photoHeroHeight(count)`: the skeleton (DetailSkeleton
 *    `photoCount`) reads the same rule, so nothing jumps when the photos land.
 *  - `src` should be the largest rendition the CMS has (the original): the large tile is ~700px
 *    wide at 1440, a single strip the whole column, and next/image's `sizes` brings it down.
 * DOM order (WCAG 1.3.2 / 2.4.3): put it in <DetailBand> AFTER the header, with
 * `className="max-md:-order-1"` — from 768 the DOM reads as the screen does (title → actions →
 * photos); on the phone the order lifts it above the title. The phone's back / share chips go in
 * <DetailHeroTopControls> as the band's FIRST child (over the hero, first in Tab order there too),
 * not in `topStart` / `topEnd` (kept for a hero that is first in the DOM).
 */

export type DetailPhoto = { src: string; alt?: string };

export type DetailPhotoHeroProps = {
  photos: DetailPhoto[];
  /** Shown when there is no photo, under the placeholder icon. */
  emptyLabel?: string;
  /** Name of the photo strip: «Fotografii Chita Lake». */
  label: string;
  /** Phone only, over the photo: back. */
  topStart?: ReactNode;
  /** Phone only, over the photo: share. */
  topEnd?: ReactNode;
  /** Every width: the main CTA (fish «Rezervă acum»). Shares one centred line with `bottomEnd`. */
  bottomStart?: ReactNode;
  /** Every width: the photo count / gallery link. */
  bottomEnd?: ReactNode;
  /** From 768: the tiles open the Lightbox, and «Vezi toate fotografiile» joins the bottom row. */
  viewer?: boolean;
  /** With `viewer`: the built-in «Vezi toate fotografiile» (lightbox). false: the page brings its own. */
  showAll?: boolean;
  /**
   * From 768, with fewer than five photos: more grid tiles after the photos (community catches, a
   * map), each a <DetailPhotoFillTile>, so the grid tops up to one large + four small (owner rule
   * 1). The layout follows the tile count the grid ends up with (it may stream in): 2 → the large
   * one + a right third · 3 → the large one + two stacked · 4 → the large one, two small, one wide ·
   * 5 → the large one + a 2 × 2.
   */
  fill?: ReactNode;
  className?: string;
};

const SIZES_PHONE = '100vw';

/** Tiles the grid shows from 768: one large + four small. */
const GRID_MAX = 5;

/** The hero's height for `count` photos — the one rule the hero and its skeleton share. */
export function photoHeroHeight(count: number): string {
  if (count <= 0) return 'h-75 md:h-0';
  // From 1024: min(the step, 100dvh − 532 — the bar, breadcrumb and title row above the grid, its
  // 24px gap, the chips and the summary card down to its main action), never under 240.
  return [
    'h-75 md:h-80',
    'min-[1024px]:h-[clamp(--spacing(60),calc(100dvh_-_--spacing(133)),--spacing(90))]',
    'xl:h-[clamp(--spacing(60),calc(100dvh_-_--spacing(133)),--spacing(100))]',
    '2xl:h-[clamp(--spacing(60),calc(100dvh_-_--spacing(133)),--spacing(120))]',
  ].join(' ');
}

/**
 * Phone only: the chips over the top of the hero (back left, share right) as the DetailBand's FIRST
 * child, so they lead the Tab order as they lead the screen, while the header comes before the
 * photos in the DOM (from 768: title → actions → photos). The band is `relative`; the hero is lifted
 * to its top on the phone (`max-md:-order-1`), so these sit on it.
 */
export function DetailHeroTopControls({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  if (!start && !end) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-above flex items-start justify-between md:hidden *:pointer-events-auto">
      {start ? <div>{start}</div> : <span />}
      {end ? <div>{end}</div> : null}
    </div>
  );
}

/** The grid's columns / rows from 768 for `shown` tiles. */
const GRID: Record<number, string> = {
  1: 'md:grid-cols-[2fr_1fr]',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-[2fr_1fr] md:grid-rows-2',
  4: 'md:grid-cols-4 md:grid-rows-2',
  5: 'md:grid-cols-4 md:grid-rows-2',
};

/**
 * With `fill` the tile count is known only once the fill lands (a streamed read): the grid lays
 * itself out from the number of tiles it has (`:has(>li:nth-child(N))`), the same five shapes.
 */
const FILL_GRID = [
  'md:grid-cols-[2fr_1fr]',
  'md:has-[>li:nth-child(3)]:grid-rows-2 md:[&:has(>li:nth-child(3))>li:first-child]:row-span-2',
  'md:has-[>li:nth-child(4)]:grid-cols-4 md:[&:has(>li:nth-child(4))>li:first-child]:col-span-2',
  'md:[&>li:nth-child(4):last-child]:col-span-2',
].join(' ');

/** Where tile `i` of `shown` sits from 768. */
function tilePlace(i: number, shown: number): string {
  if (i >= GRID_MAX) return 'md:hidden';
  if (shown <= 2) return '';
  if (i === 0) return shown === 3 ? 'md:row-span-2' : 'md:col-span-2 md:row-span-2';
  if (shown === 4 && i === 3) return 'md:col-span-2';
  return '';
}

/** next/image `sizes` for tile `i`: what the tile's box is from 768 (the column is ~the window). */
function tileSizes(i: number, shown: number, filled: boolean): string {
  if (filled) return `(min-width: 768px) ${i === 0 ? '66vw' : '33vw'}, ${SIZES_PHONE}`;
  if (shown <= 1) return `(min-width: 768px) 66vw, ${SIZES_PHONE}`;
  if (i === 0) return `(min-width: 768px) ${shown === 2 ? '50vw' : '66vw'}, ${SIZES_PHONE}`;
  return `(min-width: 768px) ${shown === 2 ? '50vw' : '25vw'}, ${SIZES_PHONE}`;
}

export function DetailPhotoHero({
  photos,
  emptyLabel = 'Nicio fotografie încă',
  label,
  topStart,
  topEnd,
  bottomStart,
  bottomEnd,
  viewer = false,
  showAll: builtInShowAll = true,
  fill,
  className,
}: DetailPhotoHeroProps) {
  const list = photos;
  const shown = Math.min(list.length, GRID_MAX);
  const height = photoHeroHeight(shown);
  // The fill tops the grid up (fewer than five photos); a lone photo without one keeps a quiet tile.
  const filled = !!fill && shown < GRID_MAX;
  const showAll = viewer && builtInShowAll && list.length >= 2 ? <DetailPhotoShowAll /> : null;

  const hero = (
    <div
      data-t3="photo"
      data-empty={list.length === 0 || undefined}
      className={cn('relative md:mx-6 md:mb-6 xl:mx-8', list.length === 0 && 'md:hidden', className)}
    >
      {list.length === 0 ? (
        <div className={cn('flex flex-col items-center justify-center gap-2 bg-soft-fill text-muted', height)}>
          <PhotoIcon aria-hidden className="size-6 shrink-0" />
          <p className="t-caption">{emptyLabel}</p>
        </div>
      ) : (
        <DetailPhotoStrip
          label={label}
          className={cn(
            'flex snap-x snap-mandatory overflow-x-auto bg-soft-fill [scrollbar-width:none]',
            'md:grid md:gap-2 md:overflow-hidden md:rounded-card md:bg-transparent',
            height,
            filled ? FILL_GRID : GRID[shown],
          )}
        >
          {list.map((photo, i) => (
            <li key={`${photo.src}-${i}`} className={cn('group/tile relative h-full w-full shrink-0 snap-center overflow-hidden bg-soft-fill', filled ? '' : tilePlace(i, shown))}>
              <Image
                src={photo.src}
                alt={photo.alt ?? ''}
                fill
                // The lead photo is the LCP: preloaded. The other grid tiles are on the first screen
                // from 768 too: eager (not preloaded, so the phone carousel does not fetch them first).
                preload={i === 0}
                loading={i === 0 ? undefined : i < GRID_MAX ? 'eager' : 'lazy'}
                sizes={tileSizes(i, shown, filled)}
                className={cn(
                  'object-cover',
                  viewer && 'transition-[filter] duration-(--duration-fast) ease-fast md:group-hover/tile:brightness-90',
                )}
              />
              {viewer && i < GRID_MAX ? <DetailPhotoTileButton index={i} label={`Deschide fotografia ${i + 1} din ${list.length}`} /> : null}
            </li>
          ))}
          {filled ? (
            fill
          ) : shown === 1 ? (
            // The right third from 768 — never on the phone carousel.
            <DetailPhotoFillTile quiet />
          ) : null}
        </DetailPhotoStrip>
      )}

      {/* fish gradient: rgba(0,0,0,.42) → 0 at 26%, 0 → .5 at the bottom. Phone only, over a photo only. */}
      {list.length ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-photo-scrim from-0% via-transparent via-40% to-photo-scrim to-100% opacity-80 md:hidden"
        />
      ) : null}

      {topStart ? <div className="absolute top-4 left-4 md:hidden">{topStart}</div> : null}
      {topEnd ? <div className="absolute top-4 right-4 md:hidden">{topEnd}</div> : null}
      {/*
        One bottom row: the CTA and the photo pill share a centre line whatever their heights (a 48px
        button beside a 36px pill). Click-through between them, so the strip still swipes there.
      */}
      {bottomStart || bottomEnd || showAll ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 *:pointer-events-auto">
          {bottomStart ? <div>{bottomStart}</div> : null}
          {bottomEnd || showAll ? (
            <div className="ml-auto flex items-center gap-2">
              {bottomEnd}
              {showAll}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return viewer && list.length ? (
    <DetailPhotoViewer photos={list} label={label}>
      {hero}
    </DetailPhotoViewer>
  ) : (
    hero
  );
}

/**
 * One tile `fill` adds to the photo grid, from 768 only (never on the phone carousel): a catch
 * photo, a map, or `quiet` — the soft tile with a photo icon (decorative).
 */
export function DetailPhotoFillTile({ children, quiet = false }: { children?: ReactNode; quiet?: boolean }) {
  return (
    <li
      aria-hidden={quiet || undefined}
      data-t3="photo-fill"
      className={cn('relative h-full min-h-0 w-full overflow-hidden bg-soft-fill max-md:hidden', quiet && 'flex items-center justify-center text-muted [&>svg]:size-6')}
    >
      {quiet ? <PhotoIcon /> : children}
    </li>
  );
}

const PILL = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 t-label [&>svg]:size-6 [&>svg]:shrink-0';

export { SHOW_ALL_CLASS } from './photoClasses';

/** The pill over a photo (fish photo-count pill): scrim, white, 36px, a 24px outline icon (Fundații §05), radius 999. */
export const PHOTO_PILL = `${PILL} bg-photo-scrim text-on-photo-scrim`;

/** The same pill over the no-photo placeholder (soft fill): the white surface with the e0 hairline, ink. */
export const SURFACE_PILL = `${PILL} bg-surface text-ink shadow-e0`;
