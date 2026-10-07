'use client';

import { Suspense, useMemo, type ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  buildDashboardPartideSection,
  communityHistoryInfiniteQuery,
  communityOverviewQuery,
  type CommunityOverviewDTO,
  type DashboardPartideSection,
} from '@/core/partide';
import { ActivePartidaCard, ActivePartidaDock } from '@/components/partide/ActivePartidaDock';
import { AcasaSceneSkeleton } from '@/components/partide/community/AcasaSceneSkeleton';
import { CommunityHistoryCard } from '@/components/partide/community/CommunityHistoryCard';
import { ExploreCta } from '@/components/partide/community/ExploreCta';
import { LatestCatchesRail } from '@/components/partide/community/LatestCatchesRail';
import { NoActiveCta, NoActiveCtaSkeleton } from '@/components/partide/community/NoActiveCta';
import { PopularVenues } from '@/components/partide/community/PopularVenues';
import { hasQuickNav, QuickNavRow, type QuickNavTargets } from '@/components/partide/community/QuickNavRow';
import { RecordsGrid } from '@/components/partide/community/RecordsGrid';
import { useNowTick } from '@/components/partide/community/useNowTick';
import { VenueGroup } from '@/components/partide/community/VenueGroup';
import { DashboardLayout, DashboardSection } from '@/components/templates/T5';
import { createBrowserTransport } from '@/lib/client/transport';
import { partideHrefs, signedInHref } from '@/lib/partide-pages';
import { partideServerClock, usePartideViewer } from '../_hub/activePartida';

/*
 * Partide · Comunitate — fish app/(app)/(tabs)/partide.tsx (sub-tab «acasa») + scenes/AcasaScene.tsx
 * (parity partide.comunitate), template T5.
 *
 * Data (fish features/partide/community/hooks.ts): the overview (communityOverviewQuery: staleTime
 * 30s, polled every 60s, no retry — c23) arrives hydrated from the static page and keeps polling here;
 * the first history page is read only once the overview has answered with nothing live (c9, c10),
 * and while it is pending the whole dashboard keeps its skeleton. A failed overview renders as empty
 * sections (fish: `overview?.x ?? []`, retry false).
 *
 * Per-user blocks (the hero or the live dock, the «self» rows) render only once the session and the
 * live probe have answered (owner rule 4) — the public dashboard never waits for them.
 *
 * Layout: below 1280 fish's single column — hero, quick nav, Ultimele capturi, the live / finished
 * section, Recorduri, Locuri populare — with the dock pinned at the bottom while a partidă runs. From
 * 1280 three columns: the hero (or the live partidă's card) and the quick nav on the left, the
 * catches and the partide in the centre, the records bento and the popular venues on the right.
 */

