'use client';

import { useState, type ReactNode } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { PAGE_RETRY } from './retry-policy';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import {
  catchThresholdCountsQuery,
  getCompetitorDisplayName,
  rankingBestNQuery,
  type BestNStandRanking,
  type CompetitionWithMyStatus,
  type RankingMetadata,
  type RankingResponse,
  type WeighingStatisticsResponse,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { sectorFill } from '@/components/ranking/sector';
import { formatWeight } from '@/components/ranking';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ErrorState } from '@/components/surfaces/StateCard';
import { DetailSection } from '@/components/templates/T3';
import { StatTile } from '@/components/ui/BentoTile';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { BiggestCatchTile, SummaryStrip, summaryTiles } from './DesktopStats';
import { isOfflineEmpty, OfflineState } from './offline';
import { StandMark } from './StandMark';
import { standLabel } from './stand';

/*
 * fish CompetitionRanking `statisticiContent`: meta cards (RankingCardsCarousel), weighing
 * sessions, Top capturi (Best 3/5/7, tap → BestN ranking), Cantitate pe sector, Capturi
 * (catch-threshold counts). Charts are drawn as plain bars (no chart library on the web).
 * Every block has its own loading (its shape), error (with «Încearcă din nou») and empty state.
 */
export function StatisticsView({
  t,
  competition,
  metadata,
  rankings,
  rankingRows,
  weighingStats,
  decimals,
}: {
  /** The competition's weight precision (weightDecimals). */
  decimals: number;
  t: Transport;
  competition: CompetitionWithMyStatus;
  metadata: RankingMetadata | undefined;
  rankings: RankingResponse | undefined;
  rankingRows: Parameters<typeof summaryTiles>[1];
  weighingStats: UseQueryResult<WeighingStatisticsResponse>;
}) {
  const status = competition.competitionStatus;
  const bestN = useQuery({ ...rankingBestNQuery(t, competition.documentId, status), ...PAGE_RETRY });
  const thresholds = useQuery({ ...catchThresholdCountsQuery(t, competition.documentId, status), ...PAGE_RETRY });

  return (
    <div className="flex flex-col gap-4 pb-2">
      <MetaTiles metadata={metadata} rows={rankingRows} completed={status === 'completed'} decimals={decimals} />
      <WeighingSessions query={weighingStats} />
      <TopsCard competition={competition} query={bestN} />
      <SectorQuantity rankings={rankings} />
      <ThresholdTable query={thresholds} />
    </div>
  );
}

/** The view while the session is unknown: the summary tiles (phone) and two chart cards. */
export function StatisticsSkeleton() {
  return (
    <div role="status" aria-label="Se încarcă statisticile" className="flex flex-col gap-4 pb-2">
      <div aria-hidden className="-mx-4 flex gap-3 overflow-hidden px-4 md:hidden">
        <span className="h-39 w-4/5 shrink-0 animate-shimmer rounded-bento" />
        <span className="h-39 w-4/5 shrink-0 animate-shimmer rounded-bento" />
      </div>
      <ChartBones />
      <ChartBones />
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
function ChartCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <DetailSection title={title} description={description} className="max-md:rounded-card max-md:shadow-e0">
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

/** A block whose read failed (and has nothing cached): the kit ErrorState with its retry. */
function BlockError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <ErrorState
      title={title}
      action={
        <Button size="compact" variant="secondary" onClick={onRetry}>
          Încearcă din nou
        </Button>
      }
    />
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
}: {
  metadata: RankingMetadata | undefined;
  rows: Parameters<typeof summaryTiles>[1];
  completed: boolean;
  decimals: number;
}) {
  if (!metadata) return null;
  // No catch yet: the one line, not three tiles of zeros (as DesktopStats from 768).
  if (metadata.totalCatchesCount === 0) return <SummaryStrip rankings={rows} completed={completed} className="md:hidden" />;
  const tiles = summaryTiles(metadata, rows, decimals);
  const item = 'w-4/5 shrink-0 snap-center [&>*]:h-full';
  return (
    <ul aria-label="Rezumat" className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
      <li className={item}>
        <BiggestCatchTile {...tiles.biggest} decimals={decimals} />
      </li>
      <li className={item}>
        <StatTile label="Capturi" value={tiles.catches.value} caption={tiles.catches.caption} />
      </li>
      <li className={item}>
        <StatTile
          label="Cantitate totală"
          value={tiles.quantity.value}
          unit="kg"
          caption={tiles.quantity.caption}
        />
      </li>
    </ul>
  );
}

