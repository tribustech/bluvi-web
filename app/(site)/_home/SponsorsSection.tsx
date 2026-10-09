'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { analyticsAttrs } from '@/components/analytics/attrs';
import { useQuery } from '@tanstack/react-query';
import type { getSponsors } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { cn } from '@/components/ui/cn';
import { DashboardSection } from '@/components/templates/T5';
import { homeLinks } from './links';
import { homeSponsorsQuery } from './queries';
import { SPONSOR_CHIP, SPONSOR_STRIP } from './sponsorStrip';

type Sponsor = NonNullable<Awaited<ReturnType<typeof getSponsors>>>['data'][number];

/**
 * fish (tabs)/index.tsx «Sponsori»: shown only when there is at least one; a tap opens the sponsor
 * (and logs fish's `sponsor_dashboard` through data-analytics-*, components/analytics). Rendered inside a <Suspense> whose fallback
 * is SponsorsView from the server's data.
 *
 * Web difference: fish's 245×150 tiles made a third rail of big cards here. The web shows a compact
 * logo strip — small chips of one fixed size, every logo the same way (contained on the surface) —
 * owner rule 5 (ROADMAP §4b: at most two rails per page, no sparse carousels). Sponsori has no list
 * page, so the header has no «Vezi toate» and no arrows: below 768 the strip scrolls sideways
 * (bleeding to the screen edge, as the rails); from 768 it wraps.
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
    <DashboardSection variant="plain" title="Sponsori">
      {/* pb-4 is the chips' shadow room; -mb-3 gives it back (the column's own rhythm). */}
      <ul aria-label="Sponsori" className={cn(SPONSOR_STRIP, '-mb-3')}>
        {sponsors.map((s) => (
          <li key={s.documentId} className="shrink-0">
            <SponsorChip sponsor={s} />
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}

/**
 * One chip, the CardShell interaction (e2 lift on hover, .7 pressed), on the surface with the e0
 * hairline. Every logo is contained with the same inset — banner artwork and square marks alike —
 * so no chip is a full-bleed slab beside white ones.
 */
function SponsorChip({ sponsor: s }: { sponsor: Sponsor }) {
  const src = s.image?.smallUrl ?? s.image?.url ?? null;
  return (
    <Link
      href={homeLinks.sponsor(s.documentId)}
      {...analyticsAttrs('sponsor_dashboard', { sponsor_id: s.documentId, sponsor_name: s.name, sponsor_url: s.url })}
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-card bg-surface px-3 shadow-e0 transition-[box-shadow,opacity] duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] active:opacity-70',
        SPONSOR_CHIP
      )}
    >
      {src ? (
        <Image src={src} alt={s.name} fill sizes="160px" className="object-contain p-2.5" />
      ) : (
        <span className="line-clamp-2 text-center t-caption text-ink">{s.name}</span>
      )}
    </Link>
  );
}
