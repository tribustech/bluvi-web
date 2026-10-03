'use client';

import { useState, type ReactNode } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
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
import { formatDecimal } from '@/components/cards/format';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ErrorState, LoadingRow } from '@/components/surfaces/StateCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { standLabel } from './stand';

/*
 * fish CompetitionRanking `statisticiContent`: meta cards (RankingCardsCarousel), weighing
 * sessions, Top capturi (Best 3/5/7, tap → BestN ranking), Cantitate pe sector, Capturi
 * (catch-threshold counts). Charts are drawn as plain bars (no chart library on the web).
 */
export function StatisticsView({
  t,
  competition,
  metadata,
  rankings,
  weighingStats,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  metadata: RankingMetadata | undefined;
  rankings: RankingResponse | undefined;
  weighingStats: UseQueryResult<WeighingStatisticsResponse>;
}) {
  const status = competition.competitionStatus;
  const bestN = useQuery(rankingBestNQuery(t, competition.documentId, status));
  const thresholds = useQuery(catchThresholdCountsQuery(t, competition.documentId, status));

  return (
    <div className="flex flex-col gap-5 pb-2">
      <MetaCards metadata={metadata} />
      <WeighingSessions query={weighingStats} />
      <TopsCard competition={competition} query={bestN} />
      <SectorQuantity rankings={rankings} />
      <ThresholdTable data={thresholds.data} />
    </div>
  );
}

