'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type CSSProperties } from 'react';
import { ChartBarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { ListError, useListUrlState } from '@/components/templates/T1';
import { DashboardEmpty, DashboardPage, DashboardToolbar, STATE_CARD } from '@/components/templates/T5';
import { FishIcon, FishingRodIcon } from '@/components/icons/brand';
import { FactTile, StatTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { communityStatsQuery, periodPhraseFor, type CommunityStatsDTO, type StatsPeriod } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import {
  ChipsSkeleton,
  EmptyIcon,
  PeriodChips,
  RowsSkeleton,
  VENUE_HEADER_INSET,
  VenueHeader,
  WiderPeriodAction,
  useShownPeriod,
} from '../../../ape-publice/_components/venue/bits';
import { ActivityCard } from './ActivityCard';
import { RecordHero } from './RecordHero';
import { SpeciesBars } from './SpeciesBars';
import { StatStrip } from './StatStrip';
import { TopAnglers } from './TopAnglerRow';
import { TopVenues } from './TopVenues';

/*
 * «Statistici comunitate» — fish app/(app)/partide/statistici.tsx (parity partide.statistici,
 * template T5 as a bento, owner rules 9, 10, 19):
 *  - c1 the title with the back control (history back inside the site, else /partide), the period
 *    chips Săptămâna / Luna (default) / Anul curent, the period in `?perioada=` (replaced; Luna left
 *    out; an invalid value reads as Luna);
 *  - c2 a switch keeps the previous period's figures, dimmed to 40% and inert, the chips' spinner
 *    beside them, until the new period lands (TanStack keepPreviousData); every label naming the
 *    period follows the figures (useShownPeriod), never the chip;
 *  - c3 a failed read is the error card with «Încearcă din nou» (never the empty copy, never the
 *    previous period's figures — the chips stay so another period can be tried); an empty period
 *    «Nicio partidă în comunitate pentru perioada selectată.» with the way to the wider period;
 *  - c4–c9 the totals, «Activitate», «Top pescari», the record, «Top bălți», «Specii prinse», each
 *    left out when the period has none of it.
 *
 * The bento: phone — one column in the fish order (totals, chart, anglers, record, venues,
 * species); from 768 the record (the navy signature tile) beside the totals, the anglers beside
 * the venues; from 1280 the record, Partide and the two small tiles in three tracks, the chart
 * beside the species.
 */

const TITLE = 'Statistici comunitate';
const GAP = 'gap-3 md:gap-4 xl:gap-5';

export function StatsScreen({ initialPeriod }: { initialPeriod: StatsPeriod }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);
  useListUrlState({ perioada: period === 'month' ? null : period });
  const q = useQuery(communityStatsQuery(t, period));

  const data = q.data;
  // A query without data goes back to «pending» on a retry: once it has failed, the error card
  // stays (busy) through the retry instead of the skeleton.
  const failedBefore = !data && q.errorUpdateCount > 0;
  // fish: a failed fetch must not masquerade as an empty period, nor as the previous period's data.
  const showError = (q.isError && (!data || q.isPlaceholderData)) || failedBefore;
  const switching = !showError && q.isFetching && q.isPlaceholderData;
  const isEmpty = !q.isPending && !showError && (data?.totals.partide ?? 0) === 0;
  const ready = !showError && data && !isEmpty ? data : null;
  const shownPeriod = useShownPeriod(period, !!data && !q.isPlaceholderData);

  if (q.isPending && !failedBefore) return <StatsSkeleton />;

  return (
    <DashboardPage
      header={<Header onRefresh={async () => !(await q.refetch()).isError} />}
      busy={switching}
      toolbar={
        <DashboardToolbar>
          <PeriodChips value={period} onChange={setPeriod} busy={switching} />
        </DashboardToolbar>
      }
    >
      <p role="status" className="sr-only">
        {switching ? 'Se încarcă perioada aleasă…' : ''}
      </p>
      <div
        inert={switching}
        aria-busy={switching || undefined}
        className={cn('transition-opacity duration-(--duration-fast)', switching && 'pointer-events-none opacity-40')}
        data-testid="stats-content"
        data-switching={switching || undefined}
      >
        {showError ? (
          <div className={STATE_CARD} data-testid="stats-error">
            <ListError title="Nu am putut încărca statisticile." onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />
          </div>
        ) : !ready ? (
          <div data-testid="stats-empty">
            <DashboardEmpty
              title="Nicio partidă în comunitate pentru perioada selectată."
              action={<WiderPeriodAction period={shownPeriod} onChange={setPeriod} />}
              icon={
                <EmptyIcon>
                  <ChartBarIcon aria-hidden />
                </EmptyIcon>
              }
            />
          </div>
        ) : (
          <StatsBento data={ready} period={shownPeriod} />
        )}
      </div>
    </DashboardPage>
  );
}

function Header({ onRefresh }: { onRefresh?: () => Promise<boolean> }) {
  return (
    <div className={VENUE_HEADER_INSET}>
      <VenueHeader title={TITLE} backHref={routes.partide()} onRefresh={onRefresh} />
    </div>
  );
}

/*
 * The bento — one grid whose DOM is the fish/phone order (totals, chart, anglers, record, venues,
 * species), so Tab and screen readers follow what the phone shows (WCAG 1.3.2 / 2.4.3). Below 768
 * it is one column in that order; from 768 and 1280 the blocks are placed by named grid areas
 * (built from the blocks present), which move boxes without changing the reading order:
 *  - 768: the record beside the totals (Partide over the two small tiles), the chart, the anglers
 *    beside the venues, the species;
 *  - 1280: record · Partide · the small tiles in 5 : 4 : 3 (3 : 2 without a record), the chart
 *    beside the species (2 : 1), the anglers beside the venues.
 * Track counts are chosen so every row's ratio is a whole number of equal tracks.
 */
type Cells = [area: string, span: number][];
const areaRow = (cells: Cells) => `"${cells.flatMap(([a, n]) => Array<string>(n).fill(a)).join(' ')}"`;
const tracks = (n: number) => `repeat(${n},minmax(0,1fr))`;

/** The two-up row of a lone block keeps the half width (the other half empty). */
const pairRow = (cols: number, a: string | null, b: string | null): Cells | null =>
  a && b ? [[a, cols / 2], [b, cols / 2]] : a || b ? [[(a ?? b)!, cols / 2], ['.', cols / 2]] : null;

function bentoAreas({ record, series, species, anglers, venues }: Record<'record' | 'series' | 'species' | 'anglers' | 'venues', boolean>) {
  const mdCols = record ? 2 : 10;
  const md: (Cells | null)[] = [
    ...(record ? [[['record', 1], ['lead', 1]], [['record', 1], ['pair', 1]]] as Cells[] : [[['lead', 6], ['pair', 4]]] as Cells[]),
    series ? [['chart', mdCols]] : null,
    pairRow(mdCols, anglers ? 'anglers' : null, venues ? 'venues' : null),
    species ? [['species', mdCols]] : null,
  ];
  const xlCols = record ? 12 : 30;
  const xl: (Cells | null)[] = [
    record ? [['record', 5], ['lead', 4], ['pair', 3]] : [['lead', 18], ['pair', 12]],
    series && species ? [['chart', (xlCols * 2) / 3], ['species', xlCols / 3]] : series ? [['chart', xlCols]] : species ? [['species', xlCols]] : null,
    pairRow(xlCols, anglers ? 'anglers' : null, venues ? 'venues' : null),
  ];
  const areas = (rows: (Cells | null)[]) => rows.filter((r): r is Cells => !!r).map(areaRow).join(' ');
  return {
    '--bento-md': areas(md),
    '--bento-md-cols': tracks(mdCols),
    '--bento-xl': areas(xl),
    '--bento-xl-cols': tracks(xlCols),
  } as CSSProperties;
}

function StatsBento({ data, period }: { data: CommunityStatsDTO; period: StatsPeriod }) {
  const record = data.record;
  const hasSeries = data.weeklySeries.length > 0;
  const hasSpecies = data.species.length > 0;
  const hasAnglers = data.topAnglers.length > 0;
  const hasVenues = data.topVenues.length > 0;
  const style = bentoAreas({ record: !!record, series: hasSeries, species: hasSpecies, anglers: hasAnglers, venues: hasVenues });
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)]',
        GAP,
        'md:grid-cols-(--bento-md-cols) md:[grid-template-areas:var(--bento-md)] xl:grid-cols-(--bento-xl-cols) xl:[grid-template-areas:var(--bento-xl)]',
      )}
      style={style}
      data-testid="stats-bento"
    >
      <StatStrip
        totals={data.totals}
        caption={`în comunitate, ${periodPhraseFor(period)}`}
        leadClassName="md:[grid-area:lead]"
        pairClassName={cn('md:[grid-area:pair]', record ? 'xl:grid-cols-1' : 'md:grid-cols-1')}
      />
      {hasSeries ? <ActivityCard period={period} series={data.weeklySeries} className="md:self-start md:[grid-area:chart]" /> : null}
      {hasAnglers ? <TopAnglers anglers={data.topAnglers} rankingHref={partideHrefs.ranking(period)} className="md:self-start md:[grid-area:anglers]" /> : null}
      {record ? <RecordHero period={period} record={record} className="md:[grid-area:record]" /> : null}
      {hasVenues ? <TopVenues venues={data.topVenues} className="md:self-start md:[grid-area:venues]" /> : null}
      {hasSpecies ? <SpeciesBars species={data.species} className="md:self-start md:[grid-area:species]" /> : null}
    </div>
  );
}

