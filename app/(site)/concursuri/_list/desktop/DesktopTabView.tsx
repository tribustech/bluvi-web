'use client';

import { useCallback, useState } from 'react';
import type { CompetitionCard } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { Agenda } from './Agenda';
import { useLiveData, useMineStates, useResultDetails, useUpcomingPeople, type DesktopViewer } from './data';
import { LiveHub } from './LiveHub';
import { MineRows } from './MineRows';
import { pickHero } from './model';
import { useDesktop } from './motion';
import { Results } from './Results';

/*
 * The /concursuri tabs from 1024 (owner-approved prototype A2, 2026-10-06): each tab gets the shape
 * its question asks for, on the same list the phone shows as fish's cards (same query, same pages,
 * same «Încarcă mai multe»):
 *   Viitoare → agenda grouped by time, with faces and a capacity bar   (./Agenda)
 *   Live     → the live hub                                            (./LiveHub)
 *   Rezultate→ compact winner rows that expand inline                  (./Results)
 *   Ale mele → my registrations, led by my status                      (./MineRows)
 * Rendered next to the cards and swapped by CSS at `lg` (no layout shift on hydration); the extra
 * reads start only once the viewport really is ≥1024.
 */

export type DesktopTab = 'notStarted' | 'started' | 'completed' | 'mine';

type Props = { tab: DesktopTab; cards: CompetitionCard[]; t: Transport; viewer: DesktopViewer };

export function DesktopTabView(props: Props) {
  if (props.tab === 'started') return <LiveView {...props} />;
  if (props.tab === 'completed') return <ResultsView {...props} />;
  if (props.tab === 'mine') return <MineView {...props} />;
  return <UpcomingView {...props} />;
}

function UpcomingView({ cards, t, viewer }: Props) {
  const people = useUpcomingPeople(t, cards, viewer, useDesktop());
  return <Agenda cards={cards} people={people} />;
}

function LiveView({ cards, t }: Props) {
  // The hero is picked once per visit (as the bento's, pulse.c5): a poll never swaps it under the
  // reader; only its leaving the live list does. It is the one competition read in full.
  const picked = pickHero(cards);
  const [heroId, setHeroId] = useState(picked);
  if (picked && !cards.some((c) => c.documentId === heroId)) setHeroId(picked);
  const { live, updatedAt, rankingState } = useLiveData(t, cards, heroId, useDesktop());
  return <LiveHub cards={cards} heroId={heroId} live={live} rankingState={rankingState} updatedAt={updatedAt} />;
}

function ResultsView({ cards, t, viewer }: Props) {
  // Rows whose ranking is wanted: hovered, focused or opened once (kept, so it never re-hides).
  const [wanted, setWanted] = useState<ReadonlySet<string>>(() => new Set());
  const want = useCallback((id: string) => setWanted((w) => (w.has(id) ? w : new Set(w).add(id))), []);
  const details = useResultDetails(t, cards, viewer, useDesktop(), wanted);
  return <Results cards={cards} details={details} onWant={want} />;
}

function MineView({ cards, t, viewer }: Props) {
  const states = useMineStates(t, cards, viewer, useDesktop());
  return <MineRows cards={cards} states={states} />;
}

/** The desktop views' loading bones: rows in the shape the tab will land in. */
export function DesktopRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-5 px-5 py-4">
          <span className="size-16 shrink-0 animate-pulse rounded-control bg-soft-fill" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-3 w-32 animate-pulse rounded-full bg-soft-fill" />
            <span className="h-4 w-2/3 animate-pulse rounded-full bg-soft-fill" />
            <span className="h-3 w-40 animate-pulse rounded-full bg-soft-fill" />
          </span>
          <span className="hidden h-8 w-48 animate-pulse rounded-full bg-soft-fill xl:block" />
          <span className="h-9 w-24 animate-pulse rounded-control bg-soft-fill" />
        </div>
      ))}
    </div>
  );
}
