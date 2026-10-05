import Image from 'next/image';
import type { ReactNode } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { DetailPhotoStrip } from './DetailPhotoStrip';

/*
 * T3 photo hero — fish LakeHero (lake, public water).
 *  - Phone: full bleed, 300px, every photo in a swipeable strip (scroll snap, the fish carousel),
 *    the fish gradient (dark top for the chips, dark bottom for the pills) and four overlay slots.
 *  - From 768: a rounded mosaic inside the gutters — two side by side, or three as one large + two
 *    stacked — 320 / 360 / 400px high. A single photo is one wide strip held lower (256 / 288), so
 *    it is not blown up across the page and the body still starts above the fold. Only the bottom
 *    overlays stay (the header carries back/share there).
 *  - No photo: on the phone a token placeholder (soft fill, a photo icon, «Nicio fotografie încă»),
 *    never a stretched stock bitmap — 300px, the back / share chips need a ground. From 768 nothing
 *    at all (the header carries back / share there; an empty slab would only push the body down).
 *    The root carries `data-empty` then, and the overlays are not on a photo: give them the `page`
 *    ground (white surface, e0, ink), not the photo scrim — the slot renderers know `photos.length`.
 *  - The heights live in one place, `photoHeroHeight(count)`: the skeleton (DetailSkeleton
 *    `photoCount`) reads the same rule, so nothing jumps when the photos land.
 *  - `src` should be the largest rendition the CMS has (the original): the 1280 strip is 1216px
 *    wide, and next/image's `sizes` brings it down for the phone.
 *  - From 1280 the mosaic takes the body's right track (360 / 384): the side photos sit exactly
 *    over the right column (<DetailBody aside>), so the photos and the body read as one grid.
 * Put it in <DetailBand> BEFORE the header, with `className="md:order-1"`: it leads on the phone in
 * the DOM too (so Tab order follows what is seen — back, share, then the title), and from 768 the
 * order puts it under the title, where the reading order no longer starts with the photo controls.
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
  className?: string;
};

const SIZES_PHONE = '100vw';

/** The hero's height for `count` photos — the one rule the hero and its skeleton share. */
export function photoHeroHeight(count: number): string {
  if (count <= 0) return 'h-75 md:h-0';
  return count === 1 ? 'h-75 md:h-64 xl:h-72' : 'h-75 md:h-80 xl:h-90 2xl:h-100';
}

export function DetailPhotoHero({
  photos,
  emptyLabel = 'Nicio fotografie încă',
  label,
  topStart,
  topEnd,
  bottomStart,
  bottomEnd,
  className,
}: DetailPhotoHeroProps) {
  const list = photos;
  const shown = Math.min(list.length, 3);
  const grid =
    shown <= 1
      ? 'md:grid-cols-1'
      : cn(
          shown === 2 ? 'md:grid-cols-2' : 'md:grid-cols-[2fr_1fr] md:grid-rows-2',
          'xl:grid-cols-[minmax(0,1fr)_--spacing(90)] 2xl:grid-cols-[minmax(0,1fr)_--spacing(96)]',
        );
  const height = photoHeroHeight(shown);

  return (
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
            'md:grid md:gap-2 md:overflow-hidden md:rounded-bento',
            height,
            grid,
          )}
        >
          {list.map((photo, i) => (
            <li
              key={`${photo.src}-${i}`}
              className={cn(
                'relative h-full w-full shrink-0 snap-center bg-soft-fill',
                i >= 3 && 'md:hidden',
                shown >= 2 && i === 0 && 'md:row-span-2',
                shown === 2 && 'md:row-span-2',
              )}
            >
              <Image
                src={photo.src}
                alt={photo.alt ?? ''}
                fill
                // The lead photo is the LCP: preloaded. The other mosaic tiles are on the first screen
                // from 768 too: eager (not preloaded, so the phone carousel does not fetch them first).
                preload={i === 0}
                loading={i === 0 ? undefined : i < 3 ? 'eager' : 'lazy'}
                sizes={i === 0 ? `(min-width: 768px) ${shown <= 1 ? '100vw' : '66vw'}, ${SIZES_PHONE}` : `(min-width: 768px) 33vw, ${SIZES_PHONE}`}
                className="object-cover"
              />
            </li>
          ))}
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
      {bottomStart || bottomEnd ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 *:pointer-events-auto">
          {bottomStart ? <div>{bottomStart}</div> : null}
          {bottomEnd ? <div className="ml-auto">{bottomEnd}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

const PILL = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 t-label [&>svg]:size-6 [&>svg]:shrink-0';

/** The pill over a photo (fish photo-count pill): scrim, white, 36px, a 24px outline icon (Fundații §05), radius 999. */
export const PHOTO_PILL = `${PILL} bg-photo-scrim text-on-photo-scrim`;

/** The same pill over the no-photo placeholder (soft fill): the white surface with the e0 hairline, ink. */
export const SURFACE_PILL = `${PILL} bg-surface text-ink shadow-e0`;
