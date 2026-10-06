'use client';

import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { competitionCardsInfiniteQuery, PULSE_CARD_PARAMS, selectCompetitionCards } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { useNow } from '../desktop/motion';
import { nextStart, startsWhen } from './model';
import { LIVE_CARD } from './parts';

/*
 * Nothing live (prototype app/dev/hub Hub.tsx NoLive): one quiet card — «Niciun concurs live acum»,
 * the next start when one is ahead (the upcoming list the page already holds, no extra request),
 * and the way to Viitoare. The next start is computed in the browser (it depends on «now»).
 */

export function NoLive({ t, isAuthenticated }: { t: Transport; isAuthenticated: boolean }) {
  const upcoming = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.upcoming, { isAuthenticated }));
  const now = useNow(60_000);
  const cards = selectCompetitionCards(upcoming.data, PULSE_CARD_PARAMS.upcoming, { isAuthenticated }).competitions;
  const next = now == null ? null : nextStart(cards, now);
  return (
    <div className={cn(LIVE_CARD, 'flex flex-col items-center gap-3 px-6 py-12 text-center')}>
      <h3 className="t-title2 text-ink">Niciun concurs live acum</h3>
      {next ? (
        <p className="t-body text-muted">
          Următorul, {next.name}, începe {startsWhen(next)}.
        </p>
      ) : null}
      <Link href={routes.competitions('notStarted')} className="t-label text-accent-ink hover:underline">
        Vezi concursurile viitoare
      </Link>
    </div>
  );
}
