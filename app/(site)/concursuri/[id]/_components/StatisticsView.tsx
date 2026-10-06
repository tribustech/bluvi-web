'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { PAGE_RETRY } from './retry-policy';
import { ChartBarIcon, ChevronRightIcon, ClockIcon, ExclamationTriangleIcon, TrophyIcon } from '@heroicons/react/24/outline';
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
import { formatDecimal, plural } from '@/components/cards/format';
import { CatchIcon, DeadFishIcon, FishIcon, ScaleIcon, StandPinIcon } from '@/components/icons/brand';
import { Dialog } from '@/components/surfaces/Dialog';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { LIST_GUTTER } from '@/components/templates/T1';
import { DetailSection, SECTION_SCROLL_MARGIN } from '@/components/templates/T3';
import { bentoSurface, FactTile, StatTile, type BentoTone } from '@/components/ui/BentoTile';
import { FaceStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { useSiteToast } from '../../../_shell/Toast';
import { ContextSurface } from './ContextSurface';
import { BiggestCatchTile, SummaryStrip, summaryTiles, type EntrantCounts } from './DesktopStats';
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
 * Bento (owner rule 9, ROADMAP §4b): on the phone the view opens on a bento of tiles of different
 * sizes (MetaTiles); from 768 the headline numbers are the strip over the views and the two facts it
 * does not say are the first cell of the chart grid (DesktopFacts) — never a row of their own, which
 * left one or two small tiles on a 1216–1680px row. The chart cards are one column below 1280 and
 * two balanced columns from 1280 (each card as tall as its content, never stretched to a taller
 * neighbour: no field of white under a short card). Owner rule 19: every chart card has its own
 * bento surface (ChartCard `tone`, the chart on a white inset), so no two cards in a row look alike;
 * the stand timeline (its own white card) sits between two tinted ones. Every state of a block (bones, error, offline)
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
  entrants,
  weighingTone = 'violet',
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
  /**
   * Who the catches are counted over (DesktopStats entrantCounts: the stands, else the feeder
   * entrants or the club teams) — the same counts as the strip over the views, so the per-entrant
   * facts are there for feeder legs and club rankings too.
   */
  entrants: EntrantCounts | null;
  /**
   * The surface of the strip's weighing tile (weighingTileTone): the grid's Penalizări / Cantitate
   * pe sector card takes the other of rose and violet, so no tint shows twice on the page (rule 19).
   */
  weighingTone?: 'rose' | 'violet';
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
  // Owner rule 19, one screen: the strip over the views takes lavender (Capturi), indigo and rose or
  // violet (the weighing); the facts mint and amber; the chart cards sky (sessions), peach (Top
  // capturi), lime (thresholds) and whichever of rose / violet the weighing tile does not use
  // (Penalizări or the donut — never both on one ranking type).
  const accentTone = weighingTone === 'rose' ? 'violet' : 'rose';
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
          entrants={entrants}
          completed={status === 'completed'}
          decimals={decimals}
          national={metadata?.rankingType === 'nationalChampionship'}
          competition={competition}
        />
      )}
      {nothing ? (
        <>
          {nc ? (
            <PenaltiesCard t={t} competitionId={competition.documentId} rows={nc.flatMap(club => club.teams ?? [])} canRevoke={canRevoke} tone={accentTone} />
          ) : null}
          <EmptyState
            icon={<ChartBarIcon aria-hidden className="size-10 text-muted" />}
            title={status === 'completed' ? 'Nu există statistici pentru acest concurs' : 'Încă nu există statistici'}
            description={status === 'completed' ? 'Nu s-a înregistrat niciun cântar.' : 'Graficele apar după primul cântar.'}
          />
        </>
      ) : (
      <div data-stats-grid className={STATS_GRID}>
        <DesktopFacts metadata={metadata} entrants={entrants} decimals={decimals} pending={rankingState === 'pending'} />
        <WeighingCharts t={t} competition={competition} query={weighingStats} decimals={decimals} />
        {nc ? (
          <PenaltiesCard t={t} competitionId={competition.documentId} rows={nc.flatMap(club => club.teams ?? [])} canRevoke={canRevoke} tone={accentTone} />
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
          <SectorQuantity rankings={rankings} decimals={decimals} tone={accentTone} />
        )}
        <ThresholdTable query={thresholds} />
      </div>
      )}
    </div>
  );
}

