'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { currentLegOf, type CompetitionWithMyStatus } from '@/core/competitions';
import {
  weighingsQuery,
  weighingsSummaryQuery,
  type AllocatedParticipantsResponse,
  type WeighingByStand,
  type WeighingsSummaryItem,
} from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { sectorFill } from '@/components/ranking/sector';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { LIST_GUTTER } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { shortDateTime } from './dates';
import { WeighingDetail, type WeighingDetailTarget } from './WeighingDetail';
import { WeighingsSummaryPanel } from './WeighingsSummaryPanel';
import { WeighingsTable, type StandReads } from './WeighingsTable';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { isNationalType, nationalStandLabel } from './stand';
import { PAGE_RETRY } from './retry-policy';

/*
 * fish CompetitionRanking `rankingView === 'cantare'`: every sector, every stand as a
 * StandCantarCard (who is on it, total kg, Cântare / Extra-Cântare counts), tap to open the
 * stand's weighings (CantarItem), press one for its detail (WeighingDetail, parity
 * competition-page.cantar-detaliu). Scale actions (referee/author) are app-only. Feeder legs: a
 * stand's weighings are the current leg's (fish currentLegOf); from 1280 the table's «Manșa N»
 * switch shows any leg (tableLeg), and the detail opens on the leg shown.
 *
 * Numbers are shown only when they are known: signed out the summary is not granted, so one note
 * above the sectors says a stand opens for its weighings (never a made-up «0» per card); while the
 * session is still being read, neither the note nor a card without its counts (their bones); signed in,
 * a stand the summary does not list has no weighing yet (fish «Cantare: 0»); a failed (or offline)
 * read is an error with a retry, never zeros. While the allocation loads, each sector is its bones.
 *
 * Each stand is a surface card (radius card, e0), like every sibling view's cards, on an
 * auto-fill grid (the T1 gutter; one shrinkable column on the phone, so a long allocation line
 * truncates instead of widening the card): more stands per row as the screen grows, never wider
 * cards. An open stand stays in its cell (selected: the accent ring, the chevron turned) and its
 * weighings open as one full-row panel after the last card of its row, so no card moves inside the
 * row and nothing leaves a hole.
 *
 * From 1280 (owner rule 14) the stands give way to WeighingsTable: every weighing in one table, the
 * detail docked beside it. From 1440 that column is there at rest too (WeighingsSummaryPanel: the
 * weighings at a glance, the ones in progress and the latest), and a pressed weighing replaces it. Until the width is known (the server render, hydration) both are drawn
 * and CSS shows the right one — the table as its bones — so nothing jumps when the client takes over.
 */

