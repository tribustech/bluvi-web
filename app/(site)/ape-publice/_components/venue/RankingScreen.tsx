'use client';

import { useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, useState } from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { AsideSection, AsideSkeleton, ChoiceChips, FilterColumn, FilterColumnSkeleton, FilterSection, ListEmpty, ListError, ListPage, useListUrlState } from '@/components/templates/T1';
import { MEDAL, isMedalPlace } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import {
  communityStatsQuery,
  firstNameOf,
  isWeighed,
  periodPhraseFor,
  type CommunityVenueRef,
  type SpeciesShare,
  type StatsPeriod,
  type TopAngler,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { useViewerState } from '../../../_shell/viewer-context';
import { userOf } from '../../../_shell/viewer-state';
import {
  AnglerAvatar,
  AnglerLink,
  anglerSubtitle,
  ChipsSkeleton,
  EmptyIcon,
  PeriodChips,
  PeriodNumbers,
  QuietNote,
  ROWS_CARD,
  RowsSkeleton,
  SEGMENT_ON_PAGE,
  SWITCHING_DIM,
  SwitchingBar,
  TitleBone,
  VenueHeader,
  WaterPages,
  WaterTabs,
  WaterTabsSkeleton,
  WiderPeriodAction,
  kgText,
  podiumScoreText,
  rankAnglers,
  scoreText,
  useShownPeriod,
} from './bits';
import { PERIOD_OPTIONS, PERIOD_TITLE } from '@/lib/stats-period';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Clasament · <apă> — fish app/(app)/public-waters/[id]/clasament.tsx → AnglersLeaderboardScreen
 * with `venue` (parity public-waters.clasament), on T1:
 *  - c2 the family header: the water's name, «Clasamentul apei» under it (parity deviation, as
 *    Partide / Statistici), the back control; c3 the period in `?perioada=` (replaced);
 *  - c4 the skeleton, the error, «Niciun clasament pentru perioada selectată încă.»;
 *  - c5 the podium 2 · 1 · 3; c6 Pescari / Specii only (no «Bălți» for one venue);
 *  - c7 rows from rank 4 / «Doar podiumul…»; c8 species rows / their empty line;
 *  - c9 the «EU» pill for the signed-in, ranked viewer — after the rows below 1280 (the fish order,
 *    so its late arrival never moves the list), in the right column from 1280; c10 the period switch (SwitchingBar + inert, the family's one
 *    treatment) + the refresh.
 * From 1280 the period, the list choice and the water's pages dock in the left column, the right
 * column holds your place and the period in numbers (ROADMAP §4, three columns): partide · pescari · capturi, the
 * same three figures as Statistici (D1: no kg figure on either sibling).
 */

type Segment = 'pescari' | 'specii';
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'pescari', label: 'Pescari' },
  { value: 'specii', label: 'Specii' },
];

/** The family header's caption (Partide: «Partide pe apă», Statistici: «Statisticile apei»). */
const CAPTION = 'Clasamentul apei';

