'use client';

import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { AsideSkeleton, ChoiceChips, FilterColumn, FilterSection, ListEmpty, ListHeader, ListPage, useListUrlState } from '@/components/templates/T1';
import { T2Spinner } from '@/components/templates/T2';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  communityStatsQuery,
  firstNameOf,
  periodPhraseFor,
  type CommunityStatsDTO,
  type SpeciesShare,
  type StatsPeriod,
  type TopAngler,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useViewerState } from '../../../_shell/viewer-context';
import { userOf } from '../../../_shell/viewer-state';
import { lakeHref } from '../_components/availability';
import { PERIOD_OPTIONS } from '@/lib/stats-period';
import { firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { PeriodAside, PeriodChips, plural, QuietNote, rankKg, RankRow, ROWS_CARD, RowsSkeleton } from '../_sub/stats';
import { useBack } from '../_sub/useBack';

/*
 * Clasament pescari la baltă — fish app/(app)/lakes/[lakeId]/clasament.tsx →
 * AnglersLeaderboardScreen with `venue` (parity lakes.anglers-ranking), on T1:
 *  - c1 «Clasament · {baltă}» with the back control (on a phone the lake takes its own line);
 *  - c2 Săptămâna / Luna / Anul curent, in the URL (`?perioada=`, replaced, never pushed —
 *    lakes.b.period-and-sort-in-url); the previous period stays on screen while the next loads,
 *    dimmed and busy (a spinner by the chips — in the docked column too —, aria-busy, not
 *    clickable), and every label keeps naming the period the numbers belong to until they change;
 *  - c3 the podium 2 · 1 · 3 (a missing place is a ghost step, so it always reads 2 · 1 · 3);
 *  - c4 Pescari / Specii only (no «Bălți» for one lake), under the podium, which stays on both
 *    (fish order: chips → podium → toggle → list → «EU»);
 *  - c5 the list from rank 4, «Doar podiumul are date…»; c6 the species list (RankRow, as stands);
 *  - c7 «EU» + «Ești pe locul N din M {perioada} — X kg» for the signed-in, ranked user, under the
 *    list (docked in the right column from 1280);
 *  - c8 the empty period and the error (never an empty period, never the previous period's data).
 * From 1280 the period and the list choice dock in the left column, the right column holds your
 * place and the period's card — its numbers in one row and the stand ranking as its action, the
 * same block as on standuri (ROADMAP §4, three columns). The right column
 * is there in every state (a skeleton while loading, the period's card when empty or failed), so a
 * period switch never changes the page's structure. Below 1280 the same blocks follow the list.
 * Each angler opens /pescari/[uid] once that page is on the web (availability.ts `angler`).
 */

type Segment = 'pescari' | 'specii';
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'pescari', label: 'Pescari' },
  { value: 'specii', label: 'Specii' },
];


