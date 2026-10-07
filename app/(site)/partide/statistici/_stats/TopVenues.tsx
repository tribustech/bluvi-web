'use client';

import Link from 'next/link';
import { Pill } from '@/components/cards/parts';
import { DashboardSection } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import type { TopVenue } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { routes } from '@/lib/routes';
import { FOCUS, Photo } from '@/components/partide/community/parts';

/*
 * «Top bălți» — fish statistici.tsx TopVenueRow (parity partide.statistici.c8): the period's top 5
 * venues, each the photo (fish's lake placeholder when it has none or it fails), the name,
 * «{localitate} · {n} partidă/partide» and on the right the rose «{n} LIVE» pill while partide run
 * there now, else «{n} captură/capturi». Only a venue that is a lake opens a page (/balti/[id]);
 * a public water or a manual pin is a plain row, as in fish.
 */

const TOP = 5;

export function TopVenues({ venues, className }: { venues: TopVenue[]; className?: string }) {
  return (
    <DashboardSection className={className} title="Top bălți" flush>
      <ol aria-label="Top bălți" className="divide-y divide-hairline border-t border-hairline" data-testid="top-venues">
        {venues.slice(0, TOP).map((v) => (
          <li key={v.key} data-testid="top-venue">
            <VenueRow venue={v} />
          </li>
        ))}
      </ol>
    </DashboardSection>
  );
}

function VenueRow({ venue }: { venue: TopVenue }) {
  const meta = [venue.locality, formatCount(venue.partide, 'partidă', 'partide')].filter(Boolean).join(' · ');
  const body = (
    <>
      <span className="relative block size-10 shrink-0 overflow-hidden rounded-control bg-soft-fill">
        <Photo src={venue.imageUrl} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate t-body-strong text-ink">{venue.name}</span>
        <span className="t-caption text-muted">{meta}</span>
      </span>
      {venue.liveCount > 0 ? (
        <Pill tone="live">{venue.liveCount} LIVE</Pill>
      ) : (
        <span className="shrink-0 t-caption text-muted tabular-nums">{formatCount(venue.catches, 'captură', 'capturi')}</span>
      )}
    </>
  );
  const cls = 'flex min-h-14 items-center gap-3 px-4.5 py-3';
  return venue.lakeId ? (
    <Link href={routes.lake(venue.lakeId)} className={cn(cls, FOCUS, 'focus-visible:-outline-offset-2 transition-colors hover:bg-soft-fill')} data-testid="top-venue-link">
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
