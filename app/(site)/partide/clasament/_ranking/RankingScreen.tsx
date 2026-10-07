'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { AsideSection, AsideSkeleton, FOCUS_RING, ListEmpty, ListError, ListPage, ListTabs, TabsSkeleton, useListUrlState } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { communityStatsQuery, type CommunityStatsDTO, type StatsPeriod } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { PERIOD_TITLE } from '@/lib/stats-period';
import {
  ChipsSkeleton,
  EmptyIcon,
  PeriodChips,
  PeriodNumbers,
  SWITCHING_DIM,
  SwitchingBar,
  useShownPeriod,
  VenueHeader,
  WiderPeriodAction,
} from '@/app/(site)/ape-publice/_components/venue/bits';
import { useViewerState, userOf } from '../../../_shell/viewer-context';
import { AnglerPopover, useAnglerPopover, usePopoverEnabled } from './AnglerPopover';
import { AnglersTable } from './AnglersTable';
import { MePill } from './MePill';
import { DEFAULT_PLACE, placeFromParams, placeToParams, rankingOrder, TABS, type RankingPlace, type RankingTab } from './place';
import { Podium, PodiumSkeleton } from './Podium';
import { SpeciesList } from './SpeciesList';
import { TableSkeleton } from './table';
import { VenuesList } from './VenuesList';

/*
 * Clasamente — fish app/(app)/partide/clasament.tsx → AnglersLeaderboardScreen (no venue), parity
 * docs/parity/areas/partide.yml partide.clasament, template T1:
 *  - c1 the title «Clasamente» with the back control; the period chips (Săptămâna / Luna / Anul
 *    curent) as the page's horizontal filter bar (owner rule 2), the period in `?perioada=` (invalid
 *    → luna; replaced, never pushed — fish router.setParams);
 *  - c2 the podium 2 · 1 · 3 in gold / silver / bronze, each place → the angler;
 *  - c3 «Pescari / Bălți / Specii» as the kit's tab bar (owner rule 20: an ARIA tablist with ← →
 *    Home End, a strong selected state, the counts as badges), the tab in `?tab=`;
 *  - c4–c6 the three rankings as compact tables (owner rules 12, 13, 16) or fish's empty lines;
 *  - c7 the «EU» pill for the signed-in, ranked viewer (computed here from the shell session; rule
 *    4: nothing while it is unknown) — after the table below 1280 (fish order), in the right column
 *    from 1280;
 *  - c8 the skeleton, the error, the empty period, and the period switch over the previous figures
 *    (the venue family's treatment: SwitchingBar, the content inert, the photos dimmed — the kit
 *    never dims text).
 * From 1280 (ROADMAP §4, three columns): the community's pages on the left (navigation only), the
 * ranking in the centre — capped, so the table's figures never drift across a wide screen (rule
 * 16) — and the viewer's place and the period in numbers on the right.
 * Rule 17: from 1024 a ranked angler opens in a popover with «Vezi profilul»; a phone goes to the
 * profile.
 */

const TITLE = 'Clasamente';

/*
 * A deep link (`?perioada=week|year`, `?tab=balti|specii`) and the static HTML: the HTML is the
 * default place (the Suspense fallback below: luna, «Pescari»), so painting it would show another
 * period's figures, or another tab, as if they were the link's — and then jump (fish never shows
 * another period's figures as the current ones, AnglersLeaderboardScreen :272-281). A tiny inline
 * script (DEEP_LINK_SCRIPT, run while the HTML parses, before the fallback paints) adds a marker to
 * <head> when the URL asks for another place; the fallback then paints the route's skeleton instead
 * of the default place's content (`:root:has(#ranking-deep-link)`). React 19 skips foreign nodes in
 * <head> on hydration (the balti geo hint's technique). Once the screen at the URL's place mounts,
 * the marker is removed.
 */
const DEEP_LINK_ID = 'ranking-deep-link';
const DEEP_LINK_SCRIPT = `try{var q=new URLSearchParams(location.search),p=q.get('perioada'),t=q.get('tab');if((p==='week'||p==='year'||t==='balti'||t==='specii')&&!document.getElementById(${JSON.stringify(DEEP_LINK_ID)})){var m=document.createElement('meta');m.id=${JSON.stringify(DEEP_LINK_ID)};document.head.appendChild(m)}}catch(e){}`;
const DEEP_HIDE = '[:root:has(#ranking-deep-link)_&]:hidden';
const DEEP_SHOW = 'hidden [:root:has(#ranking-deep-link)_&]:contents';

const noopSubscribe = () => () => {};

/** The script in the server HTML only (a script React creates on the client never runs). */
function DeepLinkScript() {
  const clientMount = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return clientMount ? null : <script dangerouslySetInnerHTML={{ __html: DEEP_LINK_SCRIPT }} />;
}

