'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { PAGE_RETRY } from './retry-policy';
import { ChartBarIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  buildWeighingSessions,
  catchThresholdCountsQuery,
  getCompetitorDisplayName,
  isNationalChampionshipRankings,
  rankingBestNQuery,
  SESSIONS_COLLAPSED_MAX,
  weighingSessionsTotals,
  type Penalty,
  type BestNStandRanking,
  type CompetitionWithMyStatus,
  type RankingMetadata,
  type RankingResponse,
  type WeighingStatisticsResponse,
} from '@/core/competitions';
import { deletePenaltyMutation } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { sectorColor, sectorFill } from '@/components/ranking/sector';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { formatDecimal } from '@/components/cards/format';
import { CatchIcon, DeadFishIcon, FishIcon, ScaleIcon } from '@/components/icons/brand';
import { Dialog } from '@/components/surfaces/Dialog';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { LIST_GUTTER } from '@/components/templates/T1';
import { DetailSection } from '@/components/templates/T3';
import { FactTile, StatTile } from '@/components/ui/BentoTile';
import { FaceStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { useSiteToast } from '../../../_shell/Toast';
import { ContextSurface } from './ContextSurface';
import { BiggestCatchTile, SummaryStrip, summaryTiles, useWeighingSlot, WeighingTile } from './DesktopStats';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { isNationalType } from './stand';
import { StandMark } from './StandMark';
import { StandTimeline, timelineHidden, useTimelineSnapshot } from './StandTimeline';
import { statisticFacts } from './StatisticFacts';

/*
 * fish CompetitionRanking / NationalChampionshipRanking `statisticiContent` (parity
 * competition-page.statistici), in fish's order: the summary cards (RankingCardsCarousel; from 768
 * the strip over the views), the weighing charts (sessions + «Cronologia standurilor»), Penalizări
 * (national championship), Top capturi (Best 3/5/7, tap → its ranking), Cantitate pe sector (the
 * quantity rankings), Capturi pe praguri. Charts are drawn with plain HTML / SVG (no chart
 * library). Every block has its own loading (its shape), error («Încearcă din nou») and empty state.
 *
 * Bento (owner rule 9, ROADMAP §4b): the view opens on a bento of tiles of different sizes (MetaTiles)
 * — see MetaTiles for its shape per width. The chart cards under it are one column below 1280 and
 * two balanced columns from 1280 (each card as tall as its content, never stretched to a taller
 * neighbour: no field of white under a short card). Every state of a block (bones, error, offline)
 * keeps its card and title, so nothing moves when it lands; the blocks drawn from the ranking (the
 * bento, Penalizări, the donut) follow the ranking read. A block with nothing to say is not drawn
 * (rule 4): no Top capturi of «-», no donut of 0; without a single catch or weighing the view is the
 * summary line and one empty state.
 *
 * Weights: one precision on the whole view — the competition's (`decimals`, as the summary tiles
 * and the ranking), with the Romanian grouping («2.961,0»): the session rows, the donut, Best N.
 * Units are their own smaller, muted word beside the figure (rule 10, InlineNumber).
 */
// From 1280 two columns that balance by height (the cards in fish's order, down the first column
// then the second); a lone card keeps the whole row. Every card is a direct child that is drawn (a
// block with nothing to say returns null).
const STATS_GRID = cn(
  'grid grid-cols-1 items-start',
  LIST_GUTTER,
  'xl:block xl:columns-2 xl:gap-4 xl:*:mb-4 xl:*:break-inside-avoid xl:[&:has(>:only-child)]:columns-1',
);
/** The rankings whose rows carry a quantity per sector (the donut). */
const QUANTITY_TYPES = new Set(['quantity', 'quantityQuality', 'qualityQuantity']);

export function StatisticsView({
  t,
  competition,
  rankingsQ,
  rankingRows,
  weighingStats,
  decimals,
  canRevoke = false,
}: {
  /** The competition's weight precision (weightDecimals). */
  decimals: number;
  t: Transport;
  competition: CompetitionWithMyStatus;
  /** The ranking read: its data draws the tiles, Penalizări and the donut; its states theirs. */
  rankingsQ: UseQueryResult<RankingResponse>;
  rankingRows: Parameters<typeof summaryTiles>[1];
  weighingStats: UseQueryResult<WeighingStatisticsResponse>;
  /** Author or referee (statute): «Revocă» on each penalty. */
  canRevoke?: boolean;
}) {
  const status = competition.competitionStatus;
  // fish hides Best-N on feeder legs: it is per stand, and a stand holds a different entrant in every leg.
  const tops = competition.rankingType !== 'feederRounds';
  const bestN = useQuery({
    ...rankingBestNQuery(t, competition.documentId, status, { enabled: tops }),
    ...PAGE_RETRY,
  });
  const thresholds = useQuery({
    ...catchThresholdCountsQuery(t, competition.documentId, status),
    ...PAGE_RETRY,
  });
  const rankings = rankingsQ.data;
  const metadata = rankings?.metadata;
  const nc = rankings && isNationalChampionshipRankings(rankings.rankings) ? rankings.rankings : null;
  // The ranking's own state, for the blocks drawn from it (the type says which will be drawn).
  const rankingState: 'ok' | 'pending' | 'failed' = rankings
    ? 'ok'
    : isOfflineEmpty(rankingsQ) || rankingsQ.isError
      ? 'failed'
      : rankingsQ.isPending && rankingsQ.fetchStatus !== 'idle'
        ? 'pending'
        : 'ok';
  const ncType = isNationalType(competition.rankingType);
  const quantityType = QUANTITY_TYPES.has(competition.rankingType ?? '');
  // Not one catch and not one weighing: nothing to chart (rule 4) — the summary line (the bento's on
  // the phone, the strip's from 768) and one empty state, not cards of «-» and a ring of 0.
  const nothing = metadata?.totalCatchesCount === 0 && weighingStats.data?.data.length === 0;
  const rankingFailure = (title: string, className?: string) => (
    <BlockState
      title={title}
      message="Nu s-a putut încărca clasamentul."
      query={rankingsQ}
      className={className}
    />
  );

  return (
    <div className="flex flex-col gap-4 pb-2">
      {rankingState === 'pending' ? (
        <TileBones />
      ) : (
        <MetaTiles
          metadata={metadata}
          rows={rankingRows}
          completed={status === 'completed'}
          decimals={decimals}
          national={metadata?.rankingType === 'nationalChampionship'}
          competition={competition}
          reserveWeighing={status === 'started' || status === 'completed'}
        />
      )}
      {nothing ? (
        <>
          {nc ? (
            <PenaltiesCard t={t} competitionId={competition.documentId} rows={nc.flatMap(club => club.teams ?? [])} canRevoke={canRevoke} />
          ) : null}
          <EmptyState
            icon={<ChartBarIcon aria-hidden className="size-10 text-muted" />}
            title={status === 'completed' ? 'Nu există statistici pentru acest concurs' : 'Încă nu există statistici'}
            description={status === 'completed' ? 'Nu s-a înregistrat niciun cântar.' : 'Graficele apar după primul cântar.'}
          />
        </>
      ) : (
      <div className={STATS_GRID}>
        <WeighingCharts t={t} competition={competition} query={weighingStats} decimals={decimals} />
        {nc ? (
          <PenaltiesCard t={t} competitionId={competition.documentId} rows={nc.flatMap(club => club.teams ?? [])} canRevoke={canRevoke} />
        ) : ncType && rankingState === 'pending' ? (
          <ChartCardSkeleton label="Se încarcă penalizările" />
        ) : ncType && rankingState === 'failed' ? (
          rankingFailure('Penalizări')
        ) : null}
        {tops ? <TopsCard competition={competition} query={bestN} decimals={decimals} /> : null}
        {competition.rankingType === 'feederRounds' || ncType ? null : quantityType && rankingState === 'pending' ? (
          <ChartCardSkeleton label="Se încarcă cantitatea pe sector" />
        ) : rankingState === 'failed' ? (
          // The donut's place (quantity rankings); otherwise only the phone tiles came from it
          // (from 768 the summary row above the views says the ranking failed).
          rankingFailure(quantityType ? 'Cantitate pe sector (kg)' : 'Rezumat', quantityType ? undefined : 'md:hidden')
        ) : (
          <SectorQuantity rankings={rankings} decimals={decimals} />
        )}
        <ThresholdTable query={thresholds} />
      </div>
      )}
    </div>
  );
}

/**
 * The bento while the ranking loads, in the loaded bento's shape: the phone's (the navy tile and
 * the quantity tile across, then two facts) and, from 1280, the six-column one (navy 2×2, quantity
 * and weighing 2×1, four facts). 768–1279 the strip over the views holds the place. Marked
 * `data-stats-bento` like the bento, so from 1280 the strip's bones step aside the same way.
 */
function TileBones({ announce = true }: { announce?: boolean }) {
  return (
    <div
      role={announce ? 'status' : undefined}
      aria-label={announce ? 'Se încarcă rezumatul' : undefined}
      aria-hidden={announce ? undefined : true}
      data-stats-bento=""
      className={cn('grid grid-cols-2 gap-3 md:hidden', BENTO_XL, 'xl:grid')}
    >
      <span aria-hidden className="col-span-2 h-39 animate-shimmer rounded-bento xl:row-span-2 xl:h-auto" />
      <span aria-hidden className="col-span-2 h-25 animate-shimmer rounded-bento xl:h-39" />
      <span aria-hidden className="col-span-2 hidden h-39 animate-shimmer rounded-bento xl:block" />
      <span aria-hidden className="h-24 animate-shimmer rounded-bento xl:h-30" />
      <span aria-hidden className="h-24 animate-shimmer rounded-bento xl:h-30" />
      <span aria-hidden className="hidden h-30 animate-shimmer rounded-bento xl:block" />
      <span aria-hidden className="hidden h-30 animate-shimmer rounded-bento xl:block" />
    </div>
  );
}

/** The view while the session is unknown: the summary tiles (phone) and two chart cards. */
export function StatisticsSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă statisticile" className="flex flex-col gap-4 pb-2">
      <TileBones announce={false} />
      <div className={STATS_GRID}>
        <ChartBones />
        <ChartBones />
        <ChartBones />
        <ChartBones />
      </div>
    </div>
  );
}

