'use client';

import Image from 'next/image';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { CardShell } from '@/components/cards/CardShell';
import { Pill } from '@/components/cards/parts';
import { cn } from '@/components/ui/cn';
import { cardDateLabel, dateWithHours, type CardMedia, type CompetitionCard } from '@/core/competitions';
import { blurDataUrl } from '@/lib/blurhash';
import { FollowersPill } from '../Followers';
import { posterFrame } from '../posterFit';
import { StatusFooter } from './footers';
import { blur, CardName, Chips, posterOf } from './parts';

/*
 * The /concursuri card at every width — fish's POSTER card (CompetitionCardPreview, expanded
 * density; the owner's pick 2026-10-06, prototype app/dev/hub FishCard.tsx PosterCard):
 *  - the poster across the top with «● LIVE» and the followers pill on the photo. From 768 the frame
 *    is a SQUARE: a near-square poster fills it, any other is shown whole over its blurhash bands
 *    (stretched, darkened). On the phone the frame takes fish's natural ratio clamped to 0.55–2.4
 *    (../posterFit.ts), the poster shown whole when clamped. The poster is part of the card: a
 *    click on it opens the competition like the rest of the card — no photo viewer (owner
 *    2026-10-08, unlike fish's onOpenPhoto);
 *  - the date in small caps with the ranking and format chips on the same row, the name (the
 *    card's ONE link, the kit's stretched CardTitle → /concursuri/[id]), the lake and organizer;
 *  - the footer under a hairline: fish's Upcoming / Live / Results footer for the card's status
 *    (./footers), or the caller's own.
 * In an aligned grid it is a two-row subgrid (body, footer) of the grid, so every footer divider in
 * a grid row starts at the same height (use POSTER_ITEM on the <li>, POSTER_GRID on the <ul>).
 */

/** The card in the list grid: a body row and a footer row of the grid's own tracks. */
export const CARD_SUBGRID = 'row-span-2 grid min-w-0 grid-rows-subgrid gap-y-0';

/** The list item around one card: aligned → the subgrid; else it hugs its own content. */
export function posterItemClass(aligned = true) {
  return aligned ? CARD_SUBGRID : 'min-w-0 self-start';
}

/**
 * The poster cards' grid: 1 column on the phone, 2 from 768, 3 from 1280, 4 from 1800 (prototype
 * scoreboard). Rows are the cards' own two tracks (subgrid) — `auto` rows, no fixed heights.
 */
export const POSTER_GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5 min-[1800px]:grid-cols-4';

const CARD_STATES = cn(
  // overflow-visible: the stretched title's focus ring sits 2px outside the card.
  'overflow-visible transition-[box-shadow,opacity] has-[a:active]:opacity-70',
);

export type PosterCardProps = {
  competition: CompetitionCard;
  /** The first cards of a list with nothing above them carry the page's LCP image. */
  priority?: boolean;
  /** Share the grid row's footer line (a subgrid). Off where footers differ a lot (podiums). */
  aligned?: boolean;
  /** Replaces fish's status footer (a tab's own footer). Each row brings its own hairline. */
  footer?: ReactNode;
  /** Extra classes on the card surface (e.g. a tab's «new weighing» flash). */
  className?: string;
};

export function PosterCard({ competition: c, priority = false, aligned = true, footer, className }: PosterCardProps) {
  const { media, thumb } = posterOf(c);
  const live = c.status === 'started';
  return (
    <CardShell elevated interactive className={cn(aligned && CARD_SUBGRID, CARD_STATES, className)}>
      <div className="flex min-w-0 flex-col">
        {thumb ? (
          <PosterFrame
            c={c}
            media={media}
            src={media?.mediumUrl ?? media?.url ?? thumb}
            priority={priority}
          />
        ) : (
          // No poster: the two chips come back inline rather than disappearing (fish c11).
          <div className="flex items-center gap-1.5 px-4 pt-4">
            {live ? <Pill tone="live">LIVE</Pill> : null}
            <FollowersPill viewers={c.viewers} competitionId={c.documentId} />
          </div>
        )}
        <PosterCopy c={c} />
      </div>
      <div className="flex min-w-0 flex-col">{footer ?? <StatusFooter c={c} />}</div>
    </CardShell>
  );
}