/**
 * fish StatisticiSkeleton (first load) under the loaded page's header, on the loaded bento's
 * tracks: the totals' real tiles with bones for the numbers, the record's navy tile, the chart
 * card at its height, the anglers' rows. The route's loading.tsx and the page's Suspense fallback.
 */
export function StatsSkeleton() {
  const bone = (cls: string) => <span className={cn('inline-block h-8 w-16 rounded-full align-middle', cls)} />;
  return (
    <DashboardPage header={<Header />} toolbar={<ChipsSkeleton />}>
      <div role="status" data-testid="stats-skeleton">
        <span className="sr-only">Se încarcă statisticile…</span>
        <div aria-hidden className={cn('flex flex-col', GAP)}>
          <div className={cn('grid md:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]', GAP)}>
            <span className="order-4 min-h-39 animate-shimmer rounded-bento md:order-none md:row-span-2" />
            <div className="order-1 flex md:order-none xl:row-span-2">
              <StatTile tone="indigo" label="Partide" icon={<FishingRodIcon />} value={bone('bg-on-bento-indigo/20')} className="w-full" />
            </div>
            <div className={cn('order-1 grid grid-cols-2 md:order-none xl:row-span-2 xl:grid-cols-1', GAP)}>
              <FactTile tone="lavender" label="Pescari" icon={<UserGroupIcon />} value={bone('h-6 w-10 animate-shimmer')} />
              <FactTile tone="sky" label="Capturi" icon={<FishIcon />} value={bone('h-6 w-10 animate-shimmer')} />
            </div>
          </div>
          <div className={cn('grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]', GAP)}>
            <div className="flex h-64.5 flex-col gap-3 rounded-card bg-surface p-4.5 shadow-e0">
              <span className="h-4 w-24 animate-shimmer rounded-full" />
              <span className="min-h-0 flex-1 animate-shimmer rounded-control" />
            </div>
            <span className="hidden h-40 animate-shimmer rounded-card xl:block" />
          </div>
          <div className={cn('grid md:grid-cols-2', GAP)}>
            <RowsSkeleton rows={3} />
            <span className="hidden md:block">
              <RowsSkeleton rows={3} />
            </span>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