const STAND_GRID = cn('grid grid-cols-[minmax(0,1fr)] items-start', LIST_GUTTER, 'md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))]');
const STAND_CARD = 'rounded-card bg-surface p-4 shadow-e0';
export function WeighingsView({
  t,
  competition,
  allocated,
  session,
  decimals,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  allocated: UseQueryResult<AllocatedParticipantsResponse>;
  /** The viewer: signed in, signed out, or still being read (no note, the counts as bones). */
  session: 'in' | 'out' | 'pending';
  /** The competition's weight precision (weightDecimals): the same as the summary tiles above. */
  decimals: number;
}) {
  const id = competition.documentId;
  const isAuthenticated = session === 'in';
  // The Public role is not granted the summary (guest → 403): signed out, totals load per stand on open.
  const summaryQ = useQuery({
    ...weighingsSummaryQuery(t, id, isAuthenticated),
    ...PAGE_RETRY,
  });
  const summaryByStand = useMemo(() => {
    const m: Record<string, WeighingsSummaryItem> = {};
    for (const s of summaryQ.data ?? []) m[s.standId] = s;
    return m;
  }, [summaryQ.data]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const currentLeg = currentLegOf(competition);
  // From 1280 the table shows any leg (its «Manșa N» switch); the phone's cards the current one.
  const [tableLeg, setTableLeg] = useState(currentLeg);
  const isNc = isNationalType(competition.rankingType);
  const desktop = useBreakpoint() === 'desktop';
  const round = desktop ? tableLeg : currentLeg;
  const legCount = Math.max(competition.roundsCount ?? 0, currentLeg ?? 0);
  // The weighing detail (fish WeighingDetailSheet): `?cantar=<weighing>&stand=<stand>` in the URL
  // (routes.competitionWeighing — a notification's link), replaced in place while it is open and
  // removed when it closes (fish clears its params). `opening` remounts it: each opening starts on
  // the pressed weighing and on the weighing view.
  const [detail, setDetail] = useState<(WeighingDetailTarget & { opening: number }) | null>(null);
  const standOf = (standId: string) => {
    for (const sector of competition.sectors) {
      const stand = sector.stands.find(st => st.documentId === standId);
      if (stand) return { sectorName: sector.name, standName: stand.name };
    }
    return null;
  };
  const writeParams = (params: { cantar: string; stand: string } | null) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('cantar');
    url.searchParams.delete('stand');
    if (params) {
      url.searchParams.set('cantar', params.cantar);
      url.searchParams.set('stand', params.stand);
    }
    window.history.replaceState(window.history.state, '', url);
  };
  const openWeighing = (standId: string, weighingId: string, fromLink = false) => {
    const where = standOf(standId);
    if (!where) return;
    writeParams({ cantar: weighingId, stand: standId });
    setDetail(d => ({
      competitionId: id,
      standId,
      weighingId,
      round,
      fromLink,
      ...where,
      opening: (d?.opening ?? 0) + 1,
    }));
  };
  const closeWeighing = () => {
    writeParams(null);
    setDetail(null);
  };
  // `?stand=<documentId>` (routes.competitionWeighings, the Extra Cântare requests): that stand opens,
  // and is brought into view once the allocation has drawn the cards; with `cantar` the weighing's
  // detail opens over it (a stand the competition does not have opens nothing, as fish). Read once,
  // on arrival.
  const linked = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stand = params.get('stand');
    if (!stand) return;
    linked.current = stand;
    const weighing = params.get('cantar');
    // After the hydrating render (the server drew every stand closed).
    const open = setTimeout(() => {
      setExpanded(stand);
      if (weighing) openWeighing(stand, weighing, true);
    }, 0);
    return () => clearTimeout(open);
    // Arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const allocationReady = !allocated.isPending;
  useEffect(() => {
    if (!allocationReady || !linked.current) return;
    document.getElementById(`stand-${linked.current}`)?.scrollIntoView({ block: 'center' });
    linked.current = null;
  }, [allocationReady]);

  if (!competition.sectors.length) {
    return <EmptyState title="Nu există date de afișat" />;
  }

  const summaryOffline = isAuthenticated && isOfflineEmpty(summaryQ);
  const summaryFailed = isAuthenticated && ((summaryQ.isError && !summaryQ.data) || summaryOffline);
  const allocationFailed = allocated.isError && !allocated.data;
  const allocationLoading = allocated.isPending;

  // Without the allocation every stand would read as empty («-»): only the state, with its retry.
  if (isOfflineEmpty(allocated)) {
    return <OfflineState fetching={allocated.isFetching} onRetry={() => void allocated.refetch()} />;
  }
  if (allocationFailed) {
    return (
      <ErrorState
        title="Nu s-au putut încărca participanții."
        action={<QueryRetry fetching={allocated.isFetching} failed onRetry={() => void allocated.refetch()} size="compact" />}
      />
    );
  }
  // The session still unknown counts as the totals loading: the cards keep their counts line's height.
  const summaryLoading = session === 'pending' || (isAuthenticated && summaryQ.isPending && summaryQ.fetchStatus === 'fetching');

  const detailPanel = (
    <WeighingDetail
      key={detail?.opening ?? 0}
      t={t}
      target={detail}
      allocated={allocated.data}
      isNc={isNc}
      decimals={decimals}
      onClose={closeWeighing}
    />
  );

  if (desktop) {
    // Signed in, the summary names the stands with weighings; without it (signed out, or it failed)
    // every stand is read; while either is unknown, none (the rows' bones).
    const reads: StandReads =
      session === 'pending' || allocationLoading
        ? null
        : session === 'out' || summaryFailed
          ? 'all'
          : summaryQ.isSuccess
            ? new Set((summaryQ.data ?? []).filter(s => s.regularCount + s.extraCount > 0).map(s => s.standId))
            : null;
    return (
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          {allocationLoading ? (
            <TableBones />
          ) : (
            <WeighingsTable
              t={t}
              competition={competition}
              allocated={allocated.data}
              reads={reads}
              leg={tableLeg != null ? { current: tableLeg, count: legCount, onChange: setTableLeg } : undefined}
              decimals={decimals}
              isNc={isNc}
              docked={detail != null}
              selected={detail?.weighingId ?? null}
              onWeighing={(standId, weighingId) => openWeighing(standId, weighingId)}
            />
          )}
        </div>
        {detail == null || detail.fromLink ? (
          <WeighingsSummaryPanel
            t={t}
            competition={competition}
            allocated={allocated.data}
            reads={reads}
            round={tableLeg}
            isNc={isNc}
            decimals={decimals}
            onWeighing={(standId, weighingId) => openWeighing(standId, weighingId)}
          />
        ) : null}
        {detailPanel}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-6">
      {/* The width is not known yet (server render): from 1280 the table's bones stand in. */}
      <div className="hidden min-w-0 flex-1 xl:block">
        <TableBones />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 xl:hidden">
        {summaryOffline ? (
          <OfflineState fetching={summaryQ.isFetching} onRetry={() => void summaryQ.refetch()} />
        ) : summaryFailed ? (
          <ErrorState
            title="Nu s-au putut încărca totalurile cântarelor."
            action={<QueryRetry fetching={summaryQ.isFetching} failed onRetry={() => void summaryQ.refetch()} size="compact" />}
          />
        ) : null}
        {session === 'out' ? (
          // Signed out the totals are read per stand, on open: said once, not on every card.
          <p className="flex items-center gap-1.5 t-caption text-muted">
            <InformationCircleIcon aria-hidden className="size-4 shrink-0" />
            Deschide un stand ca să vezi cântarele lui.
          </p>
        ) : null}
        {competition.sectors.map(sector => {
          const fill = sectorFill(sector.name, 'var(--color-accent)');
          return (
            <section key={sector.documentId} aria-labelledby={`cantar-${sector.documentId}`} className="flex flex-col gap-2">
              <h2 id={`cantar-${sector.documentId}`} className="flex items-center gap-2 t-title2">
                <span aria-hidden className={cn('size-2.5 rounded-full', fill.className)} style={fill.style} />
                Sector {sector.name}
              </h2>
              {allocationLoading ? (
                // The sector's stands in grey (no hint, no counts): announced once for the view.
                <ul aria-hidden className={STAND_GRID}>
                  {sector.stands.map(stand => (
                    <li key={stand.documentId} className={cn(STAND_CARD, 'flex items-start gap-2')}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Bone className="w-16 t-heading" />
                        <Bone className="w-3/5 t-caption" />
                        {/* Signed in the loaded card has its counts line too (same height). */}
                        {session !== 'out' ? (
                          <span className="mt-1 flex gap-3">
                            <Bone className="w-20 t-caption" />
                            <Bone className="w-24 t-caption" />
                          </span>
                        ) : null}
                      </span>
                      <Bone className="w-16 t-body-strong" />
                    </li>
                  ))}
                </ul>
              ) : (
                <SectorStands
                  stands={sector.stands}
                  expanded={expanded}
                  renderCard={stand => (
                    <StandCard
                      t={t}
                      competitionId={id}
                      standId={stand.documentId}
                      sectorName={sector.name}
                      standName={stand.name}
                      alloc={allocated.data?.[stand.documentId] ?? null}
                      nationalChampionship={isNc}
                      round={round}
                      decimals={decimals}
                      summary={
                        summaryByStand[stand.documentId] ??
                        // Signed in, a stand the summary does not list has no weighing yet (fish
                        // «Cantare: 0 / Extra-Cantare: 0»; the total stays hidden, as fish's «-»).
                        (isAuthenticated && summaryQ.isSuccess ? NO_WEIGHINGS : undefined)
                      }
                      summaryLoading={summaryLoading}
                      expanded={expanded === stand.documentId}
                      onToggle={() => setExpanded(e => (e === stand.documentId ? null : stand.documentId))}
                    />
                  )}
                  renderPanel={stand => (
                    <StandWeighings
                      t={t}
                      competitionId={id}
                      standId={stand.documentId}
                      standLabel={`Stand ${isNc ? nationalStandLabel(sector.name, allocated.data?.[stand.documentId]?.sectorDrawPosition, stand.name) : stand.name}`}
                      round={round}
                      decimals={decimals}
                      summaryLoading={summaryLoading}
                      onWeighing={weighingId => openWeighing(stand.documentId, weighingId)}
                    />
                  )}
                />
              )}
            </section>
          );
        })}
        {allocationLoading ? (
          <p role="status" className="sr-only">
            Se încarcă standurile…
          </p>
        ) : summaryLoading ? (
          <p role="status" className="sr-only">
            Se încarcă totalurile cântarelor…
          </p>
        ) : null}
      </div>
      {detailPanel}
    </div>
  );
}

/** The table's shape while the width or the allocation is not known: header and a few rows. */
function TableBones() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <span className="flex justify-between">
        <Bone className="w-40 t-caption" />
        <span className="h-8 w-48 animate-shimmer rounded-control" />
      </span>
      <span className="flex flex-col overflow-hidden rounded-card bg-surface shadow-e0">
        <span className="h-10 bg-accent-tint" />
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="flex items-center gap-6 border-t border-hairline px-4 py-3">
            <Bone className="w-10 t-body" />
            <span className="size-8 shrink-0 animate-shimmer rounded-full" />
            <Bone className="w-40 t-body" />
            <Bone className="w-20 t-body" />
            <Bone className="w-28 t-body" />
          </span>
        ))}
      </span>
    </div>
  );
}

