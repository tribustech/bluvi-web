'use client';

import { useQuery } from '@tanstack/react-query';
import { StarIcon } from '@heroicons/react/16/solid';
import { userReputationQuery } from '@/core/social';
import { useOperatorTransport } from '../../../../_shared/useOperatorTransport';
import { reputationLine } from './model';

/*
 * One line of standing for the angler the operator is about to put on a booking — fish
 * features/lakes/booking/AnglerReputationLine.tsx (c7, c11): «★ 4,5 · 3 evaluări» or «Fără evaluări
 * încă», plus a red «2 neprezentări» pill when there are any. /feed/users/:id/reputation, the
 * profile block's own read (social.userReputationQuery). Nothing until it answers (fish returns
 * null; rule 4: never a guessed «0»), a line-high box meanwhile so the card does not grow later.
 */
export function ReputationLine({ userId }: { userId: string | null | undefined }) {
  const t = useOperatorTransport();
  const { data } = useQuery(userReputationQuery(t, userId ?? undefined));
  if (!data) return <span aria-hidden className="block h-5" data-testid="reputation-pending" />;
  const line = reputationLine(data);
  return (
    <span data-testid="reputation-line" className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {line.stars ? (
        <span className="flex items-center gap-1">
          <StarIcon aria-hidden className="size-3.5 text-rating" />
          <span className="t-body-strong text-ink">
            <span className="sr-only">Nota </span>
            {line.stars}
          </span>
          <span className="t-caption text-muted">· {line.count}</span>
        </span>
      ) : (
        <span className="t-caption text-muted">Fără evaluări încă</span>
      )}
      {line.noShows ? (
        <span data-testid="reputation-no-shows" className="t-caption rounded-full font-bold bg-status-danger-bg px-2 py-0.5 text-status-danger-fg">
          {line.noShows}
        </span>
      ) : null}
    </span>
  );
}
