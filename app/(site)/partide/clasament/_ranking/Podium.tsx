'use client';

import type { ReactNode } from 'react';
import { MEDAL } from '@/components/ranking';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { firstNameOf, fmtKg, isWeighed, type StatsPeriod, type TopAngler } from '@/core/partide';
import { pluralNoun } from '@/core/realtime/chat/format';
import { PERIOD_TITLE } from '@/lib/stats-period';
import { anglerSubtitle, podiumScoreText } from '@/app/(site)/ape-publice/_components/venue/bits';
import { AnglerLink, type OpenAngler } from './AnglerPopover';

/*
 * fish AnglersLeaderboardScreen PodiumColumn / Podium (partide.clasament c2): the top three as
 * 2nd · 1st · 3rd, the 1st bigger and in the middle, each step in its medal (gold, silver, bronze —
 * the kit MEDAL tokens, the navy digit AA on each); avatar (photo or initials on the solid tone, as
 * the rows' RankingFace and the popover: one look per angler on the screen, rule 13),
 * first name, the figure. Each place opens the angler (the profile, or from 1024 the popover).
 * The same geometry as a public water's / a lake's Clasament podium, so the family reads as one.
 */

/** The steps: the phone's fish sizes (64 / 46 / 34); from 768 the podium is the page's hero, scaled up. */
export const STEP: Record<1 | 2 | 3, string> = { 1: 'h-16 md:h-24', 2: 'h-11.5 md:h-17', 3: 'h-8.5 md:h-12' };

/**
 * The names under the podium: the first name (fish firstNameOf) or — when two of the three share it
 * — the first name and the last name's initial («Andrei P.»), so the podium never shows two
 * identical names.
 */
