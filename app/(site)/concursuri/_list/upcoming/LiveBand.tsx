'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { LiveDot } from '@/components/templates/LiveDot';
import { cn } from '@/components/ui/cn';
import { formatCount, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { posterOf } from '../cards/parts';
import s from './upcoming.module.css';

/*
 * «N concursuri live acum» (prototype app/dev/hub Upcoming.tsx LiveBand): the slim navy band over
 * Viitoare that says what is live right now, one press away from the Live tab. Shown only when
 * something is live (the Live list's counts, the same cached read the tabs use). The prototype's
 * per-competition hue dots are the posters here — the poster is the competition's identifier.
 */

const FACES = 5;

export function LiveBand({ count, cards, onPress }: { count: number; cards: CompetitionCard[]; onPress?: () => void }) {
  if (count <= 0) return null;
  const shown = cards.slice(0, FACES);
  return (
    <Link
      href={routes.competitions('started')}
      onClick={onPress}
      data-live-band=""
      className={cn(
        s.lift,
        'flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-navy px-4 py-3 text-start xl:px-5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <span className="flex items-center gap-2 t-body-strong text-on-bento-indigo">
        <LiveDot tone="on-accent" size="md" />
        {formatCount(count, 'concurs live acum', 'concursuri live acum')}
      </span>
      {shown.length ? (
        <span className="flex items-center" aria-hidden>
          {shown.map((c, i) => {
            const thumb = posterOf(c).thumb;
            return (
              <span key={c.documentId} className={cn('relative size-6 shrink-0 overflow-hidden rounded-full bg-lavender ring-2 ring-navy', i > 0 && '-ml-1.5')}>
                {thumb ? <Image src={thumb} alt="" fill sizes="24px" className="object-cover" /> : null}
              </span>
            );
          })}
        </span>
      ) : null}
      <span className="hidden min-w-0 flex-1 truncate t-caption text-lavender-2 md:block">{cards.map((c) => c.name).join(' · ')}</span>
      <span className="ms-auto flex items-center gap-1 t-label text-lavender">
        Vezi live <ArrowRightIcon className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