function PosterFrame({
  c,
  media,
  src,
  priority,
}: {
  c: CompetitionCard;
  media: CardMedia | null;
  src: string;
  priority: boolean;
}) {
  // The DTO's pixel size, else the decoded image (older uploads have none).
  const [decoded, setDecoded] = useState<number | null>(null);
  const dtoRatio = media?.width && media?.height ? media.width / media.height : null;
  const frame = posterFrame(dtoRatio ?? decoded);
  const hash = blurDataUrl(media?.blurhash);
  // The bands (the poster's own blur, stretched and darkened) only where the poster is shown whole.
  const bands = cn(frame.phoneContain ? 'block' : 'hidden', frame.squareContain ? 'md:block' : 'md:hidden');
  const live = c.status === 'started';
  return (
    <div
      style={{ '--poster-ratio': String(frame.phoneRatio) } as CSSProperties}
      className="relative aspect-(--poster-ratio) overflow-hidden rounded-t-card border-b border-hairline bg-ink md:aspect-square"
    >
      {hash ? (
        <span
          aria-hidden
          className={cn('absolute -inset-4 bg-cover bg-center blur-md brightness-75', bands)}
          style={{ backgroundImage: `url(${hash})` }}
        />
      ) : (
        <Image src={src} alt="" aria-hidden fill sizes="40vw" className={cn('scale-110 object-cover opacity-70 blur-xl brightness-75', bands)} />
      )}
      {/* Under the card's stretched link (owner 2026-10-08): a click on the poster opens the competition. */}
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1800px) 25vw, (min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
        className={cn(frame.phoneContain ? 'object-contain' : 'object-cover', frame.squareContain ? 'md:object-contain' : 'md:object-cover')}
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setDecoded(img.naturalWidth / img.naturalHeight);
        }}
        {...blur(media)}
        {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
      />
      <div className="absolute top-3 right-3 z-above flex items-center gap-1.5">
        {live ? <Pill tone="live">LIVE</Pill> : null}
        <FollowersPill viewers={c.viewers} competitionId={c.documentId} onPhoto />
      </div>
    </div>
  );
}

function PosterCopy({ c }: { c: CompetitionCard }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <p className="shrink-0 pt-0.5 t-eyebrow text-accent-ink uppercase">{c.status === 'notStarted' ? dateWithHours(c) : cardDateLabel(c)}</p>
        {/* Wraps instead of truncating: a long ranking name takes a second row, right-aligned. */}
        <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-1.5">
          <Chips c={c} />
        </div>
      </div>
      <CardName c={c} className="t-title1 xl:t-title2" />
      {c.lake || c.organizer ? (
        <p className="flex min-w-0 items-center gap-1.5">
          {c.lake ? (
            <span className="flex min-w-0 shrink items-center gap-1 t-label text-accent-ink">
              <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{c.lake.name}</span>
            </span>
          ) : null}
          {c.lake && c.organizer ? <span aria-hidden className="size-1 shrink-0 rounded-full bg-faint" /> : null}
          {c.organizer ? <span className="min-w-0 truncate t-caption text-muted">{c.organizer.username}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The poster card's bones while a list loads: the same list item and two-row subgrid, a square
 * poster from 768 (4:3 on the phone, where the real poster then takes its own ratio — accepted).
 */
export function PosterCardSkeleton() {
  return (
    <li aria-hidden className={CARD_SUBGRID}>
      <CardShell elevated className={CARD_SUBGRID}>
        <span className="flex flex-col">
          <span className="block aspect-4/3 animate-shimmer md:aspect-square" />
          <span className="flex flex-col gap-2.5 p-4">
            <span className="h-2.5 w-28 rounded-full bg-soft-fill" />
            <span className="h-5 w-4/5 rounded-full bg-soft-fill" />
            <span className="h-3 w-1/2 rounded-full bg-soft-fill" />
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

/** A grid of poster cards (the default content of a tab, results mode and «Toate concursurile»). */
export function PosterGrid({
  cards,
  labelledBy,
  priorityCount = 0,
}: {
  cards: CompetitionCard[];
  labelledBy?: string;
  /** How many of the first posters load eagerly (the page's LCP when nothing sits above them). */
  priorityCount?: number;
}) {
  // Podium footers (one to six rows) hug their content: no shared footer line once a row has one.
  const aligned = !cards.some((c) => c.status === 'completed');
  return (
    <ul aria-labelledby={labelledBy} className={POSTER_GRID}>
      {cards.map((c, i) => (
        <li key={c.documentId} className={posterItemClass(aligned)}>
          <PosterCard competition={c} aligned={aligned} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

/** The poster grid's bones (role=status, spoken once). */
export function PosterGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Se încarcă concursurile…</span>
      <ul aria-hidden className={POSTER_GRID}>
        {Array.from({ length: count }, (_, i) => (
          <PosterCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
