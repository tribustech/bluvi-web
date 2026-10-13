'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { ListEmpty, ListError, ListPage, ListTabs, TabsSkeleton, useListUrlState } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { communityStatsQuery, type CommunityStatsDTO, type StatsPeriod } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import {
  ChipsSkeleton,
  EmptyIcon,
  PeriodChips,
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
 *    4: nothing while it is unknown) — after the table on a phone (fish order), in the hero from 768;
 *  - c8 the skeleton, the error, the empty period, and the period switch over the previous figures
 *    (the venue family's treatment: SwitchingBar, the content inert, the photos dimmed — the kit
 *    never dims text).
 * From 768 (owner 2026-10-13, «ia-le de la capăt»): one full-width column — the period as a centred
 * segmented control, a hero band (the period in numbers, the viewer's place, the podium as cards),
 * then the tabs and the full-width tables. Below 768 the page is fish's, unchanged.
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

  return (
    <>
      <Suspense fallback={null}>
        <ViewerProbe onUid={onUid} />
      </Suspense>
      <ListPage header={<VenueHeader title={TITLE} backHref={routes.partide()} />}>
        <div className={COLUMN}>
          <div className={SEGMENTED}>
            <PeriodChips value={period} onChange={setPeriod} busy={switching} />
          </div>
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
                <Podium
                  top3={anglers.slice(0, 3)}
                  onOpen={pop.open}
                  popover={popover}
                  meUid={meUid}
                  period={shownPeriod}
                  totals={ready.totals}
                  pill={pill}
                />
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
                      arrival never pushes the list down. From 768 it is in the hero, under the
                      period's figures. */}
                  {tab === 'pescari' && pill ? <div className="md:hidden">{pill}</div> : null}
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
 * The page's one column (owner 2026-10-13: pages are full width, only Acasă is centred): no
 * community-pages column on the left (the Partide tabs already carry them) and no right column — the
 * period in numbers and the viewer's place live in the hero (Podium) from 768.
 */
const COLUMN = 'flex w-full flex-col gap-4 md:gap-6';

/*
 * The period switch from 768: PeriodChips (the same radio group, the same labels, the same test id)
 * drawn as a centred segmented control — the competitions' StatusTabs look: one surface track, the
 * selected option on the accent tint with the accent underline, a hover wash on the others. The
 * spinner slot hangs past the track's right edge so the track stays centred. Below 768 nothing
 * applies: fish's chips. (Selectors carry [role][aria-label] so they outrank the chips' own rest
 * styles in bits.tsx PAGE_CHIPS.)
 */
const SEGMENTED = cn(
  'md:flex md:justify-center',
  'md:[&>[data-testid=period-chips]]:relative md:[&>[data-testid=period-chips]>span]:absolute md:[&>[data-testid=period-chips]>span]:left-full md:[&>[data-testid=period-chips]>span]:ml-2',
  `md:[&_[role=radiogroup][aria-label]]:gap-1 md:[&_[role=radiogroup][aria-label]]:rounded-control md:[&_[role=radiogroup][aria-label]]:bg-surface md:[&_[role=radiogroup][aria-label]]:p-1 md:[&_[role=radiogroup][aria-label]]:shadow-e0`,
  `md:[&_[role=radiogroup][aria-label]_label]:relative md:[&_[role=radiogroup][aria-label]_label]:h-10 xl:[&_[role=radiogroup][aria-label]_label]:h-9 md:[&_[role=radiogroup][aria-label]_label]:rounded-[calc(var(--radius-control)-4px)] md:[&_[role=radiogroup][aria-label]_label]:px-5 md:[&_[role=radiogroup][aria-label]_label]:t-body-strong md:[&_[role=radiogroup][aria-label]_label]:shadow-none`,
  `md:[&_[role=radiogroup][aria-label]_label]:after:absolute md:[&_[role=radiogroup][aria-label]_label]:after:inset-x-3 md:[&_[role=radiogroup][aria-label]_label]:after:bottom-1 md:[&_[role=radiogroup][aria-label]_label]:after:h-0.5 md:[&_[role=radiogroup][aria-label]_label]:after:rounded-full md:[&_[role=radiogroup][aria-label]_label]:after:content-['']`,
  `md:[&_[role=radiogroup][aria-label]_label:not(:has(:checked))]:bg-transparent md:[&_[role=radiogroup][aria-label]_label:not(:has(:checked))]:text-muted md:[&_[role=radiogroup][aria-label]_label:not(:has(:checked))]:shadow-none md:[&_[role=radiogroup][aria-label]_label:not(:has(:checked)):hover]:bg-soft-fill md:[&_[role=radiogroup][aria-label]_label:not(:has(:checked)):hover]:text-ink`,
  `md:[&_[role=radiogroup][aria-label]_label:has(:checked)]:bg-accent-tint md:[&_[role=radiogroup][aria-label]_label:has(:checked)]:text-accent-ink md:[&_[role=radiogroup][aria-label]_label:has(:checked)]:after:bg-accent`,
);

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
      <ListPage header={<VenueHeader title={TITLE} backHref={routes.partide()} />}>
        <div className={COLUMN}>
          <ChipsSkeleton className="md:hidden" />
          <div aria-hidden className="flex justify-center max-md:hidden">
            <span className="h-12 w-80 animate-shimmer rounded-control xl:h-11" />
          </div>
          <RankingSkeletonBody />
        </div>
      </ListPage>
    </div>
  );
}