/** One chart card's bones: the title bar and three rows. */
function ChartBones() {
  return (
    <div aria-hidden className="flex flex-col gap-4 rounded-card bg-surface px-4 py-5 shadow-e0 md:p-5 xl:p-6">
      <span className="flex flex-col gap-2">
        <span className="h-4 w-1/2 animate-shimmer rounded-full" />
        <span className="h-3 w-3/4 animate-shimmer rounded-full" />
      </span>
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className="h-3 animate-shimmer rounded-full" />
      ))}
    </div>
  );
}

/**
 * fish StatisticsChartCard on the T3 section card: title + description + content. On the phone the
 * section is a card too (the Statistici view sits on the white ground, inside the view's gutter).
 */
function ChartCard({
  id,
  title,
  description,
  className,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DetailSection id={id} title={title} description={description} className={cn('max-md:rounded-card max-md:shadow-e0', className)}>
      {children}
    </DetailSection>
  );
}

/** A chart card while its read is in flight: its bones, announced once. */
function ChartCardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label}>
      <ChartBones />
    </div>
  );
}

/**
 * A block whose read failed or is offline (nothing cached): its card, title and description stay
 * (the same footprint as its bones and its loaded card), the kit ErrorState / OfflineState inside
 * with the page's retry.
 */
function BlockState({
  id,
  title,
  description,
  message,
  query,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  message: string;
  query: Pick<UseQueryResult, 'isFetching' | 'refetch' | 'fetchStatus' | 'data'>;
  className?: string;
}) {
  return (
    <ChartCard id={id} title={title} description={description} className={className}>
      {isOfflineEmpty(query) ? (
        <OfflineState fetching={query.isFetching} onRetry={() => void query.refetch()} />
      ) : (
        <ErrorState title={message} action={<QueryRetry fetching={query.isFetching} failed onRetry={() => void query.refetch()} size="compact" />} />
      )}
    </ChartCard>
  );
}

