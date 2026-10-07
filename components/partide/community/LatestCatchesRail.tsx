'use client';

import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { fmtKg, gridSource, relativeRo, type CommunityCatchDTO } from '@/core/partide';
import { cn } from '@/components/ui/cn';
import { partideHrefs } from '@/lib/partide-pages';
import { AnglerAvatars, FOCUS, Photo } from './parts';

/**
 * fish features/partide/components/community/LatestCatchesRail.tsx — «Ultimele capturi» (parity
 * partide.comunitate.c7, c8): landscape photo cards with the caption ON the photo (a scrim at the
 * bottom), the relative time on a light chip, the weight with its own unit (none when unweighed —
 * never «0,0 kg»), the species («Captură»), the venue and the angler's faces. A card opens the
 * catch's partidă (lib/partide-pages: plain while that page is off). Keys are
 * `sessionDocumentId:clientId` — a clientId alone repeats across sessions.
 *
 * Layout (owner rule 5): on a phone fish's edge-bleed rail of 250px cards. From 768 the cards share
 * the column's row — three to a row, wider when there are fewer (the row is always filled, never a
 * near-empty rail); with more than a row's worth the rest scrolls on, still a rail that fills a row.
 */
export function LatestCatchesRail({ catches, now }: { catches: CommunityCatchDTO[]; now: number | null }) {
  return (
    <ul
      className={cn(
        // Phone: fixed 250 cards, bleeding to the screen edges (the gutter returned as padding).
        '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]',
        // From 768: a row of thirds that grows to fill, the overflow scrolling on.
        'md:mx-0 md:grid md:snap-none md:auto-cols-[minmax(calc((100%_-_2*--spacing(3))/3),1fr)] md:grid-flow-col md:px-0',
      )}
      aria-label="Ultimele capturi"
      data-testid="catches-rail"
    >
      {catches.map(item => (
        <li key={`${item.sessionDocumentId}:${item.clientId}`} className="w-62.5 shrink-0 snap-start md:w-auto" data-testid="catch-card">
          <CatchCard item={item} now={now} />
        </li>
      ))}
    </ul>
  );
}

function CatchCard({ item, now }: { item: CommunityCatchDTO; now: number | null }) {
  const href = partideHrefs.partida(item.sessionDocumentId);
  const species = item.species ?? 'Captură';
  const label = [item.weightKg != null ? `${fmtKg(item.weightKg)} kg` : null, species, item.venueName, item.angler.name].filter(Boolean).join(', ');
  const body = (
    <>
      <span className="absolute inset-0">
        <Photo src={gridSource(item)} className="transition-transform duration-(--duration-slow) group-hover:scale-[1.03]" />
      </span>
      {now != null ? (
        <span className="absolute top-2.25 left-2.25 rounded-badge bg-photo-chip px-1.75 py-1 t-micro-strong text-ink" data-visual-mask>
          {relativeRo(now, item.occurredAt)}
        </span>
      ) : null}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-photo-scrim to-transparent" />
      <span className="absolute inset-x-3 bottom-2.75 flex items-end justify-between gap-2 text-on-photo-scrim">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-1">
            {item.weightKg != null ? (
              <>
                <span className="shrink-0 t-title1">{fmtKg(item.weightKg)}</span>
                <span className="shrink-0 t-micro-strong">kg</span>
              </>
            ) : null}
            <span className={cn('min-w-0 truncate t-label', item.weightKg != null && 'ml-0.5')}>{species}</span>
          </span>
          <span className="mt-1 flex min-w-0 items-center gap-1.25">
            <MapPinIcon aria-hidden className="size-3 shrink-0" />
            <span className="truncate t-micro">{item.venueName}</span>
          </span>
        </span>
        <AnglerAvatars angler={item.angler} extraMembers={item.extraMembers} />
      </span>
    </>
  );
  const cls = 'group relative block h-47 overflow-hidden rounded-card bg-soft-fill shadow-e1 md:h-52';
  return href ? (
    <Link href={href} aria-label={`Deschide partida: ${label}`} className={cn(cls, FOCUS)}>
      {body}
    </Link>
  ) : (
    <div className={cls} role="group" aria-label={label}>
      {body}
    </div>
  );
}