export function RankingScreen({
  venue,
  waterKey,
  title,
  backHref,
  initialPeriod,
}: {
  venue: CommunityVenueRef;
  waterKey: string;
  title: string;
  backHref: string;
  initialPeriod: StatsPeriod;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);
  const [segment, setSegment] = useState<Segment>('pescari');
  useListUrlState({ perioada: period === 'month' ? null : period });
  const q = useQuery(communityStatsQuery(t, period, venue));

  const data = q.data;
  const switching = q.isFetching && q.isPlaceholderData;
  // A query without data goes back to «pending» on a retry: once it has failed, the error card
  // stays (busy) through the retry instead of the skeleton.
  const failedBefore = !data && q.errorUpdateCount > 0;
  const showError = (q.isError && (!data || q.isPlaceholderData)) || failedBefore;
  const loading = q.isPending && !failedBefore;
  const isEmpty = !data || data.totals.partide === 0;
  const ready = !loading && !showError && !isEmpty && data ? data : null;
  // c10: the period the figures belong to — the old one while a switch loads (useShownPeriod).
  const shownPeriod = useShownPeriod(period, !!data && !q.isPlaceholderData);
  // Ties on kg (nothing weighed) ordered by catches, then partide (bits rankAnglers).
  const anglers = useMemo(() => (ready ? rankAnglers(ready.topAnglers) : []), [ready]);

  const header = (
    <div>
      <VenueHeader title={title} description={CAPTION} backHref={backHref} onRefresh={async () => !(await q.refetch()).isError} />
      <WaterTabs waterKey={waterKey} current="clasament" period={period} />
    </div>
  );

  const filters = (
    <FilterColumn title="Opțiuni">
      <FilterSection title="Perioadă">
        <ChoiceChips name="perioada-col" layout="list" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </FilterSection>
      <FilterSection title="Arată">
        <ChoiceChips name="segment-col" layout="list" options={SEGMENTS} value={segment} onChange={setSegment} />
      </FilterSection>
      <WaterPages waterKey={waterKey} current="clasament" period={period} />
    </FilterColumn>
  );

  // The right column is there in every state (ListPage keeps its tracks): an empty or failed period
  // keeps the card in the centre track, never across centre + right. An empty period leaves it
  // bare: the centre card already says so (and offers the wider period). While a period loads it
  // takes the centre's switch treatment (bar, inert, busy) and keeps naming the period shown.
  const aside = loading ? (
    <AsideSkeleton rows={2} />
  ) : ready || showError ? (
    <div
      inert={switching}
      aria-busy={switching || undefined}
      className={cn('relative flex flex-col gap-4', switching && SWITCHING_DIM)}
      data-testid="ranking-aside"
    >
      <SwitchingBar on={switching} />
      {ready && segment === 'pescari' ? (
        <Suspense fallback={null}>
          <MeForViewer anglers={anglers} total={ready.totals.anglers} period={shownPeriod} />
        </Suspense>
      ) : null}
      {ready ? (
        // The period in numbers: the strip is its own card, so the section is bare (no card in card).
        <AsideSection title={PERIOD_TITLE[shownPeriod]} bare>
          <PeriodNumbers totals={ready.totals} />
        </AsideSection>
      ) : (
        <AsideSection title={PERIOD_TITLE[period]}>
          <p className="t-body text-muted">Cifrele perioadei apar când se încarcă clasamentul.</p>
        </AsideSection>
      )}
    </div>
  ) : (
    <span aria-hidden data-testid="ranking-aside-bare" />
  );

  return (
    <ListPage header={header} filters={filters} filtersLabel="Opțiuni clasament" aside={aside} asideLabel="Poziția ta și perioada" asideInline={false} asideBusy={loading}>
      <div className="xl:hidden">
        <PeriodChips value={period} onChange={setPeriod} busy={switching} />
      </div>
      <p role="status" className="sr-only">
        {switching ? 'Se încarcă perioada aleasă…' : ''}
      </p>
      <section
        aria-label="Clasament"
        aria-busy={switching || loading || undefined}
        inert={switching}
        className={cn('relative flex flex-col gap-3', switching && SWITCHING_DIM)}
        data-testid="ranking-content"
      >
        <SwitchingBar on={switching} />
        {loading ? (
          <RankingSkeletonBody />
        ) : showError ? (
          <div data-testid="ranking-error">
            <ListError title="Nu am putut încărca clasamentul." onRetry={() => void q.refetch()} retrying={q.isFetching} attempt={q.errorUpdateCount} />
          </div>
        ) : !ready ? (
          <div data-testid="ranking-empty">
            <ListEmpty
              title="Niciun clasament pentru perioada selectată încă."
              action={<WiderPeriodAction period={shownPeriod} onChange={setPeriod} />}
              icon={
                <EmptyIcon>
                  <TrophyIcon aria-hidden />
                </EmptyIcon>
              }
            />
          </div>
        ) : (
          <>
            <Podium top3={anglers.slice(0, 3)} />
            <SegmentedControl className={cn('xl:hidden [&>legend]:sr-only', SEGMENT_ON_PAGE)} label="Arată" name="segment" options={SEGMENTS} value={segment} onChange={setSegment} />
            {segment === 'pescari' ? <AnglerRows anglers={anglers} /> : <SpeciesRows species={ready.species} />}
            {/* fish order: the pill AFTER the rows (podium → toggle → rows → MePill) — the viewer
                resolves in the browser, so its arrival here never pushes the list down. */}
            {segment === 'pescari' ? (
              <Suspense fallback={null}>
                <MeForViewer anglers={anglers} total={ready.totals.anglers} period={shownPeriod} className="xl:hidden" />
              </Suspense>
            ) : null}
          </>
        )}
      </section>
    </ListPage>
  );
}

/**
 * The ranking's frame while the water and its period are read (fish ClasamentSkeleton), under the
 * loaded page's header slots (back, refresh) so nothing moves when the data lands. `title`
 * omitted (the route fallback, the water not read yet): a title bone.
 */
export function RankingFallback({ title, backHref }: { title?: string; backHref: string }) {
  return (
    <div aria-busy>
      <ListPage
        header={
          <div>
            <VenueHeader title={title ?? <TitleBone label="Clasament" />} description={CAPTION} backHref={backHref} />
            <WaterTabsSkeleton />
          </div>
        }
        filters={<FilterColumnSkeleton title="Opțiuni" sections={[3, 2, 4]} />}
        aside={<AsideSkeleton rows={2} />}
        asideInline={false}
        asideBusy
      >
        <div className="xl:hidden">
          <ChipsSkeleton />
        </div>
        <RankingSkeletonBody />
      </ListPage>
    </div>
  );
}

