'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/components/ui/cn';
import type { CompetitionCard } from '@/core/competitions';
import { PosterCard, posterItemClass } from '../cards/PosterCard';
import type { PhotoRequest } from '../cards/parts';
import { PAST_GROUP, upcomingGroups } from './buckets';

/*
 * Viitoare's list (prototype app/dev/hub Upcoming.tsx): fish's poster cards with fish's upcoming
 * footer (faces, N/M, «N în așteptare», places left), grouped on the time axis — Azi · Mâine ·
 * Săptămâna asta · Weekendul ăsta · Săptămâna viitoare · by month — the passed starts last, muted.
 * Inside a group: the viewer's registrations first, then by start time (./buckets).
 *
 * From 1280 the groups share rows: a group spans as many of the grid's columns as it has cards
 * (3 from 1280, 4 from 1800 — the page's poster grid), so «Azi» (1) and «Mâine» (2) sit side by side
 * instead of leaving near-empty rows (§4b.5). Every group's own grid keeps the outer columns and
 * gutter, so the cards line up across groups.
 */

const SPAN_XL = { 1: 'xl:col-span-1', 2: 'xl:col-span-2', 3: 'xl:col-span-3' } as const;
const COLS_XL = { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3' } as const;
const SPAN_WIDE = { 1: 'min-[1800px]:col-span-1', 2: 'min-[1800px]:col-span-2', 3: 'min-[1800px]:col-span-3', 4: 'min-[1800px]:col-span-4' } as const;
const COLS_WIDE = {
  1: 'min-[1800px]:grid-cols-1',
  2: 'min-[1800px]:grid-cols-2',
  3: 'min-[1800px]:grid-cols-3',
  4: 'min-[1800px]:grid-cols-4',
} as const;

const groupId = (key: string) => `viitoare-${key}`;

export function UpcomingGroups({
  cards,
  mine,
  onOpenPhoto,
  priorityCount,
  at,
}: {
  cards: CompetitionCard[];
  mine: ReadonlySet<string>;
  onOpenPhoto: (photo: PhotoRequest) => void;
  priorityCount: number;
  /** The clock to group on (ms); the static shell passes its cached one. Default: mount time. */
  at?: number;
}) {
  // The visit's clock: the groups do not reshuffle under the reader while the page stays open.
  const [now] = useState(() => new Date(at ?? Date.now()));
  const groups = useMemo(() => upcomingGroups(cards, now, mine), [cards, now, mine]);
  let index = 0;
  return (
    <div data-upcoming-groups="" className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-8 xl:grid-cols-3 xl:gap-y-10 min-[1800px]:grid-cols-4">
      {groups.map((g) => {
        const xl = Math.min(g.cards.length, 3) as 1 | 2 | 3;
        const wide = Math.min(g.cards.length, 4) as 1 | 2 | 3 | 4;
        const past = g.key === PAST_GROUP;
        return (
          <section
            key={g.key}
            aria-labelledby={groupId(g.key)}
            data-group={g.key}
            className={cn('flex min-w-0 flex-col gap-4', SPAN_XL[xl], SPAN_WIDE[wide])}
          >
            <h3 id={groupId(g.key)} className={cn('flex items-baseline gap-2 t-title2', past ? 'text-muted' : 'text-ink')}>
              {g.label}
              <span className="t-label text-muted tabular-nums">{g.cards.length}</span>
            </h3>
            <ul className={cn('grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-4', COLS_XL[xl], COLS_WIDE[wide])}>
              {g.cards.map((c) => {
                const priority = index++ < priorityCount;
                return (
                  <li key={c.documentId} className={posterItemClass(true)}>
                    <PosterCard competition={c} onOpenPhoto={onOpenPhoto} priority={priority} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const NO_MINE: ReadonlySet<string> = new Set();
const noPhoto = () => {};

/**
 * The page's static shell (../CompetitionsRoute): the first page of the tab's cards, from the
 * cached public read, in start order (who is reading is not known there), grouped on the shell's
 * clock. The poster's viewer opens once the page itself lands, a moment later.
 */
export function UpcomingGroupsShell({ cards, at }: { cards: CompetitionCard[]; at: number }) {
  return <UpcomingGroups cards={cards} mine={NO_MINE} onOpenPhoto={noPhoto} priorityCount={0} at={at} />;
}