/**
 * The bento while the ranking loads, in the phone bento's shape (the navy tile and the quantity
 * tile across, then two facts). From 768 the strip over the views holds the place (its own bones).
 */
function TileBones({ announce = true }: { announce?: boolean }) {
  return (
    <div
      role={announce ? 'status' : undefined}
      aria-label={announce ? 'Se încarcă rezumatul' : undefined}
      aria-hidden={announce ? undefined : true}
      className="grid grid-cols-2 gap-3 md:hidden"
    >
      <span aria-hidden className="col-span-2 h-39 animate-shimmer rounded-bento" />
      <span aria-hidden className="col-span-2 h-25 animate-shimmer rounded-bento" />
      <span aria-hidden className="h-24 animate-shimmer rounded-bento" />
      <span aria-hidden className="h-24 animate-shimmer rounded-bento" />
    </div>
  );
}

/** The view while the session is unknown: the summary tiles (phone) and two chart cards. */
export function StatisticsSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă statisticile" className="flex flex-col gap-4 pb-2">
      <TileBones announce={false} />
      <div className={STATS_GRID}>
        <FactBones />
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
 *
 * With a `tone` (owner rule 19: no grid of identical white cards) the card is a bento tile of that
 * surface — the title and description on the tint (ink title, the tint's own AA foreground under it),
 * an optional large icon as top-right art — and the chart on a white inset, so every colour inside
 * it keeps the contrast it was drawn for. The failed / offline states keep the plain card.
 */
function ChartCard({
  id,
  title,
  description,
  tone,
  art,
  className,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  /** The card's bento surface (a coloured tile with the chart on a white inset). */
  tone?: Exclude<BentoTone, 'page' | 'surface' | 'navy' | 'signature' | 'indigo'>;
  /** A large decorative icon in the top-right corner (with `tone`). */
  art?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const fallbackId = useId();
  if (!tone) {
    return (
      <DetailSection id={id} title={title} description={description} className={cn('max-md:rounded-card max-md:shadow-e0', className)}>
        {children}
      </DetailSection>
    );
  }
  const titleId = id ? `${id}-titlu` : fallbackId;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn('rounded-bento p-1.5 shadow-e0 outline-none md:p-2', id && SECTION_SCROLL_MARGIN, bentoSurface(tone), className)}
    >
      {art ? (
        <span aria-hidden className="pointer-events-none absolute -top-2 -right-2 z-behind size-24 opacity-15 [&>svg]:size-full">
          {art}
        </span>
      ) : null}
      <div className={cn('flex flex-col gap-0.5 px-2.5 pt-2.5 pb-3 md:px-3 md:pt-3 xl:px-4 xl:pt-4 xl:pb-4', !!art && 'pe-20')}>
        <h2 id={titleId} className="t-title2 text-ink">
          {title}
        </h2>
        {description ? <p className="t-caption">{description}</p> : null}
      </div>
      {/* The white inset is ink, not the tint's fg: only the header's description takes the card's colour. */}
      <div className="rounded-[calc(var(--radius-bento)-6px)] bg-surface p-3 text-ink md:p-4 xl:p-5">{children}</div>
    </section>
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
 * fish RankingCardsCarousel + RankingMetaCard, as a bento (owner rule 9): tiles of different sizes,
 * the headline numbers big, the small facts small. One list, laid out per width:
 *  - Phone, two columns: the navy biggest catch across (the angler's face, name and stand),
 *    «Cantitate totală» across (the 40 step: a three-decimal total never fits half a 320–375 row),
 *    then the small facts two by two — Capturi · Medie pe captură, Standuri cu pește · Fără capturi,
 *    Media pe stand · Capturi pe stand.
 *  - From 768 this list is not drawn: the headline numbers (biggest catch, Capturi with the stands
 *    with / without fish, Cantitate totală with the average per stand, the weighing) are the strip
 *    over the views (DesktopStats), on every view — so the view switcher never moves between views
 *    — and the facts the strip does not say (Medie pe captură, Capturi pe stand) are the first cell
 *    of the chart grid (DesktopFacts).
 * The per-entrant facts count what the strip counts (EntrantCounts: the stands, else the feeder
 * teams / anglers or the club teams — «Echipe cu pește», «Media pe echipă»); a fact the data cannot
 * back (nobody counted) has no tile, so nothing reads «0». The per-stand figures are their own facts (rule 10), never a number glued to the unit.
 */
function MetaTiles({
  metadata,
  rows,
  entrants,
  completed,
  decimals,
  national,
  competition,
}: {
  metadata: RankingMetadata | undefined;
  rows: Parameters<typeof summaryTiles>[1];
  entrants: EntrantCounts | null;
  completed: boolean;
  decimals: number;
  national: boolean;
  competition: CompetitionWithMyStatus;
}) {
  if (!metadata) return null;
  // No catch yet: the one line, not tiles of zeros (as DesktopStats from 768).
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rows} completed={completed} className="md:hidden" />;
  const tiles = summaryTiles(metadata, rows, decimals, entrants);
  const facts = statisticFacts(metadata, entrants);
  const stands = facts.stands;
  const faces = metadata.biggestCatch ? facesOfCatch(metadata.biggestCatch, competition) : [];
  // Owner rule 19: every tile its own surface (BentoTile tones) — the navy signature, indigo for
  // the total, the soft tints for the small facts, each with its icon as corner art.
  return (
    <ul aria-label="Rezumat" className="grid grid-cols-2 gap-3 *:min-w-0 *:*:h-full md:hidden">
      <li className="col-span-2">
        <BiggestCatchTile {...tiles.biggest} decimals={decimals} national={national} faces={faces} art />
      </li>
      <li className="col-span-2">
        {/* Across the phone row it needs no 156 height: label and number, as tall as they are. */}
        <StatTile tone="indigo" icon={<ChartBarIcon />} label="Cantitate totală" value={tiles.quantity.value} unit="kg" className="min-h-0!" />
      </li>
      <li>
        <FactTile tone="lavender" label="Capturi" icon={<FishIcon />} value={tiles.catches.value} />
      </li>
      {facts.perCatch !== null ? (
        <li>
          <FactTile tone="mint" label="Medie pe captură" icon={<ScaleIcon />} value={formatKg(facts.perCatch, decimals)} unit="kg" />
        </li>
      ) : null}
      {stands ? (
        <>
          <li>
            <FactTile tone="sky" label={`${capitalize(stands.many)} cu pește`} icon={<CatchIcon />} value={String(stands.withFish)} unit={`/${stands.total}`} />
          </li>
          <li>
            <FactTile
              tone="rose"
              label="Fără capturi"
              icon={<DeadFishIcon />}
              value={String(stands.without)}
              unit={countWord(stands.without, stands.one, stands.many)}
            />
          </li>
          <li>
            <FactTile tone="violet" label={`Media pe ${stands.one}`} icon={<ChartBarIcon />} value={formatKg(stands.perStandKg, decimals)} unit="kg" />
          </li>
          <li>
            {/* Not Capturi's lavender and fish (two tiles of one look, rule 19): amber, the stand pin. */}
            <FactTile tone="amber" label={`Capturi pe ${stands.one}`} icon={<StandPinIcon />} value={formatDecimal(stands.catchesPerStand, 1, 1)} />
          </li>
        </>
      ) : null}
    </ul>
  );
}

/** «Echipe», «Standuri»: an entrant word at the start of a label. */
const capitalize = (word: string) => word.charAt(0).toLocaleUpperCase('ro') + word.slice(1);

/** The word after a count, Romanian plural: «stand», «standuri», «de standuri» (plural() without the figure). */
const countWord = (n: number, one: string, many: string) => plural(n, one, many).replace(/^\S+ /, '');

/**
 * From 768: the facts the strip over the views does not say (Medie pe captură, Capturi pe stand) as
 * the first cell of the chart grid — in the first column from 1280 — instead of a row of their own
 * under the tabs (one or two ~260px tiles on a 1216–1680px row: a near-empty rail, owner rules 5 and
 * 16). Two facts share the cell, the 40 step with a caption that says what the figure is made of,
 * each on its own tint with its icon as corner art (rule 19) — Capturi pe stand on amber with the
 * stand pin, never the lavender fish of the strip's Capturi right above it. Feeder legs and club
 * rankings count their teams / anglers (EntrantCounts), so they have the pair too. One fact alone
 * (nobody counted) is the compact 26-step tile at its own width, never a slab of tint
 * across the whole column holding one small figure (rules 5, 9, 16).
 * While the ranking is read: one tile's bones, so the cards under it never move when it lands.
 */
function DesktopFacts({
  metadata,
  entrants,
  decimals,
  pending,
}: {
  metadata: RankingMetadata | undefined;
  entrants: EntrantCounts | null;
  decimals: number;
  pending: boolean;
}) {
  if (pending) return <FactBones />;
  if (!metadata || metadata.totalCatchesCount === 0) return null;
  const facts = statisticFacts(metadata, entrants);
  const stands = facts.stands;
  if (facts.perCatch === null && !stands) return null;
  const perCatchCaption = `din ${plural(metadata.totalCatchesCount, 'captură', 'capturi')}`;
  if (!stands) {
    return (
      <ul aria-label="Rezumat" className="flex max-md:hidden">
        <li className="min-w-52">
          <FactTile tone="mint" label="Medie pe captură" icon={<ScaleIcon />} value={formatKg(facts.perCatch!, decimals)} unit="kg" caption={perCatchCaption} />
        </li>
      </ul>
    );
  }
  return (
    <ul aria-label="Rezumat" className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(52),1fr))] gap-4 *:min-w-0 *:*:h-full max-md:hidden">
      {facts.perCatch !== null ? (
        <li>
          <StatTile tone="mint" label="Medie pe captură" icon={<ScaleIcon />} value={formatKg(facts.perCatch, decimals)} unit="kg" caption={perCatchCaption} />
        </li>
      ) : null}
      <li>
        <StatTile
          tone="amber"
          label={`Capturi pe ${stands.one}`}
          icon={<StandPinIcon />}
          value={formatDecimal(stands.catchesPerStand, 1, 1)}
          caption={`pe ${plural(stands.total, stands.one, stands.many)}`}
        />
      </li>
    </ul>
  );
}

