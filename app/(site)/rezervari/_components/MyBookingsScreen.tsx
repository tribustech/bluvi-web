'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { BookingRow } from '@/components/booking';
import { useNowTick } from '@/components/account/angler/SessionHistoryCard';
import { AsideSkeleton, ListError, ListFooter, pageToolClass, useListUrlState } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import {
  lakesToReviewQuery,
  MY_BUCKET_LABELS,
  myBookingsPageInfiniteQuery,
  myDefaultSub,
  myEmptyCopy,
  type MyBucket,
  type MySub,
} from '@/core/booking';
import { markBookingsVisited } from '@/lib/bookings-nou';
import { createBrowserTransport } from '@/lib/client/transport';
import { bookingHref } from '@/lib/routes';
import { useBackOrHome } from '../../notificari/_components/back';
import { useSiteToast } from '../../_shell/Toast';
import { BookingsChrome } from './BookingsChrome';
import { EmptyHero, FindLakeCard, HeroFeatures } from './EmptyHero';
import { BookingCardsSkeleton, GRID, MyBookingsFrame, PANEL_ID } from './frame';
import { ReviewPrompt } from './ReviewPrompt';
import { parseSub, parseTab, urlValues } from './url';

/**
 * /rezervari — booking.rezervarile-mele (T1), fish app/(app)/bookings/index.tsx. Rendered only for a
 * signed-in viewer (the page's requireViewer gate), so both per-user reads are on; they go through
 * /api/cms with the session cookie.
 *
 *  - c1–c4 the title row scrolls away, the pinned chrome holds the bucket tabs and the sub chips
 *    (BookingsChrome); «Toate» is the landing tab.
 *  - c5 the sub is remembered PER bucket during the visit; tab and sub ride in the URL (?tab=&filtru=,
 *    replaceState — a reload or the back button from a booking returns to the same list); a switch
 *    scrolls to the top, where the title shows again.
 *  - c6 one infinite query per (bucket, sub), 20 a page, a short page is the last (core
 *    myBookingsPageInfiniteQuery). No keepPreviousData: an uncached tab is the skeleton at once.
 *  - c7 an uncached tab → three card skeletons under the chrome; a failed first page → the inline error
 *    with «Încearcă din nou», never a sign-out (a dead session is the providers' global sign-out).
 *  - c8–c10 empty: the hero only on «Toate» without a sub (the account has no booking at all), a
 *    one-line copy per bucket/sub elsewhere, and nothing while this key has no settled answer yet (a
 *    background refetch keeps the empty state on screen).
 *  - c11 the review prompt: above the list on the phone, the right column from 1280.
 *  - c12 «Reîmprospătează» (fish pull-to-refresh) refetches the list AND the review prompt.
 *  - c13–c19 the card (components/booking/BookingRow). c20: it opens the booking through
 *    bookingHref, which stays null (a plain card) until /rezervari/[id] ships.
 *  - c21 the visit retires the home's «NOU» pill (lib/bookings-nou).
 * Desktop (owner rules 5, 14): a dense auto-filling grid of cards, two or more columns, with the
 * right column docked from 1280 — never the phone list stretched.
 */
