'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitionKeys,
  competitionMyStatusQuery,
  competitionQuery,
  competitionsKeys,
  competitionWeighingStatisticsQuery,
  rankingsKeys,
  rankingsQuery,
  SIGNED_OUT_MY_STATUS,
  userStatuteForCompetitionQuery,
  type CompetitionDetail,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import { activeWeighingQuery, allocatedParticipantsQuery, weighingKeys } from '@/core/organizer';
import { plural } from '@/components/cards/format';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { pageTransport } from './transport';
import type { Viewer } from '@/lib/server/viewer';
import { signInHref } from '../../../_shell/SiteHeader';
import { useViewer } from '../../../_shell/viewer-context';
import { ActiveWeighingBanner, MobileActionBar } from './ActionBar';
import { AllFishView } from './AllFishView';
import { ChatDock, MobileChatDialog, useChatBadge } from './ChatPanel';
import { CompetitionSkeleton } from './CompetitionSkeleton';
import { DesktopStats } from './DesktopStats';
import { HeaderBand } from './HeaderBand';
import { FullRankingDialog } from './FullRankingDialog';
import { DesktopHeader, DetailTabs, MobileHeader } from './Header';
import { CompetitionPreview } from './Preview';
import { buildRankingTable, type RankingSort } from './ranking';
import { RankingView } from './RankingView';
import { StatisticsView } from './StatisticsView';
import { Toast, useToast } from './Toast';
import { ViewChips, ViewPanel, ViewTabs } from './ViewSwitch';
import type { RankingViewKey } from './views';
import { WeighingsView } from './WeighingsView';

export type CompetitionDates = { label: string; start: string; end: string };

/** The competition core with a ranking type core does not parse yet (feederRounds today). */
export type LooseCompetition = Omit<CompetitionDetail, 'rankingType'> & { rankingType: string };

type Props = {
  id: string;
  dates: CompetitionDates;
  /** Set when core cannot parse the ranking type: header + preview from this, ranking unavailable. */
  unsupported?: LooseCompetition;
};

/**
 * The page renders once, signed out, and never waits for the session: header, tabs and the whole
 * ranking are in the static shell. The session (the shell's cookie-bound promise) is read by one
 * small island behind its own Suspense, which hands it to the screen after hydration; only the
 * per-viewer parts (follow, statute, action bar, chat, the viewer's own row) change then.
 */
export function CompetitionScreen(props: Props) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const onViewer = useCallback((v: Viewer | null) => setViewer(v), []);
  return (
    <>
      <Suspense fallback={null}>
        <ViewerIsland onViewer={onViewer} />
      </Suspense>
      <Screen {...props} viewer={viewer} />
    </>
  );
}

function ViewerIsland({ onViewer }: { onViewer: (v: Viewer | null) => void }) {
  const viewer = useViewer();
  useEffect(() => onViewer(viewer), [viewer, onViewer]);
  return null;
}