/** The desktop facts cell while the ranking is read: one 156px bento tile's bones. */
function FactBones() {
  return <span aria-hidden className="block h-39 animate-shimmer rounded-bento max-md:hidden" />;
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
        <ChartCard id="sesiuni" title={SESSIONS_TITLE} description={SESSIONS_DESCRIPTION} tone="sky" art={<ClockIcon />}>
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
          const peek = lastShown && collapsible && !expanded;
          const extra = session.type === 'extra';
          return (
            <li key={`${session.label}-${i}`} className="flex gap-2">
              {/* The rail: the dot, and the line down to the next session. Collapsed, the last row's
                  rail and bar fade as the peek of the hidden sessions — its text stays at full
                  strength (AA on every surface, rule 19). */}
              <span aria-hidden className={cn('flex w-6 shrink-0 flex-col items-center', peek && 'opacity-35')}>
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
                <span aria-hidden className={cn('h-1.5 overflow-hidden rounded-full', extra ? 'bg-badge-yellow-bg' : 'bg-accent-tint-2', peek && 'opacity-35')}>
                  <span
                    className={cn('block h-full rounded-full', extra ? 'bg-badge-yellow-fg' : 'bg-accent')}
                    style={{ width: `${(session.totalKg / maxKg) * 100}%` }}
                  />
                </span>
                <span className="flex flex-wrap gap-x-3 t-micro text-muted">
                  <span>{session.timeRange}</span>
                  <span>{plural(session.catchCount, 'captură', 'capturi')}</span>
                  {session.standCount > 0 ? <span>{plural(session.standCount, 'stand', 'standuri')}</span> : null}
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
        <span className="t-label text-ink-2">{`Total: ${plural(totals.catches, 'captură', 'capturi')}`}</span>
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

/**
 * The faces of the biggest catch's entrant. The registration on the catch's stand only when it is
 * that entrant: in feeder legs the stand changes every leg (the catch's stand belongs, in the
 * registration, to another team), so the registration is found by its people (participant
 * documentIds), else its team or guest name. Unresolved: the initials of the displayed name —
 * never another entrant's face.
 */
function facesOfCatch(big: NonNullable<RankingMetadata['biggestCatch']>, competition: CompetitionWithMyStatus): { name: string; src: string | null }[] {
  const registered = competition.registrations.filter(r => r.registrationStatus === 'registered');
  const ids = new Set(big.participants.map(p => p.documentId));
  const known = ids.size > 0 || !!big.teamName || !!big.guestName;
  const isEntrant = (r: (typeof registered)[number]) =>
    ids.size > 0
      ? r.participants.some(p => ids.has(p.documentId))
      : big.teamName
        ? r.teamName === big.teamName
        : big.guestName
          ? r.guestName === big.guestName
          : false;
  const onStand =
    competition.rankingType === 'feederRounds' || big.standId === null || big.standId === undefined
      ? undefined
      : registered.find(r => r.stand && String(r.stand.id) === String(big.standId));
  const reg = onStand && (!known || isEntrant(onStand)) ? onStand : known ? registered.find(isEntrant) : undefined;
  if (reg) {
    if (reg.participants.length) return reg.participants.map(p => ({ name: p.username || '?', src: p.avatar?.url ?? null }));
    if (reg.guestName) return [{ name: reg.guestName, src: null }];
  }
  const name = getCompetitorDisplayName({
    teamName: big.teamName,
    participantNames: big.participants.map(p => p.username),
    guestName: big.guestName,
    fallback: '',
  });
  return name ? [{ name, src: null }] : [];
}

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
  const rows = tops.map(top => {
    const first = data[top.key][0];
    return { ...top, first, faces: facesOnStand(first?.standId, competition) };
  });
  // The face slot is kept on every row when one has faces, so the figures line up.
  const withFaces = rows.some(r => r.faces.length > 0);
  return (
    <ChartCard id="top-capturi" title={TOPS_TITLE} description={TOPS_DESCRIPTION} tone="peach" art={<TrophyIcon />}>
      <ul className="overflow-hidden rounded-control border border-hairline">
        {rows.map(({ key, label, first, faces }, i) => {
          return (
            <li key={key} className={cn(i > 0 && 'border-t border-hairline')}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setOpen(key)}
                className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left hover:bg-soft-fill"
              >
                {/* The face first, beside the name it belongs to (as the ranking rows), never across a wide card. */}
                {withFaces ? (
                  <span data-face className="flex min-w-8 shrink-0">
                    {faces.length ? <FaceStack people={faces.slice(0, 4)} size={32} /> : null}
                  </span>
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="w-13 t-caption text-muted">{label}</span>
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
function SectorQuantity({
  rankings,
  decimals,
  tone,
}: {
  rankings: RankingResponse | undefined;
  decimals: number;
  /** Rose or violet: the one the strip's weighing tile does not use (rule 19). */
  tone: 'rose' | 'violet';
}) {
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
      tone={tone}
      art={<ChartBarIcon />}
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
  tone,
}: {
  /** Rose or violet: the one the strip's weighing tile does not use (rule 19). */
  tone: 'rose' | 'violet';
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
    <ChartCard id="penalizari" title="Penalizări" tone={tone} art={<ExclamationTriangleIcon />}>
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
    <ChartCard id="capturi-praguri" title="Capturi" description={THRESHOLDS_DESCRIPTION} tone="lime" art={<FishIcon />}>
      {/* Rule 16: as wide as its content — narrow numeric columns (fish's 4–5rem), the rest of the
          card stays margin, so the numbers sit by their sector at 1440+. */}
      <DataTableShell caption="Capturi pe praguri de greutate" width="w-full md:w-auto">
        <thead>
          <tr>
            <Th>Sector</Th>
            {THRESHOLDS.map(([label]) => (
              <Th key={label} align="right" className="md:w-18">
                {label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.bySector.map(row => (
            <tr key={row.sectorName} className="h-13">
              <Td header className="whitespace-nowrap">
                {/* The phone keeps the letter (the column says «Sector»), so six columns fit 343px. */}
                <span className="max-md:sr-only">Sector </span>
                {row.sectorName}
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
function DataTableShell({
  caption,
  width = 'w-full',
  className,
  children,
}: {
  caption: string;
  /** The table's width classes (the thresholds table is only as wide as its content from 768). */
  width?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto [scrollbar-width:thin]">
      <table className={cn(width, 'border-separate border-spacing-0 t-body text-ink tabular-nums', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

// Below 768 the cells are a step tighter (px-2, first 12px), so a six-column table fits 343px.
const CELL_PAD = 'px-2 first:pl-3 last:pr-3 md:px-3 md:first:pl-4 md:last:pr-4';

function Th({ align = 'left', className, children }: { align?: 'left' | 'right'; className?: string; children: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 t-label whitespace-nowrap first:rounded-tl-card last:rounded-tr-card',
        CELL_PAD,
        RANKING_HEAD,
        align === 'right' ? 'text-right' : 'text-left',
        className,
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
    'border-t border-hairline [tr:first-child>&]:border-t-transparent',
    CELL_PAD,
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