export function MyBookingsScreen({ initialTab, initialSub }: { initialTab?: string; initialSub?: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const toast = useSiteToast();
  const back = useBackOrHome();
  const now = useNowTick();

  // c21 — reaching this screen is the «first visit» that retires the home NOU pill.
  useEffect(() => markBookingsVisited(), []);

  const [bucket, setBucket] = useState<MyBucket>(() => parseTab(initialTab));
  const [subByBucket, setSubByBucket] = useState<Partial<Record<MyBucket, MySub | undefined>>>(() => {
    const b = parseTab(initialTab);
    const s = parseSub(b, initialSub);
    return s ? { [b]: s } : {};
  });
  const sub = bucket in subByBucket ? subByBucket[bucket] : myDefaultSub(bucket);
  useListUrlState(urlValues(bucket, sub));

  const list = useInfiniteQuery(myBookingsPageInfiniteQuery(t, bucket, sub));
  const toReview = useQuery(lakesToReviewQuery(t));

  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  // Read off the FIRST page, never the last: the badge would otherwise change as the angler scrolls.
  const pendingCount = list.data?.pages[0]?.pendingCount ?? 0;

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    // The prompt rides on its own query: refetching only the list would leave a stale prompt.
    const [l] = await Promise.all([list.refetch(), toReview.refetch()]);
    setRefreshing(false);
    if (l.isError && l.data) toast('Nu am putut încărca rezervările.', 'danger');
  }, [list, toReview, refreshing, toast]);

  const toTop = () => window.scrollTo({ top: 0 });
  const onBucket = (b: MyBucket) => {
    if (b === bucket) return;
    setBucket(b);
    toTop();
  };
  const onSub = (s: MySub | undefined) => {
    setSubByBucket((prev) => ({ ...prev, [bucket]: s }));
    toTop();
  };

  const loaded = list.data !== undefined;
  const failed = list.isError && !loaded;
  // c10 — an empty answer is shown as soon as THIS key has one; only a first fetch with nothing settled
  // hides it. A background refetch (window focus after staleTime, «Reîmprospătează») keeps it on
  // screen: fish hides it during any fetch, but RN never refetches on focus, so there it never flashes.
  const settled = !(list.isFetching && !list.isFetched);
  const heroEmpty = loaded && rows.length === 0 && settled && bucket === 'all' && !sub;
  const lakes = toReview.data ?? [];

  // The first answer of the list, ever, on this visit (state set during render: React's «store
  // information from previous renders» pattern). After it, switching to an uncached tab never puts the
  // right column back to a skeleton.
  const [listAnswered, setListAnswered] = useState(false);
  if (!listAnswered && (loaded || list.isError)) setListAnswered(true);

  // The right column (≥1280). A skeleton only until the FIRST answers land, so it is there from the
  // first paint; after that it is never empty, so the tracks never change (T1: the column never changes
  // width when the aside lands or empties): the review prompt, then the way to a lake — or, on the
  // empty-account hero (which already carries «Caută o baltă»), the hero's «how it works» rows.
  const asideBusy = toReview.isPending || !(listAnswered || loaded || list.isError);
  const aside = asideBusy ? (
    <AsideSkeleton rows={1} />
  ) : (
    <>
      {lakes.length ? <ReviewPrompt lakes={lakes} layout="stack" /> : null}
      {heroEmpty ? <HeroFeatures variant="aside" /> : <FindLakeCard />}
    </>
  );

  let body;
  // The cards read the browser's clock (live progress, «Începe mâine»): none before it exists.
  if (list.isPending || now === null) {
    body = <BookingCardsSkeleton />;
  } else if (failed) {
    body = (
      <ListError
        title="Nu am putut încărca rezervările."
        description="Verifică conexiunea și încearcă din nou."
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
        attempt={Math.max(1, list.errorUpdateCount)}
      />
    );
  } else if (rows.length === 0) {
    body = !settled ? null : bucket === 'all' && !sub ? (
      <EmptyHero />
    ) : (
      <p data-testid="bookings-empty" className="py-10 text-center t-body text-muted">
        {myEmptyCopy(bucket, sub)}
      </p>
    );
  } else {
    body = (
      <>
        <ul aria-label={MY_BUCKET_LABELS[bucket]} className={GRID}>
          {rows.map((b) => (
            <li key={b.documentId} className="flex">
              <BookingRow booking={b} nowMs={now} href={bookingHref(b.documentId)} className="w-full" />
            </li>
          ))}
        </ul>
        <ListFooter
          hasMore={Boolean(list.hasNextPage)}
          loadingMore={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
          error={list.isFetchNextPageError}
          errorLabel="Nu am putut încărca mai multe rezervări."
          spinner
        />
      </>
    );
  }

  return (
    <MyBookingsFrame
      back={{ onClick: back, label: 'Înapoi' }}
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          aria-busy={refreshing || undefined}
          className={pageToolClass()}
        >
          <ArrowPathIcon aria-hidden className={cn(refreshing && 'animate-spin motion-reduce:animate-none')} />
          <span className="sr-only md:not-sr-only">Reîmprospătează</span>
        </button>
      }
      chrome={<BookingsChrome bucket={bucket} sub={sub} pendingCount={pendingCount} onBucket={onBucket} onSub={onSub} />}
      aside={aside}
      asideBusy={asideBusy}
    >
      {lakes.length ? (
        <div className="xl:hidden">
          <ReviewPrompt lakes={lakes} />
        </div>
      ) : null}
      <section id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${bucket}`} aria-busy={list.isPending || undefined}>
        {body}
      </section>
    </MyBookingsFrame>
  );
}
