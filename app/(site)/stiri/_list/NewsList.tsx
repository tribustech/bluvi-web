'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  type ListBack,
  describeError,
  ListEmpty,
  ListError,
  ListFooter,
  ListGrid,
  ListHeader,
  ListPage,
  listGridClass,
} from '@/components/templates/T1';
import { newsInfiniteQuery } from '@/core/news';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { NewsCard } from '../_content/NewsCard';
import { NEWS_PAGE_SIZE } from '../_content/pageSize';

/*
 * Noutăți — fish app/(app)/news/index.tsx on T1 (header + one card grid; no tabs, filters or
 * aside: fish has none, and the grid takes the whole column — ROADMAP §4, cards auto-fill).
 *
 * The first page comes hydrated from the server (page.tsx, the cached public read), so the cards
 * are in the HTML; the browser takes over the same query (fish useNews; 12 per page here, see
 * pageSize.ts; fresh for one hour) for the next pages. States, in the list's own slot (the header stays):
 *  - loading (a failed server read handed over to the browser): the cards skeleton;
 *  - error: the T1 error card, «Încearcă din nou» refetches (fish ErrorScreen + refetch);
 *  - empty: «Momentan nu există noutăți.»;
 *  - list: 12 per page, the next page loading as the footer nears the viewport (fish onEndReached),
 *    with «Încarcă mai multe» as the keyboard fallback and «Se încarcă…» while it loads (fish's
 *    footer spinner); a failed page says so with «Reîncearcă»; at the end the footer goes away
 *    (fish ListLoadingStateFooter hides when there is no more data).
 */
export function NewsList() {
  const router = useRouter();
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(newsInfiniteQuery(t, { pageSize: NEWS_PAGE_SIZE }));
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  const total = q.data?.pages.at(-1)?.meta.pagination.total;

  let body: ReactNode;
  if (q.isPending) {
    body = <NewsSkeleton />;
  } else if (q.isError && !q.data) {
    const d = describeError(q.error);
    body = (
      <ListError
        title={d.title}
        description={d.message}
        onRetry={d.canRetry ? () => void q.refetch() : undefined}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  } else if (items.length === 0) {
    body = <ListEmpty title="Momentan nu există noutăți." />;
  } else {
    body = (
      <>
        <ListGrid label="Noutăți" min="md">
          {items.map((n, i) => (
            <li key={n.documentId}>
              <NewsCard news={n} priority={i < 2} />
            </li>
          ))}
        </ListGrid>
        <ListFooter
          hasMore={Boolean(q.hasNextPage)}
          loadingMore={q.isFetchingNextPage}
          error={q.isFetchNextPageError}
          onLoadMore={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          shown={items.length}
          total={total}
          noun="noutăți"
          errorLabel="Nu am putut încărca mai multe noutăți."
        />
      </>
    );
  }

  /*
   * fish BackButton: back in history when the previous entry is a Bluvi page, else Acasă — a list
   * opened from a search result, a shared link or another site in the same tab has history behind
   * it too, and «Înapoi» must never leave Bluvi.
   */
  const back: ListBack = { label: 'Înapoi', onClick: () => (previousIsInApp() ? router.back() : router.push(routes.home())) };
  return <NewsListFrame back={back}>{body}</NewsListFrame>;
}

/**
 * The page frame, shared with loading.tsx and error.tsx: the T1 header, fish's intro line as its
 * description (the page's subtitle, under the h1 — not a caption over the grid).
 */
export function NewsListFrame({ back = { label: 'Înapoi', href: routes.home() }, children }: { back?: ListBack; children: ReactNode }) {
  return (
    <ListPage header={<ListHeader title="Noutăți" description="Descoperă cele mai recente noutăți din lumea pescarilor." back={back} />}>
      {children}
    </ListPage>
  );
}

type NavigationLike = { currentEntry?: { index: number } | null };

/**
 * Whether the history entry before this one is on this origin. The Navigation API lists only the
 * same-origin, contiguous entries of the tab, so an index above 0 means the previous one is ours;
 * without it, the referrer of the document (a full load from another site → leave for Acasă).
 */
export function previousIsInApp(win: { navigation?: NavigationLike; history: { length: number }; location: { origin: string } } = window, referrer = document.referrer): boolean {
  const entry = win.navigation?.currentEntry;
  if (entry) return entry.index > 0;
  if (win.history.length <= 1 || !referrer) return false;
  try {
    return new URL(referrer).origin === win.location.origin;
  } catch {
    return false;
  }
}

/** The first page in grey, in NewsCard's own shape (200px header, the date row, a title line and two of text). */
export function NewsSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Se încarcă noutățile…</span>
      <ul aria-hidden className={listGridClass('md')}>
        {Array.from({ length: NEWS_PAGE_SIZE }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-card bg-surface shadow-e0">
            <span className="block h-50 animate-shimmer" />
            <span className="flex flex-col gap-2 p-4">
              <span className="flex h-4 items-center justify-between">
                <span className="h-2.5 w-28 rounded-full bg-soft-fill" />
                <span className="h-4 w-16 rounded-badge bg-soft-fill" />
              </span>
              {/* One heading line (22) + 2 + two body lines (2 × 20; 2 × 22 from 1280). */}
              <span className="flex h-16 flex-col justify-between py-1 xl:h-17">
                <span className="h-4 w-[85%] rounded-full bg-soft-fill" />
                <span className="h-3 w-full rounded-full bg-soft-fill" />
                <span className="h-3 w-[75%] rounded-full bg-soft-fill" />
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
