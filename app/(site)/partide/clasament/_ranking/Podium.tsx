'use client';

import { MEDAL } from '@/components/ranking';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { firstNameOf, fmtKg, isWeighed, type TopAngler } from '@/core/partide';
import { podiumScoreText } from '@/app/(site)/ape-publice/_components/venue/bits';
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

function Column({ angler, rank, shortName, onOpen, popover, me }: { angler: TopAngler; rank: 1 | 2 | 3; shortName: string; onOpen: OpenAngler; popover: boolean; me: boolean }) {
  const name = angler.name ?? 'Pescar';
  const score = podiumScoreText(angler);
  const big = rank === 1;
  return (
    <li className="flex min-w-0 flex-1 flex-col" data-rank={rank} data-popover-anchor>
      <AnglerLink
        angler={angler}
        rank={rank}
        onOpen={onOpen}
        popover={popover}
        label={`Locul ${rank}: ${name}, ${score}${me ? ' (tu)' : ''}`}
        className="group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-t-control pt-1 outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent md:gap-2"
      >
        <span className="relative">
          <Avatar name={name} src={angler.avatarUrl} size={big ? 48 : 44} tone="solid" ring className="shadow-e1 md:hidden" />
          <Avatar name={name} src={angler.avatarUrl} size={big ? 64 : 48} tone="solid" ring className="shadow-e1 max-md:hidden" />
          {me ? (
            <span aria-hidden className="absolute -right-1.5 -bottom-1 rounded-full bg-accent-ink px-1.5 t-micro-strong text-on-accent ring-2 ring-surface">
              EU
            </span>
          ) : null}
        </span>
        <span className="max-w-full truncate t-micro-strong text-ink group-hover:underline md:t-body-strong">{shortName}</span>
        {/* The weight in accent, its unit apart (rule 10); nothing weighed: the catches the order
            rests on, muted (podiumScoreText) — never «0 kg» on a medal. */}
        {isWeighed(angler.totalKg) ? (
          <span className="whitespace-nowrap text-accent-ink" data-testid="podium-score">
            <span className="t-label tabular-nums md:t-heading">{fmtKg(angler.totalKg)}</span>
            <span className="ml-1 t-micro md:t-caption">kg</span>
          </span>
        ) : (
          <span className="t-label text-muted tabular-nums md:t-body-strong" data-testid="podium-score">
            {score}
          </span>
        )}
        <span className={cn('flex w-full items-center justify-center rounded-t-control t-body-strong md:t-title2', STEP[rank], MEDAL[rank])}>
          <span className="sr-only">Locul </span>
          {rank}
        </span>
      </AnglerLink>
    </li>
  );
}

export function Podium({ top3, onOpen, popover, meUid }: { top3: TopAngler[]; onOpen: OpenAngler; popover: boolean; meUid: string | null }) {
  const [first, second, third] = top3;
  if (!first) return null;
  const names = podiumNames(top3);
  return (
    <div className="overflow-hidden rounded-card bg-surface px-4.5 pt-4 shadow-e0 md:px-8 md:pt-7" data-testid="podium">
      <ol aria-label="Podium" className="mx-auto flex max-w-140 items-end gap-2.25 md:gap-5">
        {second ? <Column angler={second} rank={2} shortName={names[1]} onOpen={onOpen} popover={popover} me={second.uid === meUid} /> : <li aria-hidden className="flex-1" />}
        <Column angler={first} rank={1} shortName={names[0]} onOpen={onOpen} popover={popover} me={first.uid === meUid} />
        {third ? <Column angler={third} rank={3} shortName={names[2]} onOpen={onOpen} popover={popover} me={third.uid === meUid} /> : <li aria-hidden className="flex-1" />}
      </ol>
    </div>
  );
}

/** The podium's grey shape (its own geometry, so nothing moves when the data lands). */
export function PodiumSkeleton() {
  const steps = [STEP[2], STEP[1], STEP[3]];
  const avatars = ['size-11 md:size-12', 'size-12 md:size-16', 'size-11 md:size-12'];
  return (
    <div aria-hidden className="rounded-card bg-surface px-4.5 pt-4 shadow-e0 md:px-8 md:pt-7">
      <div className="mx-auto flex max-w-140 items-end gap-2.25 md:gap-5">
        {steps.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5 md:gap-2">
            <span className={cn('animate-shimmer rounded-full', avatars[i])} />
            <span className="h-2.5 w-14 animate-shimmer rounded-full md:h-4 md:w-20" />
            <span className="h-3 w-12 animate-shimmer rounded-full md:h-5 md:w-16" />
            <span className={cn('w-full animate-shimmer rounded-t-control', h)} />
          </div>
        ))}
      </div>
    </div>
  );
}