/**
 * The six-column bento from 1280 (MetaTiles, its bones): a fact is one track, so at 1280–1920 it is
 * ~190–260px wide and never balloons; the headline tiles take two (the navy one two by two).
 */
const BENTO_XL = 'xl:grid-cols-6 xl:grid-flow-row-dense xl:gap-4';

/**
 * fish RankingCardsCarousel + RankingMetaCard, as a bento (owner rule 9): tiles of different sizes,
 * the headline numbers big, the small facts small. One list, laid out per width:
 *  - Phone, two columns: the navy biggest catch across, «Cantitate totală» across (the 40 step:
 *    a three-decimal total never fits half a 320–375 row), then the small facts two by two —
 *    Capturi · Medie pe captură, Standuri cu pește · Fără capturi, Media pe stand · Capturi pe stand.
 *  - 768–1279: the headline numbers are the strip over the views (DesktopStats, whose captions say
 *    the stands with fish and the average per stand), so the bento keeps only the facts the strip
 *    does not show (Medie pe captură, Capturi pe stand), each a tile's width (never one tile
 *    stretched over the row).
 *  - From 1280, six columns: the navy tile 2×2 (the number, the angler's face, name and stand),
 *    «Cantitate totală» 2×1 (with the average per stand under it) and the weighing tile 2×1 (the
 *    strip's «Cântar în curs» / «Ultimul cântar», handed over by useWeighingSlot), then four facts
 *    1×1: Capturi (per stand under it), Medie pe captură, Standuri cu pește, Fără capturi. The strip
 *    steps aside on this view (it hides itself when it sees `data-stats-bento`).
 * A fact the data cannot back (no rows: feeder legs, the club rankings) has no tile, so nothing
 * reads «0»; the two left stay small under «Cantitate totală» and the weighing tile is 2×2 beside
 * them. The per-stand figures are their own facts or their own
 * figure in a caption (rule 10), never a number glued to the unit.
 */
function MetaTiles({
  metadata,
  rows,
  completed,
  decimals,
  national,
  competition,
  reserveWeighing,
}: {
  metadata: RankingMetadata | undefined;
  rows: Parameters<typeof summaryTiles>[1];
  completed: boolean;
  decimals: number;
  national: boolean;
  competition: CompetitionWithMyStatus;
  /** Started / completed: the weighing tile's 2×1 cell is there from the first paint. */
  reserveWeighing: boolean;
}) {
  const weighing = useWeighingSlot();
  if (!metadata) return null;
  // No catch yet: the one line, not tiles of zeros (as DesktopStats from 768).
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rows} completed={completed} className="md:hidden" />;
  const tiles = summaryTiles(metadata, rows, decimals);
  const facts = statisticFacts(metadata, rows);
  const stands = facts.stands;
  const faces = metadata.biggestCatch ? facesOnStand(metadata.biggestCatch.standId, competition) : [];
  // From 768 the tiles sit on the grey page ground: the surface card, as every tile of the page.
  const onPage = 'md:bg-surface md:shadow-e0';
  // The strip says these from 768 to 1279; the bento says them on the phone and from 1280.
  const notTablet = 'md:max-xl:hidden';
  // Only from 1280 (the phone has its own tiles for these figures).
  const xlOnly = 'max-xl:hidden';
  // Without the per-stand facts (feeder, club rankings) two facts are left: they stay 1×1 under
  // «Cantitate totală» and the weighing tile takes the two rows beside them (2×2); with no weighing
  // tile they share the row (2×1 each).
  const pair = stands ? undefined : reserveWeighing ? undefined : 'xl:col-span-2';
  const tallWeighing = !stands;
  return (
    <ul
      aria-label="Rezumat"
      data-stats-bento=""
      className={cn(
        'grid grid-cols-2 gap-3 *:min-w-0 *:*:h-full',
        'md:grid-cols-[repeat(auto-fill,minmax(--spacing(60),1fr))] md:gap-4',
        BENTO_XL,
      )}
    >
      <li className={cn('col-span-2 xl:row-span-2', notTablet)}>
        <BiggestCatchTile {...tiles.biggest} decimals={decimals} national={national} faces={faces} />
      </li>
      <li className={cn('col-span-2', !reserveWeighing && 'xl:col-span-4', notTablet)}>
        {/* Across the phone row it needs no 156 height: label and number, as tall as they are. */}
        <StatTile
          label="Cantitate totală"
          value={tiles.quantity.value}
          unit="kg"
          caption={stands ? <>media pe stand <InlineNumber value={formatKg(stands.perStandKg, decimals)} unit="kg" /></> : undefined}
          captionClassName={xlOnly}
          className={cn(onPage, 'max-md:min-h-0')}
        />
      </li>
      {reserveWeighing ? (
        <li className={cn('col-span-2 hidden xl:block', tallWeighing && 'xl:row-span-2')}>
          {weighing ? (
            <WeighingTile {...weighing} standalone />
          ) : (
            <span aria-hidden className="block h-full min-h-39 animate-shimmer rounded-bento" />
          )}
        </li>
      ) : null}
      <li className={cn(notTablet, pair)}>
        <FactTile
          label="Capturi"
          icon={<FishIcon />}
          value={tiles.catches.value}
          caption={stands ? <><InlineNumber value={formatDecimal(stands.catchesPerStand, 1, 1)} /> pe stand</> : undefined}
          captionClassName={xlOnly}
          className={onPage}
        />
      </li>
      {facts.perCatch !== null ? (
        <li className={pair}>
          <FactTile label="Medie pe captură" icon={<ScaleIcon />} value={formatKg(facts.perCatch, decimals)} unit="kg" className={onPage} />
        </li>
      ) : null}
      {stands ? (
        <>
          <li className={notTablet}>
            <FactTile label="Standuri cu pește" icon={<CatchIcon />} value={String(stands.withFish)} unit={`/${stands.total}`} className={onPage} />
          </li>
          <li className={notTablet}>
            <FactTile
              label="Fără capturi"
              icon={<DeadFishIcon />}
              value={String(stands.without)}
              unit={stands.without === 1 ? 'stand' : stands.without % 100 >= 20 || (stands.without > 0 && stands.without % 100 === 0) ? 'de standuri' : 'standuri'}
              className={onPage}
            />
          </li>
          {/* From 1280 these two are the captions of «Cantitate totală» and «Capturi». */}
          <li className="md:hidden">
            <FactTile label="Media pe stand" icon={<ChartBarIcon />} value={formatKg(stands.perStandKg, decimals)} unit="kg" className={onPage} />
          </li>
          <li className="xl:hidden">
            <FactTile label="Capturi pe stand" icon={<FishIcon />} value={formatDecimal(stands.catchesPerStand, 1, 1)} className={onPage} />
          </li>
        </>
      ) : null}
    </ul>
  );
}

