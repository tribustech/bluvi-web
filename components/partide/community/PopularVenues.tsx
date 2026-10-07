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
 * partide.comunitate.c21): the top two venues side by side — photo (lake placeholder), the live
 * pill «N live» when partide run there now, the name, «localitate · N partide» (last 30 days,
 * formatCount). Only a venue that is a lake opens a page (/balti/[id]).
 */
export function PopularVenues({ venues }: { venues: CommunityPopularVenueDTO[] }) {
  const top = venues.slice(0, 2);
  if (top.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-3" data-testid="popular-venues">
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
      <span className="relative block h-19.5 shrink-0 bg-soft-fill">
        <Photo src={venue.imageUrl} />
        {venue.liveCount > 0 ? (
          <span className="absolute top-2 left-2">
            <Pill tone="live">{venue.liveCount} live</Pill>
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col gap-1.25 p-2.75">
        <span className="truncate t-body-strong text-ink">{venue.name}</span>
        <span className="flex min-w-0 items-center gap-1 text-muted">
          <MapPinIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate t-micro">{meta}</span>
        </span>
      </span>
    </>
  );
  const cls = 'flex w-full flex-col overflow-hidden rounded-card bg-surface shadow-e0';
  return href ? (
    <Link href={href} className={cn(cls, FOCUS, 'transition-shadow hover:shadow-[var(--shadow-e2),var(--shadow-e0)]')} data-testid="popular-venue">
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid="popular-venue">
      {body}
    </div>
  );
}
