'use client';

import { MagnifyingGlassIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { ICON_BUTTON_SIZE } from '@/components/nav/IconButton';
import { useBack } from '@/components/nav/useBack';
import { dismissedStore, useDismissedSuggestions } from '@/components/account/suggestions/dismissedStore';
import { SuggestedAnglerCard, SuggestedAnglerCardSkeleton } from '@/components/account/suggestions/SuggestedAnglerCard';
import { ListEmpty, ListError, ListFooter, ListHeader, ListPage, ListRegion, pageToolClass } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { dedupeByKey, suggestedAnglersHomeInfiniteQuery, withoutDismissed, type SuggestedAngler } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';

export const TITLE = 'Sugestii pentru tine';

/** «Acasă / Sugestii pentru tine» on the ≥768 band — never the URL-derived «Pescari» (no page yet). */
export const TRAIL: Crumb[] = [{ label: 'Acasă', href: routes.home() }, { label: TITLE }];

/**
 * fish: two cards per row on a phone ((width − 2·20 − 12) / 2, c4); from 768 an auto-fill grid of
 * cards at least 160px wide (fish's rail card, SUGGESTED_CARD_WIDTH: 4 at 768), from 1024 at least
 * 176px (at 160 the common long names — «Valentin Dumitrescu» — were cut at 1280), so the grid is
 * dense and gains columns as the screen grows (owner rule 5: 4 at 768, 6 at 1280, 7 at 1440, 8 at
 * 1920), never two stretched cards.
 */
const GRID =
  'grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))] lg:grid-cols-[repeat(auto-fill,minmax(--spacing(44),1fr))] lg:gap-4';

/**
 * Sugestii pentru tine — fish app/(app)/anglers/suggested.tsx (parity account.suggested, T1), behind
 * the page's requireViewer gate (c1).
 *
 *  - Header: back (in-app history, else Home) + h1 + «Caută pescari» (c2): a link to /pescari, the
 *    angler search, as fish pushes /partide/pescari (partide.pescari). The top bar's ⌘K palette
 *    still searches anglers too, as a shortcut.
 *  - Data: core suggestedAnglersHomeInfiniteQuery — GET /feed/anglers/suggested-home, pageSize 10,
 *    the Home rail's own cache (c3): suggestedHomeQueryOptions (staleTime 6h, no refetch on focus,
 *    reconnect or mount, no retry) override the site's global focus refetch, so the cards never
 *    reshuffle under the user; a follow only marks the pool stale (c11). A Home visit never
 *    replaces the pool either: its server read hydrates only an empty cache (SuggestedHomeHydration,
 *    c13), so the pages loaded here and their order survive a round trip through Home.
 *  - Cards repeated across pages are shown once (core dedupeByKey, the first kept: the server
 *    rotates the pool per fetch, c10); dismissed ones are left out (the session store shared with the
 *    Home rail, c7 / account.b.suggestion-dismissals).
 *  - States: a skeleton grid of cards while the first page loads (c8; owner rule 4 and the T1
 *    skeletons — no lone spinner over an empty page, no jump when the cards land);
 *    «Nu am putut încărca sugestiile.» with a retry when it failed and «Nu avem sugestii momentan.»
 *    when there is nothing (c9); the next page as the footer nears the viewport, with a spinner and
 *    the footer's «Mai multe» button as the keyboard path (c10). Auto-load waits for the reader's
 *    first scroll (ListFooter armOnScroll): on a wide screen the first 10 cards fill two rows and
 *    the footer is in range at once, and each page is a server scoring query that reshuffles the
 *    pool (fish loads page 1, at most one more on a phone).
 */
export function SuggestedGrid() {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(suggestedAnglersHomeInfiniteQuery(t, { isAuthenticated: true }));
  const hidden = useDismissedSuggestions();
  const back = useBack(routes.home());
  const titleRef = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState('');

  const items = useMemo(
    () =>
      withoutDismissed(
        dedupeByKey(
          (q.data?.pages ?? []).flatMap((p) => p.data),
          (a) => a.documentId,
        ),
        hidden,
      ),
    [q.data, hidden],
  );

  /**
   * Hides one card without dropping keyboard focus: it moves to the next card's «Ascunde» (else the
   * previous one's, else the h1 when the grid empties); «Sugestie ascunsă.» is announced.
   */
  const dismiss = (e: MouseEvent<HTMLButtonElement>, list: SuggestedAngler[], i: number) => {
    const grid = e.currentTarget.closest('ul');
    const neighbour = list[i + 1] ?? list[i - 1];
    const target = neighbour
      ? grid?.querySelector<HTMLElement>(`[data-dismiss="${CSS.escape(neighbour.documentId)}"]`)
      : titleRef.current?.querySelector<HTMLElement>('h1');
    dismissedStore.dismiss(list[i].documentId);
    setSaid((s) => (s === 'Sugestie ascunsă.' ? 'Sugestie ascunsă. ' : 'Sugestie ascunsă.'));
    target?.focus({ preventScroll: false });
  };

  let body: ReactNode;
  if (q.isPending) {
    body = <SuggestionsSkeleton />;
  } else if (q.isError && !q.data) {
    body = (
      <ListError
        title="Nu am putut încărca sugestiile."
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  } else if (items.length === 0 && !q.hasNextPage) {
    body = <ListEmpty title="Nu avem sugestii momentan." icon={<UsersIcon aria-hidden className="size-12 stroke-[1.5]" />} />;
  } else {
    body = (
      <>
        {items.length > 0 ? (
          <ul aria-label="Pescari sugerați" className={GRID} data-testid="suggested-grid">
            {items.map((a, i) => (
              <li key={a.documentId} className="flex min-w-0">
                <SuggestedAnglerCard angler={a} source="see_all" onDismiss={(e) => dismiss(e, items, i)} />
              </li>
            ))}
          </ul>
        ) : null}
        {/* Every card of the loaded pages dismissed but more on the server: the footer loads the
            next page at once, scroll or not (fish onEndReached on a short list). */}
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => void q.fetchNextPage()}
          error={q.isFetchNextPageError}
          errorLabel="Nu am putut încărca mai multe sugestii."
          moreLabel="Mai multe"
          spinner
          armOnScroll={items.length > 0}
        />
      </>
    );
  }

  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <div ref={titleRef}>
            <ListHeader
              title={TITLE}
              back={{ label: 'Înapoi', onClick: back }}
              actions={
                <Link href={routes.anglersSearch()} className={pageToolClass()}>
                  <MagnifyingGlassIcon aria-hidden />
                  <span className="sr-only md:not-sr-only">Caută pescari</span>
                </Link>
              }
            />
          </div>
        }
      >
        <ListRegion busy={q.isFetching && !q.isFetchingNextPage && !q.isPending}>{body}</ListRegion>
        <p role="status" className="sr-only">
          {said}
        </p>
      </ListPage>
    </>
  );
}