/** fish CompetitionWeighingCharts «Sesiuni de cântărire»: one bar per weighing, kg on the bar. */
function WeighingSessions({ query }: { query: UseQueryResult<WeighingStatisticsResponse> }) {
  if (isOfflineEmpty(query)) return <OfflineState onRetry={() => void query.refetch()} />;
  if (query.isPending && query.fetchStatus !== 'idle') return <ChartCardSkeleton label="Se încarcă sesiunile de cântărire" />;
  // A failed re-read keeps what was already on screen (TanStack keeps `data` on a refetch error).
  if (query.isError && !query.data) {
    return <BlockError title="Nu s-au putut încărca statisticile cântarilor." onRetry={() => void query.refetch()} />;
  }
  const items = [...(query.data?.data ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const title = 'Sesiuni de cântărire';
  const description = 'Cronologia cântăririlor și cantitatea totală per sesiune.';
  if (!items.length) {
    return (
      <ChartCard title={title} description={description}>
        <p className="t-body text-muted">Niciun cântar încă.</p>
      </ChartCard>
    );
  }
  const max = Math.max(...items.map(i => i.totalWeightKg), 0.001);
  return (
    <ChartCard title={title} description={description}>
      {query.isError ? <StaleNotice onRetry={() => void query.refetch()} /> : null}
      <ol className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {items.map(item => (
          <li key={item.weighingDocumentId} className="grid grid-cols-[--spacing(13)_minmax(0,1fr)_--spacing(20)] items-center gap-2 t-caption">
            <span className="t-label">{standLabel(item.sectorName ?? '', item.standName ?? '')}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-soft-fill">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(item.totalWeightKg / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-ink-2">{formatWeight(item.totalWeightKg)} kg</span>
          </li>
        ))}
      </ol>
    </ChartCard>
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

function participantLabel(row: BestNStandRanking, competition: CompetitionWithMyStatus): string {
  // fish getStandParticipantLabel: the registration on that stand first, then the row's own names.
  const reg = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.stand && String(r.stand.id) === String(row.standId),
  );
  if (reg) {
    return getCompetitorDisplayName({ teamName: reg.teamName, participantNames: reg.participants.map(p => p.username), guestName: reg.guestName });
  }
  return getCompetitorDisplayName({
    teamName: row.teamName,
    participantNames: row.participant ? [row.participant.username] : [],
    guestName: row.guestName,
  });
}

function TopsCard({
  competition,
  query,
}: {
  competition: CompetitionWithMyStatus;
  query: UseQueryResult<{ best3: BestNStandRanking[]; best5: BestNStandRanking[]; best7: BestNStandRanking[] }>;
}) {
  const [open, setOpen] = useState<BestNKey | null>(null);
  if (isOfflineEmpty(query)) return <OfflineState onRetry={() => void query.refetch()} />;
  if (query.isPending && query.fetchStatus !== 'idle') return <ChartCardSkeleton label="Se încarcă topul capturilor" />;
  if (query.isError && !query.data) {
    return <BlockError title="Nu s-a putut încărca topul capturilor." onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;
  const tops: { key: BestNKey; label: string }[] = [
    { key: 'best3', label: 'Best 3' },
    { key: 'best5', label: 'Best 5' },
    { key: 'best7', label: 'Best 7' },
  ];
  return (
    <ChartCard title="Top capturi (Best 3 / 5 / 7)" description="Cele mai bune medii (3, 5 sau 7 capturi). Apasă rândul pentru clasament.">
      <ul className="overflow-hidden rounded-control border border-hairline">
        {tops.map(({ key, label }, i) => {
          const first = data[key][0];
          return (
            <li key={key} className={cn(i > 0 && 'border-t border-hairline')}>
              <button type="button" onClick={() => setOpen(key)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left hover:bg-soft-fill">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="w-13 t-caption">{label}</span>
                    <span className="t-body tabular-nums">
                      {typeof first?.averageBestN === 'number' ? `${formatWeight(first.averageBestN)} kg` : '–'}
                    </span>
                  </span>
                  <span className="flex min-w-0 gap-1.5 t-caption text-muted">
                    <span className="shrink-0">Stand {first ? standLabel(first.sectorName, String(first.standName)) : '-'}</span>
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
      />
    </ChartCard>
  );
}

/** fish BestNRankingSheetContent (bottom sheet on the phone, dialog from 768). */
function BestNSurface({
  kind,
  onClose,
  rows,
  competition,
}: {
  kind: BestNKey | null;
  onClose: () => void;
  rows: BestNStandRanking[];
  competition: CompetitionWithMyStatus;
}) {
  const breakpoint = useBreakpoint();
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
            <Td className="text-ink-2">{(row.catchesUsed ?? []).map(w => formatWeight(w)).join('; ')}</Td>
            <Td align="right" className="t-body-strong whitespace-nowrap">
              {typeof row.averageBestN === 'number' ? `${formatWeight(row.averageBestN)} kg` : '–'}
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTableShell>
  );
  if (breakpoint === 'mobile') {
    return (
      <Sheet open={kind !== null} onClose={onClose} title={title} initialSnap={0.9}>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog open={kind !== null} onClose={onClose} title={title} closeButton>
      <div className="max-h-[60vh] overflow-y-auto">{body}</div>
    </Dialog>
  );
}

function sectorTotals(rankings: RankingResponse | undefined): { name: string; value: number }[] {
  const type = rankings?.metadata.rankingType;
  if (!rankings || (type !== 'quantity' && type !== 'quantityQuality' && type !== 'qualityQuantity')) return [];
  const bySector = new Map<string, number>();
  for (const r of rankings.rankings as { sectorName: string; quantity: number }[]) {
    if (typeof r.quantity !== 'number') return [];
    bySector.set(r.sectorName, (bySector.get(r.sectorName) ?? 0) + r.quantity);
  }
  return [...bySector.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
}

/** fish CompetitionSectorChart «Cantitate pe sector (kg)» — quantity-type rankings only. */
function SectorQuantity({ rankings }: { rankings: RankingResponse | undefined }) {
  const sectors = sectorTotals(rankings);
  if (!sectors.length) return null;
  const total = sectors.reduce((s, x) => s + x.value, 0);
  const max = Math.max(...sectors.map(s => s.value), 0.001);
  return (
    <ChartCard title="Cantitate pe sector (kg)" description="Cantitatea totală de pește cântărită pe fiecare sector al competiției.">
      <ul className="flex flex-col gap-2">
        {sectors.map(s => {
          // The sector says who it is by its dot (Fundații §01: a sector colour is only the dot or
          // the 4px edge); the bar is the chart's accent, as «Sesiuni de cântărire».
          const fill = sectorFill(s.name, 'var(--color-muted)');
          return (
            <li key={s.name} className="grid grid-cols-[--spacing(20)_minmax(0,1fr)_--spacing(24)] items-center gap-2 t-caption">
              <span className="flex items-center gap-1.5 t-label whitespace-nowrap">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', fill.className)} style={fill.style} />
                Sector {s.name}
              </span>
              <span className="h-2.5 overflow-hidden rounded-full bg-soft-fill">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(s.value / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink-2">
                {formatWeight(s.value)} kg{total > 0 ? ` · ${Math.round((s.value / total) * 100)}%` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
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

/** fish CompetitionCatchesTable «Capturi». Hidden when nothing reaches 10 kg. */
function ThresholdTable({ query }: { query: UseQueryResult<ThresholdData> }) {
  if (isOfflineEmpty(query)) return <OfflineState onRetry={() => void query.refetch()} />;
  if (query.isPending && query.fetchStatus !== 'idle') return <ChartCardSkeleton label="Se încarcă capturile pe praguri" />;
  if (query.isError && !query.data) {
    return <BlockError title="Nu s-au putut încărca capturile pe praguri." onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;
  if (data.bySector.length === 0 && data.general.count10Plus === 0 && data.general.count15Plus === 0) return null;
  return (
    <ChartCard
      title="Capturi"
      description="Numărul de capturi pe sector, grupate pe praguri de greutate (10kg, 15kg, 20kg, 25kg, 30kg)."
    >
      <DataTableShell caption="Capturi pe praguri de greutate">
        <thead>
          <tr>
            <Th>Sector</Th>
            {THRESHOLDS.map(([label]) => (
              <Th key={label} align="right">
                {label} kg
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.bySector.map(row => (
            <tr key={row.sectorName} className="h-13">
              <Td header>Sector {row.sectorName}</Td>
              {THRESHOLDS.map(([label, key]) => (
                <Td key={label} align="right" className="text-ink-2">
                  {row[key]}
                </Td>
              ))}
            </tr>
          ))}
          <tr className="h-13">
            <Td header>General</Td>
            {THRESHOLDS.map(([label, key]) => (
              <Td key={label} align="right" className="t-body-strong">
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
