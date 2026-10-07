'use client';

import { ArrowPathIcon, Cog6ToothIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery, useQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound, usePathname } from 'next/navigation';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { useViewerState } from '@/app/(site)/_shell/viewer-context';
import { isUnknownViewer, userOf } from '@/app/(site)/_shell/viewer-state';
import { FollowButton } from '@/components/cards/FollowButton';
import { ListError, ListFooter, ListTabs } from '@/components/templates/T1';
import { COLUMN_STICKY_TOP, DetailBackButton, headerChipClass } from '@/components/templates/T3';
import { DashboardRefresh } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  anglerCatchesInfiniteQuery,
  anglerCompetitionsInfiniteQuery,
  anglerProfileQuery,
  anglerSessionsInfiniteQuery,
  dedupeByKey,
  groupPublicSessionsByMonth,
  type AnglerProfile,
  type CompetitionsHistoryFilter,
  type PublicSession,
  type getAnglerCatches,
  type getAnglerCompetitions,
  type getAnglerSessions,
} from '@/core/social';
import { formatCount } from '@/core/realtime/chat/format';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { CatchGrid } from './CatchGrid';
import { CompetitionHistoryCard } from './CompetitionHistoryCard';
import { FilterChips, type ChipOption } from './FilterChips';
import { ProfileHeader } from './ProfileHeader';
import { ProfileHeaderSkeleton, ProfileTabSkeleton } from './ProfileSkeleton';
import { SessionHistoryCard } from './SessionHistoryCard';
import { PROFILE_TABS, type ProfileTab } from './tabs';
import { useFollowAngler } from './useFollowAngler';

/**
 * An angler's profile — fish components/profile/AnglerProfileScreen.tsx (parity
 * account.angler-profile, account.own-profile; template T3, owner rules 1, 3, 13, 20).
 *
 * Shared API (the own profile /profil imports it; keep it stable):
 *
 *   <Suspense fallback={…}>                       // it reads the session (useViewerState)
 *     <AnglerProfileView documentId={id} mode="other" initialTab="capturi" />
 *   </Suspense>
 *
 *  - `mode="other"` (/pescari/[id]): below 1280 a back control (DetailBackButton; home when there
 *    is no history, c35 — from 1280 the breadcrumb is the way back), the follow button unless the profile is the viewer's own (isSelf, c38 keeps
 *    the back control), the page's breadcrumb «Acasă › {nume}».
 *  - `mode="own"` (/profil): the settings cog to /setari and no back (account.own-profile c3), no
 *    follow, a header skeleton without the follow pill (c4); the page sets its own breadcrumb.
 *  - `initialTab`: the server's `?tab=` (the tab whose first page the server prefetched into the
 *    HydrationBoundary). Switching tabs keeps the URL in step (`?tab=`, Capturi bare) without a
 *    server round trip, and only the selected tab's list is ever requested (c16).
 *
 * Data: the header is per viewer — GET /feed/anglers/{id} through the /api/cms proxy with the
 * session (core anglerProfileQuery, auth required; 404 ANGLER:NOT_FOUND → notFound()). The three
 * tab lists are public (auth: false on the CMS, edge-cached, tag angler-<id>) and render for guests
 * too: signed out there is no header (we do not know the name — owner rule 4), a quiet sign-in hint
 * in its place («Intră ca să vezi pescarul» + a secondary follow button, next = this page), then
 * the tabs (web deviation from fish's redirect, c1 web_note); an empty first page tells a guest to
 * sign in, never «Nicio … încă» (an unknown id answers the public lists with [] too). An unknown session shows the
 * neutral header skeleton, never the guest hint.
 *
 * Layout: phone / tablet = fish's column (white header band, the tab bar, the selected list on
 * the grey ground). ≥1280 = two columns: the identity card left (sticky under the bar), the tabs
 * and the list right — a full-width page (ROADMAP §4), the grids auto-fill.
 */
