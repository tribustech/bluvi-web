'use client';

import { UsersIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { useBack } from '@/components/nav/useBack';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { ListEmpty, ListError, ListFooter, ListHeader, ListPage, ListRegion, ListTabs, type ListTab } from '@/components/templates/T1';
import { formatCount } from '@/core/realtime/chat/format';
import { anglerFollowersInfiniteQuery, anglerFollowingInfiniteQuery, anglerProfileQuery, dedupeByKey } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { ConnectionRow } from './ConnectionRow';
import { CONNECTIONS_GRID, OWNER_LINE, OwnerPlaceholder, RowsSkeleton, UNNAMED_TRAIL } from './ConnectionsSkeleton';
import type { ConnectionsTab } from './tab';

const REGION = 'conexiuni-lista';

/**
 * Conexiuni — fish app/(app)/anglers/[documentId]/connections.tsx (parity account.connections, T1).
 * Rendered behind the page's requireViewer gate (the CMS serves followers / following to a signed-in
 * user only, c1), so the viewer is always known here.
 *
 *  - Header: back (history, or the angler's profile on a direct visit) + h1 «Conexiuni» (c2); the
 *    angler's name as the caption once their profile is known (never a guess, owner rule 4).
 *  - Tabs «Urmăritori» / «Urmărește» (c3, rule 20: the kit tab bar, counts as badges from the
 *    angler's profile). The URL follows the tab (history.replaceState: no server round trip, no
 *    history entry per switch); followers is the bare URL.
 *  - Only the selected tab's list is requested (c4): core anglerFollowers/FollowingInfiniteQuery,
 *    pageSize 20, page-numbered. Rows repeated across pages are shown once (dedupeByKey, first
 *    kept — c10). The viewer's own row has no follow button (c5): `viewerId` is the gate's session
 *    documentId (fish reads it from GET /user/profile; the same id, without a second request).
 *  - States: seven skeleton rows (c7), the empty copy per tab (c8), the T1 error card with retry,
 *    the next page as the footer nears the viewport with the kit footer's button as the keyboard
 *    path (c9).
 */
export function ConnectionsList({
  documentId,
  viewerId,
  initialTab,
}: {
  documentId: string;
  viewerId: string;
  initialTab: ConnectionsTab;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const pathname = usePathname() ?? routes.anglerConnections(documentId);
  const [tab, setTab] = useState<ConnectionsTab>(initialTab);

  // The angler's header: the name under the title and the tab counts. Cached when we came from the
  // profile. An unknown id answers 404 ANGLER:NOT_FOUND → the profile's not-found page.
  const profileQ = useQuery(anglerProfileQuery(t, documentId));
  if (profileQ.error && isApiError(profileQ.error) && profileQ.error.status === 404) notFound();
  const profile = profileQ.data;
  // A follow pressed on a row before this profile answered cancels every in-flight ['anglers']
  // query (followAnglerMutation.onMutate), which leaves this one pending and idle with nothing to
  // refetch it — the owner line, the band's name and the tab badges would stay missing. Ask again.
  const profileStalled = profileQ.isPending && profileQ.fetchStatus === 'idle';
  const refetchProfile = profileQ.refetch;
  useEffect(() => {
    if (profileStalled) void refetchProfile();
  }, [profileStalled, refetchProfile]);

  const followersQ = useInfiniteQuery(anglerFollowersInfiniteQuery(t, tab === 'urmaritori' ? documentId : undefined));
  const followingQ = useInfiniteQuery(anglerFollowingInfiniteQuery(t, tab === 'urmareste' ? documentId : undefined));
  const activeQ = tab === 'urmaritori' ? followersQ : followingQ;

  const items = useMemo(
    () =>
      dedupeByKey(
        (activeQ.data?.pages ?? []).flatMap(p => p.data),
        item => item.documentId,
      ),
    [activeQ.data],
  );
  const total = activeQ.data?.pages.at(-1)?.meta.pagination.total;

  const select = (next: ConnectionsTab) => {
    if (next === tab) return;
    setTab(next);
    try {
      window.history.replaceState(window.history.state, '', next === 'urmaritori' ? pathname : `${pathname}?tab=${next}`);
    } catch {
      // Sandboxed frames may refuse it; the tab still switches.
    }
  };

  // In-app history only (fish BackButton's canGoBack): a direct visit, another site before this
  // one or the OAuth round trip falls back to the angler's profile (c2).
  const back = useBack(routes.angler(documentId));

  const followersN = profile?.counts.followers;
  const followingN = profile?.counts.following;
  const tabs: ListTab<ConnectionsTab>[] = [
    { key: 'urmaritori', label: 'Urmăritori', count: followersN, accessibleLabel: followersN ? `Urmăritori, ${grouped(followersN)}` : undefined },
    { key: 'urmareste', label: 'Urmărește', count: followingN, accessibleLabel: followingN ? `Urmărește, ${grouped(followingN)}` : undefined },
  ];

  const empty = tab === 'urmaritori' ? 'Niciun urmăritor încă' : 'Nu urmărește pe nimeni încă';

  let body;
  if (activeQ.isPending) {
    body = <RowsSkeleton />;
  } else if (activeQ.isError && !activeQ.data) {
    body = (
      <ListError
        title={tab === 'urmaritori' ? 'Nu am putut încărca urmăritorii' : 'Nu am putut încărca pescarii urmăriți'}
        onRetry={() => void activeQ.refetch()}
        retrying={activeQ.isFetching}
        attempt={activeQ.errorUpdateCount}
      />
    );
  } else if (items.length === 0) {
    body = <ListEmpty title={empty} icon={<UsersIcon aria-hidden className="size-12 stroke-[1.5]" />} />;
  } else {
    body = (
      <>
        <ul aria-label={tab === 'urmaritori' ? 'Urmăritori' : 'Urmărește'} className={CONNECTIONS_GRID} data-testid="connections-list">
          {items.map(item => (
            <ConnectionRow key={item.documentId} item={item} isSelf={item.documentId === viewerId} />
          ))}
        </ul>
        <ListFooter
          hasMore={!!activeQ.hasNextPage}
          loadingMore={activeQ.isFetchingNextPage}
          onLoadMore={() => void activeQ.fetchNextPage()}
          error={activeQ.isFetchNextPageError}
          shown={items.length}
          total={total}
          formatTotal={n => (tab === 'urmaritori' ? countOf(n, 'urmăritor', 'urmăritori') : countOf(n, 'pescar', 'pescari'))}
          errorLabel="Nu am putut încărca mai mulți pescari."
        />
      </>
    );
  }

  return (
    <>
      {/* ≥768 band: «Acasă / {nume} / Conexiuni» once the name is known; «Acasă / Conexiuni» before it
          and when the profile failed (the same root, never the URL-derived «Pescari»). */}
      <SetBreadcrumb
        trail={
          profile
            ? [
                { label: 'Acasă', href: routes.home() },
                { label: profile.username, href: routes.angler(documentId) },
                { label: 'Conexiuni' },
              ]
            : UNNAMED_TRAIL
        }
      />
      <ListPage
        header={
          <ListHeader
            title="Conexiuni"
            description={
              profile ? (
                <Owner documentId={documentId} username={profile.username} avatarUrl={profile.avatarUrl} />
              ) : profileQ.isPending ? (
                <OwnerPlaceholder />
              ) : (
                // The profile failed: no name (rule 4), but the line keeps its box so nothing moves.
                <span aria-hidden className={OWNER_LINE} />
              )
            }
            back={{ label: 'Înapoi', onClick: back }}
            below={<ListTabs tabs={tabs} active={tab} onSelect={select} label="Conexiuni" controls={REGION} />}
          />
        }
      >
        <ListRegion
          id={REGION}
          tabpanel
          labelledBy={`${REGION}-tab-${tab}`}
          busy={activeQ.isFetching && !activeQ.isFetchingNextPage && !activeQ.isPending}
        >
          {body}
        </ListRegion>
      </ListPage>
    </>
  );
}

/** ro-RO grouping («1.234»), the same figure the tab badge's title shows. */
const grouped = (n: number) => n.toLocaleString('ro-RO');

/** formatCount's plural and «de», with the figure grouped: «20 din 1.234 de urmăritori». */
const countOf = (n: number, singular: string, plural: string) => formatCount(n, singular, plural).replace(/^\d+/, grouped(n));

/**
 * Whose connections these are — the page's context, so an identity line rather than a caption: a
 * 24px avatar (the tone keyed by documentId, as on the profile header and the rows) and the name as
 * a link back to the profile (the phone has no breadcrumb), one line, the full name as the title
 * when cut. The same 24px box as the placeholder before it (OWNER_LINE). The kit ring (a white
 * rim) keeps the disc readable on the page background, which the neutral tone matches.
 */
function Owner({ documentId, username, avatarUrl }: { documentId: string; username: string; avatarUrl: string | null }) {
  return (
    <span className={OWNER_LINE}>
      <Avatar name={username} src={avatarUrl} size={24} tone={toneForId(documentId)} ring />
      <Link
        href={routes.angler(documentId)}
        title={username}
        data-testid="connections-owner"
        className="min-w-0 truncate t-body text-ink-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        {username}
      </Link>
    </span>
  );
}
