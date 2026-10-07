'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowPathIcon, BellIcon, ChevronRightIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import {
  getRouteForNotificationItem,
  markNotificationAsReadMutation,
  notificationsForLoggedUserInfiniteQuery,
  unreadNotificationsCountQuery,
  type NotificationResponse,
} from '@/core/social';
import { AsideSection, describeError, ListEmpty, ListError, ListFooter, ListHeader, pageToolClass } from '@/components/templates/T1';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import { isApiError } from '@/core/transport';
import { track } from '@/lib/analytics';
import { useSignOut } from '@/lib/client/sign-out';
import { createBrowserTransport } from '@/lib/client/transport';
import { notificationHref } from '@/lib/notification-href';
import { routes } from '@/lib/routes';
import { MarkAllRead } from './MarkAllRead';
import { NotificationRow } from './NotificationRow';
import { useSiteToast } from '../../_shell/Toast';
import { ASIDE_SKELETON, NotificationRowsSkeleton, NotificationsFrame } from './NotificationsSkeleton';
import { useBackOrHome } from './back';
import { ROWS } from './styles';

/** fish notifications.tsx:40 — `useNotificationsForLoggedUser({ pageSize: 10 })` (c5). */
export const NOTIFICATIONS_PAGE_SIZE = 10;

/** The way to /setari/notificari (the header's gear 768–1279, the summary's row from 1280; ☰ on a phone). */
const SETTINGS_LINK = 'Setări notificări';

/**
 * /notificari (account.notifications, T1 without filters) — fish app/(app)/notifications.tsx.
 * Rendered only for a signed-in viewer (the page's requireViewer gate: c12), so the query is on.
 *
 * - c1 first load: the rows' skeleton; a failure: the T1 error card with «Încearcă din nou». A
 *   session that died after the gate (SESSION_DEAD) keeps the skeleton: the providers' onSessionDead
 *   already signs out once, toasts «Sesiunea ta a expirat…» and sends the visitor to
 *   /intra?next=/notificari (as setari, setari/notificari, setari/profil) — a sign-out card would only
 *   flash before it. Any other 401 (no dead-session message, so no global sign-out) gets fish's
 *   ErrorScreen showSignOut: «Deconectează-te» runs the site's one sign-out (useSignOut: Firebase,
 *   cache, the in-progress guard, the SIGN_OUT_FAILED toast) and lands on /intra?next=/notificari.
 *   The card replaces the list only when nothing is loaded: a failed next page keeps the rows and
 *   says so in the footer, a failed «Reîmprospătează» keeps them and says so in a toast.
 * - c2 header: back (history, else Acasă — fish goBackOrHome) and «Notificări».
 * - c3/c4 «Citește tot» only while a loaded row is unread (fish notifications.tsx:46-49,75): in the
 *   header below 1280, in the summary column from 1280. The top bar's count never drives it: the
 *   CMS counts notification-user rows whose notification is gone, which the list filters out
 *   (docs/private/cms-patches/M2-notifications.md), so the count alone can say «2 necitite» over a
 *   fully read list.
 * - c5 GET /notification-users, 10 a page, until page === pageCount (core nextPageParam).
 * - c8/c9/c13 a row with a page is a link: mark read (unread only), log
 *   notification_clicked_from_list, navigate; an unread row without one is a button that marks it
 *   read and logs it (redirect_url 'none'); a read row without one is plain text (NotificationRow).
 * - c10 «Nu există notificări».
 * - c11 fish's pull-to-refresh is the header's «Reîmprospătează»; the next page loads as the footer
 *   nears the viewport (ListFooter, with a button for keyboards), and says when the list ends.
 * - account.b.foreground-refresh: the list refetches on window focus (TanStack's default, stale
 *   after the client's 60 s); the top bar re-reads the unread count on focus and on this page.
 */