export function AnglerProfileView({ documentId, mode, initialTab = 'capturi' }: { documentId: string; mode: 'own' | 'other'; initialTab?: ProfileTab }) {
  const viewer = useViewerState();
  const unknown = isUnknownViewer(viewer);
  const signedIn = !!userOf(viewer);
  /** Known to be signed out (not a session still being read). */
  const guest = !unknown && !signedIn;
  const t = useMemo(() => createBrowserTransport(), []);
  const pathname = usePathname() ?? routes.angler(documentId);

  const profileQ = useQuery(anglerProfileQuery(t, documentId, { isAuthenticated: signedIn }));
  if (profileQ.error && isApiError(profileQ.error) && profileQ.error.status === 404) notFound();
  const profile = profileQ.data;

  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [compChip, setCompChip] = useState<CompChip>('toate');
  const [yearChip, setYearChip] = useState<string>('all');
  const compFilter: CompetitionsHistoryFilter = compChip === 'toate' ? undefined : compChip;
  const compYear = yearChip === 'all' ? undefined : Number(yearChip);

  // Only the selected tab's query is enabled (fish passes `undefined` to the others).
  const catchesQ = useInfiniteQuery(anglerCatchesInfiniteQuery(t, tab === 'capturi' ? documentId : undefined));
  const sessionsQ = useInfiniteQuery(anglerSessionsInfiniteQuery(t, tab === 'sesiuni' ? documentId : undefined));
  const compsQ = useInfiniteQuery(anglerCompetitionsInfiniteQuery(t, tab === 'concursuri' ? documentId : undefined, { filter: compFilter, year: compYear }));
  const activeQ = tab === 'capturi' ? catchesQ : tab === 'sesiuni' ? sessionsQ : compsQ;

  const select = (next: ProfileTab) => {
    setTab(next);
    // The URL follows the tab (shareable, back to the same tab), without a server round trip.
    try {
      window.history.replaceState(window.history.state, '', next === 'capturi' ? pathname : `${pathname}?tab=${next}`);
    } catch {
      // Sandboxed frames may refuse it; the tab still switches.
    }
  };

  // c33: refreshing refetches the header and the selected tab together.
  const refresh = async () => {
    const results = await Promise.all([signedIn ? profileQ.refetch() : null, activeQ.refetch()]);
    return !results.some(r => r?.isError);
  };

  const header: ReactNode = unknown || (signedIn && profileQ.isPending) ? (
    <ProfileHeaderSkeleton mode={mode} />
  ) : !signedIn ? (
    <GuestHint documentId={documentId} />
  ) : profile ? (
    <ProfileHeader profile={profile} mode={mode} signedIn={signedIn} />
  ) : (
    <ListError title="Nu am putut încărca profilul." onRetry={() => void profileQ.refetch()} retrying={profileQ.isFetching} attempt={profileQ.errorUpdateCount} />
  );

  return (
    <div className="flex min-h-dvh flex-col pb-12" data-testid="angler-profile" data-mode={mode}>
      {mode === 'other' ? <Crumbs profile={profile} signedIn={signedIn} /> : null}
      {!profile ? <h1 className="sr-only">Profil de pescar</h1> : null}
      <div
        className={cn(
          'flex flex-col xl:grid xl:items-start xl:gap-x-6 xl:px-8',
          'xl:grid-cols-[--spacing(90)_minmax(0,1fr)] 2xl:grid-cols-[--spacing(100)_minmax(0,1fr)]',
        )}
      >
        {/* Phone / tablet: fish's header row (back · refresh · settings) on the white band. From
            1280 there is no such row (rule 1: the breadcrumb is the way back, the identity card and
            the tabs start right under it); refresh and settings move into the tab bar's end. */}
        <div className="flex min-h-14 items-center gap-2 bg-surface px-4 pt-2 md:px-6 xl:hidden">
          {mode === 'other' ? <DetailBackButton fallbackHref={routes.home()} /> : null}
          <span className="flex-1" />
          <DashboardRefresh onRefresh={refresh} />
          {mode === 'own' ? <SettingsChip /> : null}
        </div>

        <aside
          aria-label={profile ? `Despre ${profile.username}` : 'Despre pescar'}
          className={cn(
            'bg-surface px-5 pt-1 pb-5 md:px-6',
            'xl:sticky xl:mt-4 xl:max-h-[calc(100dvh-(--spacing(28)))] xl:overflow-y-auto xl:rounded-card xl:p-6 xl:shadow-e0',
            COLUMN_STICKY_TOP,
          )}
        >
          {header}
        </aside>

        <div className="flex min-w-0 flex-col xl:mt-4">
          {/* Rule 20: the switcher is one container — the white band below 1280 (the header's), a
              white card of its own from 1280 — with the accent underline on the selected tab and the
              counts we know as badges (signed in; a guest gets none, rule 4). Capturi never carries
              counts.catches: the grid lists only the catches with a photo. */}
          <div className="flex items-end gap-2 bg-surface md:px-6 xl:rounded-card xl:px-5 xl:pt-1.5 xl:shadow-e0">
            <ListTabs<ProfileTab>
              label="Istoricul pescarului"
              tabs={PROFILE_TABS.map(key => tabSpec(key, profile))}
              active={tab}
              onSelect={select}
              controls={PANEL_ID}
              className="min-w-0 flex-1 max-md:gap-0 max-md:*:flex-1 max-md:*:justify-center max-md:*:pt-2.5 xl:flex-none xl:border-b-0"
            />
            <span className="flex-1 max-xl:hidden" />
            <div className="flex items-center gap-2 self-center pb-1 max-xl:hidden">
              <RefreshChip onRefresh={refresh} />
              {mode === 'own' ? <SettingsChip compact /> : null}
            </div>
          </div>
          <div
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={`${PANEL_ID}-tab-${tab}`}
            aria-busy={activeQ.isPending || activeQ.isFetchingNextPage || undefined}
            className="flex flex-col md:px-6 md:pt-4 xl:px-0"
            data-testid={`panel-${tab}`}
          >
            <h2 className="sr-only">{TAB_LABELS[tab]}</h2>
            {tab === 'capturi' ? <CatchesPanel q={catchesQ} guest={guest} allCatches={profile?.counts.catches} /> : null}
            {tab === 'sesiuni' ? <SessionsPanel q={sessionsQ} guest={guest} /> : null}
            {tab === 'concursuri' ? (
              <CompetitionsPanel
                q={compsQ}
                guest={guest}
                knownTotal={profile?.counts.competitions}
                compChip={compChip}
                yearChip={yearChip}
                onCompChip={setCompChip}
                onYearChip={setYearChip}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const PANEL_ID = 'profil-istoric';

const TAB_LABELS: Record<ProfileTab, string> = { capturi: 'Capturi', sesiuni: 'Sesiuni', concursuri: 'Concursuri' };

/** A tab with its count badge when the header gave us one (Sesiuni = counts.sessions, the public ones). */
function tabSpec(key: ProfileTab, profile: AnglerProfile | undefined) {
  const count = !profile ? undefined : key === 'sesiuni' ? profile.counts.sessions : key === 'concursuri' ? profile.counts.competitions : undefined;
  return { key, label: TAB_LABELS[key], count, accessibleLabel: count ? `${TAB_LABELS[key]}, ${count}` : undefined };
}

/** The own profile's settings cog: the header row's chip, or (compact) the ≥1280 tab bar's. */
function SettingsChip({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href={routes.settings()}
      aria-label="Setări"
      title={compact ? 'Setări' : undefined}
      className={headerChipClass({ size: compact ? 'size-10' : undefined })}
      data-testid="profile-settings-button"
    >
      <Cog6ToothIcon aria-hidden />
    </Link>
  );
}

/**
 * ≥1280: refresh as a compact icon chip at the tab bar's end (a tooltip names it), not a lone text
 * button across the page — fish's pull-to-refresh has no desktop gesture, so it stays reachable.
 * Same contract as T5 DashboardRefresh (`false` = failed, announced politely; focusable while busy).
 */
function RefreshChip({ onRefresh }: { onRefresh: () => Promise<boolean> }) {
  const [, start] = useTransition();
  const [outcome, setOutcome] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle');
  const pending = outcome === 'pending';
  const run = () => {
    if (pending) return;
    setOutcome('pending');
    start(async () => {
      try {
        setOutcome((await onRefresh()) ? 'done' : 'failed');
      } catch {
        setOutcome('failed');
      }
    });
  };
  return (
    <>
      <button
        type="button"
        aria-label="Reîmprospătează"
        title="Reîmprospătează"
        onClick={run}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        className={headerChipClass({ size: 'size-10' })}
        data-testid="profile-refresh-chip"
      >
        <ArrowPathIcon aria-hidden className={cn(pending && 'animate-spin motion-reduce:animate-none')} />
      </button>
      <span role="status" className="sr-only">
        {outcome === 'pending' ? 'Se actualizează…' : outcome === 'done' ? 'Actualizat' : outcome === 'failed' ? 'Nu s-a putut actualiza' : ''}
      </span>
    </>
  );
}

type CompChip = 'toate' | 'podium' | 'individual' | 'team';

const COMP_CHIPS: ChipOption<CompChip>[] = [
  { value: 'toate', label: 'Toate' },
  { value: 'podium', label: 'Pe podium' },
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Echipe' },
];

/** «Oricând | {anul curent} | {anul trecut}» (fish YEAR_CHIPS), in Romania's calendar. */
function yearChips(): ChipOption<string>[] {
  const year = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', year: 'numeric' }).format(new Date()));
  return [
    { value: 'all', label: 'Oricând' },
    { value: String(year), label: String(year) },
    { value: String(year - 1), label: String(year - 1) },
  ];
}

function Crumbs({ profile, signedIn }: { profile: AnglerProfile | undefined; signedIn: boolean }) {
  if (signedIn && !profile) return null;
  return <SetBreadcrumb trail={[{ label: 'Acasă', href: routes.home() }, { label: profile ? profile.username : 'Profil de pescar' }]} />;
}

/**
 * Signed out: the header we cannot show (rule 4) becomes ONE quiet sign-in moment (rule 18) — a
 * muted line and a secondary-look follow button (account.b.guest-follow: shown to guests, a press
 * opens sign-in with this page as the way back), never the filled accent profile button for a
 * person we cannot even name. The site header's «Intră» is the only other entry. Phone / tablet:
 * one row that fits 375 on one line, clear of the chip row above; ≥1280 the identity card's
 * column, the button full width like the signed-in card's.
 */
function GuestHint({ documentId }: { documentId: string }) {
  const follow = useFollowAngler(documentId, { signedIn: false });
  return (
    <div className="flex items-center gap-3 pt-3 xl:flex-col xl:gap-3 xl:py-2 xl:text-center" data-testid="guest-hint">
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-soft-fill text-muted max-xl:hidden">
        <UserCircleIcon className="size-7" />
      </span>
      <p className="min-w-0 flex-1 t-body text-muted">Intră ca să vezi pescarul</p>
      <div className="w-30 shrink-0 xl:w-full">
        <FollowButton following={false} onToggle={follow.toggle} name="acest pescar" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The tab panels
 * ---------------------------------------------------------------------------------------------- */

type CatchesQ = UseInfiniteQueryResult<InfiniteData<Awaited<ReturnType<typeof getAnglerCatches>>, unknown>>;

/**
 * Signed out, an empty first page proves nothing: the public lists answer an unknown or deleted id
 * with an empty list too, so a guest is told what would show it, not «Nicio … încă» (rule 4).
 */
const GUEST_EMPTY = 'Intră în cont ca să vezi profilul';

function Empty({ children }: { children: string }) {
  return (
    <p className="mx-4 my-8 text-center t-body-strong text-muted md:mx-0" data-testid="tab-empty">
      {children}
    </p>
  );
}

function more(q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }) {
  return () => {
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  };
}

function CatchesPanel({ q, guest, allCatches }: { q: CatchesQ; guest: boolean; /** The header's counts.catches (signed in). */ allCatches: number | undefined }) {
  const catches = useMemo(() => dedupeByKey((q.data?.pages ?? []).flatMap(p => p.data), c => c.key), [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? catches.length;
  const loadMore = more(q);
  if (q.isPending) return <ProfileTabSkeleton tab="capturi" />;
  if (q.isError && !q.data) return <TabError what="capturile" onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />;
  if (!catches.length) return <Empty>{guest ? GUEST_EMPTY : 'Nicio captură încă'}</Empty>;
  return (
    <>
      {/* The header counts every catch; the grid only those with a photo — say so, or «57 Capturi»
          over one tile reads as broken. */}
      {allCatches !== undefined && total < allCatches ? (
        <p className="px-4 pt-3 pb-2 t-caption text-muted md:px-0 md:pt-0" data-testid="catches-photo-note">
          Doar capturile cu fotografie: {formatCount(total, 'fotografie', 'fotografii')} din {formatCount(allCatches, 'captură', 'capturi')}
        </p>
      ) : null}
      <CatchGrid catches={catches} total={total} onLoadMore={loadMore} fetchingMore={q.isFetchingNextPage} moreFailed={q.isFetchNextPageError} />
      <ListFooter hasMore={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} error={q.isFetchNextPageError} onLoadMore={loadMore} errorLabel="Nu am putut încărca mai multe capturi." />
    </>
  );
}

type SessionsQ = UseInfiniteQueryResult<InfiniteData<Awaited<ReturnType<typeof getAnglerSessions>>, unknown>>;

function SessionsPanel({ q, guest }: { q: SessionsQ; guest: boolean }) {
  const groups = useMemo(() => {
    const rows = groupPublicSessionsByMonth(dedupeByKey((q.data?.pages ?? []).flatMap(p => p.data), s => s.documentId));
    const out: { label: string; sessions: PublicSession[] }[] = [];
    for (const row of rows) {
      if (row.type === 'header') out.push({ label: row.label, sessions: [] });
      else if (out.length) out[out.length - 1].sessions.push(row.session);
      else out.push({ label: '', sessions: [row.session] });
    }
    return out;
  }, [q.data]);
  if (q.isPending) return <ProfileTabSkeleton tab="sesiuni" />;
  if (q.isError && !q.data) return <TabError what="partidele" onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />;
  if (!groups.length) return <Empty>{guest ? GUEST_EMPTY : 'Nicio partidă publică încă'}</Empty>;
  return (
    <>
      <div className="flex flex-col gap-2 px-4 md:px-0" data-testid="sessions">
        {groups.map((g, i) => (
          <section key={`${g.label}-${i}`} aria-label={g.label || undefined} data-testid="session-month">
            {g.label ? <h3 className="pt-4 pb-2 t-micro-strong tracking-[1px] text-muted md:pt-2">{g.label}</h3> : null}
            <ul className="grid gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))]">
              {g.sessions.map(s => (
                <li key={s.documentId} className="flex" data-testid="session-card">
                  <SessionHistoryCard session={s} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ListFooter hasMore={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} error={q.isFetchNextPageError} onLoadMore={more(q)} errorLabel="Nu am putut încărca mai multe partide." />
    </>
  );
}

type CompsQ = UseInfiniteQueryResult<InfiniteData<Awaited<ReturnType<typeof getAnglerCompetitions>>, unknown>>;

function CompetitionsPanel({
  q,
  guest,
  knownTotal,
  compChip,
  yearChip,
  onCompChip,
  onYearChip,
}: {
  q: CompsQ;
  guest: boolean;
  /** The header's counts.competitions (signed in); undefined for a guest. */
  knownTotal: number | undefined;
  compChip: CompChip;
  yearChip: string;
  onCompChip: (v: CompChip) => void;
  onYearChip: (v: string) => void;
}) {
  const items = useMemo(() => dedupeByKey((q.data?.pages ?? []).flatMap(p => p.data), i => i.competition.documentId), [q.data]);
  const years = useMemo(() => yearChips(), []);
  const filtered = compChip !== 'toate' || yearChip !== 'all';
  // Rule 4: chips over an angler with no competitions at all would offer filters that cannot help.
  // Known from the header's count (signed in), else (a guest) from the unfiltered list itself once
  // it answered empty.
  const noneAtAll =
    knownTotal !== undefined ? knownTotal === 0 : !filtered && !q.isPending && !q.isPlaceholderData && !q.isError && !items.length;
  const reset = () => {
    onCompChip('toate');
    onYearChip('all');
  };
  return (
    <>
      {noneAtAll ? null : (
        <div className="flex flex-col gap-2 py-3 md:pt-0" data-testid="competition-filters">
          <FilterChips label="Tip concurs" options={COMP_CHIPS} selected={compChip} onSelect={onCompChip} />
          <FilterChips label="An" options={years} selected={yearChip} onSelect={onYearChip} />
        </div>
      )}
      {q.isPending || (q.isPlaceholderData && !items.length) ? (
        <ProfileTabSkeleton tab="concursuri" />
      ) : q.isError && !q.data ? (
        <TabError what="concursurile" onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />
      ) : !items.length ? (
        filtered && !noneAtAll ? (
          // A filter emptied the list: say so, not that the angler has none (rule 4).
          <div className="mx-4 my-8 flex flex-col items-center gap-3 text-center md:mx-0">
            <p className="t-body-strong text-muted" data-testid="tab-empty">
              Niciun concurs pentru filtrele alese
            </p>
            <Button variant="secondary" size="compact" onClick={reset} data-testid="competition-filters-reset">
              Vezi toate concursurile
            </Button>
          </div>
        ) : (
          <Empty>{guest ? GUEST_EMPTY : 'Niciun concurs încă'}</Empty>
        )
      ) : (
        <>
          {/* keepPreviousData: the previous filter's cards stay while the new one loads (c27). */}
          <ul
            className={cn(
              'grid gap-3 px-4 transition-opacity duration-(--duration-fast) md:grid-cols-[repeat(auto-fill,minmax(--spacing(90),1fr))] md:px-0',
              q.isPlaceholderData && 'opacity-60',
            )}
            aria-busy={q.isPlaceholderData || undefined}
            data-testid="competitions"
            data-placeholder={q.isPlaceholderData || undefined}
          >
            {items.map(item => (
              <li key={item.competition.documentId} className="flex" data-testid="competition-card">
                <CompetitionHistoryCard item={item} />
              </li>
            ))}
          </ul>
          <ListFooter hasMore={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} error={q.isFetchNextPageError} onLoadMore={more(q)} errorLabel="Nu am putut încărca mai multe concursuri." />
        </>
      )}
    </>
  );
}

function TabError({ what, onRetry, retrying, attempt }: { what: string; onRetry: () => void; retrying: boolean; attempt: number }) {
  return (
    <div className="px-4 py-6 md:px-0">
      <ListError title={`Nu am putut încărca ${what}.`} onRetry={onRetry} retrying={retrying} attempt={attempt} />
    </div>
  );
}