/** fish StatisticsChartCard: title + description + content on a white card. */
function ChartCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0">
      <div>
        <h2 className="t-heading">{title}</h2>
        {description ? <p className="t-caption text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** fish RankingCardsCarousel + RankingMetaCard. Phone only: desktop shows these numbers on top. */
function MetaCards({ metadata }: { metadata: RankingMetadata | undefined }) {
  if (!metadata) return null;
  const big = metadata.biggestCatch;
  const cards = [
    {
      title: 'Cea mai mare captură',
      heading: big
        ? `${formatDecimal(big.weight, 2, 3)} kg`
        : metadata.biggestFish
          ? `${formatDecimal(Number(metadata.biggestFish), 2, 3)} kg`
          : '-',
      helper: big ? `Sector ${big.sectorName} Stand ${big.standName}` : '',
      helper2: big
        ? getCompetitorDisplayName({
            teamName: big.teamName,
            participantNames: big.participants.map(p => p.username),
            guestName: big.guestName,
            fallback: '',
          })
        : '',
    },
    { title: 'Număr total de capturi', heading: `${metadata.totalCatchesCount || '-'}`, helper: '', helper2: '' },
    {
      title: 'Cantitate totală',
      heading: metadata.totalQuantity ? `${formatDecimal(metadata.totalQuantity, 3, 3)} kg` : '-',
      helper: '',
      helper2: '',
    },
  ];
  return (
    <ul aria-label="Rezumat" className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:hidden">
      {cards.map(card => (
        <li
          key={card.title}
          className="flex h-28 w-[80%] shrink-0 snap-center flex-col items-center justify-center gap-1 rounded-[12px] bg-accent px-3 text-center text-on-accent shadow-glow"
        >
          <p className="t-caption">{card.title}</p>
          <p className="t-stat">{card.heading}</p>
          {card.helper ? <p className="t-caption">{card.helper}</p> : null}
          {card.helper2 ? <p className="-mt-1 max-w-1/2 truncate t-micro opacity-80">{card.helper2}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** fish CompetitionWeighingCharts «Sesiuni de cântărire»: one bar per weighing, kg on the bar. */
function WeighingSessions({ query }: { query: UseQueryResult<WeighingStatisticsResponse> }) {
  if (query.isPending && query.fetchStatus !== 'idle') return <LoadingRow />;
  if (query.isError) {
    return (
      <ErrorState
        title="Nu s-au putut încărca statisticile cântarilor."
        action={
          <Button size="compact" variant="secondary" onClick={() => void query.refetch()}>
            Încearcă din nou
          </Button>
        }
      />
    );
  }
  const items = [...(query.data?.data ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!items.length) return null;
  const max = Math.max(...items.map(i => i.totalWeightKg), 0.001);
  return (
    <ChartCard title="Sesiuni de cântărire" description="Cronologia cântăririlor și cantitatea totală per sesiune.">
      <ol className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {items.map(item => (
          <li key={item.weighingDocumentId} className="grid grid-cols-[52px_minmax(0,1fr)_72px] items-center gap-2 t-caption">
            <span className="font-bold">{standLabel(item.sectorName ?? '', item.standName ?? '')}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-soft-fill">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(item.totalWeightKg / max) * 100}%` }} />
            </span>
            <span className="text-right tabular-nums text-ink-2">{formatDecimal(item.totalWeightKg, 1, 3)} kg</span>
          </li>
        ))}
      </ol>
    </ChartCard>
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
  if (query.isPending && query.fetchStatus !== 'idle') return <LoadingRow />;
  const data = query.data;
  if (!data) return null;
  const tops: { key: BestNKey; label: string }[] = [
    { key: 'best3', label: 'Best 3' },
    { key: 'best5', label: 'Best 5' },
    { key: 'best7', label: 'Best 7' },
  ];
  return (
    <ChartCard title="Top capturi (Best 3 / 5 / 7)" description="Cele mai bune medii (3, 5 sau 7 capturi). Apasă rândul pentru clasament.">
      <ul className="overflow-hidden rounded-[8px] border border-hairline">
        {tops.map(({ key, label }, i) => {
          const first = data[key][0];
          return (
            <li key={key} className={cn(i > 0 && 'border-t border-hairline', i % 2 === 1 && 'bg-soft-fill/50')}>
              <button type="button" onClick={() => setOpen(key)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-soft-fill">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="w-13 t-caption">{label}</span>
                    <span className="t-body tabular-nums">
                      {typeof first?.averageBestN === 'number' ? `${formatDecimal(first.averageBestN, 3, 3)} kg` : '-'}
                    </span>
                  </span>
                  <span className="flex min-w-0 gap-1.5 t-caption text-muted">
                    <span className="shrink-0">Stand {first ? standLabel(first.sectorName, String(first.standName)) : '-'}</span>
                    <span className="truncate">{first ? participantLabel(first, competition) : '-'}</span>
                  </span>
                </span>
                <ChevronRightIcon aria-hidden className="size-5 text-faint" />
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
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 t-caption tabular-nums">
        <thead>
          <tr className="text-left text-ink-2">
            <th scope="col" className="border-b border-hairline px-2 py-2.5">Stand</th>
            <th scope="col" className="border-b border-hairline px-2 py-2.5">Participant(e) / Echipă</th>
            <th scope="col" className="border-b border-hairline px-2 py-2.5">Primele capturi (kg)</th>
            <th scope="col" className="border-b border-hairline px-2 py-2.5 text-right">Medie</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.standId}`} className="odd:bg-soft-fill/50">
              <td className="px-2 py-2.5 font-bold">{standLabel(row.sectorName, String(row.standName))}</td>
              <td className="px-2 py-2.5">{participantLabel(row, competition)}</td>
              <td className="px-2 py-2.5 text-muted">{(row.catchesUsed ?? []).map(w => formatDecimal(w, 2, 2)).join('; ')}</td>
              <td className="px-2 py-2.5 text-right whitespace-nowrap">
                {typeof row.averageBestN === 'number' ? formatDecimal(row.averageBestN, 3, 3) : '-'} kg
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  if (breakpoint === 'mobile') {
    return (
      <Sheet open={kind !== null} onClose={onClose} title={title} initialSnap={0.9}>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog open={kind !== null} onClose={onClose} title={title} closeButton className="max-w-[640px]">
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
          const fill = sectorFill(s.name, 'var(--color-accent)');
          return (
            <li key={s.name} className="grid grid-cols-[72px_minmax(0,1fr)_96px] items-center gap-2 t-caption">
              <span className="font-bold">Sector {s.name}</span>
              <span className="h-3 overflow-hidden rounded-full bg-soft-fill">
                <span className={cn('block h-full rounded-full', fill.className)} style={{ ...fill.style, width: `${(s.value / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink-2">
                {formatDecimal(s.value, 1, 1)} kg{total > 0 ? ` · ${Math.round((s.value / total) * 100)}%` : ''}
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

/** fish CompetitionCatchesTable «Capturi». Hidden when nothing reaches 10 kg. */
function ThresholdTable({
  data,
}: {
  data:
    | {
        bySector: ({ sectorName: string } & Record<(typeof THRESHOLDS)[number][1], number>)[];
        general: Record<(typeof THRESHOLDS)[number][1], number>;
      }
    | undefined;
}) {
  if (!data) return null;
  if (data.bySector.length === 0 && data.general.count10Plus === 0 && data.general.count15Plus === 0) return null;
  return (
    <ChartCard
      title="Capturi"
      description="Numărul de capturi pe sector, grupate pe praguri de greutate (10kg, 15kg, 20kg, 25kg, 30kg)."
    >
      <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-[8px] border border-hairline t-caption tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left text-ink-2">
              <span className="sr-only">Sector</span>
            </th>
            {THRESHOLDS.map(([label]) => (
              <th key={label} scope="col" className="w-11 py-2.5 text-center text-ink-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.bySector.map(row => (
            <tr key={row.sectorName} className="odd:bg-soft-fill/50">
              <th scope="row" className="border-t border-hairline px-3 py-3 text-left font-semibold">
                {row.sectorName}
              </th>
              {THRESHOLDS.map(([label, key]) => (
                <td key={label} className="border-t border-hairline text-center text-ink-2">
                  {row[key]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="bg-soft-fill">
            <th scope="row" className="border-t border-hairline px-3 py-3 text-left font-bold">
              General
            </th>
            {THRESHOLDS.map(([label, key]) => (
              <td key={label} className="border-t border-hairline text-center font-bold">
                {data.general[key]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </ChartCard>
  );
}