function podiumNames(top3: TopAngler[]): string[] {
  const firsts = top3.map((a) => firstNameOf(a.name));
  return top3.map((a, i) => {
    if (firsts.filter((f) => f === firsts[i]).length < 2) return firsts[i];
    const parts = (a.name ?? '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : firsts[i];
  });
}

/*
 * From 768 the podium is the page's hero band (owner 2026-10-13, «fă-le frumos să aibă sens»): a
 * light accent-tint → surface band, the period in numbers on its left (PeriodNumbers' figures, no
 * longer a lone right column), the viewer's place under them, and the three places as cards on its
 * right — 2 · 1 · 3, the 1st the tallest — each with a large face ringed in its medal, the full
 * name, the figure big, the partide / catches line and the medal chip. The cards rise in once
 * (staggered, @starting-style: no keyframes, nothing loops; off under prefers-reduced-motion).
 * Below 768 nothing changes: fish's podium steps (every md: class here is the hero's, every
 * max-md: / md:hidden one keeps the phone as it was).
 */

/** The card's medal wash (its top in the medal, fading to the surface) and the face's ring. */
const CARD_WASH: Record<1 | 2 | 3, string> = {
  1: 'md:from-medal-gold/20',
  2: 'md:from-medal-silver/15',
  3: 'md:from-medal-bronze/20',
};
const FACE_RING: Record<1 | 2 | 3, string> = {
  1: 'md:bg-medal-gold',
  2: 'md:bg-medal-silver',
  3: 'md:bg-medal-bronze',
};
/** The cards' heights: the 1st the tallest; the entrance staggered 2 → 1 → 3 reads as one rise. */
const CARD_PAD: Record<1 | 2 | 3, string> = { 1: 'md:pt-10 md:pb-11', 2: 'md:pt-7 md:pb-7', 3: 'md:pt-7 md:pb-7' };
const RISE_DELAY: Record<1 | 2 | 3, string> = { 1: 'md:delay-150', 2: 'md:delay-0', 3: 'md:delay-300' };
const RISE =
  'md:motion-safe:transition-[opacity,translate] md:motion-safe:duration-(--duration-slow) md:motion-safe:ease-slow md:motion-safe:starting:translate-y-4 md:motion-safe:starting:opacity-0';

function Column({ angler, rank, shortName, onOpen, popover, me }: { angler: TopAngler; rank: 1 | 2 | 3; shortName: string; onOpen: OpenAngler; popover: boolean; me: boolean }) {
  const name = angler.name ?? 'Pescar';
  const score = podiumScoreText(angler);
  const big = rank === 1;
  return (
    <li className={cn('flex min-w-0 flex-1 flex-col', RISE, RISE_DELAY[rank])} data-rank={rank} data-popover-anchor>
      <AnglerLink
        angler={angler}
        rank={rank}
        onOpen={onOpen}
        popover={popover}
        label={`Locul ${rank}: ${name}, ${score}${me ? ' (tu)' : ''}`}
        className={cn(
          'group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-t-control pt-1 outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent md:gap-1',
          // The hero's card: the surface, the medal wash at its top, a lift on hover.
          'md:rounded-card md:bg-surface md:bg-linear-to-b md:to-surface md:to-55% md:px-4 md:shadow-e1 md:transition-shadow md:duration-(--duration-fast) md:hover:shadow-e2',
          me ? 'md:inset-ring-2 md:inset-ring-accent' : null,
          CARD_WASH[rank],
          CARD_PAD[rank],
        )}
      >
        <span className={cn('relative md:mb-3 md:rounded-full md:p-1', FACE_RING[rank])}>
          <Avatar name={name} src={angler.avatarUrl} size={big ? 48 : 44} tone="solid" ring className="shadow-e1 md:hidden" />
          <Avatar name={name} src={angler.avatarUrl} size={64} tone="solid" ring className={cn('shadow-e1 max-md:hidden', big ? 'md:size-22' : 'md:size-18')} />
          {/* The medal chip, astride the face's ring (the hero only; the phone's step carries the digit). */}
          <span aria-hidden className={cn('absolute -bottom-2.5 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full t-label tabular-nums ring-2 ring-surface max-md:hidden', MEDAL[rank])}>
            {rank}
          </span>
          {me ? (
            <span aria-hidden className="absolute -right-1.5 -bottom-1 rounded-full bg-accent-ink px-1.5 t-micro-strong text-on-accent ring-2 ring-surface">
              EU
            </span>
          ) : null}
        </span>
        <span className="max-w-full truncate t-micro-strong text-ink group-hover:underline md:hidden">{shortName}</span>
        <span className="max-w-full truncate t-body-strong text-ink group-hover:underline max-md:hidden xl:t-heading">{name}</span>
        {/* The weight in accent, its unit apart (rule 10); nothing weighed: the catches the order
            rests on, muted (podiumScoreText) — never «0 kg» on a medal. */}
        {isWeighed(angler.totalKg) ? (
          <span className="whitespace-nowrap text-accent-ink" data-testid="podium-score">
            <span className={cn('t-label tabular-nums', big ? 'md:t-display' : 'md:t-stat')}>{fmtKg(angler.totalKg)}</span>
            <span className="ml-1 t-micro md:t-label md:text-muted">kg</span>
          </span>
        ) : (
          <span className="t-label text-muted tabular-nums md:t-heading" data-testid="podium-score">
            {score}
          </span>
        )}
        <span className="t-caption text-muted max-md:hidden">{anglerSubtitle(angler)}</span>
        <span className={cn('flex w-full items-center justify-center rounded-t-control t-body-strong md:hidden', STEP[rank], MEDAL[rank])}>
          <span className="sr-only">Locul </span>
          {rank}
        </span>
      </AnglerLink>
    </li>
  );
}

/**
 * The hero's left half (from 768): the period's name, its three figures (partide · pescari ·
 * capturi; D1: no kg), and the viewer's place when they are ranked.
 */
function PeriodSummary({ period, totals, pill }: { period: StatsPeriod; totals: PeriodTotals; pill: ReactNode }) {
  const cells = [
    { key: 'partide', value: totals.partide, label: pluralNoun(totals.partide, 'partidă', 'partide') },
    { key: 'anglers', value: totals.anglers, label: pluralNoun(totals.anglers, 'pescar', 'pescari') },
    { key: 'catches', value: totals.catches, label: pluralNoun(totals.catches, 'captură', 'capturi') },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-6 max-md:hidden" data-testid="ranking-summary">
      <div className="flex flex-col gap-1.5">
        <p className="t-eyebrow text-accent-ink uppercase">{PERIOD_TITLE[period]}</p>
        <p className="t-title2 text-ink">Cine a prins cel mai mult în comunitate</p>
      </div>
      <dl aria-label={`${PERIOD_TITLE[period]}, pe scurt`} className="flex flex-wrap gap-x-8 gap-y-4">
        {cells.map((c, i) => (
          <div key={c.key} className={cn('flex flex-col-reverse gap-1', i > 0 && 'border-l border-accent-tint-2 pl-8')}>
            <dt className="t-label text-muted">{c.label}</dt>
            <dd className="t-hero text-ink tabular-nums">{c.value.toLocaleString('ro-RO')}</dd>
          </div>
        ))}
      </dl>
      {pill}
    </div>
  );
}

type PeriodTotals = { partide: number; anglers: number; catches: number };

export function Podium({
  top3,
  onOpen,
  popover,
  meUid,
  period,
  totals,
  pill,
}: {
  top3: TopAngler[];
  onOpen: OpenAngler;
  popover: boolean;
  meUid: string | null;
  /** The period the figures belong to (useShownPeriod): the hero's eyebrow. */
  period: StatsPeriod;
  totals: PeriodTotals;
  /** The viewer's place (MePill) in the hero, from 768; null when unknown / not ranked. */
  pill: ReactNode;
}) {
  const [first, second, third] = top3;
  if (!first) return null;
  const names = podiumNames(top3);
  return (
    <div
      className={cn(
        'overflow-hidden rounded-card bg-surface px-4.5 pt-4 shadow-e0',
        'md:grid md:gap-8 md:rounded-bento md:border md:border-accent-tint-2 md:bg-linear-to-br md:from-accent-tint md:to-surface md:p-8 md:shadow-none lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 xl:px-12 xl:py-10',
      )}
      data-testid="podium"
    >
      <PeriodSummary period={period} totals={totals} pill={pill} />
      <ol aria-label="Podium" className="mx-auto flex max-w-140 items-end gap-2.25 md:w-full md:max-w-180 md:gap-4 xl:gap-5">
        {second ? <Column angler={second} rank={2} shortName={names[1]} onOpen={onOpen} popover={popover} me={second.uid === meUid} /> : <li aria-hidden className="flex-1" />}
        <Column angler={first} rank={1} shortName={names[0]} onOpen={onOpen} popover={popover} me={first.uid === meUid} />
        {third ? <Column angler={third} rank={3} shortName={names[2]} onOpen={onOpen} popover={popover} me={third.uid === meUid} /> : <li aria-hidden className="flex-1" />}
      </ol>
    </div>
  );
}

/** The podium's grey shape (its own geometry, so nothing moves when the data lands): fish's steps on a phone, the hero band from 768. */
export function PodiumSkeleton() {
  const steps = [STEP[2], STEP[1], STEP[3]];
  const avatars = ['size-11', 'size-12', 'size-11'];
  return (
    <>
      <div aria-hidden className="rounded-card bg-surface px-4.5 pt-4 shadow-e0 md:hidden">
        <div className="mx-auto flex max-w-140 items-end gap-2.25">
          {steps.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={cn('animate-shimmer rounded-full', avatars[i])} />
              <span className="h-2.5 w-14 animate-shimmer rounded-full" />
              <span className="h-3 w-12 animate-shimmer rounded-full" />
              <span className={cn('w-full animate-shimmer rounded-t-control', h)} />
            </div>
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="grid gap-8 rounded-bento border border-accent-tint-2 bg-linear-to-br from-accent-tint to-surface p-8 max-md:hidden lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 xl:px-12 xl:py-10"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <span className="h-3 w-28 animate-shimmer rounded-full" />
            <span className="h-5 w-72 max-w-full animate-shimmer rounded-full" />
          </div>
          <div className="flex gap-8">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col gap-2">
                <span className="h-11 w-20 animate-shimmer rounded-full" />
                <span className="h-3 w-12 animate-shimmer rounded-full" />
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-180 items-end gap-4 xl:gap-5">
          {[2, 1, 3].map((r) => (
            <div key={r} className={cn('flex flex-1 flex-col items-center gap-2 rounded-card bg-surface px-4 shadow-e1', CARD_PAD[r as 1 | 2 | 3])}>
              <span className={cn('mb-3 animate-shimmer rounded-full', r === 1 ? 'size-24' : 'size-20')} />
              <span className="h-4 w-28 animate-shimmer rounded-full" />
              <span className="h-6 w-20 animate-shimmer rounded-full" />
              <span className="h-3 w-32 animate-shimmer rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