function Screen({ id, dates, viewer, unsupported }: Props & { viewer: Viewer | null }) {
  const t = useMemo(() => pageTransport(), []);
  const qc = useQueryClient();
  const pathname = usePathname() ?? '';
  const breakpoint = useBreakpoint();
  const isAuthenticated = viewer !== null;
  const session = { isAuthenticated };

  const competitionQ = useQuery({
    ...competitionQuery(t, id, session),
    // An unsupported core cannot be parsed by the browser either: it stays what the server read
    // (the follow mutation still updates it optimistically).
    ...(unsupported
      ? { enabled: false, initialData: { ...unsupported, ...SIGNED_OUT_MY_STATUS } as unknown as CompetitionWithMyStatus }
      : {}),
  });
  // Unsupported core: the viewer's overlay (isFollowing, registration) is read on its own.
  const myStatusQ = useQuery({ ...competitionMyStatusQuery(t, id, session), enabled: !!unsupported && isAuthenticated });
  // The server hydrated the signed-out overlay (isFollowing false): re-read it once with the session.
  useEffect(() => {
    if (isAuthenticated) void qc.invalidateQueries({ queryKey: competitionsKeys.byId(id), exact: true });
  }, [isAuthenticated, id, qc]);

  const competition =
    unsupported && competitionQ.data && myStatusQ.data ? { ...competitionQ.data, ...myStatusQ.data } : competitionQ.data;
  const status = competition?.competitionStatus;
  // fish CompetitionRanking: only notStarted gets the preview; every other status (started,
  // completed, cancelled, draft) gets the views and the ranking (or «Nu există date de afișat»).
  const rankingVisible = !!status && status !== 'notStarted';

  const { data: statute } = useQuery(userStatuteForCompetitionQuery(t, id, session));
  const chatBadge = useChatBadge(id, viewer, statute);

  const [view, setView] = useState<RankingViewKey>('clasament');
  const [sortBy, setSortBy] = useState<RankingSort>('stand');
  const [barMessage, setBarMessage] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const toast = useToast();

  const rankingsQ = useQuery({ ...rankingsQuery(t, id, status), ...(unsupported ? { enabled: false } : {}) });
  const { data: activeWeighing } = useQuery(activeWeighingQuery(t, id, session));
  const isDesktop = breakpoint !== 'mobile';
  const weighingStatsQ = useQuery(
    competitionWeighingStatisticsQuery(t, id, status, {
      enabled: !unsupported && (view === 'statistici' || (isDesktop && rankingVisible)),
    }),
  );
  const { data: allocated } = useQuery({
    ...allocatedParticipantsQuery(t, id),
    enabled: !unsupported && (view === 'cantare' || (isDesktop && !!activeWeighing?.length)),
  });

  // fish builds the table from the stand order (default) or the place order (Sortare).
  const table = useMemo(() => buildRankingTable(rankingsQ.data, sortBy), [rankingsQ.data, sortBy]);
  // Desktop: the table sorts itself (place by default); its rows are built once, in place order.
  const placeTable = useMemo(() => buildRankingTable(rankingsQ.data, 'position'), [rankingsQ.data]);

  /** fish `handleChipPress`: switching view refreshes that view's data. */
  const selectView = (next: RankingViewKey) => {
    setView(next);
    if (next === 'statistici' || next === 'clasament') {
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.rankingBestN(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.weighingStatistics(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.timelineSnapshot(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.catchThresholdCounts(id) });
    } else if (next === 'allFish') {
      // Every sort/filter variant of competitionKeys.catchesInfinite(id, …).
      void qc.invalidateQueries({ queryKey: [...competitionKeys.all, id, 'catches'] });
    } else if (next === 'cantare') {
      void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(id) });
    }
  };

  /** fish `handleSortChange` + its bar message. */
  const changeSort = (by: RankingSort) => {
    setSortBy(by);
    setBarMessage(
      by === 'stand'
        ? 'Sortarea clasamentului după stand a fost efectuată.'
        : 'Sortarea clasamentului după poziția în clasament a fost efectuată.',
    );
  };

  const share = async () => {
    if (!competition) return;
    const url = window.location.origin + pathname;
    // fish handleShareCompetition (without the emoji).
    const text = `Intră în Bluvi să vezi competiția de pescuit ${competition.name}${
      competition.lake?.name ? ` de pe balta ${competition.lake.name}` : ''
    }`;
    try {
      if (navigator.share) {
        await navigator.share({ title: competition.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.show('Linkul competiției a fost copiat.');
    } catch {
      // Share sheet dismissed: nothing to report.
    }
  };

  if (!competition) {
    if (competitionQ.isError) {
      return (
        <div className="px-4 py-6 md:px-6 xl:px-8">
          <ErrorState
            title="Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu."
            action={
              <Button size="compact" variant="secondary" onClick={() => void competitionQ.refetch()}>
                Reîncearcă
              </Button>
            }
          />
        </div>
      );
    }
    return <CompetitionSkeleton />;
  }

  const hasBanner = !!activeWeighing?.length && !!activeWeighing[0]?.stand;
  const signIn = signInHref(pathname);

  return (
    // fish screen background is white; on md+ the content sits on page grey.
    <div className={rankingVisible ? 'relative max-md:min-h-dvh max-md:bg-surface' : 'relative'}>
      <HeaderBand>
      <MobileHeader competition={competition} viewer={viewer} statute={statute} signIn={signIn} onShare={share} toast={toast.show} />
      <DesktopHeader
        competition={competition}
        viewer={viewer}
        statute={statute}
        dates={dates}
        signIn={signIn}
        onShare={share}
        onFullView={rankingVisible && table ? () => setFullOpen(true) : undefined}
        toast={toast.show}
      />
      <DetailTabs />
      </HeaderBand>

      {rankingVisible && unsupported ? (
        <div className="flex flex-col gap-3 px-4 pt-4 md:gap-4.5 md:px-6 md:pt-6 xl:px-8">
          {/* fish renders feeder legs (FeederLegTabs + FeederRankingTable); the web has no view for them yet. */}
          <EmptyState title="Clasamentul acestui tip de concurs nu este încă disponibil pe web." />
        </div>
      ) : rankingVisible ? (
        <div className="flex flex-col gap-3 px-4 pt-4 md:gap-4.5 md:px-6 md:pt-6 xl:px-8">
          <DesktopStats
            metadata={rankingsQ.data?.metadata}
            rankings={table?.rows}
            competition={competition}
            activeWeighing={activeWeighing}
            weighings={weighingStatsQ.data?.data}
            weighingsLoading={weighingStatsQ.isPending}
            allocated={allocated}
            onAllWeighings={() => selectView('cantare')}
          />
          <ViewChips value={view} onChange={selectView} />
          <ViewTabs
            value={view}
            onChange={selectView}
            meta={{
              clasament: placeTable ? `General · ${plural(placeTable.rows.length, 'pescar', 'pescari')}` : 'General',
              cantare: weighingsMeta(activeWeighing?.length ?? 0, weighingStatsQ.data?.data, weighingStatsQ.isPending),
              statistici: 'Best 3/5/7 · pe sectoare',
              allFish:
                typeof rankingsQ.data?.metadata.totalCatchesCount === 'number'
                  ? plural(rankingsQ.data.metadata.totalCatchesCount, 'captură', 'capturi')
                  : 'Toate capturile',
            }}
            live={status === 'started' && !!activeWeighing?.length}
          />

          <ViewPanel value={view}>
          {view === 'clasament' && (
            <RankingView
              query={rankingsQ}
              table={table}
              placeTable={placeTable}
              currentUserStandId={currentUserStandId(competition, viewer)}
            />
          )}
          {view === 'statistici' &&
            (isAuthenticated ? (
              <StatisticsView t={t} competition={competition} metadata={rankingsQ.data?.metadata} rankings={rankingsQ.data} weighingStats={weighingStatsQ} />
            ) : (
              <SignInPrompt href={signIn} />
            ))}
          {view === 'cantare' && <WeighingsView t={t} competition={competition} allocated={allocated} isAuthenticated={isAuthenticated} />}
          {view === 'allFish' && <AllFishView t={t} competition={competition} />}
          </ViewPanel>
        </div>
      ) : (
        <CompetitionPreview competition={competition} dates={dates} />
      )}

      {/* Room for the fixed action bar (+ banner) above the mobile tab bar. */}
      <div aria-hidden className={`md:hidden ${hasBanner ? 'h-32' : 'h-24'}`} />
      {/* Room for the fixed chat dock (≈60px tall, 24/32px from the bottom). */}
      <div className="h-24 max-md:hidden xl:h-28" aria-hidden />

      <div className="fixed inset-x-0 bottom-[calc(50px+max(14px,env(safe-area-inset-bottom)))] z-20 md:hidden">
        <MobileActionBar
          competition={competition}
          isAuthenticated={isAuthenticated}
          signIn={signIn}
          onSort={changeSort}
          onView={selectView}
          onFullView={() => setFullOpen(true)}
          fullViewDisabled={!table}
          onShare={share}
          onChat={isAuthenticated ? () => setChatOpen(true) : undefined}
          chatBadge={chatBadge}
          rankingAvailable={!unsupported}
          barMessage={barMessage}
          onBarMessageDismiss={() => setBarMessage(null)}
        />
        <ActiveWeighingBanner weighings={activeWeighing} onPress={() => selectView('cantare')} />
      </div>

      <FullRankingDialog
        open={fullOpen}
        onClose={() => setFullOpen(false)}
        title={competition.name}
        table={placeTable}
      />
      <ChatDock competition={competition} viewer={viewer} statute={statute} signIn={signIn} badge={chatBadge} />
      <MobileChatDialog
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        competition={competition}
        viewer={viewer}
        statute={statute}
        signIn={signIn}
      />
      <Toast message={toast.message} />
    </div>
  );
}

/** The signed-in angler's stand (ranking `standId` is the stand's numeric id). */
function currentUserStandId(
  competition: { registrations: { registrationStatus: string; stand: { id: number } | null; participants: { documentId: string }[] }[] },
  viewer: Viewer | null,
): string | null {
  if (!viewer) return null;
  const mine = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.participants.some(p => p.documentId === viewer.documentId),
  );
  return mine?.stand ? String(mine.stand.id) : null;
}

/** fish: «Trebuie sa fii autentificat pentru a vedea statisticile.» + «Intră în cont». */
function SignInPrompt({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-4 py-6 text-center shadow-e0">
      <p className="t-body text-ink-2">Trebuie să fii autentificat pentru a vedea statisticile.</p>
      <a href={href} className="t-body-strong text-accent-ink underline-offset-2 hover:underline">
        Intră în cont
      </a>
    </div>
  );
}

function weighingsMeta(active: number, weighings: { endDate: string | null }[] | undefined, loading: boolean): string {
  const done = weighings?.filter(w => w.endDate).length ?? 0;
  const parts = [active > 0 ? `${active} în curs` : null, weighings ? `${done} ${done === 1 ? 'finalizat' : 'finalizate'}` : null];
  // Until the statistics land the count is unknown: a neutral placeholder, not «Pe standuri».
  if (!weighings && loading) parts.push('…');
  return parts.filter(Boolean).join(' · ') || 'Pe standuri';
}