/**
 * fish CompetitionWeighingCharts: «Sesiuni de cântărire» (only with at least one weighing), then the
 * stand timeline card. While the weighing statistics load: their shape; on error: the message and a
 * retry of them alone (fish hides both cards then).
 *
 * No snapshot (204) beside a sessions card: fish draws the timeline card with one line in it; on a
 * wide screen that is a whole card of filler, so the line is the sessions card's muted footer
 * instead (StandTimeline's copy). Without sessions the timeline card stays (it is all there is).
 */
const SESSIONS_TITLE = 'Sesiuni de cântărire';
const SESSIONS_DESCRIPTION = 'Cronologia cântăririlor și cantitatea totală per sesiune.';
/** StandTimeline's 204 copy: live, no weighing closed yet; after the competition, none was kept. */
const timelineEmptyCopy = (status: string | null | undefined) =>
  status === 'started' ? 'Nu există cântăriri înregistrate încă.' : 'Cronologia nu este disponibilă pentru acest concurs.';

function WeighingCharts({
  t,
  competition,
  query,
  decimals,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  query: UseQueryResult<WeighingStatisticsResponse>;
  decimals: number;
}) {
  // The timeline's read (shared with its card): a 204 becomes the sessions card's footer line.
  const snapshot = useTimelineSnapshot(t, competition);
  const hidden = timelineHidden(competition.competitionStatus);
  const noSnapshot = !hidden && snapshot.isSuccess && !snapshot.data;
  if (isOfflineEmpty(query) || (query.isError && !query.data)) {
    // A failed re-read keeps what was already on screen (TanStack keeps `data` on a refetch error).
    return (
      <>
        <BlockState
          id="sesiuni"
          title={SESSIONS_TITLE}
          description={SESSIONS_DESCRIPTION}
          message="Nu s-au putut încărca statisticile cântarilor."
          query={query}
        />
        <StandTimeline t={t} competition={competition} variant="card" />
      </>
    );
  }
  if (query.isPending && query.fetchStatus !== 'idle') {
    // As many grid items as the loaded view (sessions + the timeline card), so nothing after them moves.
    return (
      <>
        <ChartCardSkeleton label="Se încarcă sesiunile de cântărire" />
        {hidden ? null : <ChartCardSkeleton label="Se încarcă cronologia standurilor" />}
      </>
    );
  }
  if (!query.data) return null;
  const sessions = query.data.data.length > 0;
  return (
    <>
      {sessions ? (
        <ChartCard id="sesiuni" title={SESSIONS_TITLE} description={SESSIONS_DESCRIPTION}>
          {query.isError ? <StaleNotice onRetry={() => void query.refetch()} /> : null}
          <SessionTimeline items={query.data.data} decimals={decimals} />
          {noSnapshot ? <p className="mt-3 t-caption text-muted">{timelineEmptyCopy(competition.competitionStatus)}</p> : null}
        </ChartCard>
      ) : null}
      {sessions && noSnapshot ? null : <StandTimeline t={t} competition={competition} variant="card" />}
    </>
  );
}

