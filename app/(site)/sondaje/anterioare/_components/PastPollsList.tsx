'use client';

import { ChartBarIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useBack } from '@/components/nav/useBack';
import { ListEmpty, ListError, ListFooter, ListHeader, ListPage, ListRegion } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { pastPollsInfiniteQuery } from '@/core/competitions';
import { track } from '@/lib/analytics';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { PAST_POLLS_TITLE, pollsCount } from './format';
import { PastPollCard } from './PastPollCard';

const TITLE_ID = 'sondaje-anterioare-title';

/**
 * The cards: a masonry grid (c4). One column on a phone; from 768 as many tracks as there are polls,
 * up to the full row — two at 768–1279, up to three from 1280 (auto-fill columns of at least 320 and
 * never narrower than a third, so a card is ~350–530 wide). With one or two polls the tracks are
 * capped at 560 and the grid is centred, so a lone result never sits in a third of an empty page.
 *
 * Masonry, not rows: a poll with a description and six options beside two-option polls would leave
 * holes under the short cards in a row grid (every row as tall as its tallest card). CSS columns were
 * rejected: they balance the columns again when the next page lands, moving the cards already read
 * to other columns, and read down each column. Here the grid's rows are 1px and each card spans its
 * own height + the 16px gap (useMasonry, measured before paint and on resize): the DOM order stays
 * the CMS order (newest first), auto-placement puts each card at the top of the shortest column, and
 * a new page only adds cards under the old ones.
 */
const ROW_GAP = 16;
const GRID_BASE = 'grid auto-rows-[1px] gap-x-4';
const GRID_TRACKS = {
  1: 'grid-cols-1 md:grid-cols-[minmax(0,560px)] md:justify-center',
  2: 'grid-cols-1 md:grid-cols-[repeat(2,minmax(0,560px))] md:justify-center',
  many: 'grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(max(--spacing(80),calc((100%_-_--spacing(8))/3)),1fr))]',
} as const;

/**
 * Sets each <li>'s row span from its card's height (rows are 1px): synchronously before the first
 * paint of new cards, then whenever a card changes height (a new width at another breakpoint, the
 * fonts landing). Plain DOM writes on elements React does not style.
 */
function useMasonry(list: RefObject<HTMLUListElement | null>, items: readonly unknown[]) {
  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const size = (li: HTMLElement) => {
      const card = li.firstElementChild as HTMLElement | null;
      if (card) li.style.gridRowEnd = `span ${Math.ceil(card.getBoundingClientRect().height) + ROW_GAP}`;
    };
    const lis = [...ul.children] as HTMLElement[];
    lis.forEach(size);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const li = (e.target as HTMLElement).parentElement;
        if (li) size(li);
      }
    });
    for (const li of lis) if (li.firstElementChild) ro.observe(li.firstElementChild);
    return () => ro.disconnect();
  }, [list, items]);
}

/**
 * /sondaje/anterioare on T1 — fish app/(app)/polls/past.tsx (parity participant.polls-past).
 *
 *  - Header (c1): back (in-app history, else Acasă — fish goBackOrHome) + «Sondaje anterioare»;
 *    no manual refresh control (c6 «Reîncarcă» removed by the owner 2026-10-11).
 *  - Data (c5, c8): core pastPollsInfiniteQuery — GET /polls/past?page&pageSize=10 through
 *    /api/cms, auth optional: personalised (my vote) with the session cookie, plain for a guest.
 *  - States: a centred spinner while the first page loads (c2); «Niciun sondaj încheiat» (c3);
 *    the first page failed → ListError with a retry; the cards (c4); the next page as the footer
 *    nears the viewport (after the first scroll) with a spinner, the footer's «Încarcă mai multe» as the keyboard path (c5).
 *  - Analytics (c7): poll_past_view once per visit (a ref, so React's dev double effect and a
 *    refetch never send it twice).
 */
export function PastPollsList() {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(pastPollsInfiniteQuery(t));
  const back = useBack(routes.home());
  const listRef = useRef<HTMLUListElement>(null);

  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track('poll_past_view');
  }, []);

  const polls = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.data), [q.data]);
  const total = q.data?.pages.at(-1)?.meta.pagination.total;
  useMasonry(listRef, polls);

  let body: ReactNode;
  if (q.isPending) {
    body = <PastPollsSpinner />;
  } else if (q.isError && !q.data) {
    body = (
      <ListError
        title="Nu am putut încărca sondajele."
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  } else if (polls.length === 0) {
    body = (
      <ListEmpty
        title="Niciun sondaj încheiat"
        description="Pe măsură ce sondajele se închid, vor apărea aici cu rezultatele finale."
        icon={<ChartBarIcon aria-hidden className="size-12 stroke-[1.5]" />}
      />
    );
  } else {
    body = (
      <>
        <ul
          ref={listRef}
          aria-labelledby={TITLE_ID}
          // The last cards' 16px gap (part of their span) is taken back before the footer.
          className={cn(GRID_BASE, GRID_TRACKS[polls.length === 1 ? 1 : polls.length === 2 ? 2 : 'many'], '-mb-4')}
          data-testid="past-polls"
        >
          {polls.map((p) => (
            <li key={p.documentId} className="min-w-0 self-start">
              <PastPollCard poll={p} />
            </li>
          ))}
        </ul>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => void q.fetchNextPage()}
          error={q.isFetchNextPageError}
          errorLabel="Nu am putut încărca mai multe sondaje."
          shown={polls.length}
          total={total}
          formatTotal={pollsCount}
          spinner
          // The masonry is short on a wide screen: the footer is in range at once, and page 2 would
          // load before anyone scrolled. Armed by the reader's first scroll; the button loads at once.
          armOnScroll
        />
      </>
    );
  }

  return (
    <ListPage
      header={
        <ListHeader
          title={PAST_POLLS_TITLE}
          titleId={TITLE_ID}
          back={{ label: 'Înapoi', onClick: back }}
        />
      }
    >
      <ListRegion labelledBy={TITLE_ID}>
        {body}
      </ListRegion>
    </ListPage>
  );
}

/** c2: fish's centred ActivityIndicator, in the list's slot (the header stays). Announced once. */
function PastPollsSpinner() {
  return (
    <div role="status" className="flex min-h-80 items-center justify-center" data-testid="past-polls-loading">
      <span aria-hidden className="size-8 animate-spin rounded-full border-3 border-accent border-r-transparent motion-reduce:animate-none" />
      <span className="sr-only">Se încarcă sondajele…</span>
    </div>
  );
}

/**
 * The route's loading.tsx: the same header (back as a link to Acasă — no history handler on the
 * server) and the spinner, so nothing moves when the list lands.
 */
export function PastPollsLoading() {
  return (
    <ListPage
      header={
        <ListHeader
          title={PAST_POLLS_TITLE}
          titleId={TITLE_ID}
          back={{ label: 'Înapoi', href: routes.home() }}
        />
      }
    >
      <PastPollsSpinner />
    </ListPage>
  );
}