/** A stand the (successful) summary does not list: no weighing yet, no total. */
type StandSummary = Pick<WeighingsSummaryItem, 'regularCount' | 'extraCount'> & { totalKg: number | null };
const NO_WEIGHINGS: StandSummary = { regularCount: 0, extraCount: 0, totalKg: null };

/** A text bone inside a line of the given type step (as tall as the loaded text). */
function Bone({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className="absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-full" />
    </span>
  );
}

function StandCard({
  t,
  competitionId,
  standId,
  sectorName,
  standName,
  alloc,
  nationalChampionship,
  summary,
  summaryLoading,
  expanded,
  onToggle,
  round,
  decimals,
}: {
  decimals: number;
  /** Feeder: the current leg (the stand's weighings are that leg's). */
  round?: number;
  t: Transport;
  competitionId: string;
  standId: string;
  sectorName: string;
  standName: string;
  alloc: AllocatedParticipantsResponse[string];
  /** fish StandCantarCard on the NC ranking: «Stand A3(12)» (the draw position, the stand in brackets). */
  nationalChampionship?: boolean;
  summary: StandSummary | undefined;
  summaryLoading: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const weighingsQ = useQuery({
    ...weighingsQuery(t, competitionId, standId, {
      enabled: expanded && !summaryLoading,
      round,
    }),
    ...PAGE_RETRY,
  });
  const weighings = weighingsQ.data;

  const participants = alloc ? (alloc.guestName ? alloc.guestName : alloc.participants.map(p => p.name).join(', ') || '-') : '-';
  const panelId = `cantare-${standId}`;
  // The open stand counts its own weighings; a closed one shows the summary when there is one.
  const fromList = expanded && weighingsQ.isSuccess && weighings;
  const counts = fromList
    ? {
        regular: weighings.filter(w => w.weighingType === 'normal').length,
        extra: weighings.filter(w => w.weighingType === 'extra').length,
        kg: weighings.length ? weighings.reduce((acc, w) => acc + w.catches.reduce((a, c) => a + c.weight, 0), 0) : null,
      }
    : summary
      ? {
          regular: summary.regularCount,
          extra: summary.extraCount,
          kg: summary.totalKg == null ? null : Number(summary.totalKg),
        }
      : null;
  const summaryPending = summaryLoading && !summary;
  const listPending = expanded && weighingsQ.isPending;

  return (
    <div className={cn(STAND_CARD, 'transition-shadow duration-(--duration-fast)', expanded && 'ring-2 ring-accent')}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2 rounded-control text-left"
      >
        <span className="min-w-0 flex-1">
          {/* fish: «Stand 12» under its «Sector A» heading; the national championship «Stand A3(12)». */}
          <span className="block truncate t-heading">
            Stand {nationalChampionship ? nationalStandLabel(sectorName, alloc?.sectorDrawPosition, standName) : standName}
          </span>
          <span className="block truncate t-caption text-muted">
            {alloc ? (
              <>
                {alloc.teamName ? `${alloc.teamName}: ` : ''}
                {participants}
              </>
            ) : (
              // fish: «-» for a stand the allocation says is empty (a failed read never reaches here).
              '-'
            )}
          </span>
        </span>
        {counts && counts.kg !== null ? (
          // fish: the total in the accent; the unit apart, smaller and muted (owner rule 10).
          <InlineNumber value={formatKg(counts.kg, decimals)} unit="kg" valueClassName="t-body-strong text-accent-ink" className="shrink-0" />
        ) : null}
        <ChevronDownIcon
          aria-hidden
          className={cn('size-6 shrink-0 text-muted transition-transform duration-(--duration-fast)', expanded && 'rotate-180')}
        />
      </button>
      {summaryPending || listPending ? (
        // Announced once by the view (totals) or by the open stand's panel (its weighings).
        <span aria-hidden className="mt-1 flex gap-3">
          <Bone className="w-20 t-caption" />
          <Bone className="w-24 t-caption" />
        </span>
      ) : counts ? (
        <p className="mt-1 flex gap-3 t-caption text-muted">
          <span>
            Cântare: <span className="t-label text-ink">{counts.regular}</span>
          </span>
          <span>
            Extra-cântare: <span className="t-label text-ink">{counts.extra}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}

type SectorStand = CompetitionWithMyStatus['sectors'][number]['stands'][number];

/** The grid's column count, read from its resolved template (1 before it is measured). */
function useGridColumns(ref: RefObject<HTMLElement | null>): number {
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

/**
 * One sector's stand cards; the open stand's weighings as a full-row panel after the last card of
 * the open card's visual row (row end = ceil((i + 1) / cols) × cols), so the cards around it stay put.
 */
function SectorStands({
  stands,
  expanded,
  renderCard,
  renderPanel,
}: {
  stands: SectorStand[];
  expanded: string | null;
  renderCard: (stand: SectorStand) => ReactNode;
  renderPanel: (stand: SectorStand) => ReactNode;
}) {
  const grid = useRef<HTMLUListElement>(null);
  const cols = useGridColumns(grid);
  const openIndex = stands.findIndex(st => st.documentId === expanded);
  const panelAfter = openIndex < 0 ? -1 : Math.min(Math.ceil((openIndex + 1) / cols) * cols, stands.length) - 1;
  return (
    <ul ref={grid} className={STAND_GRID}>
      {stands.map((stand, i) => (
        <Fragment key={stand.documentId}>
          <li id={`stand-${stand.documentId}`} className="min-w-0 scroll-mt-40">
            {renderCard(stand)}
          </li>
          {i === panelAfter ? (
            <li key={`panel-${stands[openIndex].documentId}`} className="col-span-full min-w-0">
              {renderPanel(stands[openIndex])}
            </li>
          ) : null}
        </Fragment>
      ))}
    </ul>
  );
}

/** The open stand's weighings (its own read, shared with the card's counts), in its full-row panel. */
function StandWeighings({
  t,
  competitionId,
  standId,
  standLabel,
  round,
  decimals,
  summaryLoading,
  onWeighing,
}: {
  t: Transport;
  competitionId: string;
  standId: string;
  standLabel: string;
  round?: number;
  decimals: number;
  summaryLoading: boolean;
  onWeighing: (weighingId: string) => void;
}) {
  const weighingsQ = useQuery({
    ...weighingsQuery(t, competitionId, standId, { enabled: !summaryLoading, round }),
    ...PAGE_RETRY,
  });
  const weighings = weighingsQ.data;
  // The panel opens below its row: bring it into view without a jump.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const headingId = `cantare-${standId}-titlu`;
  return (
    <div ref={panel} id={`cantare-${standId}`} role="region" aria-labelledby={headingId} className={cn(STAND_CARD, 'scroll-mb-28 flex flex-col gap-3')}>
      <h3 id={headingId} className="t-label text-ink-2">
        Cântarele standului {standLabel.replace(/^Stand /, '')}
      </h3>
      {isOfflineEmpty(weighingsQ) ? (
        <OfflineState fetching={weighingsQ.isFetching} onRetry={() => void weighingsQ.refetch()} />
      ) : weighingsQ.isPending ? (
        <div role="status" aria-label="Se încarcă cântarele standului" className="grid gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(64),1fr))]">
          {[0, 1].map(i => (
            <span key={i} aria-hidden className="h-24 animate-shimmer rounded-control" />
          ))}
        </div>
      ) : weighingsQ.isError && !weighings ? (
        <ErrorState
          title="Cântarele standului nu au putut fi încărcate."
          action={<QueryRetry fetching={weighingsQ.isFetching} failed onRetry={() => void weighingsQ.refetch()} size="compact" />}
        />
      ) : weighings && weighings.length > 0 ? (
        <ol className="grid gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(64),1fr))]">
          {weighings.map((w, i) => (
            <WeighingItem key={w.documentId} weighing={w} index={i} decimals={decimals} onPress={() => onWeighing(w.documentId)} />
          ))}
        </ol>
      ) : (
        <p className="t-caption text-muted">Standul nu are niciun cântar încă.</p>
      )}
    </div>
  );
}

/** fish components/scale/CantarItem.tsx (read-only): pressed, it opens the weighing's detail. */
function WeighingItem({
  weighing,
  index,
  decimals,
  onPress,
}: {
  weighing: WeighingByStand;
  index: number;
  decimals: number;
  onPress: () => void;
}) {
  const total = formatKg(
    weighing.catches.reduce((a, c) => a + c.weight, 0),
    decimals,
  );
  const finished = weighing.weighingStatus === 'finished';
  return (
    <li>
      <button
        type="button"
        onClick={onPress}
        aria-haspopup="dialog"
        className="flex h-full w-full cursor-pointer flex-col gap-1 rounded-control bg-page p-3 text-left hover:bg-soft-fill"
      >
        <div className="flex w-full items-center gap-2">
          <span className="flex-1 t-body-strong">
            Cântar {index + 1} {weighing.weighingType === 'extra' ? '(Extra)' : null}
          </span>
          {/* A state, not an attribute: the status pill (radius 999). */}
          <StatusPill tone={finished ? 'success' : 'live'}>{finished ? 'Terminat' : 'În curs'}</StatusPill>
        </div>
        <p className="flex gap-3 t-caption text-muted">
          <span>
            Total: <InlineNumber value={total} unit="kg" valueClassName="t-label text-ink" />
          </span>
          <span>
            Capturi: <span className="t-label text-ink tabular-nums">{weighing.catches.length}</span>
          </span>
        </p>
        {weighing.startDate ? (
          <p className="t-caption text-muted">
            {shortDateTime(weighing.startDate)} <span aria-hidden>–</span>
            <span className="sr-only">până la</span> {weighing.endDate ? shortDateTime(weighing.endDate) : 'În curs'}
          </p>
        ) : null}
      </button>
    </li>
  );
}
