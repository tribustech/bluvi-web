'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import type { OwnedLake } from '@/core/booking';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { LAKE_COVER_FALLBACK, lakeCardStats, lakeCover } from './model';

/** fish OwnedLakeCard GlassStat dots: amber «În așteptare», teal «Active». */
const DOT = { pending: 'bg-rating', active: 'bg-photo-dot-active' } as const;

/**
 * fish components/OwnedLakeCard.tsx — one owned lake on «Administrare lacuri»: the lake's cover photo
 * (the bundled lake when it has none, or when it fails to load) under a neutral dark scrim (c7), the
 * name on one line with a chevron, and three glass tiles pushed to the bottom (c8): amber dot +
 * pending, teal dot + active, today's cash to collect (ro-RO, «lei» its own smaller element — owner
 * rule 10). The whole card is ONE link named by the lake (c9): a stretched link on the name (the
 * tiles stay readable text, not part of the link's name), keyboard focus ringing the card.
 */
export function OwnedLakeCard({ lake }: { lake: OwnedLake }) {
  const s = lakeCardStats(lake);
  return (
    <article
      data-testid="owned-lake-card"
      className={cn(
        'group relative isolate flex min-h-37 w-full flex-col overflow-hidden rounded-card bg-navy shadow-e2 md:min-h-52',
        'motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.985]',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- CMS cover (any host, local CMS too) with a bundled fallback; decorative. */}
      <img
        src={lakeCover(lake)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(LAKE_COVER_FALLBACK)) e.currentTarget.src = LAKE_COVER_FALLBACK;
        }}
        className="absolute inset-0 z-behind size-full object-cover motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-[1.03]"
      />
      {/* Neutral dark scrim (fish: not indigo, so each lake's real colours show). */}
      <span aria-hidden className="absolute inset-0 z-behind bg-linear-to-b from-photo-scrim/55 via-photo-scrim/85 to-photo-scrim" />

      <div className="flex flex-1 flex-col gap-3.5 p-4 xl:p-5">
        <h2 className="flex min-w-0 items-center gap-2.5">
          <Link
            href={routes.operator(lake.documentId)}
            className={cn(
              'min-w-0 flex-1 truncate t-title2 text-on-photo-scrim outline-none',
              // The whole card is the link (c9); the ring follows the card's corners.
              'after:absolute after:inset-0 after:z-above after:rounded-card focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent',
            )}
          >
            {lake.name}
          </Link>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-on-photo-scrim/85 motion-safe:transition-transform group-hover:translate-x-0.5" />
        </h2>

        <dl className="mt-auto grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-2.25">
          <GlassStat dot={DOT.pending} value={s.pending} label="În așteptare" />
          <GlassStat dot={DOT.active} value={s.active} label="Active" />
          <GlassStat value={s.cash} unit="lei" label="De încasat azi" />
        </dl>
      </div>
    </article>
  );
}

function GlassStat({ dot, value, unit, label }: { dot?: string; value: ReactNode; unit?: string; label: string }) {
  // dt before dd in the DOM (label, then value for a screen reader); the value reads first on screen.
  return (
    <div className="flex min-w-0 flex-col-reverse justify-end rounded-[13px] border border-on-photo-scrim/20 bg-photo-scrim/50 p-2.75 backdrop-blur-md xl:p-3">
      <dt className="mt-0.5 truncate t-micro text-on-photo-scrim/90 xl:t-caption">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-on-photo-scrim">
        {dot ? <span aria-hidden className={cn('size-1.75 shrink-0 self-center rounded-full', dot)} /> : null}
        <span className="min-w-0 t-num-18 break-all xl:t-stat xl:tabular-nums">{value}</span>
        {unit ? <span className="shrink-0 t-label text-on-photo-scrim/80">{unit}</span> : null}
      </dd>
    </div>
  );
}
