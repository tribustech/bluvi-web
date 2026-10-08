'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { ListError } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { computeBaitRanking, eventHeatmapByHour, type LocalSession } from '@/core/partide';
import type { MemberTabProps } from '../types';
import { BaitLeaderboard, CARD, HourHeatmap, RodBars } from './Cards';
import { anyWeighed, tripStatsOf, type StatsScope } from './model';
import { ScopeToggle } from './ScopeToggle';
import { TripTiles, VenueTiles } from './Tiles';
import { useVenueScope } from './useVenueScope';

/*
 * The member view's «Statistici» tab (parity partide.partida-statistici; fish
 * features/partide/scenes/StatisticiScene.tsx, components/Leaderboard + HourHeatmap,
 * helpers/patterns.ts — ported to core/partide/domain/patterns.ts).
 *
 *  - c1 the scope toggle, «Această partidă» first;
 *  - c2 «Această partidă»: Capturi (the signature tile), Cea mai mare, Greutate totală (kg);
 *  - c3 «Toate partidele»: Partide, Top momeală, Distanță ideală, Ore de vârf («—» when unknown);
 *  - c4 «Capturi pe lansetă» — this partidă only, and only with rods;
 *  - c5 both scopes: «Clasament momeli» and the 24 h «Trăsături pe ore» of every non-blank event;
 *  - c6 fish's empty copy per scope;
 *  - c7 the venue scope is computed here, on the client, from the viewer's own partide at the same
 *    venue (./useVenueScope) — never a server statistic.
 *
 * The bento (owner rules 9, 19): the tiles, then the cards — from a 768px-wide panel the rod bars
 * beside the leaderboard and the heatmap across (one row of 24 hours); without rod bars the
 * leaderboard beside the heatmap, so no table is stretched across the column (rule 16).
 */

const VENUE_WORD: Record<LocalSession['venueType'], string> = {
  lake: 'la această baltă',
  publicWater: 'pe această apă',
  pin: 'în acest loc',
};

function EmptyCard({ text, testId }: { text: string; testId: string }) {
  return (
    <div data-testid={testId} className={cn(CARD, 'items-center gap-2 px-6 py-10 text-center')}>
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent [&>svg]:size-6">
        <ChartBarIcon />
      </span>
      <p className="max-w-[44ch] t-body text-muted">{text}</p>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div data-testid="stats-skeleton" aria-busy="true" className="flex flex-col gap-3 md:gap-4">
      <p role="status" className="sr-only">
        Se încarcă statisticile…
      </p>
      <div aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <span className="col-span-2 h-39 animate-shimmer rounded-bento md:col-span-1 md:row-span-2 md:h-auto" />
        <span className="col-span-2 h-24 animate-shimmer rounded-bento" />
        <span className="h-24 animate-shimmer rounded-bento" />
        <span className="h-24 animate-shimmer rounded-bento" />
      </div>
      <div aria-hidden className="grid gap-3 md:grid-cols-2 md:gap-4">
        <span className="h-56 animate-shimmer rounded-bento" />
        <span className="h-56 animate-shimmer rounded-bento" />
      </div>
    </div>
  );
}

/** The cards under the tiles; `rods` only in the partidă scope. */
function CardsBento({ rods, ranking, hours }: { rods: ReactNode; ranking: ReactNode; hours: (wide: string) => ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 md:gap-4 @[48rem]:grid-cols-2">
        {rods}
        {ranking}
        {hours(rods ? '@[48rem]:col-span-2' : '')}
      </div>
    </div>
  );
}

export default function StatisticiTab({ documentId, session, events }: MemberTabProps) {
  const [scope, setScope] = useState<StatsScope>('partida');
  // fish reads Date.now() on render; one instant per mount keeps the memo stable (the elapsed time
  // feeds no tile — only computeTripStats' rate — and the recency weights move by the day).
  const [now] = useState(() => Date.now());
  const isBalta = scope === 'balta';

  // «Această partidă» — this partidă's own events only.
  const trip = useMemo(() => tripStatsOf(session, events, now), [session, events, now]);
  const tripRanking = useMemo(() => computeBaitRanking(events), [events]);
  const tripHours = useMemo(() => eventHeatmapByHour(events), [events]);
  const weighed = useMemo(() => anyWeighed(events), [events]);

  // «Toate partidele» — read only once chosen, then kept (switching back and forth is instant).
  const [venueAsked, setVenueAsked] = useState(false);
  const venue = useVenueScope({ enabled: venueAsked, documentId, session, events, now });

  const choose = (s: StatsScope) => {
    if (s === 'balta') setVenueAsked(true);
    setScope(s);
  };

  let body: ReactNode;
  if (!isBalta) {
    body =
      events.length === 0 ? (
        <EmptyCard testId="stats-empty-partida" text="Niciun eveniment încă în această partidă." />
      ) : (
        <>
          <TripTiles stats={trip} weighed={weighed} />
          <CardsBento
            rods={session.rods.length > 0 ? <RodBars rods={session.rods} byRod={trip.capturesByRod} /> : null}
            ranking={<BaitLeaderboard rows={tripRanking} />}
            hours={cls => <HourHeatmap hours={tripHours} className={cls} />}
          />
        </>
      );
  } else if (venue.status === 'loading') {
    body = <StatsSkeleton />;
  } else if (venue.status === 'error') {
    body = (
      <div data-testid="stats-error">
        <ListError title="Nu am putut încărca statisticile." onRetry={venue.retry} retrying={venue.retrying} attempt={venue.attempt} />
      </div>
    );
  } else if (venue.patterns.recap.sessionCount === 0 || venue.patterns.eventCount === 0) {
    body = <EmptyCard testId="stats-empty-balta" text="Încă nu sunt suficiente date pentru această baltă." />;
  } else {
    const p = venue.patterns;
    body = (
      <>
        <VenueTiles recap={p.recap} venueWord={VENUE_WORD[session.venueType]} readCount={Math.min(venue.readCount, p.recap.sessionCount)} />
        <CardsBento rods={null} ranking={<BaitLeaderboard rows={p.baitRanking} />} hours={cls => <HourHeatmap hours={p.heatmapByHour} className={cls} />} />
      </>
    );
  }

  return (
    <div data-testid="partida-stats" data-scope={scope} className="flex flex-col gap-3 px-4 py-4 md:gap-4 md:px-0 md:py-0">
      <ScopeToggle scope={scope} onChange={choose} />
      {body}
    </div>
  );
}