/**
 * The first page on its way (c8): card skeletons in the grid's own columns at the card's height —
 * 8 on a phone (four rows of two), 14 from 768 — announced once («Se încarcă sugestiile…»).
 */
export function SuggestionsSkeleton() {
  return (
    <div role="status" data-testid="suggested-skeleton">
      <span className="sr-only">Se încarcă sugestiile…</span>
      <ul aria-hidden className={GRID}>
        {Array.from({ length: 14 }, (_, i) => (
          <li key={i} className={cn('flex min-w-0', i >= 8 && 'max-md:hidden')}>
            <SuggestedAnglerCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The whole page while the gate reads the session (loading.tsx and the page's Suspense fallback):
 * the real title, the back control's place and the card skeletons; the band already says the trail. The
 * header mirrors ListHeader's box by hand (its back control needs a client handler).
 */
export function SuggestedPageLoading() {
  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <div className="flex min-h-12 items-center gap-3 xl:min-h-10">
            <span aria-hidden className={cn(ICON_BUTTON_SIZE, 'shrink-0 rounded-control bg-surface shadow-e0')} />
            <h1 className="min-w-0 flex-1 t-title1 text-ink">{TITLE}</h1>
          </div>
        }
      >
        <SuggestionsSkeleton />
      </ListPage>
    </>
  );
}