/** The grey shape of the ranking while the first period loads. */
export function RankingSkeletonBody() {
  // Podium's own geometry, 2 · 1 · 3 (STEP, the avatars, the md scale); every bone shimmers.
  const steps = [STEP[2], STEP[1], STEP[3]];
  const avatars = ['size-11 md:size-12', 'size-12 md:size-16', 'size-11 md:size-12'];
  return (
    <div role="status" className="flex flex-col gap-3" data-testid="ranking-skeleton">
      <span className="sr-only">Se încarcă clasamentul…</span>
      <div aria-hidden className="rounded-card bg-surface px-4.5 pt-4 shadow-e0 md:pt-6">
        <div className="mx-auto flex max-w-140 items-end gap-2.25 md:max-w-160 md:gap-4">
          {steps.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={cn('animate-shimmer rounded-full', avatars[i])} />
              <span className="h-2.5 w-14 animate-shimmer rounded-full md:h-4 md:w-20" />
              <span className="h-3 w-12 animate-shimmer rounded-full md:h-5 md:w-16" />
              <span className={cn('w-full animate-shimmer rounded-t-control', h)} />
            </div>
          ))}
        </div>
      </div>
      <span aria-hidden className="h-11 animate-shimmer rounded-control xl:hidden" />
      <RowsSkeleton rows={5} />
    </div>
  );
}

/* Podium — fish PodiumColumn / Podium (c5): gold, silver, bronze steps; 1st larger, in the middle. */

/** The steps: the phone's fish sizes; from 768 the podium is the page's hero, scaled up. */
const STEP: Record<1 | 2 | 3, string> = { 1: 'h-16 md:h-20', 2: 'h-11.5 md:h-15', 3: 'h-8.5 md:h-11' };

/**
 * The names under the podium: the first name (fish firstNameOf), or — when two of the three share
 * it («Andrew» and «Andrew R») — the first name and the last name's initial («Andrew R.»), so the
 * podium never shows two identical names.
 */
