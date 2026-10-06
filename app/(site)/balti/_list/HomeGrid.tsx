'use client';

import { ChevronRightIcon, MapIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { LINK_ACTION } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { getLakeLocationSubtitle, type LakeHomeSectionLake } from '@/core/lakes';
import { blurDataUrl } from '@/lib/blurhash';
import { routes } from '@/lib/routes';
import { track } from './analytics';
import type { HomeCategory } from './categories';
import { LAKE_GRID, LakeGridCard, LakeGridCardSkeleton } from './LakeGridCard';
import { lakeImage } from './lakeImage';

/*
 * The Bălți home on a desktop (owner rule 5, ROADMAP §4b, 2026-10-06): a row of icon categories
 * (Airbnb) under the search header, and ONE dense grid of listing cards that the picked category
 * filters in place. The phone keeps fish's rails while «Toate» is picked; a picked category shows
 * the same grid at every width.
 */

/* -------------------------------------------------------------------------------- categories */

/**
 * The icon category row: each chip is a toggle of the grid below (aria-pressed), the picked one
 * underlined in ink (Airbnb). One line; it scrolls sideways when the categories outgrow it, with
 * a fade on the edge that still has more.
 */
export function CategoryBar({
  categories,
  current,
  onPick,
}: {
  categories: HomeCategory[];
  current: string;
  onPick: (key: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const read = () => setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    read();
    el.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [categories.length]);

  if (categories.length < 2) return null;
  return (
    <div className="relative -mx-4 md:mx-0">
      <div
        ref={scroller}
        role="group"
        aria-label="Categorii"
        className="flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:gap-2 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => {
          const on = c.key === current;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(c.key)}
              className={cn(
                'group relative flex min-w-18 shrink-0 cursor-pointer flex-col items-center gap-1 px-2.5 pt-2 pb-2.5 md:min-w-20 md:px-3',
                'rounded-control transition-colors duration-(--duration-fast) ease-fast',
                'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                on ? 'text-ink' : 'text-muted hover:text-ink',
                // The underline: ink under the picked one, a hairline on hover.
                "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:content-['']",
                on ? 'after:bg-ink' : 'after:bg-transparent hover:after:bg-hairline',
              )}
            >
              <span aria-hidden className="flex size-6 items-center justify-center [&>svg]:size-6 [&>svg]:stroke-[1.5]">
                {c.icon}
              </span>
              <span className={cn('whitespace-nowrap t-caption', on ? 'font-semibold' : 'font-medium')}>{c.label}</span>
            </button>
          );
        })}
      </div>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-page to-transparent transition-opacity duration-(--duration-fast)',
          edges.start ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-page to-transparent transition-opacity duration-(--duration-fast)',
          edges.end ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------------- the grid */

export function HomeGrid({
  category,
  distanceOf,
  className,
}: {
  category: HomeCategory;
  /** «7.4 km» for a lake in the nearby set. */
  distanceOf: (lake: LakeHomeSectionLake) => string | null;
  className?: string;
}) {
  const id = `balti-grid-${category.key.replace(/[^a-z0-9-]/gi, '-')}`;
  const onClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as Element).closest('a[href]');
    const item = a?.closest<HTMLElement>('[data-lake-id]');
    if (!a || !item) return;
    track('lake_home_section_click', {
      section_key: category.key === 'all' ? 'all_lakes' : category.key,
      section_position: 0,
      item_position: Number(item.dataset.itemPosition),
      lake_id: item.dataset.lakeId,
    });
  };
  return (
    <section aria-labelledby={id} data-balti-grid={category.key} className={className}>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1 pb-4">
        <h2 id={id} className="t-title2 text-ink">
          {category.title}
        </h2>
        <Link href={category.mapHref} className={cn(LINK_ACTION, '-my-3 ml-auto gap-1.5')} aria-label={`Vezi pe hartă: ${category.title}`}>
          <MapIcon aria-hidden className="size-4.5 stroke-2" />
          {category.key === 'all' ? 'Vezi toate pe hartă' : 'Vezi pe hartă'}
          <ChevronRightIcon aria-hidden className="size-3.5 stroke-[2.5]" />
        </Link>
      </div>
      <ul className={LAKE_GRID} onClick={onClick}>
        {category.lakes.map((lake, i) => (
          <li key={lake.documentId} data-lake-id={lake.documentId} data-item-position={i + 1} className="min-w-0">
            <LakeGridCard lake={lake} distanceLabel={distanceOf(lake)} priority={i < 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The grid's bones: the heading line and two rows of cards (the final tracks). */
export function HomeGridSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <div className="flex items-end gap-3 pb-4">
        <span className="h-6 w-44 animate-shimmer rounded-full" />
      </div>
      <div className={LAKE_GRID}>
        {Array.from({ length: 8 }, (_, i) => (
          <LakeGridCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------- recently viewed */

/**
 * «Vizualizate recent» on a desktop: compact — a strip of small items (thumbnail, name, place),
 * never a rail of big cards that a single lake leaves 80% empty (rule 5).
 */
export function RecentStrip({ lakes, className }: { lakes: LakeHomeSectionLake[]; className?: string }) {
  const shown = lakes.slice(0, 8);
  return (
    <section aria-labelledby="balti-recent-title" className={className}>
      <div className="pb-3">
        <h2 id="balti-recent-title" className="t-heading text-ink">
          Vizualizate recent
        </h2>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3">
        {shown.map((lake) => {
          const image = lakeImage(lake);
          const place = getLakeLocationSubtitle(
            { county: lake.county ?? null, countyRef: lake.countyRef ?? null, cityRef: lake.cityRef ?? null },
            { includeAddress: false },
          );
          return (
            <li key={lake.documentId} className="min-w-0">
              <Link
                href={routes.lake(lake.documentId)}
                className={cn(
                  'flex items-center gap-3 rounded-card bg-surface p-2 pr-3 shadow-e0',
                  'transition-shadow duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-avatar bg-soft-fill">
                  {image ? (
                    <Image
                      src={image.src}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                      {...(image.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(image.blurhash) } : {})}
                    />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate t-body-strong text-ink">{lake.name}</span>
                  <span className="truncate t-caption text-ink-2">{place}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The category row's bones (first paint): the same box, so the grid under it does not move. */
export function CategoryBarSkeleton() {
  return (
    <div aria-hidden className="-mx-4 flex gap-1 overflow-hidden px-4 md:mx-0 md:gap-2 md:px-0">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className="flex min-w-18 shrink-0 flex-col items-center gap-1 px-2.5 pt-2 pb-2.5 md:min-w-20 md:px-3">
          <span className="size-6 animate-shimmer rounded-full" />
          <span className="h-4 w-12 animate-shimmer rounded-full" />
        </span>
      ))}
    </div>
  );
}
