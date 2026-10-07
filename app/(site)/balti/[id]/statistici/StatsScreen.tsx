'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { ChartBarIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { ChoiceChips, FilterColumn, FilterColumnSkeleton, FilterSection, ListHeader, useListUrlState } from '@/components/templates/T1';
import { T2Spinner } from '@/components/templates/T2';
import { CardShell } from '@/components/cards/CardShell';
import { formatDecimal } from '@/components/cards/format';
import { Pill } from '@/components/cards/parts';
import { DashboardEmpty, DashboardLayout, DashboardPage, DashboardSection, LINK_ACTION } from '@/components/templates/T5';
import { FishIcon, FishingRodIcon } from '@/components/icons/brand';
import { BentoArt, bentoSurface, FactTile } from '@/components/ui/BentoTile';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { cn } from '@/components/ui/cn';
import {
  communityStatsQuery,
  firstNameOf,
  isWeighed,
  recordTagFor,
  seriesDetailLabels,
  sortStands,
  STAND_SORT_OPTIONS,
  standLabel,
  standSortValue,
  type CommunityStatsDTO,
  type SpeciesShare,
  type StandSort,
  type StandStat,
  type StatsPeriod,
  type StatsRecord,
  type TopAngler,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { lakeHref } from '../_components/availability';
import { ActivityChart } from '../_sub/ActivityChart';
import { TitleShimmer } from '../_sub/FallbackHeader';
import { LakePages } from '../_sub/LakePages';
import { PERIOD_OPTIONS } from '@/lib/stats-period';
import { firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { ChipsSkeleton, PeriodChips, plural, rankKg, RankRow, RowsSkeleton } from '../_sub/stats';
import { useBack } from '../_sub/useBack';
import { AnglerAvatar, dayMonth, EmptyIcon } from '../_sub/venue';

/*
 * Statistici baltă — fish app/(app)/lakes/[lakeId]/statistici.tsx → VenueStatsScreen (parity
 * lakes.stats), on T5. Strictly a period view (its sibling Partide answers «now»):
 *  - c1 the lake's name as the title («Statistici» under it; «Statistici» while the name is not
 *    known), the back control (history back inside the site, else the lake);
 *  - c2 Săptămâna / Luna / Anul curent, default Luna, in `?perioada=` (replaced, never pushed);
 *  - c3 a switch keeps the previous figures, dimmed and inert, the chips' spinner beside them;
 *  - c4 the skeleton first, the error card (never the empty copy, never stale figures — the chips
 *    stay so another period can be tried); c5 «Nicio partidă în perioada selectată.» with the chips;
 *  - c6 partide · pescari · capturi; c7 «Activitate»; c8 «Top pescari» (3) + «Clasament ›»;
 *    c9 the record (opens its partidă once the web has one); c10 «Top standuri» (sort chips, top 5,
 *    bars vs the leader, «Clasament ›» with the period and the sort); c11 «Specii prinse»;
 *  - c12 the query is core communityStatsQuery (60s, previous period kept as placeholder).
 * From 1280 three columns (ROADMAP §4): the period and the lake's pages · the figures, the chart,
 * the anglers and the stands · the record and the species. Below 1280 one column in the fish
 * order (strip, chart, anglers, record, stands, species).
 */

const CAPTION = 'Statistici';

export function StatsScreen({ lakeId, lakeName, initialPeriod }: { lakeId: string; lakeName: string; initialPeriod: StatsPeriod }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);
  useListUrlState({ perioada: period === 'month' ? null : period });
  const q = useQuery(communityStatsQuery(t, period, { kind: 'lake', id: lakeId }));
  const back = useBack(routes.lake(lakeId));

  // The period the figures on screen belong to: a switch keeps the previous one's figures (the
  // placeholder) — every link keeps naming THAT period until the new figures land.
  const [settled, setSettled] = useState<StatsPeriod>(initialPeriod);
  if (q.data && !q.isPlaceholderData && settled !== period) setSettled(period);
  const shownPeriod = q.isPlaceholderData ? settled : period;

  const data = q.data;
  // c4: a failed read never shows the previous period (placeholder) nor the empty copy.
  const failed = firstReadFailed(q, !!data && !q.isPlaceholderData) || (q.isError && q.isPlaceholderData);
  const switching = !failed && q.isFetching && q.isPlaceholderData;
  const isEmpty = !q.isPending && !failed && (data?.totals.partide ?? 0) === 0;
  const ready = !failed && data && !isEmpty ? data : null;

  const header = (
    <ListHeader
      className="pt-4 md:pt-6 xl:pt-8"
      titleId={SUB_TITLE_ID}
      title={lakeName || 'Statistici'}
      description={CAPTION}
      back={{ label: 'Înapoi', onClick: back }}
    />
  );

  if (q.isPending && !failed) return <StatsFallback lakeName={lakeName} lakeId={lakeId} />;

  const main = failed ? (
    <SubListError
      testId="stats-error"
      title="Nu am putut încărca statisticile."
      onRetry={() => void q.refetch()}
      retrying={q.isFetching}
      attempt={q.errorUpdateCount}
    />
  ) : !ready ? (
    <div data-testid="stats-empty">
      <SubRetryFocus />
      <DashboardEmpty
        title="Nicio partidă în perioada selectată."
        icon={
          <EmptyIcon>
            <ChartBarIcon aria-hidden />
          </EmptyIcon>
        }
      />
    </div>
  ) : (
    <>
      <SubRetryFocus />
      <StatsMain data={ready} period={shownPeriod} lakeId={lakeId} />
    </>
  );

  // From 1280 the three tracks stay in every state, so the centre never moves sideways between a
  // period with figures, an empty one and a failed read. Nothing to show on the right (an empty
  // period, or no record and no species): the track stays reserved but empty — the centre's card
  // is the page's one message (rule 4: never a second «nothing here»), and so is a failed read's
  // error card (never a second sentence about the missing data beside it).
  const reserved = <div data-testid="stats-aside-reserved" />;
  const aside = ready ? <RecordAndSpecies data={ready} period={shownPeriod} empty={reserved} /> : reserved;

  return (
    <DashboardPage
      header={header}
      busy={switching}
      toolbar={
        // Always there (c4, c5): a failed or empty period keeps the way to another one.
        <div className="xl:hidden">
          <PeriodChips value={period} onChange={setPeriod} busy={switching} fill />
        </div>
      }
    >
      <p role="status" className="sr-only">
        {switching ? 'Se încarcă perioada aleasă…' : ''}
      </p>
      <DashboardLayout
        sidesBelowXl="hidden"
        context={<StatsContext lakeId={lakeId} period={period} shownPeriod={shownPeriod} onPeriod={setPeriod} switching={switching} />}
        contextLabel="Perioada și paginile bălții"
        main={
          <div
            inert={switching}
            className={cn('@container flex flex-col gap-4 transition-opacity md:gap-5 xl:gap-6', switching && 'pointer-events-none opacity-60')}
            data-testid="stats-content"
          >
            {main}
          </div>
        }
        aside={
          <div inert={switching} className={cn('transition-opacity', switching && 'pointer-events-none opacity-60')}>
            {aside}
          </div>
        }
        asideLabel="Recordul și speciile"
      />
    </DashboardPage>
  );
}

function StatsContext({
  lakeId,
  period,
  shownPeriod,
  onPeriod,
  switching,
}: {
  lakeId: string;
  period: StatsPeriod;
  shownPeriod: StatsPeriod;
  onPeriod: (p: StatsPeriod) => void;
  switching: boolean;
}) {
  return (
    <FilterColumn title="Statistici">
      <FilterSection title="Perioadă" icon={switching ? <T2Spinner className="size-5 text-accent" /> : undefined}>
        <ChoiceChips name="perioada-col" layout="list" options={PERIOD_OPTIONS} value={period} onChange={onPeriod} />
      </FilterSection>
      <LakePages lakeId={lakeId} current="statistici" period={shownPeriod} />
    </FilterColumn>
  );
}

/** «now» only in the browser (the series' detail labels count back from today). */
const noSubscribe = () => () => {};
const useToday = () => useSyncExternalStore(noSubscribe, () => new Date().toDateString(), () => null);

function StatsMain({ data, period, lakeId }: { data: CommunityStatsDTO; period: StatsPeriod; lakeId: string }) {
  const today = useToday();
  const series = data.weeklySeries;
  const detail = useMemo(() => (today ? seriesDetailLabels(period, series.length, new Date(today)) : series.map(s => s.label)), [period, series, today]);
  const hasSpecies = data.species.length > 0;
  const hasStands = (data.stands?.length ?? 0) > 0;
  return (
    <>
      <PeriodKpis totals={data.totals} />
      {series.length > 0 ? (
        <ActivityChart
          testId="activity-card"
          points={series.map((s, i) => ({ label: s.label, count: s.count, detail: detail[i] }))}
          noun={['captură', 'capturi']}
          summary={`Activitate pe perioada aleasă: ${plural(series.reduce((a, s) => a + s.count, 0), 'captură', 'capturi')}.`}
        />
      ) : null}
      {/*
        The two ranked lists (owner rule 16: numbers never float across a wide column): once the
        column holds two (container ≥ 704px — a tablet, 1440 and up) Top pescari and Top standuri
        share a bento row, each name next to its number; narrower, they stack. On a phone the
        wrapper dissolves (fish order: the anglers, the record, the stands, the species).
      */}
      <div className="contents @[44rem]:grid @[44rem]:grid-cols-2 @[44rem]:items-start @[44rem]:gap-5 @[44rem]:[&>:only-child]:col-span-2" data-testid="ranked-pair">
        {data.topAnglers.length > 0 ? (
          <DashboardSection
            title="Top pescari"
            flush
            action={
              <Link href={routes.lakeRanking(lakeId, period)} className={cn(LINK_ACTION, '-my-3 inline-flex items-center gap-0.5')} data-testid="top-anglers-ranking">
                Clasament
                <ChevronRightIcon aria-hidden className="size-4" />
              </Link>
            }
          >
            <ol aria-label="Top pescari" className="divide-y divide-hairline border-t border-hairline" data-testid="top-anglers">
              {data.topAnglers.slice(0, 3).map((a, i) => (
                <TopAnglerRow key={a.uid} angler={a} rank={i + 1} />
              ))}
            </ol>
          </DashboardSection>
        ) : null}
        {hasStands ? (
          <div className="max-md:order-1">
            <TopStands stands={data.stands ?? []} lakeId={lakeId} period={period} />
          </div>
        ) : null}
      </div>
      {/*
        fish order below 768: the record between the anglers and the stands, the species last. From
        768 to 1279 the record and the species share a row (the tablet's width, not a 720px photo and
        590px bars); from 1280 both live in the right column.
      */}
      {data.record || hasSpecies ? (
        <div className="contents md:grid md:grid-cols-2 md:items-start md:gap-5 xl:hidden">
          {data.record ? <RecordHero period={period} record={data.record} /> : null}
          {hasSpecies ? (
            <div className="max-md:order-last">
              <SpeciesSection species={data.species} />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/*
 * lakes.stats.c6 — partide · pescari · capturi (no kg; fish StatStrip), as an Apple-style bento
 * (owner rules 9 and 19): one idea per tile, each on its own surface. Capturi is the signature —
 * the navy tile, the 64px lavender number, the fish as its corner art; Partide (indigo, the rod) and
 * Pescari (lavender, the group) are the small fact tiles beside it. Phone: Capturi across the row,
 * the two facts under it; from 768 Capturi on the left as tall as the two facts stacked on the
 * right. The skeleton (PeriodKpisSkeleton) is the same grid on the same surfaces.
 * TODO(kit): a BentoTile `compact` floor (its 156px minimum is not overridable — cn does not
 * merge), so the signature tile could be a BentoTile instead of its own anatomy on bentoSurface.
 */
const KPI_BENTO = 'grid grid-cols-2 gap-2.5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:grid-rows-[auto_auto] md:gap-3 xl:gap-4';
const KPI_SIGNATURE = cn(bentoSurface('signature'), 'col-span-2 flex min-w-0 flex-col justify-between gap-2 rounded-bento p-4.5 md:col-span-1 md:row-span-2 md:min-h-39');
const KPI_LABEL = 't-label tracking-[0.4px] text-lavender-2 uppercase';

function PeriodKpis({ totals }: { totals: { partide: number; anglers: number; catches: number } }) {
  const n = (v: number) => <span data-testid="stat-value">{v.toLocaleString('ro-RO')}</span>;
  return (
    <div role="group" aria-label="Perioada, pe scurt" className={KPI_BENTO} data-testid="stat-strip">
      <div className={KPI_SIGNATURE} data-testid="stat-catches">
        <BentoArt>
          <FishIcon />
        </BentoArt>
        <p className={KPI_LABEL}>Capturi</p>
        <SignatureNumber size="tile" tone="lavender" unitTone="lavender" value={n(totals.catches)} className="whitespace-nowrap" />
      </div>
      <FactTile tone="indigo" label="Partide" icon={<FishingRodIcon />} value={n(totals.partide)} className="md:min-h-19" />
      <FactTile tone="lavender" label="Pescari" icon={<UserGroupIcon />} value={n(totals.anglers)} className="md:min-h-19" />
    </div>
  );
}

/** PeriodKpis in grey: the same grid and surfaces, the labels known, the numbers as bones. */
function PeriodKpisSkeleton() {
  return (
    <div aria-hidden className={KPI_BENTO}>
      <div className={KPI_SIGNATURE}>
        <p className={KPI_LABEL}>Capturi</p>
        <span className="h-14 w-28 rounded-full bg-lavender/15" />
      </div>
      <FactTile tone="indigo" label="Partide" icon={<FishingRodIcon />} value={<span className="inline-block h-6 w-10 rounded-full bg-on-bento-indigo/20 align-middle" />} className="md:min-h-19" />
      <FactTile tone="lavender" label="Pescari" icon={<UserGroupIcon />} value={<span className="inline-block h-6 w-10 animate-shimmer rounded-full align-middle" />} className="md:min-h-19" />
    </div>
  );
}

function RecordAndSpecies({ data, period, empty }: { data: CommunityStatsDTO; period: StatsPeriod; empty: ReactNode }) {
  if (!data.record && !data.species.length) return empty;
  return (
    <div className="flex flex-col gap-6">
      {data.record ? <RecordHero period={period} record={data.record} /> : null}
      {data.species.length > 0 ? <SpeciesSection species={data.species} /> : null}
    </div>
  );
}

/*
 * «Top pescari» — fish TopAnglerRow (c8), in the rankings' grammar (the shared RankRow of Clasament):
 * the PositionPill (rank 1 the navy winner), the avatar (the kit's, its tone from the name as in
 * Clasament, with a photo fallback),
 * the kg in the ranking's stat step with two decimals and the unit under it.
 */

function TopAnglerRow({ angler, rank }: { angler: TopAngler; rank: number }) {
  const name = angler.name ?? 'Pescar';
  const weighed = isWeighed(angler.totalKg);
  return (
    <RankRow
      rank={rank}
      testId="top-angler"
      lead={<AnglerAvatar name={name} src={angler.avatarUrl} size={32} />}
      title={name}
      meta={`${plural(angler.partide, 'partidă', 'partide')} · ${plural(angler.catches, 'captură', 'capturi')}`}
      value={weighed ? rankKg(angler.totalKg) : '—'}
      unit={weighed ? 'kg' : undefined}
      muted={!weighed}
      href={lakeHref('angler', routes.angler(angler.uid))}
      label={`Locul ${rank}: ${name}`}
    />
  );
}

/*
 * The record — fish RecordHero (c9): the photo under a scrim (a rendition sized for the card), or —
 * no photo, or the photo failed — fish's short indigo → navy card with the light tag. The kit card
 * (CardShell: radius, focus ring of the stretched link) carries both.
 */

function RecordHero({ period, record }: { period: StatsPeriod; record: StatsRecord }) {
  const [failed, setFailed] = useState<string | null>(null);
  const meta = [record.angler?.name ? firstNameOf(record.angler.name) : null, dayMonth(record.occurredAt)].filter(Boolean).join(' · ');
  const photo = record.photoUrl && failed !== record.photoUrl ? record.photoUrl : null;
  const href = record.sessionDocumentId ? lakeHref('partida', routes.partida(record.sessionDocumentId)) : undefined;
  const tag = recordTagFor(period);
  const kg = rankKg(record.weightKg);
  const label = `${tag.toLowerCase()}: ${kg} kg${record.species ? `, ${record.species}` : ''}`;
  const body = (
    <>
      {photo ? (
        <>
          <Image
            src={photo}
            alt=""
            fill
            sizes="(min-width: 1280px) 360px, (min-width: 768px) 50vw, 100vw"
            onError={() => setFailed(record.photoUrl ?? null)}
            className="object-cover"
          />
          <span aria-hidden className="absolute inset-0 bg-linear-to-t from-photo-scrim via-photo-scrim/40 to-transparent" />
        </>
      ) : null}
      <span className="absolute top-2.5 left-3">
        <Pill tone={photo ? 'scrim' : 'light'} className="tracking-wide">
          {tag}
        </Pill>
      </span>
      <span className="absolute inset-x-3.5 bottom-3 flex flex-col gap-1 text-on-photo-scrim">
        <span className="flex items-baseline gap-1">
          <span className="t-stat tabular-nums">{kg}</span>
          <span className="t-body-strong">kg{record.species ? ` · ${record.species}` : ''}</span>
        </span>
        {meta ? <span className="truncate t-micro text-on-photo-scrim/80">{meta}</span> : null}
      </span>
    </>
  );
  const ground = cn('relative block w-full', photo ? 'aspect-video bg-navy' : 'h-30 bg-linear-to-br from-accent-ink to-navy');
  return (
    <figure aria-label={label} data-testid="record-hero">
      <CardShell interactive={!!href}>
        {href ? (
          <Link
            href={href}
            className={cn(
              ground,
              'outline-none after:absolute after:inset-0 after:rounded-card after:content-[""] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent',
            )}
          >
            {body}
          </Link>
        ) : (
          <div className={ground}>{body}</div>
        )}
      </CardShell>
    </figure>
  );
}

/* «Top standuri» — fish TopStandsCard + StandRow showBar (c10). */

const TOP_STANDS = 5;

function TopStands({ stands, lakeId, period }: { stands: StandStat[]; lakeId: string; period: StatsPeriod }) {
  const [sort, setSort] = useState<StandSort>('kg');
  const name = useId();
  const ranked = useMemo(() => sortStands(stands, sort), [stands, sort]);
  if (ranked.length === 0) return null;
  const lead = standSortValue(ranked[0], sort) ?? 0;
  return (
    <DashboardSection
      title="Top standuri"
      flush
      action={
        <Link
          href={routes.lakeStands(lakeId, { perioada: period, sortare: sort })}
          className={cn(LINK_ACTION, '-my-3 inline-flex items-center gap-0.5')}
          data-testid="top-stands-ranking"
        >
          Clasament
          <ChevronRightIcon aria-hidden className="size-4" />
        </Link>
      }
    >
      <div className="flex flex-col gap-1 pt-1">
        <div className="px-4.5 pb-2">
          <ChoiceChips name={`sortare-${name}`} label="Ordonează standurile după" options={STAND_SORT_OPTIONS} value={sort} onChange={setSort} />
        </div>
        <ol aria-label="Top standuri" className="divide-y divide-hairline border-t border-hairline" data-testid="top-stands">
          {ranked.slice(0, TOP_STANDS).map((s, i) => (
            <StandBarRow key={s.standId} stand={s} sort={sort} rank={i + 1} lead={lead} />
          ))}
        </ol>
      </div>
    </DashboardSection>
  );
}

/**
 * The row's value for the sort. A kg sort with no weight (none recorded, or 0 kg — the isWeighed
 * rule of «Top pescari» and Clasament, owner rule 11) is a muted «—», never «0,00 kg».
 */
function standValue(stand: StandStat, sort: StandSort): { value: string; unit?: string; muted?: boolean } {
  if (sort === 'catches') return { value: String(stand.catches), unit: plural(stand.catches, 'captură', 'capturi').slice(String(stand.catches).length + 1) };
  const kg = standSortValue(stand, sort);
  return kg == null || !isWeighed(kg) ? { value: '—', muted: true } : { value: rankKg(kg), unit: 'kg' };
}

/** fish StandRow showBar: the shared RankRow, the proportion bar (vs the leader) under the meta line. */
function StandBarRow({ stand, sort, rank, lead }: { stand: StandStat; sort: StandSort; rank: number; lead: number }) {
  const value = standSortValue(stand, sort) ?? 0;
  const fraction = lead > 0 && value > 0 ? Math.max(0.04, value / lead) : 0;
  const v = standValue(stand, sort);
  return (
    <RankRow
      rank={rank}
      testId={`top-stand-${stand.standId}`}
      title={standLabel(stand.name) ?? stand.name}
      meta={
        <>
          <span className="block">
            {plural(stand.partide, 'partidă', 'partide')} · {plural(stand.catches, 'captură', 'capturi')}
            {stand.recordKg != null ? ` · record ${rankKg(stand.recordKg)} kg` : ''}
          </span>
          {/* Nothing to measure (no weight / no catch for the sort): no track — an empty bar reads as
              a zero the row does not claim; the row keeps the track's height so rows stay even. */}
          {fraction > 0 ? (
            <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-accent-tint">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${fraction * 100}%` }} data-testid="stand-bar" />
            </span>
          ) : (
            <span aria-hidden className="mt-1.5 block h-1" data-testid="stand-bar-none" />
          )}
        </>
      }
      value={<span data-testid="stand-value">{v.value}</span>}
      unit={v.unit}
      muted={v.muted}
    />
  );
}

/* «Specii prinse» — fish SpeciesCard (c11). */

function SpeciesSection({ species }: { species: SpeciesShare[] }) {
  // Bars against the leader (as Top standuri): eight species at 10–15% each still read as a ranking,
  // not as a row of near-empty tracks. The label is the real share, with the Romanian comma.
  const lead = species[0]?.pct ?? 0;
  return (
    <DashboardSection title="Specii prinse">
      <ul className="grid grid-cols-[fit-content(45%)_minmax(--spacing(16),--spacing(80))_--spacing(12)] gap-x-2.5 gap-y-2.5" data-testid="species-card">
        {species.map((s, i) => (
          <li key={s.name} className="col-span-3 grid grid-cols-subgrid items-center">
            <span className="truncate t-label text-ink">{s.name}</span>
            <span aria-hidden className="h-2 overflow-hidden rounded-full bg-accent-tint">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${lead > 0 ? Math.min(100, (s.pct / lead) * 100) : 0}%`, opacity: i === 0 ? 1 : Math.max(0.3, 1 - i * 0.22) }}
              />
            </span>
            <span className="text-right t-micro-strong text-muted tabular-nums">{formatDecimal(s.pct, 0, 1)}%</span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}

/**
 * The page's frame while the lake or its first period is read (fish StatisticiSkeleton, c4), under
 * the loaded page's header, on the loaded page's tracks: the real «Pe această baltă» column (static —
 * it needs only the lake's id; the period's chips shimmer, the period is not known here), the KPI
 * row's own three tiles, the «Activitate» card at its height, the anglers' rows.
 * TODO(kit): DashboardSkeleton's blocks (tile, chart card) are not exported — this unit may only
 * touch the lake pages, so the shapes below reuse the real bento (PeriodKpisSkeleton) instead.
 */
export function StatsFallback({ lakeName, lakeId: id }: { lakeName?: string; lakeId?: string }) {
  // loading.tsx knows no params: the back square goes to the lake as soon as its id is in the URL.
  const params = useParams<{ id?: string }>();
  const lakeId = id ?? params?.id;
  return (
    <DashboardPage
      header={
        <ListHeader
          className="pt-4 md:pt-6 xl:pt-8"
          title={lakeName ?? <TitleShimmer srLabel="Statistici" />}
          description={CAPTION}
          back={{ label: 'Înapoi', href: lakeId ? routes.lake(lakeId) : routes.lakes() }}
        />
      }
      toolbar={
        <div className="xl:hidden">
          <ChipsSkeleton fill />
        </div>
      }
    >
      <div role="status" data-testid="stats-skeleton">
        <span className="sr-only">Se încarcă statisticile…</span>
        <DashboardLayout
          sidesBelowXl="hidden"
          context={
            lakeId ? (
              <FilterColumn title="Statistici">
                <FilterSection title="Perioadă">
                  <span aria-hidden className="flex flex-col gap-2.5">
                    {PERIOD_OPTIONS.map(o => (
                      <span key={o.value} className="h-10 animate-shimmer rounded-control" />
                    ))}
                  </span>
                </FilterSection>
                <LakePages lakeId={lakeId} current="statistici" />
              </FilterColumn>
            ) : (
              <FilterColumnSkeleton title="Statistici" sections={[3, 5, 4]} />
            )
          }
          contextLabel="Perioada și paginile bălții"
          main={
            <div aria-hidden className="flex flex-col gap-4 md:gap-5 xl:gap-6">
              <PeriodKpisSkeleton />
              <div className="flex h-64.5 flex-col gap-3 rounded-card bg-surface p-4.5 shadow-e0">
                <span className="h-4 w-24 animate-shimmer rounded-full" />
                <span className="min-h-0 flex-1 animate-shimmer rounded-control" />
              </div>
              <RowsSkeleton rows={3} />
            </div>
          }
          aside={
            <div aria-hidden className="flex flex-col gap-4">
              <span className="aspect-video animate-shimmer rounded-card" />
              <span className="h-40 animate-shimmer rounded-card" />
            </div>
          }
          asideLabel="Recordul și speciile"
        />
      </div>
    </DashboardPage>
  );
}
