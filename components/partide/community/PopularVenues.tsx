'use client';

import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { CommunityPopularVenueDTO } from '@/core/partide';
import { Pill } from '@/components/cards/parts';
import { cn } from '@/components/ui/cn';
import { popularVenueMeta } from '@/lib/partide-community';
import { routes } from '@/lib/routes';
import { FOCUS, Photo } from './parts';

/**
 * fish features/partide/components/community/PopularVenues.tsx — «Locuri populare» (parity
 * partide.comunitate.c21): photo (lake placeholder), the live pill «N live» when partide run there
 * now, the name, «localitate · N partide» (last 30 days, formatCount). Only a venue that is a lake
 * opens a page (/balti/[id]).
 *
 * Phone: fish's top two side by side, a card each. From 768 the Bălți grid card's look (owner
 * 2026-10-18: «nu arată ca bălțile noastre frumoase» — LakeGridCard: a rounded 4:3 photo, the text
 * under it, no card box), four to a row: every venue the overview returns (up to four).
 */
export function PopularVenues({ venues }: { venues: CommunityPopularVenueDTO[] }) {
  const top = venues.slice(0, 4);
  if (top.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 max-md:[&>li:nth-child(n+3)]:hidden md:grid-cols-4 md:gap-x-5 md:gap-y-8" data-testid="popular-venues">
      {top.map(v => (
        <li key={v.key} className="flex">
          <VenueCard venue={v} />
        </li>
      ))}
    </ul>
  );
}

function VenueCard({ venue }: { venue: CommunityPopularVenueDTO }) {
  const href = venue.lakeId ? routes.lake(venue.lakeId) : null;
  const meta = popularVenueMeta(venue.locality, venue.sessionsLast30d);
  const body = (
    <>
      <span className="relative block h-19.5 shrink-0 overflow-hidden bg-soft-fill md:aspect-4/3 md:h-auto md:rounded-card">
        <Photo src={venue.imageUrl} className="transition-transform duration-(--duration-slow) md:group-hover:scale-[1.03]" />
        {venue.liveCount > 0 ? (
          <span className="absolute top-2 left-2 md:top-2.5 md:left-2.5">
            <Pill tone="live">{venue.liveCount} live</Pill>
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1.25 p-2.75 md:gap-0.5 md:p-0">
        <span className="truncate t-body-strong text-ink">{venue.name}</span>
        <span className="flex min-w-0 items-center gap-1 text-muted md:text-ink-2">
          <MapPinIcon aria-hidden className="size-3 shrink-0 md:hidden" />
          <span className="truncate t-micro md:t-body">{meta}</span>
        </span>
      </span>
    </>
  );
  // Phone: fish's white card. From 768 no box: the photo and the text under it (LakeGridCard).
  const cls = 'group flex w-full flex-col overflow-hidden rounded-card bg-surface shadow-e0 md:gap-2.5 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none';
  return href ? (
    <Link href={href} className={cn(cls, FOCUS, 'transition-shadow max-md:hover:shadow-[var(--shadow-e2),var(--shadow-e0)]')} data-testid="popular-venue">
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid="popular-venue">
      {body}
    </div>
  );
}
