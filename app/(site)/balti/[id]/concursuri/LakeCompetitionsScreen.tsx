'use client';

import { useRouter } from 'next/navigation';
import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { useMemo, useState, type ReactNode } from 'react';
import { ListEmpty, ListFooter, ListGrid, ListHeader, ListPage, ListRegion, ListTabs, LiveDot, useListUrlState } from '@/components/templates/T1';
import { Button } from '@/components/ui/Button';
import type { CompetitionCardsPage } from '@/core/competitions';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { logEvent } from '../../../concursuri/_list/analytics';
import { CardSkeleton, cardItemClass, CompetitionCardItem, type PhotoRequest } from '../../../concursuri/_list/CompetitionCardItem';
import { PhotoViewer } from '../../../concursuri/_list/PhotoViewer';
import { firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { useBack } from '../_sub/useBack';
import { lakeCompetitionCardsQuery, withoutLake } from './query';
import { LAKE_COMPETITION_TABS, tabOf, type LakeCompetitionTab } from './tabs';

/*
 * Concursuri la baltă — fish app/(app)/lakes/[lakeId]/concursuri.tsx (CompetitionTabs +
 * CompetitionsFullList per tab; parity lakes.competitions, T1). Also the target of the lake page's
 * «Vezi tot» rails (fish /competitions/{started|notStarted|completed}/{lakeId}, the per-lake lists of
 * competitions-list merged here):
 *  - c1 back control beside the lake's name, no promotional subtitle;
 *  - c2 Live · Viitoare · Trecute, Live first (the LIVE dot only while something IS live); c6
 *    `?tab=` picks the tab, a switch replaces the URL and logs fish's competition_list_tab_pressed;
 *  - c3 each tab 10 a page, more as the end comes into view; a card opens /concursuri/[id];
 *  - c4 «Momentan nu este disponibil niciun concurs.» with the way to the next tab that has some;
 *    c5 a failed tab: its error card with «Încearcă din nou» (fish ErrorScreen + pull-to-refresh).
 * The cards are the /concursuri list's (CompetitionCardItem, compact «Listă», aligned footers):
 * the same competition looks the same on both pages — the unit («20/20 echipe»), the pending
 * registrations, the faces, the followers pill (its list), the poster opening whole — minus the
 * lake line, which would repeat this page's lake on every card.
 */

const PANEL_ID = 'concursuri-balta';
/** The first row's thumbnails carry the page's LCP (eager, high priority). */
const PRIORITY_CARDS = 4;

/** fish CompetitionTabs ids (GA merges web and app on them). */
const TAB_EVENT_ID: Record<LakeCompetitionTab, 'live' | 'upcoming' | 'past'> = { live: 'live', viitoare: 'upcoming', trecute: 'past' };
const COUNT_KEY = { live: 'started', viitoare: 'notStarted', trecute: 'completed' } as const;
const NEXT_LABEL: Record<LakeCompetitionTab, string> = {
  live: 'Vezi concursurile live',
  viitoare: 'Vezi concursurile viitoare',
  trecute: 'Vezi concursurile trecute',
};

type Counts = CompetitionCardsPage['meta']['counts'];

export function LakeCompetitionsScreen({ lakeId, lakeName, initialTab }: { lakeId: string; lakeName: string; initialTab: LakeCompetitionTab }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const router = useRouter();
  const [tab, setTab] = useState<LakeCompetitionTab>(initialTab);
  useListUrlState({ tab: tab === 'live' ? null : tab });
  const back = useBack(routes.lake(lakeId));
  const [photo, setPhoto] = useState<PhotoRequest | null>(null);

  const q = useInfiniteQuery(lakeCompetitionCardsQuery(t, lakeId, tabOf(tab).status));
  // Every tab's size rides on each tab's read: kept across a switch so the LIVE dot never flickers.
  const [counts, setCounts] = useState<Counts | null>(null);
  const fresh = q.data?.pages[0]?.meta.counts ?? null;
  if (fresh && (!counts || fresh.started !== counts.started || fresh.notStarted !== counts.notStarted || fresh.completed !== counts.completed)) setCounts(fresh);

  const select = (next: LakeCompetitionTab) => {
    if (next !== tab) logEvent('competition_list_tab_pressed', { tab_id: TAB_EVENT_ID[next], screen_name: 'Competitions List', screen_class: 'Competitions List' });
    setTab(next);
  };

  return (
    <ListPage
      header={
        <ListHeader
          title={lakeName || 'baltă'}
          titleId={SUB_TITLE_ID}
          back={{ label: 'Înapoi', onClick: back }}
          below={
            <ListTabs
              label="Concursuri la baltă"
              controls={PANEL_ID}
              active={tab}
              onSelect={select}
              tabs={LAKE_COMPETITION_TABS.map(x => ({ key: x.key, label: x.label, leading: x.key === 'live' && counts && counts.started > 0 ? <LiveDot /> : undefined }))}
            />
          }
        />
      }
    >
      <TabList key={tab} q={q} tab={tab} counts={counts} onTab={setTab} onOpenPhoto={setPhoto} />
      <PhotoViewer
        photo={photo}
        onClose={() => setPhoto(null)}
        onOpenCompetition={id => {
          setPhoto(null);
          router.push(routes.competition(id));
        }}
      />
    </ListPage>
  );
}

type CardsQuery = UseInfiniteQueryResult<InfiniteData<CompetitionCardsPage>, Error>;

function TabList({
  q,
  tab,
  counts,
  onTab,
  onOpenPhoto,
}: {
  q: CardsQuery;
  tab: LakeCompetitionTab;
  counts: Counts | null;
  onTab: (tab: LakeCompetitionTab) => void;
  onOpenPhoto: (photo: PhotoRequest) => void;
}) {
  const meta = tabOf(tab);
  const items = useMemo(() => (q.data?.pages.flatMap(p => p.data) ?? []).map(withoutLake), [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? items.length;
  const headingId = `${PANEL_ID}-titlu`;
  const failed = firstReadFailed(q);
  // Podium footers (Trecute) hug their rows; Live and Viitoare share one footer line per grid row.
  const aligned = tab !== 'trecute';
  // The empty tab points at the first other tab that has competitions (Viitoare, then Trecute, then Live).
  const next = counts ? (['viitoare', 'trecute', 'live'] as const).find(k => k !== tab && counts[COUNT_KEY[k]] > 0) : undefined;

  let body: ReactNode;
  if (failed) {
    body = <SubListError title="Nu am putut încărca concursurile" onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />;
  } else if (q.isPending) {
    body = <CardsSkeleton />;
  } else if (items.length === 0) {
    body = (
      <>
        <SubRetryFocus target={headingId} />
        <ListEmpty
          icon={<TrophyIcon aria-hidden className="size-12" />}
          title="Momentan nu este disponibil niciun concurs."
          action={
            next ? (
              <Button variant="secondary" onClick={() => onTab(next)}>
                {NEXT_LABEL[next]}
              </Button>
            ) : undefined
          }
        />
      </>
    );
  } else {
    body = (
      <>
        <SubRetryFocus target={headingId} />
        <ListGrid min="md" labelledBy={headingId} className="gap-y-2.5">
          {items.map((c, i) => (
            <li key={c.documentId} className={cardItemClass(aligned)}>
              <CompetitionCardItem competition={c} aligned={aligned} onOpenPhoto={onOpenPhoto} priority={i < PRIORITY_CARDS} />
            </li>
          ))}
        </ListGrid>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          error={q.isFetchNextPageError}
          shown={items.length}
          total={total}
          noun="concursuri"
          errorLabel="Nu am putut încărca mai multe concursuri."
        />
      </>
    );
  }

  return (
    <ListRegion id={PANEL_ID} tabpanel labelledBy={`${PANEL_ID}-tab-${tab}`} busy={q.isFetching && !q.isFetchingNextPage && !!q.data}>
      <h2 id={headingId} className="sr-only">
        {meta.title}
      </h2>
      {body}
    </ListRegion>
  );
}

/** The cards' footprint while a tab loads (the /concursuri CardSkeleton, in the same grid). */
export function CardsSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Se încarcă concursurile…</span>
      <ListGrid min="md" className="gap-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ListGrid>
    </div>
  );
}