/** The screen at the URL's place. The static HTML is the default place (the Suspense fallback). */
export function RankingRoot() {
  return (
    <Suspense
      fallback={
        <>
          <DeepLinkScript />
          <div className={cn('contents', DEEP_HIDE)} data-testid="ranking-static">
            <RankingScreen initial={DEFAULT_PLACE} syncUrl={false} />
          </div>
          <div className={DEEP_SHOW}>
            <RankingFallback />
          </div>
        </>
      }
    >
      <FromUrl />
    </Suspense>
  );
}

function FromUrl() {
  const params = useSearchParams();
  // Read once: from here on the screen owns the place and mirrors it into the URL.
  const [initial] = useState(() => placeFromParams(params));
  useEffect(() => document.getElementById(DEEP_LINK_ID)?.remove(), []);
  return <RankingScreen initial={initial} syncUrl />;
}

/** The viewer's documentId (the CMS ranks by it) once the shell session answered; null otherwise. */
function ViewerProbe({ onUid }: { onUid: (uid: string | null) => void }) {
  const uid = userOf(useViewerState())?.documentId ?? null;
  useEffect(() => onUid(uid), [uid, onUid]);
  return null;
}

function RankingScreen({ initial, syncUrl }: { initial: RankingPlace; syncUrl: boolean }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [period, setPeriod] = useState<StatsPeriod>(initial.period);
  const [tab, setTab] = useState<RankingTab>(initial.tab);
  const [meUid, setMeUid] = useState<string | null>(null);
  const place: RankingPlace = { period, tab };
  useListUrlState(syncUrl ? placeToParams(place) : {});

  const q = useQuery(communityStatsQuery(t, period));
  const data = q.data;
  const switching = q.isFetching && q.isPlaceholderData;
  // A query without data goes back to «pending» on a retry: once it has failed, the error card
  // stays (busy) through the retry instead of the skeleton.
  const failedBefore = !data && q.errorUpdateCount > 0;
  // fish: a failed fetch never masquerades as an empty period nor as the previous period's data.
  const showError = (q.isError && (!data || q.isPlaceholderData)) || failedBefore;
  const loading = q.isPending && !failedBefore;
  const ready: CommunityStatsDTO | null = !loading && !showError && data && data.totals.partide > 0 ? data : null;
  const empty = !loading && !showError && !ready;
  const shownPeriod = useShownPeriod(period, !!data && !q.isPlaceholderData);
  // Ties on kg (nothing weighed) ordered by catches, then partide (./place rankingOrder).
  const anglers = useMemo(() => (ready ? rankingOrder(ready.topAnglers) : []), [ready]);

  const pop = useAnglerPopover();
  const popover = usePopoverEnabled();
  const { close } = pop;
  useEffect(() => close(), [period, tab, close]);

  const me = useMemo(() => {
    if (!ready || !meUid) return null;
    const idx = anglers.findIndex((a) => a.uid === meUid);
    return idx === -1 ? null : { rank: idx + 1, kg: anglers[idx].totalKg };
  }, [anglers, meUid, ready]);
  const onUid = useCallback((uid: string | null) => setMeUid(uid), []);

  const counts: Record<RankingTab, number> = {
    pescari: ready?.topAnglers.length ?? 0,
    balti: ready?.topVenues.length ?? 0,
    specii: ready?.species.length ?? 0,
  };
  const pill = me && ready ? <MePill rank={me.rank} total={ready.totals.anglers} period={shownPeriod} kg={me.kg} /> : null;

  const aside = loading ? (
    <AsideSkeleton rows={2} />
  ) : ready ? (
    <div inert={switching} aria-busy={switching || undefined} className="relative flex flex-col gap-4" data-testid="ranking-aside">
      <SwitchingBar on={switching} />
      {tab === 'pescari' && pill ? <div className="max-xl:hidden">{pill}</div> : null}
      <AsideSection title={PERIOD_TITLE[shownPeriod]} bare>
        <PeriodNumbers totals={ready.totals} />
      </AsideSection>
    </div>
  ) : (
    <span aria-hidden data-testid="ranking-aside-bare" />
  );

  return (
    <>
      <Suspense fallback={null}>
        <ViewerProbe onUid={onUid} />
      </Suspense>
      <ListPage
        header={<VenueHeader title={TITLE} backHref={routes.partide()} onRefresh={async () => !(await q.refetch()).isError} />}
        context={<CommunityPages period={period} />}
        contextLabel="Comunitate"
        aside={aside}
        asideLabel="Poziția ta și perioada"
        asideInline={false}
        asideBusy={loading}
      >
        <div className={COLUMN}>
          <PeriodChips value={period} onChange={setPeriod} busy={switching} />
          <p role="status" className="sr-only">
            {switching ? 'Se încarcă perioada aleasă…' : ''}
          </p>
          <section
            aria-label="Clasament"
            aria-busy={switching || loading || undefined}
            inert={switching}
            className={cn('relative flex flex-col gap-4', switching && SWITCHING_DIM)}
            data-testid="ranking-content"
          >
            <SwitchingBar on={switching} />
            {loading ? (
              <RankingSkeletonBody />
            ) : showError ? (
              <div data-testid="ranking-error">
                <ListError
                  title="Nu am putut încărca statisticile."
                  description="Verifică conexiunea și încearcă din nou."
                  onRetry={() => void q.refetch()}
                  retrying={q.isFetching}
                  attempt={q.errorUpdateCount}
                />
              </div>
            ) : empty || !ready ? (
              <div data-testid="ranking-empty">
                <ListEmpty
                  title="Niciun clasament pentru perioada selectată încă."
                  action={<WiderPeriodAction period={shownPeriod} onChange={setPeriod} />}
                  icon={
                    <EmptyIcon>
                      <TrophyIcon aria-hidden />
                    </EmptyIcon>
                  }
                />
              </div>
            ) : (
              <>
                <Podium top3={anglers.slice(0, 3)} onOpen={pop.open} popover={popover} meUid={meUid} />
                <ListTabs
                  label="Clasament"
                  tabs={TABS.map((x) => ({ ...x, count: counts[x.key] }))}
                  active={tab}
                  onSelect={setTab}
                  controls="clasament-panel"
                />
                <div role="tabpanel" id="clasament-panel" aria-labelledby={`clasament-panel-tab-${tab}`} className="flex flex-col gap-4">
                  {tab === 'pescari' ? (
                    <AnglersTable anglers={anglers} onOpen={pop.open} popover={popover} meUid={meUid} />
                  ) : tab === 'balti' ? (
                    <VenuesList venues={ready.topVenues} />
                  ) : (
                    <SpeciesList species={ready.species} />
                  )}
                  {/* fish order: the pill AFTER the rows — the viewer resolves in the browser, so its
                      arrival never pushes the list down. From 1280 it is in the right column. */}
                  {tab === 'pescari' && pill ? <div className="xl:hidden">{pill}</div> : null}
                </div>
              </>
            )}
          </section>
        </div>
      </ListPage>
      <AnglerPopover target={pop.target} period={shownPeriod} onClose={pop.close} />
    </>
  );
}