/** fish WeighingSessionTimeline: the rail, one row per session, 4 then «Vezi toate cântarele». */
function SessionTimeline({ items, decimals }: { items: WeighingStatisticsResponse['data']; decimals: number }) {
  const sessions = useMemo(() => buildWeighingSessions(items), [items]);
  const [expanded, setExpanded] = useState(false);
  const collapsible = sessions.length > SESSIONS_COLLAPSED_MAX;
  const shown = collapsible && !expanded ? sessions.slice(0, SESSIONS_COLLAPSED_MAX) : sessions;
  const maxKg = Math.max(...sessions.map(s => s.totalKg), 1);
  const totals = weighingSessionsTotals(sessions);
  return (
    <div className="flex flex-col gap-1">
      <ol className="flex flex-col">
        {shown.map((session, i) => {
          const lastShown = i === shown.length - 1;
          const extra = session.type === 'extra';
          return (
            <li key={`${session.label}-${i}`} className={cn('flex gap-2', lastShown && collapsible && !expanded && 'opacity-35')}>
              {/* The rail: the dot, and the line down to the next session. */}
              <span aria-hidden className="flex w-6 shrink-0 flex-col items-center">
                <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', extra ? 'bg-badge-yellow-fg' : 'bg-accent')} />
                {!(lastShown && !collapsible) ? <span className="my-0.5 w-0.5 flex-1 bg-hairline" /> : null}
              </span>
              <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5', !(lastShown && !collapsible) && 'pb-4')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span aria-hidden className="t-body">
                      {session.icon}
                    </span>
                    <span className="truncate t-label text-ink">{session.label}</span>
                  </span>
                  <InlineNumber
                    value={formatKg(session.totalKg, decimals)}
                    unit="kg"
                    className="shrink-0"
                    valueClassName={cn('t-body', extra ? 'text-status-warning-fg' : 'text-accent-ink')}
                  />
                </div>
                <span aria-hidden className={cn('h-1.5 overflow-hidden rounded-full', extra ? 'bg-badge-yellow-bg' : 'bg-accent-tint-2')}>
                  <span
                    className={cn('block h-full rounded-full', extra ? 'bg-badge-yellow-fg' : 'bg-accent')}
                    style={{ width: `${(session.totalKg / maxKg) * 100}%` }}
                  />
                </span>
                <span className="flex flex-wrap gap-x-3 t-micro text-muted">
                  <span>{session.timeRange}</span>
                  <span>
                    {session.catchCount} {session.catchCount === 1 ? 'captură' : 'capturi'}
                  </span>
                  {session.standCount > 0 ? (
                    <span>
                      {session.standCount} {session.standCount === 1 ? 'stand' : 'standuri'}
                    </span>
                  ) : null}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(e => !e)}
          className={cn(
            'cursor-pointer self-center rounded-control px-2 py-2 t-label hover:underline',
            expanded ? 'text-muted' : 'text-accent-ink',
          )}
        >
          {expanded ? 'Restrânge' : `Vezi toate cântarele (${sessions.length - SESSIONS_COLLAPSED_MAX} ascunse)`}
        </button>
      ) : null}
      <p className="mt-2 flex items-center justify-between border-t border-hairline pt-2.5 pl-6">
        <span className="t-label text-ink-2">Total: {totals.catches} capturi</span>
        <InlineNumber value={formatKg(totals.kg, decimals)} unit="kg" valueClassName="t-body-strong text-ink" />
      </p>
    </div>
  );
}

/** The data on screen is from an earlier read; the latest one failed. */
function StaleNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="mb-3 flex items-center gap-2 t-caption text-muted">
      Date posibil neactualizate ·
      <button type="button" onClick={onRetry} className="cursor-pointer t-label text-accent-ink hover:underline">
        Reîncearcă
      </button>
    </p>
  );
}

type BestNKey = 'best3' | 'best5' | 'best7';

/** The faces of the registration on a stand (fish standIdToParticipantAvatars): photo, else a name for the initials. */
function facesOnStand(standId: string | number | null | undefined, competition: CompetitionWithMyStatus): { name: string; src: string | null }[] {
  if (standId === null || standId === undefined) return [];
  const reg = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.stand && String(r.stand.id) === String(standId),
  );
  if (!reg) return [];
  if (reg.participants.length)
    return reg.participants.map(p => ({
      name: p.username || '?',
      src: p.avatar?.url ?? null,
    }));
  return reg.guestName ? [{ name: reg.guestName, src: null }] : [];
}

function participantLabel(row: BestNStandRanking, competition: CompetitionWithMyStatus): string {
  // fish getStandParticipantLabel: the registration on that stand first, then the row's own names.
  const reg = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.stand && String(r.stand.id) === String(row.standId),
  );
  if (reg) {
    return getCompetitorDisplayName({
      teamName: reg.teamName,
      participantNames: reg.participants.map(p => p.username),
      guestName: reg.guestName,
    });
  }
  return getCompetitorDisplayName({
    teamName: row.teamName,
    participantNames: row.participant ? [row.participant.username] : [],
    guestName: row.guestName,
  });
}

const TOPS_TITLE = 'Top capturi (Best 3 / 5 / 7)';
const TOPS_DESCRIPTION = 'Cele mai bune medii (3, 5 sau 7 capturi). Apasă rândul pentru clasament.';