export function ComunitateScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const overview = useQuery(communityOverviewQuery(t));
  const activeVenues = overview.data?.activeVenues ?? EMPTY;
  // fish AcasaScene: history only once the overview has answered (data or error) with nothing live.
  const historyEnabled = !overview.isPending && activeVenues.length === 0;
  const history = useInfiniteQuery(communityHistoryInfiniteQuery(t, [], historyEnabled));
  const now = useNowTick();

  if (overview.isPending || (historyEnabled && history.isPending)) return <AcasaSceneSkeleton />;

  const data: CommunityOverviewDTO = overview.data ?? { latestCatches: [], activeVenues: [], records: [], popularVenues: [] };
  // fish rule (core communityView): live, else the 3 latest finished, else empty — never both.
  const section = buildDashboardPartideSection(activeVenues, history.data?.pages[0]?.data ?? []);
  const explore = partideHrefs.explore();

  const rail =
    data.latestCatches.length > 0 ? (
      <DashboardSection variant="plain" title="Ultimele capturi">
        <LatestCatchesRail catches={data.latestCatches} now={now} />
      </DashboardSection>
    ) : null;

  const records = (
    <DashboardSection variant="plain" title="Recorduri">
      <RecordsGrid records={data.records} />
    </DashboardSection>
  );
  const popular =
    data.popularVenues.length > 0 ? (
      <DashboardSection variant="plain" title="Locuri populare">
        <PopularVenues venues={data.popularVenues} />
      </DashboardSection>
    ) : null;

  return (
    <>
      <DashboardLayout
        sidesBelowXl="hidden"
        contextLabel="Partida mea și scurtături"
        asideLabel="Recorduri și locuri populare"
        context={
          CONTEXT_ON ? (
            <>
              <Suspense fallback={<HeroSkeleton layout="desktop" />}>
                <HeroOrActive layout="desktop" />
              </Suspense>
              <QuickNav layout="list" />
            </>
          ) : undefined
        }
        main={
          <>
            {/* No hero and no quick nav on the web: no left column (an empty one would only push the
                page right); from 1280 the live partidă's card, when there is one, opens the centre. */}
            {CONTEXT_ON ? null : (
              <div className="contents max-xl:hidden">
                <Suspense fallback={null}>
                  <HeroOrActive layout="desktop" />
                </Suspense>
              </div>
            )}
            {/* Below 1280 the left column's blocks open the single column, in fish's order. */}
            <div className="contents xl:hidden">
              <Suspense fallback={<HeroSkeleton layout="mobile" />}>
                <HeroOrActive layout="mobile" />
              </Suspense>
              <QuickNav layout="row" />
            </div>
            {rail}
            <MiddleSection section={section} explore={explore} />
            <div className="contents xl:hidden">
              {records}
              {popular}
            </div>
          </>
        }
        aside={
          <>
            {records}
            {popular}
          </>
        }
      />
      <Suspense fallback={null}>
        <Dock />
      </Suspense>
    </>
  );
}

const EMPTY: never[] = [];

const SECTION_TITLE: Record<DashboardPartideSection['kind'], string> = {
  live: 'În direct',
  finished: 'Ultimele partide',
  empty: 'Partide active',
};

/** c9–c17 — «În direct» / «Ultimele partide» / «Partide active», «Vezi toate» and the Explorează banner. */
function MiddleSection({ section, explore }: { section: DashboardPartideSection; explore: string | null }) {
  return (
    <DashboardSection
      variant="plain"
      title={SECTION_TITLE[section.kind]}
      action={explore ? { href: explore, label: 'Vezi toate', srLabel: 'Vezi toate partidele în Explorează' } : undefined}
    >
      <div className="flex flex-col gap-3">
        {section.kind === 'live' ? (
          <CardGrid testId="live-section">
            <Suspense fallback={section.venues.map(v => <VenueGroup key={v.key} venue={v} />)}>
              <LiveVenuesForViewer venues={section.venues} />
            </Suspense>
          </CardGrid>
        ) : section.kind === 'finished' ? (
          <CardGrid testId="finished-section">
            {section.rows.map(row => (
              <CommunityHistoryCard key={row.documentId} row={row} />
            ))}
          </CardGrid>
        ) : (
          // fish D4: the tutorial prose belongs to the empty state only.
          <div className="flex max-w-120 flex-col gap-2" data-testid="empty-section">
            <p className="t-caption text-muted">O partidă poate fi solo sau cu 2-3 pescari împreună.</p>
            <p className="t-caption text-muted">Nicio partidă publică activă acum.</p>
          </div>
        )}
        {explore ? <ExploreCta href={explore} /> : null}
      </div>
    </DashboardSection>
  );
}

/** One column of cards; two once the centre column is wide enough for two (≥768 of column). */
function CardGrid({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <div className="grid items-start gap-3 @3xl:grid-cols-2" data-testid={testId}>
      {children}
    </div>
  );
}

/** c15 — the viewer's own leaderboard rows are marked once the session is known. */
function LiveVenuesForViewer({ venues }: { venues: Extract<DashboardPartideSection, { kind: 'live' }>['venues'] }) {
  const viewer = usePartideViewer();
  const uid = viewer.kind === 'viewer' ? viewer.uid : null;
  return venues.map(v => <VenueGroup key={v.key} venue={v} viewerUid={uid} />);
}

