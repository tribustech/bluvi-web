'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useTransition, type ReactNode } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { describeError, ListEmpty, ListError, ListFooter, ListRegion } from '@/components/templates/T1';
import { Button, ButtonLink } from '@/components/ui/Button';
import { filteredCompetitionsInfiniteQuery, type CompetitionListItem } from '@/core/competitions';
import { ApiError, isApiError, type Transport, type TransportRequest } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { footerNoun, STATUS_LIST_PAGINATION, STATUS_LISTS, type StatusListKey } from './config';
import { LegacyCompetitionCard, StatusGrid, StatusListSkeleton } from './LegacyCompetitionCard';
import { PANEL_ID, TITLE_ID, useRefreshing } from './StatusListShell';

/*
 * fish components/CompetitionsFullList.tsx under the three status screens (parity
 * competitions-list.viitoare / .live / .incheiate, T1) — the list region; the header (c1: back,
 * title, count line, refresh, the status tabs) is StatusListShell, outside the page's Suspense:
 *  - c2 the legacy list (/feed/competitions?status=…, filteredCompetitionsInfiniteQuery), c3 a grid
 *    of the compact legacy card — two columns on a phone as in fish, auto-filling from 768;
 *  - c4 the first page loading: the cards' skeleton; c5 a failed first page: the shared error card
 *    under the header, whose back stays; c6 «Momentan nu este disponibil niciun concurs.»;
 *  - c7 pull-to-refresh is the kit's stand-in (DashboardRefresh, «Reîmprospătează»); the next page
 *    loads as the end of the list nears, with a button as fallback and a «Se încarcă…» footer.
 *
 * Reads (fish useFilteredCompetitions has no staleTime: it re-reads on every mount and on app
 * foreground): the server's first page is hydrated with its cache-tag stamp; it counts as fresh for
 * 60s (the CMS's edge TTL for /feed/competitions), so a page whose stamp is older re-reads on mount,
 * and coming back to the tab or to the page after a minute re-reads it too — live counts and a
 * finished competition never linger. Every browser read gives up after READ_TIMEOUT_MS and a timed
 * out read is never retried (a hung CMS shows its error within one budget, not three); other
 * failures retry once. When the server read failed, the browser reads once without retrying (the
 * user already waited for the server's budget; «Încearcă din nou» retries).
 *
 * The list is a PUBLIC read without credentials (auth 'none', lib/client/transport publicDirect): a
 * 401 / 403 on it is a missing CMS grant, never the viewer's session — signing out cannot fix it,
 * so it says «Serverul nu răspunde» with a retry. «Deconectează-te» is kept only for SESSION_DEAD.
 */

/** The first row's posters carry the page's LCP (eager, high priority). */
const PRIORITY_CARDS = 4;
/** The CMS's edge TTL for /feed/competitions: the list is re-read after that. */
const STALE_MS = 60_000;
/** A browser read that has not answered by then fails like a network error. */
const READ_TIMEOUT_MS = 10_000;

/** `t` with every request bounded: its own signal (TanStack's cancel) or the timeout, whichever first. */
function withTimeout(t: Transport, ms: number): Transport {
  return {
    request<T>(req: TransportRequest) {
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(new DOMException('Timpul de răspuns a expirat', 'TimeoutError')), ms);
      const outer = req.signal;
      const forward = () => c.abort(outer?.reason);
      if (outer?.aborted) forward();
      else outer?.addEventListener('abort', forward, { once: true });
      return t.request<T>({ ...req, signal: c.signal }).finally(() => {
        clearTimeout(timer);
        outer?.removeEventListener('abort', forward);
      });
    },
  };
}

/** A read that ran out of READ_TIMEOUT_MS (the transport wraps the abort reason as a NETWORK error). */
function isTimeout(e: unknown) {
  const cause = isApiError(e) ? (e as { cause?: unknown }).cause : e;
  return (cause as { name?: string } | undefined)?.name === 'TimeoutError';
}

/** One retry for a failure that may pass (5xx, network); never for a timeout or a 4xx. */
const retryOnce = (count: number, e: unknown) => count < 1 && !isTimeout(e) && !(isApiError(e) && e.status >= 400 && e.status < 500);

/**
 * The user is online and the site loaded: an unreachable CMS is the server's fault, not their
 * connection. A 401 / 403 on this credential-less read is the CMS's grant, not a session.
 */
