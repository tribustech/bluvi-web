'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { PAGE_RETRY } from './retry-policy';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
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
import { formatDecimal } from '@/components/cards/format';
import { Dialog } from '@/components/surfaces/Dialog';
import { ErrorState } from '@/components/surfaces/StateCard';
import { LIST_GUTTER } from '@/components/templates/T1';
import { DetailSection } from '@/components/templates/T3';
import { StatTile } from '@/components/ui/BentoTile';
import { FaceStack } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '../../../_shell/Toast';
import { ContextSurface } from './ContextSurface';
import { BiggestCatchTile, SummaryStrip, summaryTiles } from './DesktopStats';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { isNationalType } from './stand';
import { StandMark } from './StandMark';
import { StandTimeline, timelineHidden, useTimelineSnapshot } from './StandTimeline';

/*
 * fish CompetitionRanking / NationalChampionshipRanking `statisticiContent` (parity
 * competition-page.statistici), in fish's order: the summary cards (RankingCardsCarousel; from 768
 * the strip over the views), the weighing charts (sessions + «Cronologia standurilor»), Penalizări
 * (national championship), Top capturi (Best 3/5/7, tap → its ranking), Cantitate pe sector (the
 * quantity rankings), Capturi pe praguri. Charts are drawn with plain HTML / SVG (no chart
 * library). Every block has its own loading (its shape), error («Încearcă din nou») and empty state.
 *
 * Width (ROADMAP §4): the cards are items of one auto-fill grid in fish's order (~480px tracks: one
 * shrinkable column on the phone and the tablet, two from 1280, three on the widest screens; the
 * T1 list gutter); the wide «Capturi» table spans the whole row under them. Every state of a block
 * (bones, error, offline) keeps its card, title and grid footprint, so nothing moves when it lands;
 * the blocks drawn from the ranking (phone tiles, Penalizări, the donut) follow the ranking read.
 *
 * Weights: the competition's precision (`decimals`, as the summary tiles) with the Romanian
 * grouping («2.961,0»); the session rows and the sector donut keep fish's one decimal (c7, c12).
 */
const STATS_GRID = cn('grid grid-cols-1 items-start', LIST_GUTTER, 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(120),1fr))]');
/** The rankings whose rows carry a quantity per sector (the donut). */
const QUANTITY_TYPES = new Set(['quantity', 'quantityQuality', 'qualityQuantity']);
/** fish's one decimal (session rows, the sector donut), grouped. */
const kg1 = (n: number) => formatDecimal(n, 1, 1);

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
        />
      )}
      <div className={STATS_GRID}>
        <WeighingCharts t={t} competition={competition} query={weighingStats} />
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
          <SectorQuantity rankings={rankings} />
        )}
        <div className="col-span-full min-w-0 empty:hidden">
          <ThresholdTable query={thresholds} />
        </div>
      </div>
    </div>
  );
}

