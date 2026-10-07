'use client';

import { useId, useMemo, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, BellIcon } from '@heroicons/react/24/outline';
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
import { track } from '@/lib/analytics';
import { createBrowserTransport } from '@/lib/client/transport';
import { notificationHref } from '@/lib/notification-href';
import { MarkAllRead } from './MarkAllRead';
import { NotificationRow } from './NotificationRow';
import { useSiteToast } from '../../_shell/Toast';
import { ASIDE_SKELETON, NotificationRowsSkeleton, NotificationsFrame } from './NotificationsSkeleton';
import { useBackOrHome } from './back';
import { ROWS } from './styles';

/** fish notifications.tsx:40 — `useNotificationsForLoggedUser({ pageSize: 10 })` (c5). */
export const NOTIFICATIONS_PAGE_SIZE = 10;

/**
 * /notificari (account.notifications, T1 without filters) — fish app/(app)/notifications.tsx.
 * Rendered only for a signed-in viewer (the page's requireViewer gate: c12), so the query is on.
 *
 * - c1 first load: the rows' skeleton; a failure: the T1 error card with «Încearcă din nou», and for
 *   a session that died after the gate (401 on a refetch) «Deconectează-te» — signing out refreshes
 *   the page, whose gate sends the visitor to /intra?next=/notificari (fish ErrorScreen showSignOut).
 *   The card replaces the list only when nothing is loaded: a failed next page keeps the rows and
 *   says so in the footer, a failed «Reîmprospătează» keeps them and says so in a toast.
 * - c2 header: back (history, else Acasă — fish goBackOrHome) and «Notificări».
 * - c3/c4 «Citește tot» while a loaded row is unread or the top bar's count is above 0 (MarkAllRead
 *   reads everything on the server): in the header below 1280, in the summary column from 1280
 *   (with that unread count).
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
  const router = useRouter();
  const toast = useSiteToast();
  const back = useBackOrHome();
  const titleId = useId();

  const list = useInfiniteQuery(notificationsForLoggedUserInfiniteQuery(t, { pageSize: NOTIFICATIONS_PAGE_SIZE }));
  // The top bar's own count (same key): the summary column says the number the bell's dot stands for.
  const unread = useQuery(unreadNotificationsCountQuery(t));
  const { mutate: markRead } = useMutation(markNotificationAsReadMutation(t, qc));

  const items = useMemo(() => dedupeRows(list.data?.pages.flatMap((page) => page.data) ?? []), [list.data]);
  const loaded = list.data !== undefined;
  const hasUnread = items.some((n) => !n.read);
  // «Citește tot» reads everything on the server: offer it whenever the server's count or a loaded
  // row says something is unread (unread rows past the loaded pages, or a count not yet re-read).
  const canMarkAll = (unread.data ?? 0) > 0 || hasUnread;
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

  // fish ErrorScreen «Deconectează-te» — the one way out of a session that died after the gate.
  const [signingOut, startSignOut] = useTransition();
  const signOut = () => {
    if (signingOut) return;
    startSignOut(async () => {
      const ok = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
        .then((r) => r.ok)
        .catch(() => false);
      if (!ok) return;
      qc.clear();
      // The page's gate sees no session and sends the visitor to /intra?next=/notificari.
      startSignOut(() => router.refresh());
    });
  };

  const focusTitle = () => document.getElementById(titleId)?.focus();

  const header = (
    <ListHeader
      title="Notificări"
      titleId={titleId}
      back={{ label: 'Înapoi', onClick: back }}
      actions={
        loaded ? (
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
            {canMarkAll ? <MarkAllRead t={t} onDone={focusTitle} className={cn(pageToolClass({ iconOnly: false }), 'xl:hidden')} /> : null}
          </>
        ) : null
      }
    />
  );

  const summary = (
    <Summary
      count={unread.data}
      hasUnread={hasUnread}
      markAll={<MarkAllRead t={t} onDone={focusTitle} className={buttonClass({ variant: 'outline', block: true })} />}
    />
  );

  let body;
  // The summary column is there in every state from 1280 (its track never empties: NotificationsFrame);
  // a first load that failed leaves it empty — no count to say, no skeleton shimmering forever.
  let aside: ReactNode = null;
  if (list.isPending) {
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
            <Button variant="outline" aria-disabled={signingOut || undefined} aria-busy={signingOut || undefined} onClick={signOut}>
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
    aside = summary;
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
 * The summary column (≥1280): how many notifications are unread — the top bar's count, so the page
 * and the bell's dot agree — and «Citește tot» whenever that count or a loaded row says something is
 * unread (the same rule as the header's copy; the server action reads everything). «Le-ai citit pe
 * toate.» only when both agree nothing is; a count of 0 against an unread loaded row (a count not
 * re-read yet) says no number (rule 4) and keeps the button. A link to the notification settings
 * joins it when /setari/notificari ships (account.notification-settings).
 */
function Summary({ count, hasUnread, markAll }: { count: number | undefined; hasUnread: boolean; markAll: ReactNode }) {
  const canMarkAll = (count ?? 0) > 0 || hasUnread;
  return (
    <AsideSection title="Rezumat">
      {count === undefined ? (
        <span aria-hidden className="h-7 w-32 animate-shimmer rounded-full" />
      ) : count > 0 ? (
        <p className="t-title2 text-ink" data-testid="notifications-unread-count">
          {formatCount(count, 'necitită', 'necitite')}
        </p>
      ) : !hasUnread ? (
        <p className="t-body text-ink-2" data-testid="notifications-unread-count">
          Le-ai citit pe toate.
        </p>
      ) : null}
      {canMarkAll ? markAll : null}
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
