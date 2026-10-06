'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { AsideSkeleton, ChoiceChips, FilterColumn, FilterSection, ListEmpty, ListHeader, ListPage, useListUrlState } from '@/components/templates/T1';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  communityStatsQuery,
  sortStands,
  STAND_SORT_OPTIONS,
  standLabel,
  standSortValue,
  type StandSort,
  type StandStat,
  type StatsPeriod,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { PERIOD_TITLE } from '@/lib/stats-period';
import { ChipStrip, firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { PeriodAside, plural, rankKg, RankRow, ROWS_CARD, StandsSkeletonBody } from '../_sub/stats';
import { useBack } from '../_sub/useBack';

/*
 * Clasament standuri — fish app/(app)/lakes/[lakeId]/standuri.tsx → StandsLeaderboardScreen +
 * StandRow + helpers/standSort (parity lakes.stands-ranking), on T1:
 *  - c1 «Clasament standuri», the lake's name under it — with the period, the only period cue a
 *    phone has (no chips here) —, the back control;
 *  - c2 Kg total / Capturi / Record from `?sortare=` (unknown → kg), written back (replaced); the
 *    period from `?perioada=` (default month), no period chips here (fish);
 *  - c3 «N standuri cu activitate» / «1 stand cu activitate», every stand by the sort; none: the
 *    kit empty card alone (it says it; the sort chips are inert);
 *  - c4 no value (Record without a weighed catch, a stand with no catch) sinks and reads «—», ties
 *    by name (core sortStands);
 *  - c5 the skeleton while loading, the error — never «0 standuri».
 * The right column is the period's card shared with clasament (its numbers, the anglers' ranking
 * for the same period as its action), docked from 1280, under the list below it
 * (lakes.b.period-and-sort-in-url). A period switch (the empty card's «Vezi anul curent») keeps the
 * shown period's name on the previous numbers, dimmed and busy, until the new ones land.
 */


/** fish StandRow formatValue: the count for Capturi, kg otherwise (two decimals), «—» with no value. */
function formatValue(stand: StandStat, sort: StandSort): { value: string; unit?: string } {
  if (sort === 'catches') return { value: String(stand.catches), unit: stand.catches === 1 ? 'captură' : 'capturi' };
  const kg = standSortValue(stand, sort);
  return kg == null || stand.catches === 0 ? { value: '—' } : { value: rankKg(kg), unit: 'kg' };
}

export function StandsScreen({
  lakeId,
  lakeName,
  period,
  initialSort,
}: {
  lakeId: string;
  lakeName: string;
  period: StatsPeriod;
  initialSort: StandSort;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [sort, setSort] = useState<StandSort>(initialSort);
  useListUrlState({ sortare: sort === 'kg' ? null : sort });
  const q = useQuery(communityStatsQuery(t, period, { kind: 'lake', id: lakeId }));
  const back = useBack(routes.lake(lakeId));

  // The period the numbers on screen belong to (as clasament): a period switch keeps the previous
  // period's stands on screen (placeholder) — dimmed and busy, and every label keeps naming THAT
  // period until the new numbers land, never one period's data under another's name.
  const [settled, setSettled] = useState<StatsPeriod>(period);
  if (q.data && !q.isPlaceholderData && settled !== period) setSettled(period);
  const shownPeriod = q.isPlaceholderData ? settled : period;

  const failed = firstReadFailed(q, !!q.data && !q.isPlaceholderData);
  const switching = !failed && q.isFetching && q.isPlaceholderData;
  const ranked = sortStands(q.data?.stands ?? [], sort);
  // Nothing to sort: the chips are shown but inert (a disabled fieldset), never live over an empty card.
  const noRows = !q.isPending && !failed && ranked.length === 0;
  const ready = q.data && !failed && q.data.totals.partide > 0 ? q.data : null;

  const header = (
    <ListHeader
      title="Clasament standuri"
      titleId={SUB_TITLE_ID}
      description={`${lakeName} · ${PERIOD_TITLE[shownPeriod]}`}
      back={{ label: 'Înapoi', onClick: back }}
    />
  );
  const filters = (
    <FilterColumn title="Ordonează">
      <fieldset disabled={noRows} className={cn('min-w-0', noRows && 'opacity-60')}>
        <FilterSection title="După">
          <ChoiceChips name="sortare-col" layout="list" options={STAND_SORT_OPTIONS} value={sort} onChange={setSort} />
        </FilterSection>
      </fieldset>
    </FilterColumn>
  );
  const aside = q.isPending ? (
    <AsideSkeleton rows={1} />
  ) : (
    <PeriodAside
      period={shownPeriod}
      totals={ready ? ready.totals : null}
      quiet={failed ? 'Numerele perioadei nu s-au putut încărca.' : 'Nicio partidă în această perioadă.'}
      action={{ href: routes.lakeRanking(lakeId, shownPeriod), label: 'Clasament pescari' }}
      note="Standurile sunt clasate după partidele comunității din această perioadă."
      dimmed={switching}
    />
  );

  return (
    <ListPage header={header} filters={filters} filtersLabel="Ordonare standuri" aside={aside} asideLabel="Perioada" asideBusy={q.isPending || switching}>
      {noRows ? null : (
        <div className="xl:hidden">
          <ChipStrip>
            <ChoiceChips name="sortare" label="Ordonează după" options={STAND_SORT_OPTIONS} value={sort} onChange={setSort} />
          </ChipStrip>
        </div>
      )}
      {switching ? (
        <p role="status" className="sr-only">
          Se încarcă perioada aleasă…
        </p>
      ) : null}
      <section
        aria-label="Standuri"
        aria-busy={q.isPending || switching || undefined}
        className={cn('flex flex-col gap-2.5 transition-opacity', switching && 'pointer-events-none opacity-60')}
        data-testid="stands-content"
      >
        {failed ? (
          <SubListError
            testId="stats-error"
            title="Nu am putut încărca statisticile."
            onRetry={() => void q.refetch()}
            retrying={q.isFetching}
            attempt={q.errorUpdateCount}
          />
        ) : q.isPending ? (
          <StandsSkeletonBody />
        ) : ranked.length ? (
          <>
            <SubRetryFocus />
            <p className="mx-0.5 t-caption text-muted" data-testid="stands-count">
              {plural(ranked.length, 'stand cu activitate', 'standuri cu activitate')}
            </p>
            <ol aria-label={`Standuri după ${STAND_SORT_OPTIONS.find(o => o.value === sort)?.label.toLowerCase()}`} className={cn(ROWS_CARD, 'divide-y divide-hairline')} data-testid="stand-rows">
              {ranked.map((stand, i) => (
                <StandRow key={stand.standId} stand={stand} sort={sort} rank={i + 1} />
              ))}
            </ol>
          </>
        ) : (
          // The empty card says it — no «0 standuri cu activitate» line over it.
          <div data-testid="stands-empty">
            <SubRetryFocus />
            <ListEmpty
              icon={<MapPinIcon aria-hidden className="size-12" />}
              title="Nicio activitate la standuri în perioada asta."
              action={
                period !== 'year' ? (
                  <Link href={routes.lakeStands(lakeId, { perioada: 'year', sortare: sort === 'kg' ? undefined : sort })} className={buttonClass({ variant: 'secondary' })}>
                    Vezi anul curent
                  </Link>
                ) : undefined
              }
            />
          </div>
        )}
      </section>
    </ListPage>
  );
}

/**
 * fish StandRow (the full list: no proportion bar), on the shared RankRow — the leader as the
 * winner. Every kg in the row is the ranking's two decimals: «record 3,00 kg» in the meta line as
 * in the value column.
 */
function StandRow({ stand, sort, rank }: { stand: StandStat; sort: StandSort; rank: number }) {
  const v = formatValue(stand, sort);
  return (
    <RankRow
      rank={rank}
      testId={`stand-${stand.standId}`}
      title={standLabel(stand.name) ?? stand.name}
      meta={`${plural(stand.partide, 'partidă', 'partide')} · ${plural(stand.catches, 'captură', 'capturi')}${stand.recordKg != null ? ` · record ${rankKg(stand.recordKg)} kg` : ''}`}
      value={v.value}
      unit={v.unit}
    />
  );
}
