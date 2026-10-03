'use client';

import { useId, useMemo, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { getSponsors } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { RailArrows } from './HorizontalRail';
import { homeLinks } from './links';
import { homeSponsorsQuery } from './queries';

type Sponsor = NonNullable<Awaited<ReturnType<typeof getSponsors>>>['data'][number];

/**
 * fish (tabs)/index.tsx «Sponsori»: shown only when there is at least one; 245×150 logos. Rendered
 * inside a <Suspense> whose fallback is SponsorsView from the server's data.
 */
export function SponsorsSection({ layout }: { layout: 'mobile' | 'desktop' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useQuery(homeSponsorsQuery(t));
  return <SponsorsView layout={layout} sponsors={data?.data ?? []} />;
}

/** The markup of the section, from data alone (no query, no clock). */
export function SponsorsView({ layout, sponsors }: { layout: 'mobile' | 'desktop'; sponsors: Sponsor[] }) {
  const scroller = useRef<HTMLUListElement>(null);
  const listId = useId();
  if (sponsors.length === 0) return null;

  return (
    <section aria-labelledby={`acasa-sponsori-${layout}`} className="flex flex-col gap-2.5">
      <h2 id={`acasa-sponsori-${layout}`} className="t-title1 xl:t-title2">
        Sponsori
      </h2>
      <div className="relative">
      <ul
        ref={scroller}
        id={listId}
        aria-label="Sponsori"
        className="-mx-5 flex snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 md:-mx-6 md:scroll-px-6 md:px-6 xl:mx-0 xl:scroll-px-0 xl:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sponsors.map((s) => {
          const src = s.image?.smallUrl ?? s.image?.url ?? null;
          return (
            <li key={s.documentId} className="shrink-0 snap-start">
              <Link
                href={homeLinks.sponsor(s.documentId)}
                className="relative block h-[150px] w-[245px] overflow-hidden rounded-control bg-surface shadow-e0"
              >
                {src ? <Image src={src} alt={s.name} fill sizes="245px" className="object-cover" /> : <span className="p-3 t-body-strong">{s.name}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <RailArrows scroller={scroller} controls={listId} label="Sponsori" className="top-1/2" />
      </div>
    </section>
  );
}