function podiumNames(top3: TopAngler[]): string[] {
  const firsts = top3.map((a) => firstNameOf(a.name));
  return top3.map((a, i) => {
    if (firsts.filter((f) => f === firsts[i]).length < 2) return firsts[i];
    const parts = (a.name ?? '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : firsts[i];
  });
}

function PodiumColumn({ angler, rank, shortName }: { angler: TopAngler; rank: 1 | 2 | 3; shortName: string }) {
  const name = angler.name ?? 'Pescar';
  const weighed = isWeighed(angler.totalKg);
  const score = podiumScoreText(angler);
  return (
    <li className="flex min-w-0 flex-1 flex-col" data-rank={rank}>
      <AnglerLink uid={angler.uid} label={`Locul ${rank}: ${name}, ${score}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-t-control pt-1 md:gap-2">
        <AnglerAvatar uid={angler.uid} name={name} src={angler.avatarUrl} size={rank === 1 ? 48 : 44} ring className="shadow-e1 md:hidden" />
        <AnglerAvatar uid={angler.uid} name={name} src={angler.avatarUrl} size={rank === 1 ? 64 : 48} ring className="shadow-e1 max-md:hidden" />
        <span className="max-w-full truncate t-micro-strong text-ink md:t-body-strong">{shortName}</span>
        {/* The weight in accent; nothing weighed: the catches the order rests on, muted (scoreText);
            no catch either: the partide that placed it (podiumScoreText), never «0 capturi» on a medal. */}
        <span className={cn('t-label tabular-nums md:t-heading', weighed ? 'text-accent-ink' : 'text-muted')} data-testid="podium-score">
          {score}
        </span>
        <span className={cn('flex w-full items-center justify-center rounded-t-control t-body-strong md:t-heading', STEP[rank], MEDAL[rank])}>
          <span className="sr-only">Locul </span>
          {rank}
        </span>
      </AnglerLink>
    </li>
  );
}

function Podium({ top3 }: { top3: TopAngler[] }) {
  const [first, second, third] = top3;
  if (!first) return null;
  const names = podiumNames(top3);
  return (
    <div className="overflow-hidden rounded-card bg-surface px-4.5 pt-4 shadow-e0 md:pt-6" data-testid="podium">
      <ol aria-label="Podium" className="mx-auto flex max-w-140 items-end gap-2.25 md:max-w-160 md:gap-4">
        {second ? <PodiumColumn angler={second} rank={2} shortName={names[1]} /> : <li aria-hidden className="flex-1" />}
        <PodiumColumn angler={first} rank={1} shortName={names[0]} />
        {third ? <PodiumColumn angler={third} rank={3} shortName={names[2]} /> : <li aria-hidden className="flex-1" />}
      </ol>
    </div>
  );
}

/* Lists — fish AnglerRow / SpeciesRow (c7, c8). */

/**
 * fish RankBadge: ranks 1–3 in the medal colours (rankColor). Here as the medal chip Statistici's
 * Top pescari uses (MEDAL: the navy digit on gold / silver / bronze) — the medal as a text colour
 * (MEDAL_TEXT) is 2.6:1 for silver on white, under AA. Rank 4+ muted.
 */
function Rank({ rank }: { rank: number }) {
  const medal = isMedalPlace(rank);
  return (
    <span className="flex w-6 shrink-0 justify-center">
      <span
        className={cn('flex size-6 items-center justify-center rounded-full tabular-nums', medal ? cn('t-micro-strong', MEDAL[rank]) : 't-label text-muted')}
        data-testid="rank"
        data-medal={medal ? rank : undefined}
      >
        <span className="sr-only">Locul </span>
        {rank}
      </span>
    </span>
  );
}

function AnglerRows({ anglers }: { anglers: TopAngler[] }) {
  if (anglers.length <= 3) {
    return (
      <div className={ROWS_CARD}>
        <QuietNote testId="podium-only">
          {anglers.length === 1 ? 'Doar un pescar are partide în această perioadă.' : `Doar ${formatCount(anglers.length, 'pescar', 'pescari')} au partide în această perioadă.`}
        </QuietNote>
      </div>
    );
  }
  return (
    <ol aria-label="Pescari" className={cn(ROWS_CARD, 'divide-y divide-hairline')} data-testid="angler-rows">
      {anglers.slice(3).map((a, i) => {
        const name = a.name ?? 'Pescar';
        return (
          <li key={a.uid}>
            <AnglerLink uid={a.uid} label={`Locul ${i + 4}: ${name}`} className="flex items-center gap-3 px-4 py-3">
              <Rank rank={i + 4} />
              <AnglerAvatar uid={a.uid} name={a.name ?? ''} src={a.avatarUrl} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate t-body-strong text-ink">{name}</span>
                <span className="t-caption text-muted">{anglerSubtitle(a)}</span>
              </span>
              <span className={cn('shrink-0 t-body-strong tabular-nums', isWeighed(a.totalKg) ? 'text-ink' : 'text-muted')}>{scoreText(a)}</span>
            </AnglerLink>
          </li>
        );
      })}
    </ol>
  );
}

function SpeciesRows({ species }: { species: SpeciesShare[] }) {
  if (!species.length) {
    return (
      <div className={ROWS_CARD}>
        <QuietNote testId="species-empty">
          Nicio specie înregistrată în această perioadă.
        </QuietNote>
      </div>
    );
  }
  return (
    <ol aria-label="Specii" className={cn(ROWS_CARD, 'divide-y divide-hairline')} data-testid="species-rows">
      {species.map((s, i) => (
        <li key={s.name} className="flex items-center gap-3 px-4 py-3">
          <Rank rank={i + 1} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate t-body-strong text-ink">{s.name}</span>
            <span className="t-caption text-muted">{formatCount(s.count, 'captură', 'capturi')}</span>
          </span>
          <span className="shrink-0 t-body-strong text-ink tabular-nums">{s.pct}%</span>
        </li>
      ))}
    </ol>
  );
}

/* Aside — your place (c9) and the period in numbers. */

/** fish `myRank`: the signed-in viewer's place among the ranked anglers (profile.documentId = uid). */
function MeForViewer({ anglers, total, period, className }: { anglers: TopAngler[]; total: number; period: StatsPeriod; className?: string }) {
  const viewer = userOf(useViewerState());
  if (!viewer?.documentId) return null;
  const idx = anglers.findIndex((a) => a.uid === viewer.documentId);
  if (idx === -1) return null;
  const kg = anglers[idx].totalKg;
  return (
    <div className={cn('flex items-center gap-2 rounded-card bg-accent-tint px-3 py-2.5 inset-ring inset-ring-accent-tint-2', className)} data-testid="me-pill">
      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-ink t-micro-strong text-on-accent">
        EU
      </span>
      <p className="t-label text-ink">
        Ești pe locul {idx + 1} din {formatCount(total, 'pescar', 'pescari')} {periodPhraseFor(period)}
        {isWeighed(kg) ? ` — ${kgText(kg)}` : null}
      </p>
    </div>
  );
}