function TopsCard({
  competition,
  query,
  decimals,
}: {
  decimals: number;
  competition: CompetitionWithMyStatus;
  query: UseQueryResult<{
    best3: BestNStandRanking[];
    best5: BestNStandRanking[];
    best7: BestNStandRanking[];
  }>;
}) {
  const [open, setOpen] = useState<BestNKey | null>(null);
  if (isOfflineEmpty(query) || (query.isError && !query.data)) {
    return <BlockState id="top-capturi" title={TOPS_TITLE} description={TOPS_DESCRIPTION} message="Nu s-a putut încărca topul capturilor." query={query} />;
  }
  if (query.isPending && query.fetchStatus !== 'idle') return <ChartCardSkeleton label="Se încarcă topul capturilor" />;
  const data = query.data;
  // No leader in any of the three (no catch yet): no card of «-» rows opening empty tables (rule 4).
  if (!data || (!data.best3.length && !data.best5.length && !data.best7.length)) return null;
  const tops: { key: BestNKey; label: string }[] = [
    { key: 'best3', label: 'Best 3' },
    { key: 'best5', label: 'Best 5' },
    { key: 'best7', label: 'Best 7' },
  ];
  return (
    <ChartCard id="top-capturi" title={TOPS_TITLE} description={TOPS_DESCRIPTION}>
      <ul className="overflow-hidden rounded-control border border-hairline">
        {tops.map(({ key, label }, i) => {
          const first = data[key][0];
          const faces = facesOnStand(first?.standId, competition);
          return (
            <li key={key} className={cn(i > 0 && 'border-t border-hairline')}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(key)}
                className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left hover:bg-soft-fill"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="w-13 t-caption">{label}</span>
                    {typeof first?.averageBestN === 'number' ? (
                      <InlineNumber value={formatKg(first.averageBestN, decimals)} unit="kg" valueClassName="t-body text-ink" />
                    ) : (
                      <span className="t-body">-</span>
                    )}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 t-caption text-muted">
                    {first ? <StandMark sector={first.sectorName} stand={String(first.standName)} /> : <span className="shrink-0">-</span>}
                    <span className="truncate">{first ? participantLabel(first, competition) : '-'}</span>
                  </span>
                </span>
                {faces.length ? <FaceStack people={faces.slice(0, 4)} size={32} className="shrink-0" /> : null}
                <ChevronRightIcon aria-hidden className="size-6 shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      <BestNSurface
        kind={open}
        onClose={() => setOpen(null)}
        rows={open ? [...data[open]].sort((a, b) => (b.averageBestN ?? 0) - (a.averageBestN ?? 0)) : []}
        competition={competition}
        decimals={decimals}
      />
    </ChartCard>
  );
}

/**
 * fish BestNRankingSheetContent, on the page's kit context surface opened over the page (a sheet on
 * the phone, a dialog from 768; the surface scrolls a long table itself).
 */
function BestNSurface({
  kind,
  onClose,
  rows,
  competition,
  decimals,
}: {
  kind: BestNKey | null;
  onClose: () => void;
  rows: BestNStandRanking[];
  competition: CompetitionWithMyStatus;
  decimals: number;
}) {
  const title = kind === 'best3' ? 'Best 3 - Clasament' : kind === 'best5' ? 'Best 5 - Clasament' : 'Best 7 - Clasament';
  const body = (
    <DataTableShell caption={title}>
      <thead>
        <tr>
          <Th>Stand</Th>
          <Th>Participant(e) / Echipă</Th>
          <Th>Primele capturi (kg)</Th>
          <Th align="right">Medie</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={`${row.standId}`} className="h-13">
            <Td>
              <StandMark sector={row.sectorName} stand={String(row.standName)} />
            </Td>
            <Td>{participantLabel(row, competition)}</Td>
            <Td className="text-ink-2">{(row.catchesUsed ?? []).map(w => formatKg(w, decimals)).join('; ')}</Td>
            <Td align="right" className="t-body-strong whitespace-nowrap">
              {typeof row.averageBestN === 'number' ? (
                <InlineNumber value={formatKg(row.averageBestN, decimals)} unit="kg" valueClassName="t-body-strong text-ink" />
              ) : (
                '-'
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTableShell>
  );
  return (
    <ContextSurface open={kind !== null} onClose={onClose} title={title} overlay>
      {kind !== null ? body : null}
    </ContextSurface>
  );
}

/** The weight the penalties took off the rows (kg): why the sectors add up to less than «Cantitate totală». */
function deductedKg(rankings: RankingResponse | undefined): number {
  if (!rankings) return 0;
  let kg = 0;
  for (const r of rankings.rankings as { penalties?: Penalty[] }[]) {
    for (const p of r.penalties ?? []) if (p.action === 'DEDUCT_TOTAL_WEIGHT' && typeof p.value === 'number') kg += p.value;
  }
  return kg;
}

function sectorTotals(rankings: RankingResponse | undefined): { name: string; value: number }[] {
  const type = rankings?.metadata.rankingType;
  if (!rankings || (type !== 'quantity' && type !== 'quantityQuality' && type !== 'qualityQuantity')) return [];
  const bySector = new Map<string, number>();
  for (const r of rankings.rankings as {
    sectorName: string;
    quantity: number;
  }[]) {
    if (typeof r.quantity !== 'number') return [];
    bySector.set(r.sectorName, (bySector.get(r.sectorName) ?? 0) + r.quantity);
  }
  return [...bySector.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * fish CompetitionSectorChart «Cantitate pe sector (kg)» — quantity, quantityQuality and
 * qualityQuantity rankings only: a donut in the sectors' own colours, the total in its middle, a
 * legend «Sector X · y.y kg» naming every slice by its swatch. No letter is drawn on a slice: a
 * sector colour is never a ground under text (components/ranking/sector.ts), and white fails AA on
 * the light sector hues.
 */
function SectorQuantity({ rankings, decimals }: { rankings: RankingResponse | undefined; decimals: number }) {
  const sectors = sectorTotals(rankings);
  const total = sectors.reduce((s, x) => s + x.value, 0);
  // No sector has a gram yet: no blank ring of «0» (rule 4).
  if (!sectors.length || total <= 0) return null;
  const kg = (n: number) => formatKg(n, decimals);
  // The rows carry the quantity after the weight penalties; the bento's total is what was weighed.
  const afterPenalties = deductedKg(rankings) > 0;
  const R = 80;
  const r = 40;
  const mid = (R + r) / 2;
  const width = R - r;
  const circumference = 2 * Math.PI * mid;
  const share = (v: number) => (total > 0 ? v / total : 0);
  const slices = sectors.map((s, i) => ({
    ...s,
    share: share(s.value),
    start: share(sectors.slice(0, i).reduce((sum, x) => sum + x.value, 0)),
  }));
  return (
    <ChartCard
      id="cantitate-sector"
      title="Cantitate pe sector (kg)"
      description={
        afterPenalties
          ? 'Cantitatea de pește pe fiecare sector, după penalizările de greutate.'
          : 'Cantitatea totală de pește cântărită pe fiecare sector al competiției.'
      }
    >
      {/* From 768 the card is wide: the donut and its legend side by side. */}
      <figure className="flex flex-col items-center gap-3 py-2 md:flex-row md:justify-center md:gap-8">
        <svg
          viewBox="-100 -100 200 200"
          className="size-50"
          role="img"
          aria-label={`Cantitate pe sector: ${sectors.map(s => `Sector ${s.name} ${kg(s.value)} kg`).join(', ')}`}
        >
          <g transform="rotate(-90)">
            {slices.map(s => (
              <circle
                key={s.name}
                r={mid}
                fill="none"
                strokeWidth={width}
                style={{ stroke: sectorColor(s.name) }}
                strokeDasharray={`${s.share * circumference} ${circumference}`}
                strokeDashoffset={-s.start * circumference}
              />
            ))}
          </g>
          <circle r={r} className="fill-accent-tint" />
          <text y={-6} textAnchor="middle" dominantBaseline="central" className="fill-ink t-heading" aria-hidden>
            {kg(total)}
          </text>
          <text y={14} textAnchor="middle" dominantBaseline="central" className="fill-muted t-micro" aria-hidden>
            kg
          </text>
        </svg>
        <figcaption>
          {/* Many sectors (up to 24): the legend in columns, so the card stays short beside its neighbour. */}
          <ul
            className={cn(
              'flex flex-wrap justify-center gap-x-3 gap-y-1.5',
              sectors.length > 8 ? 'md:grid md:grid-cols-3 md:gap-x-5 xl:grid-cols-2' : 'md:flex-col',
            )}
          >
            {sectors.map(s => {
              const fill = sectorFill(s.name, 'var(--color-muted)');
              return (
                <li key={s.name} className="flex items-center gap-1.5 t-caption text-ink-2">
                  <span aria-hidden className={cn('size-3 shrink-0 rounded-badge', fill.className)} style={fill.style} />
                  Sector {s.name} · <InlineNumber value={kg(s.value)} unit="kg" />
                </li>
              );
            })}
          </ul>
        </figcaption>
      </figure>
    </ChartCard>
  );
}

/** One penalty, with the competitor it was given to (fish PenaltiesSection `FlatPenalty`). */
type FlatPenalty = Penalty & { teamLabel: string };

const PENALTY_LABEL: Record<string, string> = {
  WARNING: 'Avertisment',
  DEDUCT_TOTAL_WEIGHT: 'Penalizare greutate',
  ELIMINATE: 'Eliminare',
};
const PENALTIES_PREVIEW = 3;

/**
 * fish components/penalty/PenaltiesSection.tsx — National Championship: every penalty, newest
 * first, 3 then «Vezi toate penalizările (n ascunse)» / «Ascunde». Authors and referees revoke one
 * (confirm, then DELETE, which re-reads the ranking and Best-N): the confirm stays open and busy
 * until the answer; on success it closes, a toast says so and focus goes to the «Penalizări»
 * heading (the revoked row is gone); on error the message stays in the dialog.
 */
function PenaltiesCard({
  t,
  competitionId,
  rows,
  canRevoke,
}: {
  t: Transport;
  competitionId: string;
  rows: {
    teamName?: string | null;
    guestName?: string | null;
    participant?: { username?: string } | null;
    penalties?: Penalty[];
  }[];
  canRevoke: boolean;
}) {
  const qc = useQueryClient();
  const toast = useSiteToast();
  const revoke = useMutation(deletePenaltyMutation(t, qc, competitionId));
  const [expanded, setExpanded] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const section = useRef<HTMLDivElement>(null);
  const closeAsk = () => {
    if (revoke.isPending) return;
    setAsking(null);
    setRevokeError(null);
  };
  const confirmRevoke = async () => {
    if (!asking || revoke.isPending) return;
    setRevokeError(null);
    try {
      await revoke.mutateAsync(asking);
      setAsking(null);
      toast('Penalizarea a fost revocată.', 'success');
      // After the dialog has given focus back (to a row that is about to go): the section heading.
      requestAnimationFrame(() => {
        const heading = section.current?.querySelector<HTMLElement>('h2, h3');
        if (!heading) return;
        heading.tabIndex = -1;
        heading.classList.add('outline-none');
        heading.focus();
      });
    } catch (err) {
      setRevokeError((err instanceof Error && err.message) || 'Penalizarea nu a putut fi revocată.');
    }
  };
  const sorted: FlatPenalty[] = useMemo(
    () =>
      rows
        .flatMap(r =>
          (r.penalties ?? []).map(p => ({
            ...p,
            teamLabel: getCompetitorDisplayName({
              teamName: r.teamName,
              participantNames: r.participant?.username ? [r.participant.username] : [],
              guestName: r.guestName,
              fallback: '-',
            }),
          })),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rows],
  );
  if (sorted.length === 0) return null;
  const collapsible = sorted.length > PENALTIES_PREVIEW;
  const visible = expanded ? sorted : sorted.slice(0, PENALTIES_PREVIEW);
  return (
    <div ref={section}>
    <ChartCard id="penalizari" title="Penalizări">
      <ul className="overflow-hidden rounded-control border border-hairline">
        {visible.map((p, i) => {
          const headline =
            p.action === 'DEDUCT_TOTAL_WEIGHT' && p.value != null ? (
              <>
                {PENALTY_LABEL[p.action]} · <InlineNumber value={formatDecimal(p.value, 0, 3)} unit="kg" valueClassName="t-label text-ink" />
              </>
            ) : (
              (PENALTY_LABEL[p.action] ?? p.action)
            );
          return (
            <li
              key={p.documentId}
              className={cn('flex items-start gap-2.5 p-3', i > 0 && 'border-t border-hairline', i % 2 === 1 && 'bg-page')}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn('h-3 w-2 shrink-0 rounded-badge', p.action === 'ELIMINATE' ? 'bg-status-danger-line' : 'bg-badge-yellow-fg')}
                  />
                  <span className="t-label text-ink">{headline}</span>
                  <span className="t-caption text-ink-2">· {p.teamLabel}</span>
                </p>
                {p.reason ? <p className="t-caption text-ink-2">{p.reason}</p> : null}
                <p className="t-micro text-muted">
                  {p.author?.username ?? 'Organizator'} · {new Date(p.createdAt).toLocaleString('ro-RO')}
                </p>
              </div>
              {canRevoke ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setAsking(p.documentId)}
                  className="shrink-0 cursor-pointer rounded-control t-label text-status-danger-fg hover:underline"
                >
                  Revocă
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(e => !e)}
          className={cn(
            'mx-auto mt-1 block cursor-pointer rounded-control px-2 py-2 t-label hover:underline',
            expanded ? 'text-muted' : 'text-accent-ink',
          )}
        >
          {expanded ? 'Ascunde' : `Vezi toate penalizările (${sorted.length - PENALTIES_PREVIEW} ascunse)`}
        </button>
      ) : null}
      <Dialog
        open={asking !== null}
        onClose={closeAsk}
        title="Revocă penalizarea?"
        description="Acțiunea va elimina penalizarea din clasament."
        alert
        actions={
          <>
            <Button variant="secondary" aria-disabled={revoke.isPending || undefined} onClick={closeAsk}>
              Anulează
            </Button>
            <Button
              variant="danger"
              aria-busy={revoke.isPending || undefined}
              aria-disabled={revoke.isPending || undefined}
              onClick={() => void confirmRevoke()}
            >
              {revoke.isPending ? 'Se revocă…' : 'Revocă'}
            </Button>
          </>
        }
      >
        {revokeError ? (
          <p role="alert" className="t-body text-status-danger-fg">
            {revokeError}
          </p>
        ) : null}
      </Dialog>
    </ChartCard>
    </div>
  );
}

const THRESHOLDS = [
  ['10+', 'count10Plus'],
  ['15+', 'count15Plus'],
  ['20+', 'count20Plus'],
  ['25+', 'count25Plus'],
  ['30+', 'count30Plus'],
] as const;

type ThresholdKey = (typeof THRESHOLDS)[number][1];
type ThresholdData = {
  bySector: ({ sectorName: string } & Record<ThresholdKey, number>)[];
  general: Record<ThresholdKey, number>;
};

// The unit once, after the figures (rule 10), never «10kg» glued five times.
const THRESHOLDS_DESCRIPTION = 'Numărul de capturi pe sector, grupate pe praguri de greutate (10, 15, 20, 25 și 30 kg).';

/**
 * fish CompetitionCatchesTable «Capturi». Hidden when nothing reaches 10 kg: fish hides it only with
 * no sector rows, and otherwise draws a block of zeros (20+ rows of «0» on a live competition) that
 * says nothing — the web hides it whenever the General row is all zeros (parity statistici.c13).
 */
function ThresholdTable({ query }: { query: UseQueryResult<ThresholdData> }) {
  if (isOfflineEmpty(query) || (query.isError && !query.data)) {
    return <BlockState id="capturi-praguri" title="Capturi" description={THRESHOLDS_DESCRIPTION} message="Nu s-au putut încărca capturile pe praguri." query={query} />;
  }
  if (query.isPending && query.fetchStatus !== 'idle') return <ChartCardSkeleton label="Se încarcă capturile pe praguri" />;
  const data = query.data;
  if (!data) return null;
  if (![data.general, ...data.bySector].some(row => THRESHOLDS.some(([, key]) => row[key] > 0))) return null;
  return (
    <ChartCard
      id="capturi-praguri"
      title="Capturi"
      description={THRESHOLDS_DESCRIPTION}
    >
      {/* Narrow numeric columns: on a full-width card the numbers stay near their sector. */}
      <DataTableShell caption="Capturi pe praguri de greutate" className="md:max-w-3xl">
        <thead>
          <tr>
            <Th>Sector</Th>
            {THRESHOLDS.map(([label]) => (
              <Th key={label} align="right">
                {label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.bySector.map(row => (
            <tr key={row.sectorName} className="h-13">
              <Td header className="whitespace-nowrap">
                Sector {row.sectorName}
              </Td>
              {THRESHOLDS.map(([label, key]) => (
                // A zero recedes, so the thresholds that were reached stand out.
                <Td key={label} align="right" className={row[key] === 0 ? 'text-muted' : 'text-ink'}>
                  {row[key]}
                </Td>
              ))}
            </tr>
          ))}
          <tr className="h-13">
            <Td header className="whitespace-nowrap">
              General
            </Td>
            {THRESHOLDS.map(([label, key]) => (
              <Td key={label} align="right" className={cn('t-body-strong', data.general[key] === 0 && 'text-muted')}>
                {data.general[key]}
              </Td>
            ))}
          </tr>
        </tbody>
      </DataTableShell>
    </ChartCard>
  );
}

/*
 * The two small tables of the view (Best N — a ranking —, thresholds) on the ranking table's look
 * (owner rule 12, RankingTable): the header row is its own coloured band (RANKING_HEAD, rounded at
 * the top), t-label heads; 52px rows on hairlines (no zebra), right-aligned tabular numbers, a
 * horizontal scroll when narrower. TODO(kit): extract RankingTable's shell as a kit DataTable.
 */
function DataTableShell({ caption, className, children }: { caption: string; className?: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto [scrollbar-width:thin]">
      <table className={cn('w-full border-separate border-spacing-0 t-body text-ink tabular-nums', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

function Th({ align = 'left', children }: { align?: 'left' | 'right'; children: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 px-3 t-label whitespace-nowrap first:rounded-tl-card first:pl-4 last:rounded-tr-card last:pr-4',
        RANKING_HEAD,
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  );
}

function Td({
  align = 'left',
  header = false,
  className,
  children,
}: {
  align?: 'left' | 'right';
  /** The row's name cell (a <th scope="row">). */
  header?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const cls = cn(
    // The first row sits right under the header band: no line on it.
    'border-t border-hairline px-3 first:pl-4 last:pr-4 [tr:first-child>&]:border-t-transparent',
    align === 'right' ? 'text-right' : 'text-left',
    header && 't-body-strong',
    className,
  );
  return header ? (
    <th scope="row" className={cls}>
      {children}
    </th>
  ) : (
    <td className={cls}>{children}</td>
  );
}
