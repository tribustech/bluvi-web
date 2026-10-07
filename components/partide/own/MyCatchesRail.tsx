'use client';

import { useContext, useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { RailRegistry, useRailEdges } from '@/app/(site)/_home/HorizontalRail';
import { FOCUS, Photo } from '@/components/partide/community/parts';
import { cn } from '@/components/ui/cn';
import { fmtKg, relativeRo } from '@/core/partide';
import type { AnglerCatch } from '@/core/social';

/** fish RAIL_LIMIT: the rail shows at most 12 photos; the full set is one tap away («Vezi tot»). */
export const MY_CATCHES_RAIL_LIMIT = 12;

/**
 * fish features/partide/components/MyCatchesRail.tsx — «Capturile mele» on Ale mele (parity
 * partide.ale-mele.c8–c10): MY catch photos from /feed/sessions/mine/catches, the same landscape
 * frame as the community rail (caption ON the photo: the relative time on a light chip, the kg with
 * its own unit — none when unweighed —, the species («Captură»), the venue), at most 12 of them,
 * then the «Vezi tot» tail card → /partide/capturile-mele (left out while that page is not on the
 * web, lib/partide-pages). A card opens the lightbox in place at its index (no navigation).
 *
 * Layout (owner rule 5): on a phone fish's edge-bleed rail of 250px cards. From 768 the cards keep
 * a third of the column (a quarter from a 1024px column), so a short set reads as compact cards
 * rather than a near-empty rail stretched across the page, and a long one fills the row and
 * scrolls on. The scrollbar is hidden, so with a mouse (fine pointer, from 768) the rail registers
 * with a RailRegistry provider (the section header renders Acasă's RailArrows from it): previous /
 * next, a page at a time, shown only while the rail overflows. Touch keeps fish's swipe.
 */
export function MyCatchesRail({
  catches,
  now,
  onOpen,
  seeAllHref,
}: {
  catches: AnglerCatch[];
  now: number | null;
  onOpen: (index: number) => void;
  seeAllHref: string | null;
}) {
  const shown = catches.slice(0, MY_CATCHES_RAIL_LIMIT);
  const scroller = useRef<HTMLUListElement>(null);
  const listId = useId();
  const edges = useRailEdges(scroller);
  const register = useContext(RailRegistry);
  useEffect(() => {
    register?.({ scroller, controls: listId, label: 'Capturile mele', edges });
  }, [register, listId, edges]);
  useEffect(() => () => register?.(null), [register]);
  return (
    <ul
      ref={scroller}
      id={listId}
      className={cn(
        '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]',
        'md:mx-0 md:grid md:snap-none md:grid-flow-col md:auto-cols-[calc((100%_-_2*--spacing(3))/3)] md:px-0',
        '@5xl:auto-cols-[calc((100%_-_3*--spacing(3))/4)]',
      )}
      aria-label="Capturile mele"
      data-testid="my-catches-rail"
    >
      {shown.map((item, index) => (
        <li key={item.key} className="w-62.5 shrink-0 snap-start md:w-auto" data-testid="my-catch-card">
          <CatchCard item={item} now={now} onOpen={() => onOpen(index)} />
        </li>
      ))}
      {seeAllHref ? (
        <li className="w-33 shrink-0 snap-start md:w-auto">
          <SeeAllCard href={seeAllHref} />
        </li>
      ) : null}
    </ul>
  );
}

function CatchCard({ item, now, onOpen }: { item: AnglerCatch; now: number | null; onOpen: () => void }) {
  const species = item.species ?? 'Captură';
  const label = [item.weightKg != null ? `${fmtKg(item.weightKg)} kg` : null, species, item.venueName].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Deschide fotografia: ${label}`}
      className={cn('group relative block h-47 w-full cursor-pointer overflow-hidden rounded-card bg-soft-fill text-left shadow-e1 md:h-52', FOCUS)}
    >
      <span className="absolute inset-0">
        <Photo src={item.photoGridUrl ?? item.photoUrl} className="transition-transform duration-(--duration-slow) group-hover:scale-[1.03]" />
      </span>
      {now != null ? (
        <span className="absolute top-2.25 left-2.25 rounded-badge bg-photo-chip px-1.75 py-1 t-micro-strong text-ink" data-visual-mask>
          {relativeRo(now, item.date)}
        </span>
      ) : null}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-photo-scrim to-transparent" />
      <span className="absolute inset-x-3 bottom-2.75 flex min-w-0 flex-col text-on-photo-scrim">
        <span className="flex min-w-0 items-baseline gap-1">
          {item.weightKg != null ? (
            <>
              <span className="shrink-0 t-title1">{fmtKg(item.weightKg)}</span>
              <span className="shrink-0 t-micro-strong">kg</span>
            </>
          ) : null}
          <span className={cn('min-w-0 truncate t-label', item.weightKg != null && 'ml-0.5')}>{species}</span>
        </span>
        {item.venueName ? (
          <span className="mt-1 flex min-w-0 items-center gap-1.25">
            <MapPinIcon aria-hidden className="size-3 shrink-0" />
            <span className="truncate t-micro">{item.venueName}</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** fish SeeAllCard — «Vezi tot» / «capturile mele» (no count: the feed is cursor-paginated). */
function SeeAllCard({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex h-47 flex-col items-center justify-center gap-2.5 rounded-card bg-surface px-3 text-center shadow-e1 transition-colors duration-(--duration-fast) hover:bg-soft-fill md:h-52',
        FOCUS,
      )}
      data-testid="my-catches-see-all"
    >
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
        <ArrowRightIcon className="size-5" />
      </span>
      <span className="t-label text-ink">Vezi tot</span>
      <span className="t-micro text-muted">capturile mele</span>
    </Link>
  );
}