/** The phone's summary tiles while the ranking loads (from 768 they sit above the views). */
function TileBones({ announce = true }: { announce?: boolean }) {
  return (
    <div
      role={announce ? 'status' : undefined}
      aria-label={announce ? 'Se încarcă rezumatul' : undefined}
      aria-hidden={announce ? undefined : true}
      className="-mx-4 flex gap-3 overflow-hidden px-4 md:hidden"
    >
      <span aria-hidden className="h-39 w-4/5 shrink-0 animate-shimmer rounded-bento" />
      <span aria-hidden className="h-39 w-4/5 shrink-0 animate-shimmer rounded-bento" />
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
 * fish RankingCardsCarousel + RankingMetaCard, on the kit tiles the desktop row uses (the navy
 * CountTile for the biggest catch, StatTiles for the totals). Phone only: from 768 the same tiles
 * sit above the views.
 */
function MetaTiles({
  metadata,
  rows,
  completed,
  decimals,
  national,
}: {
  metadata: RankingMetadata | undefined;
  rows: Parameters<typeof summaryTiles>[1];
  completed: boolean;
  decimals: number;
  national: boolean;
}) {
  if (!metadata) return null;
  // No catch yet: the one line, not three tiles of zeros (as DesktopStats from 768).
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rows} completed={completed} className="md:hidden" />;
  const tiles = summaryTiles(metadata, rows, decimals);
  const item = 'w-4/5 shrink-0 snap-center [&>*]:h-full';
  return (
    <ul aria-label="Rezumat" tabIndex={0} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
      <li className={item}>
        <BiggestCatchTile {...tiles.biggest} decimals={decimals} national={national} />
      </li>
      <li className={item}>
        <StatTile label="Număr total de capturi" value={tiles.catches.value} caption={tiles.catches.caption} />
      </li>
      <li className={item}>
        <StatTile label="Cantitate totală" value={tiles.quantity.value} unit="kg" caption={tiles.quantity.caption} />
      </li>
    </ul>
  );
}

/**
 * fish CompetitionWeighingCharts: «Sesiuni de cântărire» (only with at least one weighing), then the
 * stand timeline card. While the weighing statistics load: their shape; on error: the message and a
 * retry of them alone (fish hides both cards then).
 */
const SESSIONS_TITLE = 'Sesiuni de cântărire';
const SESSIONS_DESCRIPTION = 'Cronologia cântăririlor și cantitatea totală per sesiune.';

function WeighingCharts({
  t,
  competition,
  query,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  query: UseQueryResult<WeighingStatisticsResponse>;
}) {
  // The timeline's read (shared with its card): with no chart to sit beside it, the sessions card
  // takes the whole row and so does the short «no timeline» card — no empty band in the grid.
  const snapshot = useTimelineSnapshot(t, competition);
  const hidden = timelineHidden(competition.competitionStatus);
  const noTimeline = hidden || (snapshot.isSuccess && !snapshot.data);
  const wide = noTimeline ? 'col-span-full' : undefined;
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
        <StandTimeline t={t} competition={competition} variant="card" emptyClassName="col-span-full" />
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
  return (
    <>
      {query.data.data.length > 0 ? (
        <ChartCard id="sesiuni" title={SESSIONS_TITLE} description={SESSIONS_DESCRIPTION} className={wide}>
          {query.isError ? <StaleNotice onRetry={() => void query.refetch()} /> : null}
          <SessionTimeline items={query.data.data} />
        </ChartCard>
      ) : null}
      <StandTimeline t={t} competition={competition} variant="card" emptyClassName="col-span-full" />
    </>
  );
}

/** fish WeighingSessionTimeline: the rail, one row per session, 4 then «Vezi toate cântarele». */
function SessionTimeline({ items }: { items: WeighingStatisticsResponse['data'] }) {
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
                  <span className={cn('shrink-0 t-body tabular-nums', extra ? 'text-status-warning-fg' : 'text-accent-ink')}>
                    {kg1(session.totalKg)} kg
                  </span>
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
        <span className="t-body text-ink tabular-nums">{kg1(totals.kg)} kg</span>
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

/** The faces of the registration on a Best-N leader's stand (fish standIdToParticipantAvatars). */
function standFaces(row: BestNStandRanking | undefined, competition: CompetitionWithMyStatus): { name: string; src: string | null }[] {
  if (!row) return [];
  const reg = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.stand && String(r.stand.id) === String(row.standId),
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
/** An average of 3, 5 or 7 catches keeps three decimals (fish), whatever one catch's precision. */
const AVERAGE_DECIMALS = 3;

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
  if (!data) return null;
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
          const faces = standFaces(first, competition);
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
                    <span className="t-body tabular-nums">
                      {typeof first?.averageBestN === 'number' ? `${formatKg(first.averageBestN, AVERAGE_DECIMALS)} kg` : '-'}
                    </span>
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
              {typeof row.averageBestN === 'number' ? `${formatKg(row.averageBestN, AVERAGE_DECIMALS)} kg` : '-'}
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
function SectorQuantity({ rankings }: { rankings: RankingResponse | undefined }) {
  const sectors = sectorTotals(rankings);
  if (!sectors.length) return null;
  const total = sectors.reduce((s, x) => s + x.value, 0);
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
      description="Cantitatea totală de pește cântărită pe fiecare sector al competiției."
    >
      {/* From 768 the card is wide: the donut and its legend side by side. */}
      <figure className="flex flex-col items-center gap-3 py-2 md:flex-row md:justify-center md:gap-8">
        <svg
          viewBox="-100 -100 200 200"
          className="size-50"
          role="img"
          aria-label={`Cantitate pe sector: ${sectors.map(s => `Sector ${s.name} ${kg1(s.value)} kg`).join(', ')}`}
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
            {kg1(total)}
          </text>
          <text y={14} textAnchor="middle" dominantBaseline="central" className="fill-muted t-micro" aria-hidden>
            kg
          </text>
        </svg>
        <figcaption>
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 md:flex-col">
            {sectors.map(s => {
              const fill = sectorFill(s.name, 'var(--color-muted)');
              return (
                <li key={s.name} className="flex items-center gap-1.5 t-caption text-ink-2">
                  <span aria-hidden className={cn('size-3 shrink-0 rounded-badge', fill.className)} style={fill.style} />
                  Sector {s.name} · {kg1(s.value)} kg
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
    <div ref={section} className="contents">
    <ChartCard id="penalizari" title="Penalizări">
      <ul className="overflow-hidden rounded-control border border-hairline">
        {visible.map((p, i) => {
          const headline =
            p.action === 'DEDUCT_TOTAL_WEIGHT' && p.value != null
              ? `${PENALTY_LABEL[p.action]} · ${p.value} kg`
              : (PENALTY_LABEL[p.action] ?? p.action);
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

const THRESHOLDS_DESCRIPTION = 'Numărul de capturi pe sector, grupate pe praguri de greutate (10kg, 15kg, 20kg, 25kg, 30kg).';

/** fish CompetitionCatchesTable «Capturi». Hidden when nothing reaches 10 kg. */
function ThresholdTable({ query }: { query: UseQueryResult<ThresholdData> }) {
  if (isOfflineEmpty(query) || (query.isError && !query.data)) {
    return <BlockState id="capturi-praguri" title="Capturi" description={THRESHOLDS_DESCRIPTION} message="Nu s-au putut încărca capturile pe praguri." query={query} />;
  }
  if (query.isPending && query.fetchStatus !== 'idle') return <ChartCardSkeleton label="Se încarcă capturile pe praguri" />;
  const data = query.data;
  if (!data) return null;
  if (data.bySector.length === 0 && data.general.count10Plus === 0 && data.general.count15Plus === 0) return null;
  return (
    <ChartCard
      id="capturi-praguri"
      title="Capturi"
      description={THRESHOLDS_DESCRIPTION}
    >
      <DataTableShell caption="Capturi pe praguri de greutate">
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
 * The two small tables of the view (Best N, thresholds) on the competition's ranking table look
 * (RankingView's embedded RankingTable), embedded in their card / dialog (no second card): a 40px
 * header row on the card's own white — no fill, no radius, t-label heads, a hairline under it —
 * 52px rows on hairlines (no zebra), right-aligned tabular numbers, a horizontal scroll when
 * narrower. TODO(kit): extract RankingTable's shell as a kit DataTable, then use it here.
 */
function DataTableShell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto [scrollbar-width:thin]">
      <table className="w-full border-separate border-spacing-0 t-body text-ink tabular-nums">
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
        'h-10 border-b border-hairline px-3 t-label whitespace-nowrap text-ink-2 first:pl-4 last:pr-4',
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
    // The first row sits right under the header's hairline: no second line.
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