/**
 * The centre column's cap (owner rule 16): the podium, the tabs and the tables keep a reading width,
 * and what a wide screen has left over stays as margin before the right column.
 */
const COLUMN = 'mx-auto flex w-full max-w-200 flex-col gap-4';

/**
 * «Comunitate» — the community pages, the left column from 1280 (navigation only: ListPage
 * `context`): Comunitate, Explorează, Statistici and Clasamente (current), each only once it is on
 * the web (lib/partide-pages). Statistici carries the period in view.
 */
function CommunityPages({ period }: { period: StatsPeriod }) {
  const pages = [
    { key: 'comunitate', label: 'Comunitate', href: routes.partide() },
    { key: 'exploreaza', label: 'Explorează', href: partideHrefs.explore() },
    { key: 'statistici', label: 'Statistici', href: partideHrefs.stats(period) },
    { key: 'clasament', label: 'Clasamente', href: routes.partideRanking(period) },
  ].flatMap((p) => (p.href ? [{ ...p, href: p.href }] : []));
  return (
    <nav aria-label="Paginile comunității" className="flex min-w-0 flex-col" data-testid="community-pages">
      <p aria-hidden className="mb-2.5 t-eyebrow text-muted uppercase">
        Comunitate
      </p>
      <ul className="-mx-2 flex flex-col gap-0.5">
        {pages.map((p) => {
          const on = p.key === 'clasament';
          return (
            <li key={p.key}>
              <Link
                href={p.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center justify-between gap-2 rounded-control px-2 py-2 t-body transition-colors duration-(--duration-fast)',
                  on ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:bg-soft-fill hover:text-ink',
                  FOCUS_RING,
                )}
              >
                {p.label}
                {on ? null : <ChevronRightIcon aria-hidden className="size-5 text-muted" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The community pages' place while the route loads (same height: nothing moves). */
function CommunityPagesSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <span className="mb-2.5 h-3 w-24 animate-shimmer rounded-full" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="my-2.75 h-4.5 w-32 animate-shimmer rounded-full" />
      ))}
    </div>
  );
}

/** The ranking's grey shape while the first period loads (fish ClasamentSkeleton). */
export function RankingSkeletonBody() {
  return (
    <div role="status" className="flex flex-col gap-4" data-testid="ranking-skeleton">
      <span className="sr-only">Se încarcă clasamentul…</span>
      <PodiumSkeleton />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={5} />
    </div>
  );
}

/** The page's frame before the screen hydrates its data (the route's loading state). */
export function RankingFallback() {
  return (
    <div aria-busy>
      <ListPage
        header={<VenueHeader title={TITLE} backHref={routes.partide()} />}
        context={<CommunityPagesSkeleton />}
        aside={<AsideSkeleton rows={2} />}
        asideInline={false}
        asideBusy
      >
        <div className={COLUMN}>
          <ChipsSkeleton />
          <RankingSkeletonBody />
        </div>
      </ListPage>
    </div>
  );
}
