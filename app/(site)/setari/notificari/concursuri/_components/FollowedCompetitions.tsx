'use client';

import { BellSlashIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PreferencesPanel } from '@/components/account/notification-preferences';
import { ListEmpty, ListError } from '@/components/templates/T1';
import { followedCompetitionsQuery, type FollowedCompetition } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { CompetitionRow } from './CompetitionRow';
import { FOLLOWED_GRID, FollowedFrame, FollowedLoading } from './FollowedFrame';

/**
 * «Concursuri urmărite» — fish app/(app)/notification-preferences.tsx (parity
 * account.notification-preferences c1–c5, c13). Behind the page's requireViewer gate.
 *
 *  - The list is GET /feed/followed-competitions (core followedCompetitionsQuery): fish's centred
 *    spinner while it loads (c2), «Nu urmărești niciun concurs în desfășurare.» when empty (c3), the
 *    rows otherwise (c4). fish has no error state (an error reads as the empty list); the web never
 *    says «nothing» when it does not know (owner rule 4): the T1 error card with a retry.
 *  - A row opens the preferences panel in `edit` mode for that competition (c5). The panel is keyed
 *    by the competition, so each one gets a fresh panel (its own draft and mutation, fish
 *    `key={selected.documentId}`); it stays mounted after closing so the dialog can return focus to
 *    the row.
 *  - A save refetches the list (c13, fish onSaved → refetch; the core mutation also invalidates it),
 *    so the row's summary follows.
 */
export function FollowedCompetitions() {
  const t = useMemo(() => createBrowserTransport(), []);
  const list = useQuery(followedCompetitionsQuery(t));
  const [selected, setSelected] = useState<FollowedCompetition | null>(null);
  const [open, setOpen] = useState(false);

  let body;
  if (list.isPending) {
    body = <FollowedLoading />;
  } else if (list.isError && !list.data) {
    body = (
      <ListError
        title="Nu am putut încărca concursurile urmărite"
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
        attempt={list.errorUpdateCount}
      />
    );
  } else if (!list.data?.length) {
    body = <ListEmpty title="Nu urmărești niciun concurs în desfășurare." icon={<BellSlashIcon aria-hidden className="size-12 stroke-[1.5]" />} />;
  } else {
    body = (
      <ul aria-labelledby="concursuri-urmarite" className={FOLLOWED_GRID} data-testid="followed-list">
        {list.data.map(item => (
          <CompetitionRow
            key={item.documentId}
            item={item}
            onOpen={() => {
              setSelected(item);
              setOpen(true);
            }}
          />
        ))}
      </ul>
    );
  }

  return (
    <FollowedFrame busy={list.isFetching && !list.isPending}>
      {body}
      {selected ? (
        <PreferencesPanel
          key={selected.documentId}
          mode="edit"
          open={open}
          onClose={() => setOpen(false)}
          onSaved={() => void list.refetch()}
          competitionId={selected.documentId}
          competitionName={selected.name}
        />
      ) : null}
    </FollowedFrame>
  );
}