function describeListError(error: unknown) {
  if (isApiError(error) && error.code !== 'SESSION_DEAD' && (error.status === 401 || error.status === 403)) {
    return describeError(new ApiError({ message: '', status: 503, code: 'HTTP' }));
  }
  const d = describeError(error);
  if (d.kind !== 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return d;
  return describeError(new ApiError({ message: '', status: 503, code: 'HTTP' }));
}

export function StatusListScreen({ list, serverRead }: { list: StatusListKey; serverRead: 'hydrated' | 'failed' }) {
  const cfg = STATUS_LISTS[list];
  const t = useMemo(() => withTimeout(createBrowserTransport(), READ_TIMEOUT_MS), []);
  const qc = useQueryClient();
  const router = useRouter();
  const refreshing = useRefreshing();
  const q = useInfiniteQuery({
    ...filteredCompetitionsInfiniteQuery(t, {
      status: cfg.status,
      pagination: STATUS_LIST_PAGINATION,
    }),
    staleTime: STALE_MS,
    retry: serverRead === 'failed' ? false : retryOnce,
  });

  // fish keyExtractor tolerates repeats across pages (documentId + index); the web keys by id, so a
  // row that moved between two page reads is shown once.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: CompetitionListItem[] = [];
    for (const c of q.data?.pages.flatMap(p => p.data) ?? []) {
      if (seen.has(c.documentId)) continue;
      seen.add(c.documentId);
      out.push(c);
    }
    return out;
  }, [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total;

  // The first read failed and nothing is on screen — also while its retry runs (TanStack puts a
  // query with no data back to pending; the error card and its focused button must stay).
  // Offline, TanStack pauses the read (and resumes it once back online): say so with the offline
  // card rather than a skeleton that cannot finish.
  const paused = !q.data && q.fetchStatus === 'paused';
  const failed = !q.data && (q.isError || (q.isFetching && q.errorUpdateCount > 0) || paused);

  // fish ErrorScreen «Deconectează-te» — the one fix for a dead session (SESSION_DEAD only).
  const [signingOut, startSignOut] = useTransition();
  const signOut = () => {
    if (signingOut) return;
    startSignOut(async () => {
      const ok = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
        .then(r => r.ok)
        .catch(() => false);
      if (!ok) return;
      qc.clear();
      startSignOut(() => router.refresh());
    });
  };

  // After a successful retry, focus goes from the (unmounted) retry button to the title.
  const retried = useRef(false);
  useEffect(() => {
    if (retried.current && q.data) {
      retried.current = false;
      document.getElementById(TITLE_ID)?.focus();
    }
  }, [q.data]);

  let body: ReactNode;
  if (failed) {
    const d = describeListError(paused ? new ApiError({ message: '', status: 0, code: 'NETWORK' }) : q.error);
    body = (
      <ListError
        title={d.title}
        description={d.message}
        onRetry={
          d.canRetry
            ? () => {
                retried.current = true;
                void q.refetch();
              }
            : undefined
        }
        retrying={q.isFetching}
        attempt={Math.max(1, q.errorUpdateCount)}
        secondaryAction={
          d.showSignOut ? (
            <Button variant="ghost" aria-disabled={signingOut || undefined} onClick={signOut}>
              {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (q.isPending) {
    body = <StatusListSkeleton />;
  } else if (items.length === 0) {
    body = (
      <ListEmpty
        icon={<TrophyIcon aria-hidden className="size-12" />}
        title="Momentan nu este disponibil niciun concurs."
        action={
          <ButtonLink variant="secondary" href={routes.competitions()}>
            Vezi toate concursurile
          </ButtonLink>
        }
      />
    );
  } else {
    body = (
      <>
        <StatusGrid labelledBy={TITLE_ID}>
          {items.map((c, i) => (
            <LegacyCompetitionCard key={c.documentId} competition={c} priority={i < PRIORITY_CARDS} />
          ))}
        </StatusGrid>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          error={q.isFetchNextPageError}
          shown={items.length}
          total={total}
          noun={footerNoun(total)}
          errorLabel="Nu am putut încărca mai multe concursuri."
        />
      </>
    );
  }

  return (
    <ListRegion id={PANEL_ID} labelledBy={TITLE_ID} busy={refreshing}>
      {body}
    </ListRegion>
  );
}
