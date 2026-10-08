'use client';

import Image from 'next/image';
import { CardShell } from '@/components/cards/CardShell';
import { LiveDot } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { cardDateLabel, type CompetitionCard } from '@/core/competitions';
import { blur, CardName, Chips, LakeLine, posterOf } from './cards/parts';
import { StatusFooter } from './cards/footers';
import { FollowersPill } from './Followers';

/*
 * The list card of the Concursuri tab — fish features/competitions/components/cards/preview/
 * CompetitionCardPreview.tsx (compact «Listă»), with its three footers (./cards/footers). The
 * /concursuri tabs use the poster card (./cards/PosterCard); this one stays for the lake page. Everything it shows is derived by the server
 * (dateLabel, hoursLabel, rankingLabel, counts, unit, podium); the card formats nothing that
 * depends on a timezone or a ranking rule (parity competitions-list.cards.c19).
 *
 * The whole card is ONE link named by the competition (the kit's stretched CardTitle, c1), poster
 * included: a click on the poster opens the competition, no photo viewer (owner 2026-10-08, unlike
 * fish). The followers pill is its own control above it (z-above).
 *
 * Surface: the kit CardShell (e0) in its `interactive` mode: hover and
 * keyboard focus inside lift it to e2 (the kit's states; the card never takes the page's colour),
 * pressing its link dims it to .7. In Viitoare and Live, it is a two-row subgrid (body,
 * footer) of the list's grid (`aligned`), so within a grid row every footer divider starts at the
 * same height; each footer's content sits right under its divider and any slack of the track falls
 * below it, at the card's bottom edge (never an empty band in the middle of the card). Results cards
 * (podium footers of one to six rows) are not aligned: each hugs its own content. One density: fish's
 * compact «Listă» card (the owner dropped the Listă / Afiș toggle, 2026-10-06).
 */

/** The card in the list grid: a body row and a footer row of the grid's own tracks (see above). */
export const CARD_SUBGRID = 'row-span-2 grid min-w-0 grid-rows-subgrid gap-y-0';

/** The list item around one card: aligned → the subgrid; results → hugs its content. */
export function cardItemClass(aligned: boolean) {
  return aligned ? CARD_SUBGRID : 'min-w-0 self-start';
}

const CARD_STATES = cn(
  // overflow-visible: the stretched title's focus ring sits 2px outside the card.
  'overflow-visible transition-[box-shadow,opacity] has-[a:active]:opacity-70',
);

export function CompetitionCardItem({
  competition: c,
  priority = false,
  aligned = true,
}: {
  competition: CompetitionCard;
  /** Share the grid row's footer line (a subgrid); off for results, where footers differ by rows. */
  aligned?: boolean;
  /** The first cards of a list with no bento above them carry the page's LCP image. */
  priority?: boolean;
}) {
  const { media, thumb } = posterOf(c);

  return (
    // fish: the compact card sits flat.
    <CardShell interactive className={cn(aligned && CARD_SUBGRID, CARD_STATES)}>
      <div className="flex items-start gap-3 p-3">
        {thumb ? (
          <span className="relative size-19 shrink-0 overflow-hidden rounded-avatar bg-soft-fill">
            <Image
              src={thumb}
              alt=""
              fill
              sizes="76px"
              className="object-cover"
              {...blur(media)}
              {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
            />
          </span>
        ) : (
          <span aria-hidden className="size-19 shrink-0 rounded-avatar bg-soft-fill" />
        )}
        <CompactCopy c={c} />
      </div>
      <div className="flex min-w-0 flex-col">
        <StatusFooter c={c} />
      </div>
    </CardShell>
  );
}

function CompactCopy({ c }: { c: CompetitionCard }) {
  const live = c.status === 'started';
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {/* The pill rides the date line, so the name below keeps the full width (fish). */}
      <div className="flex min-h-5.5 items-center gap-1.5">
        {live ? <LiveDot /> : null}
        <p className={cn('min-w-0 flex-1 truncate t-label', live ? 'text-live' : 'text-accent-ink uppercase')}>
          {live ? `LIVE · ${cardDateLabel(c)}` : cardDateLabel(c)}
        </p>
        <FollowersPill viewers={c.viewers} competitionId={c.documentId} />
      </div>
      <CardName c={c} className="t-heading" />
      <LakeLine c={c} />
      <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
        <Chips c={c} />
      </div>
    </div>
  );
}

/**
 * Same footprint as a card while the first page loads (fish CompetitionsListSkeleton): the kit
 * CardShell, in the same list item and two-row subgrid as the real cards, so the bones' rows match
 * theirs. The footer is the upcoming footer's height (a face row, min-h-8 on the real card too), so
 * nothing moves when the cards land.
 */
export function CardSkeleton() {
  return (
    <li aria-hidden className={CARD_SUBGRID}>
      <CardShell className={CARD_SUBGRID}>
        <span className="flex gap-3 p-3">
          <span className="size-19 shrink-0 animate-shimmer rounded-avatar" />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className="h-2.5 w-24 rounded-full bg-soft-fill" />
            <span className="h-4 w-4/5 rounded-full bg-soft-fill" />
            <span className="h-3 w-2/5 rounded-full bg-soft-fill" />
            <span className="h-5 w-32 rounded-badge bg-soft-fill" />
          </span>
        </span>
        <span className="flex min-h-8 items-center gap-2.5 border-t border-hairline px-3 py-2.5">
          <span className="size-8 animate-shimmer rounded-full" />
          <span className="h-3 w-24 rounded-full bg-soft-fill" />
        </span>
      </CardShell>
    </li>
  );
}
