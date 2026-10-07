'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { ChoiceChips, FilterColumn, FilterColumnSkeleton, FilterSection, ListError, useListUrlState } from '@/components/templates/T1';
import { DashboardEmpty, DashboardLayout, DashboardPage, DashboardSection, DashboardToolbar, LINK_ACTION, STATE_CARD } from '@/components/templates/T5';
import { MEDAL } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import {
  communityStatsQuery,
  firstNameOf,
  fmtKg,
  isWeighed,
  recordTagFor,
  seriesDetailLabels,
  type CommunityStatsDTO,
  type CommunityVenueRef,
  type SpeciesShare,
  type StatsPeriod,
  type StatsRecord,
  type TopAngler,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { partidaHref } from '@/lib/routes';
import { ActivityChart } from './ActivityChart';
import {
  AnglerAvatar,
  AnglerLink,
  anglerSubtitle,
  ChipsSkeleton,
  EmptyIcon,
  PeriodChips,
  PeriodNumbers,
  RowsSkeleton,
  SWITCHING_DIM,
  SafePhoto,
  SwitchingBar,
  TitleBone,
  VENUE_HEADER_INSET,
  VenueHeader,
  WaterPages,
  WaterTabs,
  WaterTabsSkeleton,
  WiderPeriodAction,
  rankAnglers,
  scoreText,
  useShownPeriod,
} from './bits';
import { dayMonth } from './dates';
import { PERIOD_OPTIONS } from '@/lib/stats-period';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Statisticile apei — fish app/(app)/public-waters/[id]/statistici.tsx → VenueStatsScreen (parity
 * public-waters.statistici), on T5:
 *  - c2 the water's name as the title («Statisticile apei» under it), the back control at every
 *    width (the family's one header, VenueHeader — fish BackButton: back to Partide when that is
 *    where the user came from); c3 the period in `?perioada=` (replaced);
 *  - c4 the skeleton; c5 the error (never an empty period, never the previous period's data) —
 *    the chips stay, so a failed switch can go back to a period that worked (from the cache);
 *  - c6 «Nicio partidă în perioada selectată.» with the chips kept; c7 the switch over the
 *    previous figures (SwitchingBar + inert + photos dimmed, the chips busy — the family's one
 *    treatment: dimmed text fails AA);
 *  - c8 the totals, «Activitate» (when the series has buckets), «Top pescari» (3) with
 *    «Clasament ›», the record, «Specii prinse»; c11 never «Top standuri» (lakes only).
 * From 1280 three columns (ROADMAP §4), as the sibling Clasament: the period and the water's other
 * pages on the left, the figures, the chart and the anglers in the centre, the record and the
 * species on the right. Below 1280 the fish order, one column (the record beside the species from
 * 768).
 */

const CAPTION = 'Statisticile apei';

export type StatsLinks = { partide: string; ranking: (period: StatsPeriod) => string; catches: string };

export function StatsScreen({
  venue,
  waterKey,
  title,
  backHref,
  links,
  initialPeriod,
}: {
  venue: CommunityVenueRef;
  waterKey: string;
  title: string;
  backHref: string;
  links: StatsLinks;
  initialPeriod: StatsPeriod;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);
  useListUrlState({ perioada: period === 'month' ? null : period });
  const q = useQuery(communityStatsQuery(t, period, venue));

  const data = q.data;
  // A query without data goes back to «pending» on a retry: once it has failed, the error card
  // stays (busy) through the retry instead of the skeleton.
  const failedBefore = !data && q.errorUpdateCount > 0;
  const showError = (q.isError && (!data || q.isPlaceholderData)) || failedBefore;
  const switching = q.isFetching && q.isPlaceholderData;
  const isEmpty = !q.isPending && !q.isError && (data?.totals.partide ?? 0) === 0;
  const ready = !showError && data && !isEmpty ? data : null;
  // c7: the period the figures belong to — the old one while a switch loads (useShownPeriod).
  const shownPeriod = useShownPeriod(period, !!data && !q.isPlaceholderData);

  const header = (
    <div className={VENUE_HEADER_INSET}>
      <VenueHeader title={title} description={CAPTION} backHref={backHref} onRefresh={async () => !(await q.refetch()).isError} />
      <WaterTabs waterKey={waterKey} current="statistici" period={period} />
    </div>
  );

  if (q.isPending && !failedBefore) return <StatsFallback title={title} backHref={backHref} />;

  const main = showError ? (
    <div className={STATE_CARD} data-testid="stats-error">
      <ListError title="Nu am putut încărca statisticile." onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />
    </div>
  ) : !ready ? (
    <div data-testid="stats-empty">
      <DashboardEmpty
        title="Nicio partidă în perioada selectată."
        action={<WiderPeriodAction period={shownPeriod} onChange={setPeriod} />}
        icon={
          <EmptyIcon>
            <ChartBarIcon aria-hidden />
          </EmptyIcon>
        }
      />
    </div>
  ) : (
    <StatsMain data={ready} period={shownPeriod} rankingHref={links.ranking(period)} />
  );

  // The right column is there in EVERY state (from 1280): the centre track keeps its width, so an
  // empty or failed period's card sits where the figures start, never across main + aside. An
  // empty period leaves the track bare: the centre card already says it (and offers the wider
  // period); a second «nicio partidă» beside it would only repeat it.
  const aside = ready ? (
    <StatsAside data={ready} period={shownPeriod} empty={<QuietAside>Nicio captură cu record în această perioadă.</QuietAside>} />
  ) : showError ? (
    <QuietAside>Recordul și speciile apar când se încarcă perioada.</QuietAside>
  ) : (
    <span aria-hidden data-testid="stats-aside-bare" />
  );

  return (
    <DashboardPage
      header={header}
      busy={switching}
      toolbar={
        // Always there (c5, c6): a failed or empty period keeps the way back to another one.
        <DashboardToolbar className="xl:hidden">
          <PeriodChips value={period} onChange={setPeriod} busy={switching} />
        </DashboardToolbar>
      }
    >
      <p role="status" className="sr-only">
        {switching ? 'Se încarcă perioada aleasă…' : ''}
      </p>
      {/* c7: only the FIGURES are inert while a period loads — the left column (the period, the
          water's pages) stays live, so the chip just used keeps the keyboard focus. */}
      <DashboardLayout
        context={<StatsContext period={period} onPeriod={setPeriod} waterKey={waterKey} />}
        contextLabel="Perioada și paginile apei"
        main={
          <div inert={switching} className={cn('relative flex flex-col gap-4 md:gap-5 xl:gap-6', switching && SWITCHING_DIM)} data-testid="stats-content">
            <SwitchingBar on={switching} />
            {main}
          </div>
        }
        aside={
          <div inert={switching} className={cn('relative', switching && SWITCHING_DIM)}>
            {aside}
          </div>
        }
        asideLabel="Recordul și speciile"
        sidesBelowXl="hidden"
      />
    </DashboardPage>
  );
}

/** A quiet card in the right column when the period has nothing for it (the lake's AsideSection line). */
function QuietAside({ children }: { children: ReactNode }) {
  return (
    <DashboardSection title="Recordul și speciile">
      <p className="t-body text-muted">{children}</p>
    </DashboardSection>
  );
}

/** The left column from 1280: the period (as Clasament's) and the water's pages (as every sibling's). */
function StatsContext({ period, onPeriod, waterKey }: { period: StatsPeriod; onPeriod: (p: StatsPeriod) => void; waterKey: string }) {
  return (
    <FilterColumn title="Opțiuni">
      <FilterSection title="Perioadă">
        <ChoiceChips name="perioada-col" layout="list" options={PERIOD_OPTIONS} value={period} onChange={onPeriod} />
      </FilterSection>
      <WaterPages waterKey={waterKey} current="statistici" period={period} />
    </FilterColumn>
  );
}

/** «now» only in the browser (the detail labels count back from today), null while hydrating. */
const noSubscribe = () => () => {};
const useToday = () => useSyncExternalStore(noSubscribe, () => new Date().toDateString(), () => null);

function StatsMain({ data, period, rankingHref }: { data: CommunityStatsDTO; period: StatsPeriod; rankingHref: string }) {
  const today = useToday();
  const series = data.weeklySeries;
  const detail = useMemo(() => (today ? seriesDetailLabels(period, series.length, new Date(today)) : series.map((s) => s.label)), [period, series, today]);
  const top = useMemo(() => rankAnglers(data.topAnglers).slice(0, 3), [data.topAnglers]);
  return (
    <>
      {/* fish StatStrip: partide · pescari · capturi (D1: deliberately no kg figure). */}
      <PeriodNumbers totals={data.totals} />
      {series.length > 0 ? (
        <ActivityChart
          testId="activity-card"
          points={series.map((s, i) => ({ label: s.label, count: s.count, detail: detail[i] }))}
          noun={['captură', 'capturi']}
          summary={`Activitate pe perioada aleasă: ${formatCount(series.reduce((a, s) => a + s.count, 0), 'captură', 'capturi')}.`}
        />
      ) : null}
      {data.topAnglers.length > 0 ? (
        <DashboardSection
          title="Top pescari"
          flush
          action={
            <Link href={rankingHref} className={cn(LINK_ACTION, '-my-3 inline-flex items-center gap-0.5')}>
              Clasament
              <ChevronRightIcon aria-hidden className="size-4" />
            </Link>
          }
        >
          <ol aria-label="Top pescari" className="divide-y divide-hairline pt-1" data-testid="top-anglers">
            {top.map((a, i) => (
              <TopAnglerRow key={a.uid} angler={a} rank={i + 1} />
            ))}
          </ol>
        </DashboardSection>
      ) : null}
      {/* Below 1280 the record and the species follow in the main column (the fish order); from
          768 side by side, so the 16:9 record never takes the tablet's whole width. */}
      {data.record || data.species.length ? (
        <div className="xl:hidden">
          <StatsAside data={data} period={period} />
        </div>
      ) : null}
    </>
  );
}

function StatsAside({ data, period, empty = null }: { data: CommunityStatsDTO; period: StatsPeriod; empty?: ReactNode }) {
  if (!data.record && !data.species.length) return empty;
  return (
    <div className="flex flex-col gap-4 md:max-xl:grid md:max-xl:grid-cols-2 md:max-xl:items-start md:max-xl:gap-5 md:max-xl:[&>:only-child]:col-span-2 xl:gap-6">
      {data.record ? <RecordHero period={period} record={data.record} /> : null}
      {data.species.length > 0 ? (
        <DashboardSection title="Specii prinse">
          <SpeciesBars species={data.species} />
        </DashboardSection>
      ) : null}
    </div>
  );
}

/**
 * The page's frame while the water and its first period are read (fish StatisticiSkeleton, c4),
 * under the loaded page's header slots (back, caption, refresh), on the loaded page's tracks; every
 * bone shimmers. `title` omitted (the route fallback, the water not read yet): a title bone.
 */
export function StatsFallback({ title, backHref }: { title?: string; backHref: string }) {
  return (
    <DashboardPage
      header={
        <div className={VENUE_HEADER_INSET}>
          <VenueHeader title={title ?? <TitleBone label="Statistici" />} description={CAPTION} backHref={backHref} />
          <WaterTabsSkeleton />
        </div>
      }
      toolbar={<ChipsSkeleton className="xl:hidden" />}
    >
      <div role="status" data-testid="stats-skeleton">
        <span className="sr-only">Se încarcă statisticile…</span>
        <DashboardLayout
          sidesBelowXl="hidden"
          context={<FilterColumnSkeleton title="Opțiuni" sections={[3, 4]} />}
          main={
            <div aria-hidden className="flex flex-col gap-4 xl:gap-6">
              {/* PeriodNumbers' box: the strip card, three cells. */}
              <span className="h-16 animate-shimmer rounded-card" />
              <span className="h-60 animate-shimmer rounded-card" />
              <RowsSkeleton rows={3} />
            </div>
          }
          aside={
            <div aria-hidden className="flex flex-col gap-4">
              <span className="aspect-video animate-shimmer rounded-card" />
              <span className="h-40 animate-shimmer rounded-card" />
            </div>
          }
        />
      </div>
    </DashboardPage>
  );
}

/* «Top pescari» — fish TopAnglerRow (c8, c10). */

function TopAnglerRow({ angler, rank }: { angler: TopAngler; rank: number }) {
  const name = angler.name ?? 'Pescar';
  return (
    <li>
      <AnglerLink uid={angler.uid} label={`Locul ${rank}: ${name}`} className="flex items-center gap-3 px-4.5 py-3">
        <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full t-micro-strong tabular-nums', rank <= 3 ? MEDAL[rank as 1 | 2 | 3] : 'text-muted')}>
          <span className="sr-only">Locul </span>
          {rank}
        </span>
        <AnglerAvatar uid={angler.uid} name={name} src={angler.avatarUrl} size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate t-body-strong text-ink">{name}</span>
          <span className="t-caption text-muted">{anglerSubtitle(angler)}</span>
        </span>
        {/* The weight, the leader's in accent; nothing weighed: the catches the order rests on, muted (scoreText). */}
        <span className={cn('shrink-0 t-body-strong tabular-nums', !isWeighed(angler.totalKg) ? 'text-muted' : rank === 1 ? 'text-accent-ink' : 'text-ink')}>{scoreText(angler)}</span>
      </AnglerLink>
    </li>
  );
}

/* The record — fish RecordHero: the photo (cover, 16:9) under a scrim, or the navy ground. */

function RecordHero({ period, record }: { period: StatsPeriod; record: StatsRecord }) {
  const meta = [record.angler?.name ? firstNameOf(record.angler.name) : null, record.venueName, dayMonth(record.occurredAt)].filter(Boolean).join(' · ');
  const photo = record.photoUrl;
  const body = (
    <>
      {photo ? (
        <>
          <SafePhoto src={photo} loading="eager" className="absolute inset-0 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-linear-to-t from-photo-scrim via-photo-scrim/40 to-transparent" />
        </>
      ) : null}
      <span className={cn('absolute top-2.5 left-3 rounded-badge px-2 py-1 t-micro-strong tracking-wide text-on-photo-scrim', photo ? 'bg-photo-scrim' : 'bg-indigo-5')}>{recordTagFor(period)}</span>
      <span className="absolute inset-x-3.5 bottom-3 flex flex-col gap-1 text-on-photo-scrim">
        <span className="flex items-baseline gap-1">
          <span className="t-stat">{fmtKg(record.weightKg)}</span>
          <span className="t-body-strong">kg{record.species ? ` · ${record.species}` : ''}</span>
        </span>
        {meta ? <span className="truncate t-micro text-lavender-3">{meta}</span> : null}
      </span>
    </>
  );
  const cls = cn('relative block w-full overflow-hidden rounded-card', photo ? 'aspect-video bg-navy' : 'h-30 bg-navy');
  // fish: the hero opens its partidă (spectator view) when it carries a session — once the web has one.
  const href = record.sessionDocumentId ? (partidaHref(record.sessionDocumentId) ?? undefined) : undefined;
  return (
    <figure aria-label={`${recordTagFor(period).toLowerCase()}: ${fmtKg(record.weightKg)} kg${record.species ? `, ${record.species}` : ''}`} data-testid="record-hero">
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </figure>
  );
}

/* «Specii prinse» — fish SpeciesCard: one bar per species, its share of the catches. */

function SpeciesBars({ species }: { species: SpeciesShare[] }) {
  return (
    // One grid for the card (rows as subgrids): the name column is as wide as the longest name, up
    // to 45% of the card, so the bars start on one line and a long name («Biban-soare american»)
    // is whole wherever there is room.
    <ul className="grid grid-cols-[fit-content(45%)_minmax(--spacing(16),1fr)_--spacing(10)] gap-x-2.5 gap-y-2.5" data-testid="species-card">
      {species.map((s, i) => (
        <li key={s.name} className="col-span-3 grid grid-cols-subgrid items-center">
          <span className="truncate t-label text-ink">{s.name}</span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-accent-tint">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, s.pct)}%`, opacity: i === 0 ? 1 : Math.max(0.3, 1 - i * 0.22) }} />
          </span>
          <span className="text-right t-micro-strong text-muted tabular-nums">{s.pct}%</span>
        </li>
      ))}
    </ul>
  );
}