export function RankingScreen({ lakeId, lakeName, initialPeriod }: { lakeId: string; lakeName: string; initialPeriod: StatsPeriod }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [period, setPeriod] = useState<StatsPeriod>(initialPeriod);
  const [segment, setSegment] = useState<Segment>('pescari');
  useListUrlState({ perioada: period === 'month' ? null : period });
  const q = useQuery(communityStatsQuery(t, period, { kind: 'lake', id: lakeId }));
  const back = useBack(routes.lake(lakeId));

  // The period the numbers on screen belong to: while the next period loads the previous one's
  // numbers stay (placeholder), so every label keeps the previous period's name until they change.
  const [settled, setSettled] = useState<StatsPeriod>(initialPeriod);
  if (q.data && !q.isPlaceholderData && settled !== period) setSettled(period);
  const shownPeriod = q.isPlaceholderData ? settled : period;

  const data = q.data;
  const failed = firstReadFailed(q, !!data && !q.isPlaceholderData);
  const loading = !failed && q.isPending;
  const switching = !failed && q.isFetching && q.isPlaceholderData;
  const isEmpty = !data || data.totals.partide === 0;
  const ready = !loading && !failed && !isEmpty && data ? data : null;

  const header = (
    <ListHeader
      titleId={SUB_TITLE_ID}
      // c1 «Clasament · {baltă}»; on a phone the lake takes its own line (no dot orphaned at the
      // end of the first) — the dot stays in the heading's text for assistive tech.
      title={
        <>
          Clasament<span className="max-sm:sr-only"> · </span>
          <span className="max-sm:block">{lakeName || 'baltă'}</span>
        </>
      }
      back={{ label: 'Înapoi', onClick: back }}
    />
  );

  const filters = (
    <FilterColumn title="Clasament">
      <FilterSection title="Perioadă" icon={switching ? <T2Spinner className="size-5 text-accent" /> : undefined}>
        <ChoiceChips name="perioada-col" layout="list" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </FilterSection>
      <FilterSection title="Arată">
        <ChoiceChips name="segment-col" layout="list" options={SEGMENTS} value={segment} onChange={setSegment} />
      </FilterSection>
    </FilterColumn>
  );

  const aside = loading ? (
    <AsideSkeleton rows={2} />
  ) : (
    <>
      {ready && segment === 'pescari' ? (
        // Docked only: below 1280 the pill follows the list (c7, as fish shows it in the content).
        <Suspense fallback={null}>
          <MeForViewer data={ready} period={shownPeriod} className="hidden xl:flex" />
        </Suspense>
      ) : null}
      <PeriodAside
        period={shownPeriod}
        totals={ready ? ready.totals : null}
        quiet={failed ? 'Numerele perioadei nu s-au putut încărca.' : 'Nicio partidă în această perioadă.'}
        action={{ href: routes.lakeStands(lakeId, { perioada: shownPeriod }), label: 'Clasament standuri' }}
        note={ready?.stands?.length ? `${plural(ready.stands.length, 'stand cu activitate', 'standuri cu activitate')} în perioada aleasă.` : undefined}
        dimmed={switching}
      />
    </>
  );

  return (
    <ListPage header={header} filters={filters} filtersLabel="Opțiuni clasament" aside={aside} asideLabel="Perioada și poziția ta" asideBusy={loading || switching}>
      <div className="xl:hidden">
        <PeriodChips value={period} onChange={setPeriod} busy={switching} />
      </div>
      {switching ? (
        <p role="status" className="sr-only">
          Se încarcă perioada aleasă…
        </p>
      ) : null}
      <section
        aria-label="Clasament"
        aria-busy={switching || loading || undefined}
        className={cn('flex flex-col gap-3 transition-opacity', switching && 'pointer-events-none opacity-60')}
        data-testid="ranking-content"
      >
        {failed ? (
          <SubListError
            testId="stats-error"
            title="Nu am putut încărca statisticile."
            onRetry={() => void q.refetch()}
            retrying={q.isFetching}
            attempt={q.errorUpdateCount}
          />
        ) : loading ? (
          <RankingSkeletonBody />
        ) : !ready ? (
          <div data-testid="ranking-empty">
            <SubRetryFocus />
            <ListEmpty
              icon={<ChartBarIcon aria-hidden className="size-12" />}
              title="Niciun clasament pentru perioada selectată încă."
              action={
                period !== 'year' ? (
                  <Button variant="secondary" onClick={() => setPeriod('year')}>
                    Vezi anul curent
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <SubRetryFocus />
            {/* fish order: the podium (on both views), the toggle, the list, then «EU». */}
            <Podium top3={ready.topAnglers.slice(0, 3)} />
            <SegmentedControl
              className="xl:hidden [&>legend]:sr-only"
              label="Arată"
              name="segment"
              options={SEGMENTS}
              value={segment}
              onChange={setSegment}
            />
            {segment === 'pescari' ? <AnglerRows anglers={ready.topAnglers} /> : <SpeciesRows species={ready.species} />}
            {segment === 'pescari' ? (
              <Suspense fallback={null}>
                <MeForViewer data={ready} period={shownPeriod} className="xl:hidden" />
              </Suspense>
            ) : null}
          </>
        )}
      </section>
    </ListPage>
  );
}

/** The grey shape of the screen while the first period loads (fish ClasamentSkeleton). */
export function RankingSkeletonBody() {
  const steps = [STEP_H[2], STEP_H[1], STEP_H[3]];
  const avatars = ['size-11 md:size-12', 'size-12 md:size-16', 'size-11 md:size-12'];
  return (
    <div role="status" className="flex flex-col gap-3" data-testid="ranking-skeleton">
      <span className="sr-only">Se încarcă clasamentul…</span>
      <div aria-hidden className="rounded-card bg-surface px-4.5 pt-4 shadow-e0">
        <div className="mx-auto flex max-w-140 items-end gap-2.25 md:gap-4">
          {steps.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={cn('animate-shimmer rounded-full', avatars[i])} />
              <span className="h-2.5 w-14 rounded-full bg-soft-fill" />
              <span className="h-3 w-12 rounded-full bg-soft-fill" />
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

/* ------------------------------------------------------------------------------------------------
 * Podium — fish PodiumColumn / Podium (c3)
 * ---------------------------------------------------------------------------------------------- */

/*
 * The steps take the ranking's place roles (Fundații §05, the PositionPill that replaces fish's
 * medals): the winner on navy with lavender, the others on the accent tint with accent ink — never
 * the star colour or a text token used as a fill (both collide in the dark theme). From 768 the
 * podium is the page's hero: 64 / 48 avatars, taller steps, the whole name (truncated) — first names
 * alone collide («Andrew» on 1 and 2); on a phone, fish's first name.
 */
const STEP_H: Record<1 | 2 | 3, string> = { 1: 'h-16 md:h-20', 2: 'h-11.5 md:h-14', 3: 'h-8.5 md:h-10' };
const STEP: Record<1 | 2 | 3, string> = {
  1: cn(STEP_H[1], 'bg-navy text-lavender t-num-18'),
  2: cn(STEP_H[2], 'bg-accent-tint text-accent-ink t-num-16'),
  3: cn(STEP_H[3], 'bg-accent-tint text-accent-ink t-num-16'),
};

function AnglerLink({ uid, className, children, label }: { uid: string; className?: string; children: ReactNode; label: string }) {
  const href = lakeHref('angler', routes.angler(uid));
  return href ? (
    <Link href={href} aria-label={label} className={cn('rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:bg-soft-fill', className)}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

const PODIUM_NAME = 'max-w-full truncate t-micro-strong md:t-body-strong';

function PodiumColumn({ angler, rank }: { angler: TopAngler; rank: 1 | 2 | 3 }) {
  const name = angler.name ?? 'Pescar';
  return (
    <li className="flex min-w-0 flex-1 flex-col" data-rank={rank}>
      <AnglerLink uid={angler.uid} label={`Locul ${rank}: ${name}, ${rankKg(angler.totalKg)} kg`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 pt-1">
        {/* Avatar's own display class would beat `hidden`: each size sits in its own wrapper. */}
        <span className="flex md:hidden">
          <Avatar name={name} src={angler.avatarUrl} size={rank === 1 ? 48 : 44} ring className="shadow-e1" />
        </span>
        <span className="hidden md:flex">
          <Avatar name={name} src={angler.avatarUrl} size={rank === 1 ? 64 : 48} ring className="shadow-e1" />
        </span>
        <span className={cn(PODIUM_NAME, 'text-ink')} title={name}>
          <span className="md:hidden">{firstNameOf(angler.name)}</span>
          <span className="hidden md:inline">{name}</span>
        </span>
        <span className="t-label text-accent-ink tabular-nums md:t-body-strong">{rankKg(angler.totalKg)} kg</span>
        <span className={cn('flex w-full items-center justify-center rounded-t-control', STEP[rank])}>
          <span className="sr-only">Locul </span>
          {rank}
        </span>
      </AnglerLink>
    </li>
  );
}

/** A place nobody holds yet: a dashed outline of its step, so the podium always reads 2 · 1 · 3. */
function GhostColumn({ rank }: { rank: 2 | 3 }) {
  return (
    <li aria-hidden className="flex min-w-0 flex-1 flex-col items-center gap-1.5 pt-1" data-ghost={rank}>
      <span className="size-11 rounded-full border border-dashed border-hairline md:size-12" />
      <span className={cn(PODIUM_NAME, 'text-muted')}>—</span>
      <span className="invisible t-label md:t-body-strong">0</span>
      <span className={cn('flex w-full items-center justify-center rounded-t-control border border-b-0 border-dashed border-hairline t-num-16 text-muted', STEP_H[rank])}>{rank}</span>
    </li>
  );
}

function Podium({ top3 }: { top3: TopAngler[] }) {
  const [first, second, third] = top3;
  if (!first) return null;
  return (
    <div className="overflow-hidden rounded-card bg-surface px-4.5 pt-4 shadow-e0 md:pt-6" data-testid="podium">
      <ol aria-label="Podium" className="mx-auto flex max-w-140 items-end gap-2.25 md:gap-4">
        {second ? <PodiumColumn angler={second} rank={2} /> : <GhostColumn rank={2} />}
        <PodiumColumn angler={first} rank={1} />
        {third ? <PodiumColumn angler={third} rank={3} /> : <GhostColumn rank={3} />}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Lists — fish AnglerRow / SpeciesRow (c5, c6): the shared RankRow (as the stands)
 * ---------------------------------------------------------------------------------------------- */

function AnglerRows({ anglers }: { anglers: TopAngler[] }) {
  if (anglers.length <= 3) {
    return (
      <div className={ROWS_CARD}>
        <QuietNote className="py-4" testId="podium-only">
          Doar podiumul are date pentru perioada asta.
        </QuietNote>
      </div>
    );
  }
  return (
    <ol aria-label="Pescari" className={cn(ROWS_CARD, 'divide-y divide-hairline')} data-testid="angler-rows">
      {anglers.slice(3).map((a, i) => {
        const name = a.name ?? 'Pescar';
        return (
          <RankRow
            key={a.uid}
            rank={i + 4}
            lead={<Avatar name={name} src={a.avatarUrl} size={32} />}
            title={name}
            meta={`${plural(a.partide, 'partidă', 'partide')} · ${plural(a.catches, 'captură', 'capturi')}`}
            value={rankKg(a.totalKg)}
            unit="kg"
            href={lakeHref('angler', routes.angler(a.uid))}
            label={`Locul ${i + 4}: ${name}`}
          />
        );
      })}
    </ol>
  );
}

function SpeciesRows({ species }: { species: SpeciesShare[] }) {
  if (!species.length) {
    return (
      <div className={ROWS_CARD}>
        <QuietNote className="py-4" testId="species-empty">
          Nicio specie înregistrată în această perioadă.
        </QuietNote>
      </div>
    );
  }
  return (
    <ol aria-label="Specii" className={cn(ROWS_CARD, 'divide-y divide-hairline')} data-testid="species-rows">
      {species.map((s, i) => (
        <RankRow key={s.name} rank={i + 1} title={s.name} meta={plural(s.count, 'captură', 'capturi')} value={`${s.pct}%`} unit="din capturi" />
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Your place (c7) and the period in numbers
 * ---------------------------------------------------------------------------------------------- */

/** fish `myRank`: the signed-in user's place among the ranked anglers (profile.documentId = uid). */
function MeForViewer({ data, period, className }: { data: CommunityStatsDTO; period: StatsPeriod; className?: string }) {
  const viewer = userOf(useViewerState());
  if (!viewer?.documentId) return null;
  const idx = data.topAnglers.findIndex(a => a.uid === viewer.documentId);
  if (idx === -1) return null;
  return <MePill rank={idx + 1} total={data.totals.anglers} period={period} kg={data.topAnglers[idx].totalKg} className={className} />;
}

function MePill({ rank, total, period, kg, className }: { rank: number; total: number; period: StatsPeriod; kg: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 rounded-card bg-accent-tint px-3 py-2.5 inset-ring inset-ring-accent-tint-2', className)} data-testid="me-pill">
      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-ink t-micro-strong text-on-accent">
        EU
      </span>
      <p className="t-label text-ink">
        Ești pe locul {rank} din {total} {periodPhraseFor(period)} — {rankKg(kg)} kg
      </p>
    </div>
  );
}