export function NotificationsScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const back = useBackOrHome();
  const titleId = useId();

  const list = useInfiniteQuery(notificationsForLoggedUserInfiniteQuery(t, { pageSize: NOTIFICATIONS_PAGE_SIZE }));
  // The top bar's own count (same key): the summary column says the number the bell's dot stands for.
  const unread = useQuery(unreadNotificationsCountQuery(t));
  const { mutate: markRead } = useMutation(markNotificationAsReadMutation(t, qc));

  const items = useMemo(() => dedupeRows(list.data?.pages.flatMap((page) => page.data) ?? []), [list.data]);
  const loaded = list.data !== undefined;
  const unreadLoaded = items.reduce((n, row) => (row.read ? n : n + 1), 0);
  const hasUnread = unreadLoaded > 0;
  const total = list.data?.pages.at(-1)?.meta.pagination.total;
  const refreshing = list.isRefetching && !list.isFetchingNextPage;

  const open = (n: NotificationResponse, href: string | null) => {
    track('notification_clicked_from_list', {
      notification_type: n.notification.type,
      notification_documentId: n.notification.documentId,
      notification_title: n.notification.title,
      redirect_url: href ?? 'none',
    });
    // fish marks with the NOTIFICATION's documentId (core markNotificationAsRead), not the row's.
    if (!n.read) markRead(n.notification.documentId);
  };

  const refresh = async () => {
    if (refreshing) return;
    // A failed refresh keeps the rows on screen (TanStack keeps `data`): say so instead.
    const result = await list.refetch();
    if (result.isError) toast('Nu am putut reîmprospăta notificările. Încearcă din nou.', 'danger');
  };

  // fish ErrorScreen «Deconectează-te» (a 401 the global dead-session handler does not take).
  const { signOut, signingOut } = useSignOut({ to: routes.signIn(routes.notifications()) });

  const focusTitle = () => document.getElementById(titleId)?.focus();

  const header = (
    <ListHeader
      title="Notificări"
      titleId={titleId}
      back={{ label: 'Înapoi', onClick: back }}
      actions={
        <>
          {loaded ? (
            <>
            <button
              type="button"
              onClick={() => void refresh()}
              aria-disabled={refreshing || undefined}
              aria-busy={refreshing || undefined}
              className={pageToolClass()}
            >
              <ArrowPathIcon aria-hidden className={cn(refreshing && 'animate-spin motion-reduce:animate-none')} />
              <span className="sr-only">{refreshing ? 'Se reîmprospătează…' : 'Reîmprospătează'}</span>
            </button>
            {/* From 1280 «Citește tot» is the summary column's labelled action. */}
            {hasUnread ? <MarkAllRead t={t} onDone={focusTitle} className={cn(pageToolClass({ iconOnly: false }), 'xl:hidden')} /> : null}
            </>
          ) : null}
          {/* The way to the notification settings (fish: Setări → Notificări; /setari is not on the web
              yet): this gear 768–1279, the summary column's row from 1280, the ☰ menu's row on a phone
              (a fourth header tool would squeeze the title there). */}
          <Link href={routes.notificationSettings()} className={cn(pageToolClass(), 'max-md:hidden md:w-12 md:px-0 md:[&>svg]:size-6 xl:hidden')}>
            <Cog6ToothIcon aria-hidden />
            <span className="sr-only">{SETTINGS_LINK}</span>
          </Link>
        </>
      }
    />
  );

  const summary = (
    <Summary
      count={unread.data}
      unreadLoaded={unreadLoaded}
      hasMore={list.hasNextPage}
      markAll={<MarkAllRead t={t} onDone={focusTitle} className={buttonClass({ variant: 'outline', block: true })} />}
    />
  );

  let body;
  // The summary column is there in every state from 1280 (its track never empties: NotificationsFrame);
  // a first load that failed leaves it empty — no count to say, no skeleton shimmering forever.
  let aside: ReactNode = null;
  if (list.isPending || (!loaded && isApiError(list.error) && list.error.code === 'SESSION_DEAD')) {
    body = <NotificationRowsSkeleton />;
    aside = ASIDE_SKELETON;
  } else if (list.isError && !loaded) {
    const e = describeError(list.error);
    body = (
      <ListError
        title={e.title}
        description={e.message}
        onRetry={e.canRetry ? () => void list.refetch() : undefined}
        retrying={list.isFetching}
        attempt={list.errorUpdateCount}
        secondaryAction={
          e.showSignOut ? (
            <Button variant="outline" aria-disabled={signingOut || undefined} aria-busy={signingOut || undefined} onClick={() => signOut()}>
              {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (items.length === 0) {
    body = (
      <ListEmpty
        icon={<BellIcon className="size-12" />}
        title="Nu există notificări"
        description="Aici apar noutățile despre concursurile, partidele și pescarii care te interesează."
      />
    );
    // Nothing to sum up: no count (a count here could only be rows the list cannot show), no
    // «Citește tot» — the settings row alone.
    aside = <Summary count={undefined} unreadLoaded={0} hasMore={false} empty />;
  } else {
    const now = new Date();
    body = (
      <>
        <ul aria-labelledby={titleId} className={ROWS}>
          {items.map((n) => {
            const route = getRouteForNotificationItem(n);
            const href = route ? notificationHref(route) : null;
            return <NotificationRow key={n.documentId} notification={n} href={href} now={now} onOpen={() => open(n, href)} />;
          })}
        </ul>
        <ListFooter
          hasMore={list.hasNextPage}
          loadingMore={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
          error={list.isFetchNextPageError}
          shown={items.length}
          total={total}
          formatTotal={(n) => formatCount(n, 'notificare', 'notificări')}
          errorLabel="Nu am putut încărca mai multe notificări."
          endLabel={(list.data?.pages.length ?? 0) > 1 ? 'Ai ajuns la finalul listei.' : undefined}
        />
      </>
    );
    aside = summary;
  }

  return (
    <NotificationsFrame header={header} aside={aside}>
      {body}
    </NotificationsFrame>
  );
}

/**
 * The summary column (≥1280). fish c3: «Citește tot» only while a loaded row is unread — the same
 * rule as the header's copy (MarkAllRead `markAll`). The number is the top bar's count (so the page
 * and the bell's dot agree) but only when the list backs it: a loaded row is unread and the count
 * covers at least the loaded unread rows (a count not re-read yet says no number — rule 4). The
 * CMS's count also includes rows whose notification is gone (M2-notifications.md), so with no
 * loaded unread row it is never shown. «Le-ai citit pe toate.» only when every row is loaded and
 * read; with pages left and none unread so far it says nothing (we do not know). `empty`: no
 * notifications at all — the settings row alone. Last, «Setări notificări» → /setari/notificari
 * (account.notification-settings; 768–1279 the header's gear, ☰ on a phone).
 */
function Summary({
  count,
  unreadLoaded,
  hasMore,
  markAll,
  empty = false,
}: {
  count: number | undefined;
  unreadLoaded: number;
  hasMore: boolean;
  markAll?: ReactNode;
  empty?: boolean;
}) {
  const hasUnread = unreadLoaded > 0;
  let status: ReactNode = null;
  if (empty) {
    // No status line: the list already says «Nu există notificări».
  } else if (hasUnread) {
    if (count === undefined) status = <span aria-hidden className="h-7 w-32 animate-shimmer rounded-full" />;
    else if (count >= unreadLoaded)
      status = (
        <p className="t-title2 text-ink" data-testid="notifications-unread-count">
          {formatCount(count, 'necitită', 'necitite')}
        </p>
      );
  } else if (!hasMore) {
    status = (
      <p className="t-body text-ink-2" data-testid="notifications-unread-count">
        Le-ai citit pe toate.
      </p>
    );
  }
  return (
    <AsideSection title="Rezumat">
      {status}
      {hasUnread ? markAll : null}
      <Link
        href={routes.notificationSettings()}
        className="-mx-2 flex min-h-12 items-center gap-3 rounded-control px-2 t-body-strong text-ink hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        <Cog6ToothIcon aria-hidden className="size-5 shrink-0" />
        <span className="flex-1">{SETTINGS_LINK}</span>
        <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
      </Link>
    </AsideSection>
  );
}

/**
 * The list is offset-paged by sentAt: a notification that arrives between two page loads shifts the
 * rows, so page N+1 can start with page N's last row. Keep the first occurrence (fish's FlatList
 * shows the repeat harmlessly with index keys; here keys are documentIds and must be unique).
 */
function dedupeRows(rows: NotificationResponse[]): NotificationResponse[] {
  const seen = new Set<string>();
  return rows.filter((n) => (seen.has(n.documentId) ? false : (seen.add(n.documentId), true)));
}
