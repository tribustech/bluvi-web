'use client';

import Image from 'next/image';
import { useCallback, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import { PHOTO_CHIP } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { averageColor, blurDataUrl } from '@/lib/blurhash';
import type { GalleryImage } from './content';
import { NEWS_HERO_EMPTY_HEIGHT, NEWS_HERO_HEIGHT, NEWS_HERO_WIDE_HEIGHT, SPONSOR_HERO_EMPTY_HEIGHT, SPONSOR_HERO_HEIGHT } from './hero';
import { fillsFrame, ratioOf, stripRatio, WIDE_RATIO } from './imageSize';

/*
 * fish components/CarouselWithPagination.tsx inside ScreenWithFakeSheet — the article's (and the
 * sponsor's) header pictures:
 *  - a swipeable strip (scroll snap) with page dots over the bottom edge, the back chip floating
 *    over the top-left (phone; from 768 the breadcrumb band is the way back, as on every T3 page).
 *    The chip comes first in the DOM, so Tab reaches «Înapoi» before the strip (WCAG 2.4.3);
 *  - no picture: fish's grey header on the phone, at the loaded header's own height (300 / 224,
 *    so the skeleton does not jump) with the newspaper glyph; from 768 nothing (an empty slab would
 *    only push the article down — the T3 photo-hero rule). From 768 the skeleton still reserves the
 *    strip: most articles have a banner, so the rare one without takes the shift (deliberate);
 *  - each picture over its blurhash (fish expo-image `placeholder`).
 *
 * `variant="news"` (the article): phone full bleed, 300px, cover-cropped (fish 250 + the status
 * bar) — except a banner wider than 2:1, shown whole in a strip of its own ratio (≥ 200 high), as
 * a crop cut its text off. From 768 the strip is the top of the article card, sized from the FIRST
 * picture's own ratio (the server read its size: probe.ts) clamped to 4:3 … 4:1, 240 to 480 high,
 * so the strip hugs the banner. What is left over is a flat ground of the picture's own average
 * colour (its blurhash DC; the card's white without one) — not a blur, which turned white logos
 * and screenshots into grey haze.
 *
 * `variant="sponsor"` (a logo / sponsor artwork): one band of SPONSOR_HERO_HEIGHT (the skeleton
 * reads the same constant), on the white surface with a hairline under it from 768. Landscape
 * artwork from 4:3 to 2:1 (Acasă's tile rule) fills the phone band like fish and, from 768, sits at
 * the band's full height; a square or tall logo (or a thin strip) is contained with 24px of air —
 * on the phone 64px at the sides, clear of the 48px back chip and its 16px inset.
 *
 * Moving between pictures (chips, dots, arrow keys) scrolls smoothly unless the reader asked for
 * reduced motion (Fundații §06).
 */

export function Gallery({
  images,
  label,
  back,
  variant = 'news',
  sizes = '(min-width: 1440px) 1000px, (min-width: 1280px) 880px, (min-width: 768px) 720px, 100vw',
  className,
}: {
  /** The pictures, with their pixel size when the server could read it (probe.ts). */
  images: GalleryImage[];
  /** Name of the carousel: «Fotografii: <title>». */
  label: string;
  /** Phone only, over the top-left: the back chip (DetailBackButton). */
  back?: ReactNode;
  variant?: 'news' | 'sponsor';
  sizes?: string;
  className?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [active, setActive] = useState(0);
  const count = images.length;

  const go = useCallback((i: number) => {
    const el = strip.current;
    if (!el) return;
    const next = Math.max(0, Math.min(i, el.children.length - 1));
    el.scrollTo({ left: next * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    setActive(next);
  }, []);

  const backChip = back ? <div className="absolute top-4 left-4 z-above md:hidden">{back}</div> : null;

  const sponsor = variant === 'sponsor';

  if (count === 0) {
    return (
      <div data-gallery="empty" className={cn('relative md:hidden', className)}>
        {backChip}
        {/* pb-6: the glyph centres in what the sheet (lifted 24px over the header) leaves visible. */}
        <div
          aria-hidden
          className={cn('flex items-center justify-center bg-soft-fill pb-6 text-muted', sponsor ? SPONSOR_HERO_EMPTY_HEIGHT : NEWS_HERO_EMPTY_HEIGHT)}
        >
          <NewspaperIcon className="size-8" />
        </div>
      </div>
    );
  }

  const firstRatio = ratioOf(images[0]);
  const fills = sponsor && fillsFrame(firstRatio);
  const wide = !sponsor && firstRatio !== null && firstRatio > WIDE_RATIO;
  const stripStyle = sponsor ? undefined : ({ '--strip-ratio': String(stripRatio(firstRatio)) } as CSSProperties);

  return (
    <div
      role="region"
      aria-roledescription="carusel"
      aria-label={label}
      data-gallery={count}
      data-fit={sponsor ? (fills ? 'fill' : 'contain') : wide ? 'contain' : 'cover'}
      className={cn('relative', className)}
    >
      {backChip}
      {count > 1 ? (
        <span id={hintId} className="sr-only">
          Folosește săgețile stânga și dreapta pentru a trece la altă fotografie.
        </span>
      ) : null}
      <div
        ref={strip}
        // A scrollable strip is reachable by keyboard (axe scrollable-region-focusable): Tab lands on
        // it, ← / → move one picture (the dots and, from 768, the ‹ › chips do the same by pointer).
        // A named group (a generic div may not carry a name), the key hint as its description.
        role={count > 1 ? 'group' : undefined}
        aria-label={count > 1 ? 'Fotografii' : undefined}
        aria-describedby={count > 1 ? hintId : undefined}
        tabIndex={count > 1 ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(active + 1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(active - 1);
          }
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        style={stripStyle}
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]',
          'outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent',
          sponsor
            ? cn(SPONSOR_HERO_HEIGHT, 'bg-surface md:border-b md:border-hairline')
            : cn(wide ? NEWS_HERO_WIDE_HEIGHT : NEWS_HERO_HEIGHT, 'bg-surface'),
        )}
      >
        {images.map((img, i) => {
          const blur = blurDataUrl(img.blurhash);
          const placeholder = blur ? ({ placeholder: 'blur', blurDataURL: blur } as const) : {};
          const contained = sponsor && !fills;
          // The letterbox ground of a news picture: its own average colour (without a hash, the
          // card's white — most CMS artwork is a logo or a screenshot on white).
          const ground = sponsor ? undefined : averageColor(img.blurhash);
          return (
            <div
              key={`${img.src}-${i}`}
              role="group"
              aria-roledescription="diapozitiv"
              aria-label={`${i + 1} din ${count}`}
              aria-hidden={count > 1 && i !== active ? true : undefined}
              style={ground ? ({ '--letterbox': ground } as CSSProperties) : undefined}
              className={cn('relative h-full w-full shrink-0 snap-center overflow-hidden', ground && 'bg-(--letterbox)')}
            >
              <Image
                src={img.src}
                alt=""
                fill
                preload={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
                sizes={sizes}
                {...(contained ? {} : placeholder)}
                className={contained ? 'object-contain p-6 max-md:px-16' : wide ? 'object-contain' : 'object-cover md:object-contain'}
              />
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          {/* fish CarouselPagination: the dots ~22px above the sheet's top edge; 24px targets. */}
          <div className="absolute inset-x-0 bottom-9 flex justify-center md:bottom-4">
            <div className="flex items-center rounded-full bg-photo-scrim px-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Fotografia ${i + 1} din ${count}`}
                  aria-current={i === active ? 'true' : undefined}
                  onClick={() => go(i)}
                  className="flex size-6 items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'block size-1.75 rounded-full bg-on-photo-scrim transition-opacity duration-(--duration-fast)',
                      i === active ? 'opacity-100' : 'opacity-50',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          {/* The chip class is `relative`: the wrapper carries the position. */}
          <div className="absolute top-1/2 left-4 -translate-y-1/2 max-md:hidden">
            <button
              type="button"
              aria-label="Fotografia anterioară"
              disabled={active === 0}
              onClick={() => go(active - 1)}
              className={cn(PHOTO_CHIP, 'disabled:invisible')}
            >
              <ChevronLeftIcon aria-hidden />
            </button>
          </div>
          {/* The chip class is `relative`: the wrapper carries the position. */}
          <div className="absolute top-1/2 right-4 -translate-y-1/2 max-md:hidden">
            <button
              type="button"
              aria-label="Fotografia următoare"
              disabled={active === count - 1}
              onClick={() => go(active + 1)}
              className={cn(PHOTO_CHIP, 'disabled:invisible')}
            >
              <ChevronRightIcon aria-hidden />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
