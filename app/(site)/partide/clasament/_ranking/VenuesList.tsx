'use client';

import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { formatCount, pluralNoun } from '@/core/realtime/chat/format';
import type { TopVenue } from '@/core/partide';
import { routes } from '@/lib/routes';
import { PlaceCell, ROW_LINK, rowClick, TABLE_CARD, TableNote, Td, Th } from './table';

/*
 * «Bălți» (partide.clasament c5; fish VenueRow): the period's venues ranked — the image (fish's
 * placeholder lake when none), the name, «{localitate} · {n} partide» and «{n} capturi». A venue
 * that is a lake (lakeId) opens the lake page; a public water or a pin is a plain row (fish
 * onOpen undefined). Phone: name over the locality line, the catches on the right; from 768 the
 * locality, the partide and the catches are columns of their own. Empty: fish's line.
 */

const PLACEHOLDER = '/images/placeholder-lake.jpg';

/**
 * The «de » between a figure and its noun when the figure is printed apart (bold) from the noun:
 * formatCount's rule — from 20, unless the last two digits are 1–19 («40 de capturi», «101 capturi»).
 */
function deOf(count: number): string {
  const lastTwo = count % 100;
  return count >= 20 && (lastTwo === 0 || lastTwo >= 20) ? 'de ' : '';
}

export function VenuesList({ venues }: { venues: TopVenue[] }) {
  if (!venues.length) return <TableNote testId="venues-empty">Nicio baltă cu partide în această perioadă.</TableNote>;
  return (
    <div className={TABLE_CARD}>
      <table className="w-full border-separate border-spacing-0 t-table" data-testid="venue-rows">
        <caption className="sr-only">Bălți</caption>
        <thead>
          <tr>
            <Th className="text-center">Loc</Th>
            <Th>Baltă</Th>
            <Th className="max-md:hidden">Localitate</Th>
            <Th num className="max-md:hidden">
              Partide
            </Th>
            <Th num>Capturi</Th>
          </tr>
        </thead>
        <tbody>
          {venues.map((v, i) => {
            const href = v.lakeId ? routes.lake(v.lakeId) : null;
            const line = [v.locality, formatCount(v.partide, 'partidă', 'partide')].filter(Boolean).join(' · ');
            return (
              <tr key={v.key} onClick={href ? rowClick : undefined} className={cn(href && 'cursor-pointer transition-colors duration-(--duration-fast) hover:bg-soft-fill')}>
                <PlaceCell rank={i + 1} />
                <Td className="max-w-0 w-full">
                  <span className="flex min-w-0 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- CMS thumbnail at 32px. */}
                    <img src={v.imageUrl || PLACEHOLDER} alt="" loading="lazy" decoding="async" className="size-8 shrink-0 rounded-control bg-soft-fill object-cover" onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                    <span className="flex min-w-0 flex-col">
                      {href ? (
                        <Link href={href} data-row-link className={cn('truncate t-body-strong text-ink', ROW_LINK)}>
                          {v.name}
                        </Link>
                      ) : (
                        <span className="truncate t-body-strong text-ink">{v.name}</span>
                      )}
                      <span className="truncate t-caption text-muted md:hidden">{line}</span>
                    </span>
                  </span>
                </Td>
                <Td className="t-body whitespace-nowrap text-ink-2 max-md:hidden">{v.locality ?? '—'}</Td>
                <Td num className="t-body text-ink-2 max-md:hidden">
                  {v.partide.toLocaleString('ro-RO')}
                </Td>
                <Td num>
                  <span className="t-body-strong text-ink">{v.catches.toLocaleString('ro-RO')}</span>
                  <span className="ml-1 t-micro text-muted md:hidden">
                    {deOf(v.catches)}
                    {pluralNoun(v.catches, 'captură', 'capturi')}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