/**
 * c4/c5 — the hero «Ești la pescuit?» when the viewer has no live partidă (a guest included); with
 * one, nothing here below 1280 (the dock takes over) and its card in the left column from 1280.
 * Unknown (session or probe unanswered, or the probe failed) → the hero's skeleton / nothing.
 */
function HeroOrActive({ layout }: { layout: 'mobile' | 'desktop' }) {
  const viewer = usePartideViewer();
  if (viewer.kind === 'pending') return <HeroSkeleton layout={layout} />;
  if (viewer.kind === 'viewer') {
    if (viewer.active === 'pending') return <HeroSkeleton layout={layout} />;
    if (viewer.active === 'failed') return null;
    if (viewer.active) {
      const id = viewer.active.documentId;
      return layout === 'desktop' ? (
        <ActivePartidaCard
          session={viewer.active}
          clock={partideServerClock}
          href={partideHrefs.partida(id)}
          captureHref={partideHrefs.capture(id)}
          headingId="partide-partida-activa"
        />
      ) : null;
    }
  }
  const signedIn = viewer.kind === 'viewer';
  return <NoActiveCta layout={layout} start={signedInHref(partideHrefs.start(), signedIn)} join={signedInHref(partideHrefs.join(), signedIn)} />;
}

/**
 * c4 — whether the hero has anything to offer: «Începe o partidă» or «Intră cu cod» on the web. With
 * neither, no hero and no skeleton for it (owner rule 4; fish's hero always carries both). The flags
 * are static, so a guest and a viewer agree.
 */
const HERO_ON = partideHrefs.start() != null || partideHrefs.join() != null;

/** c6 — the quick nav's targets as the flags stand (the guest sign-in detour keeps a non-null target non-null). */
const QUICK_NAV_BASE: QuickNavTargets = { stats: partideHrefs.stats(), ranking: partideHrefs.ranking(), anglers: partideHrefs.anglersSearch() };

/** The left column (from 1280) has something static to carry: the hero or the quick nav. */
const CONTEXT_ON = HERO_ON || hasQuickNav(QUICK_NAV_BASE);

/** The hero's box while the viewer is read — nothing when the hero itself would not render. */
function HeroSkeleton({ layout }: { layout: 'mobile' | 'desktop' }) {
  return HERO_ON ? <NoActiveCtaSkeleton layout={layout} hasActions /> : null;
}

/** c26 — the live-partidă dock pinned at the bottom (below 1280; the left column's card from 1280). */
function Dock() {
  const viewer = usePartideViewer();
  if (viewer.kind !== 'viewer' || !viewer.active || viewer.active === 'pending' || viewer.active === 'failed') return null;
  // c26/c28 — the bar opens the partidă and «Captură» the capture flow, each only once its page is
  // on the web (lib/partide-pages); until then the venue is plain text and «Captură» is left out.
  const id = viewer.active.documentId;
  return <ActivePartidaDock session={viewer.active} clock={partideServerClock} href={partideHrefs.partida(id)} captureHref={partideHrefs.capture(id)} />;
}

/** c6 — the quick nav; «Pescari» goes through sign-in for a guest (fish D6). */
function QuickNav({ layout }: { layout: 'row' | 'list' }) {
  const base = QUICK_NAV_BASE;
  if (!hasQuickNav(base)) return null;
  return (
    <Suspense fallback={<QuickNavRow targets={base} layout={layout} />}>
      <QuickNavForViewer base={base} layout={layout} />
    </Suspense>
  );
}

function QuickNavForViewer({ base, layout }: { base: QuickNavTargets; layout: 'row' | 'list' }) {
  const viewer = usePartideViewer();
  // Unknown: the page itself (it sends a guest to sign-in and back) — never a guess either way.
  const anglers = viewer.kind === 'guest' ? signedInHref(base.anglers, false) : base.anglers;
  return <QuickNavRow targets={{ ...base, anglers }} layout={layout} />;
}
