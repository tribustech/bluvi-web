'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { getSponsors } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { cn } from '@/components/ui/cn';
import { HorizontalRail, RailItem } from './HorizontalRail';
import { RailSection } from './RailSection';
import { homeLinks } from './links';
import { homeSponsorsQuery } from './queries';

type Sponsor = NonNullable<Awaited<ReturnType<typeof getSponsors>>>['data'][number];

/**
 * fish (tabs)/index.tsx «Sponsori»: shown only when there is at least one; fish's 245×150 logo tiles
 * as the 1.6:1 frame (8:5) on the rails' 224 slot and track grid (HorizontalRail — the same rule as
 * every rail of the column). A tap opens the sponsor (fish also logs `sponsor_dashboard`: GA4 lands
 * in M8). Rendered inside a <Suspense> whose fallback is SponsorsView from the server's data.
 */
export function SponsorsSection() {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useQuery(homeSponsorsQuery(t));
  return <SponsorsView sponsors={data?.data ?? []} />;
}

/** The markup of the section, from data alone (no query, no clock). */
export function SponsorsView({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;
  return (
    <RailSection title="Sponsori">
      <HorizontalRail label="Sponsori" width={224}>
        {sponsors.map((s) => (
          <RailItem key={s.documentId} width={224}>
            <SponsorTile sponsor={s} />
          </RailItem>
        ))}
      </HorizontalRail>
    </RailSection>
  );
}

/** Landscape artwork from 4:3 to 2:1 fills the 8:5 frame (a few px of crop on a banner is fine). */
const FILL_MIN = 4 / 3;
const FILL_MAX = 2;

/**
 * One tile, the CardShell interaction (e2 lift on hover, .7 pressed), on the surface with the e0
 * hairline at every width. Landscape artwork (its ratio known once it loads) fills the frame edge
 * to edge. A square or tall logo sits centred with air around it (`contain`, p-6) on the same
 * white: most logos ship on their own opaque white, which then melts into the tile instead of
 * reading as a white card inside a tinted one.
 */
function SponsorTile({ sponsor: s }: { sponsor: Sponsor }) {
  const src = s.image?.smallUrl ?? s.image?.url ?? null;
  const [fills, setFills] = useState(false);
  return (
    <Link
      href={homeLinks.sponsor(s.documentId)}
      className={cn(
        'relative flex aspect-8/5 w-full items-center justify-center overflow-hidden rounded-card bg-surface shadow-e0 transition-[box-shadow,opacity] duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] active:opacity-70'
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={s.name}
          fill
          sizes="(min-width: 768px) 304px, 224px"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalHeight === 0) return;
            const ratio = img.naturalWidth / img.naturalHeight;
            setFills(ratio >= FILL_MIN && ratio <= FILL_MAX);
          }}
          className={cn(fills ? 'object-cover' : 'object-contain p-6')}
        />
      ) : (
        <span className="p-3 text-center t-body-strong text-ink">{s.name}</span>
      )}
    </Link>
  );
}
