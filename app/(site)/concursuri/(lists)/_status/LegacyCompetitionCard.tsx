'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { MapPinIcon, UserIcon } from '@heroicons/react/20/solid';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { CardShell, CardTitle } from '@/components/cards/CardShell';
import { Eyebrow, Pill } from '@/components/cards/parts';
import { ListGrid } from '@/components/templates/T1';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { legacyListCard, type CompetitionListItem } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { blurDataUrl } from '@/lib/blurhash';
import { FollowersPill } from '../../_list/Followers';

/*
 * fish components/CompetitionCard.tsx, `compact` — the card of the global status lists (parity
 * competitions-list.viitoare / .live / .incheiate c8–c14). These lists read the LEGACY list DTO
 * (/feed/competitions — registrations, no results), and their criteria are fish's compact legacy
 * card (poster, faces + «{n}/{limit} pescari», green format and yellow ranking badges), which the
 * Concursuri tab's CompetitionCardItem (card DTO, stat / podium footers) does not draw. It is built
 * from the kit parts — CardShell + stretched CardTitle, Eyebrow for the date, the round LIVE Pill
 * and the scrim followers pill over the photo, Avatar / FaceStack, Badge.
 * TODO(kit): a CompetitionCard `variant="poster"` (faces, a pending line, the contained poster above) —
 * then this goes; promoting it is a components/cards change outside this screen's files.
 *
 *  - c9 the poster: banner, else the lake's first image, in its small format, 120px tall on a phone
 *    (fish imageHeight, compact), 16:10 from 768 — always shown WHOLE (contain) over a blurred copy
 *    of the same file, as fish does (a printed fee or rules on a poster is never cropped); its
 *    blurhash is the placeholder. A competition with no picture gets a quiet trophy band;
 *  - c10 over it: LIVE + the followers pill on a live competition, the followers pill otherwise —
 *    the pill opens the followers list (its own control above the card's link, after it in the
 *    tab order);
 *  - c11 the date (getDisplayedDate, upper-cased; WEB: an en dash between the two days), c12 the
 *    name on up to two lines, the lake, the faces of registered then pending entrants (a nameless
 *    entrant is a neutral person glyph, never invented initials) and
 *    «{registered}/{limit, else 21} pescari|echipe»;
 *  - c13 «{n} în așteptare» in orange on an upcoming competition with pending registrations;
 *  - c14 the format badge (green) and the ranking type (yellow); they wrap like fish's badge row and
 *    a label longer than the card is cut with an ellipsis (its full text in the title).
 * The whole card is one link named by the competition (the kit's stretched CardTitle, c8).
 *
 * Row rhythm: each card is four rows of the grid's own tracks (CSS subgrid: poster · date + name +
 * lake · people · badges), so a row's sections line up across its cards and each section is only
 * as tall as its tallest card needs — no reserved name line or empty faces line. The grid's 10px
 * row gap is the gap between the sections too. The skeleton below is drawn from the same classes.
 */

/** A card: four rows of the grid (see StatusGrid). */
const ITEM = 'row-span-4 grid min-w-0 grid-rows-subgrid';
/** CardShell is a flex column; here it is the subgrid itself (grid! wins over the shell's flex). */
const CARD = 'row-span-4 grid! grid-rows-subgrid';
/** The poster band: 120px on a phone (fish), 16:10 from 768. */
const POSTER = 'relative h-30 overflow-hidden rounded-t-card bg-soft-fill md:h-auto md:aspect-16/10';
const TOP = 'flex min-w-0 flex-col gap-1 px-2.5';
const PEOPLE = 'flex min-w-0 flex-col gap-2 px-2.5';
const PEOPLE_ROW = 'flex min-w-0 flex-col gap-1 md:flex-row md:flex-wrap md:items-center md:gap-x-2';
const BADGES = 'flex min-w-0 flex-wrap content-start gap-1 px-2.5 pb-3';
/** The poster's sizes hint: half the phone width; 220–300px columns from 768. */
const POSTER_SIZES = '(min-width: 1280px) 320px, (min-width: 768px) 260px, 50vw';

/** fish prints «SÂM, 10 - DUM, 11 OCT»; on the web a range takes an en dash (parity c11). */
const dateRange = (label: string) => label.replace(' - ', ' – ');

/**
 * The date: fish's full label on every width — it fits a phone column for a range within a month
 * (≈130px of 144 at 375); a longer one (across months, or with the year) wraps as in fish.
 */
function DateLine({ label }: { label: string }) {
  return <Eyebrow>{dateRange(label)}</Eyebrow>;
}

type Face = { name: string; avatarUrl: string | null };

/**
 * The entrants' faces (24px, a quarter overlap). The kit FaceStack makes initials from the name;
 * the legacy DTO often has no name for an entrant (participants: []), so a nameless face without a
 * photo is a person glyph on soft-fill instead of «PA» from a placeholder.
 * TODO(kit): FaceStack `anonymous` faces (components/ui) — then this is FaceStack again.
 */
function Faces({ faces, overflow }: { faces: Face[]; overflow: number }) {
  if (faces.every(f => f.name)) {
    return <FaceStack size={24} people={faces.map(f => ({ name: f.name, src: f.avatarUrl }))} overflow={overflow} />;
  }
  return (
    <div aria-hidden className="flex items-center *:not-first:-ml-1.5">
      {faces.map((f, i) =>
        f.name || f.avatarUrl ? (
          <Avatar key={i} name={f.name || 'Participant'} src={f.avatarUrl} size={24} ring />
        ) : (
          <span key={i} className="box-border inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-surface bg-soft-fill text-muted">
            <UserIcon className="size-3.5" />
          </span>
        ),
      )}
      {overflow > 0 ? (
        <span className="box-border inline-flex h-6 shrink-0 items-center rounded-full border-2 border-surface bg-soft-fill px-2 text-facestack-24 font-extrabold text-ink-2 tabular-nums">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function Poster({ src, blurhash, priority }: { src: string; blurhash: string | null; priority: boolean }) {
  const blur = blurDataUrl(blurhash);
  const eager = priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {};
  return (
    <>
      {/* The fill behind the poster (fish blurredBackgroundForContain): the same file and sizes as the
          poster (one download), saturated so it reads as a fill. */}
      <Image src={src} alt="" aria-hidden fill sizes={POSTER_SIZES} className="scale-125 object-cover blur-2xl saturate-150" />
      <Image
        src={src}
        alt=""
        fill
        sizes={POSTER_SIZES}
        className="object-contain transition-transform duration-(--duration-medium) ease-medium group-hover:scale-103 motion-reduce:transform-none"
        {...(blur ? { placeholder: 'blur' as const, blurDataURL: blur } : {})}
        {...eager}
      />
    </>
  );
}

export function LegacyCompetitionCard({ competition: c, priority = false }: { competition: CompetitionListItem; priority?: boolean }) {
  const card = legacyListCard(c);
  const live = c.competitionStatus === 'started';
  return (
    <li className={ITEM}>
      <CardShell
        elevated
        interactive
        // overflow-visible: the stretched title's focus ring sits 2px outside the card; pressing the
        // link dims the card (fish pressStyle opacity .7) on the §06 fast motion.
        className={cn(CARD, 'group overflow-visible transition-[box-shadow,opacity] duration-(--duration-fast) ease-fast has-[a:active]:opacity-70')}
      >
        <div className={POSTER} data-poster>
          {card.poster ? (
            <Poster src={card.poster.src} blurhash={card.poster.blurhash} priority={priority} />
          ) : (
            // No banner and no lake photo: a designed band, not a picture that failed to load.
            <span aria-hidden className="absolute inset-0 flex items-center justify-center text-muted">
              <TrophyIcon className="size-8" />
            </span>
          )}
        </div>

        <div className={TOP}>
          <DateLine label={card.dateLabel} />
          <CardTitle
            href={routes.competition(c.documentId)}
            className="line-clamp-2 t-body-strong text-ink transition-colors duration-(--duration-fast) ease-fast group-hover:text-accent-ink"
          >
            {c.name}
          </CardTitle>
          {c.lake?.name ? (
            <p className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
              <MapPinIcon aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{c.lake.name}</span>
            </p>
          ) : null}
        </div>

        <div className={PEOPLE}>
          <div aria-hidden className="h-px bg-hairline" />
          <div className={PEOPLE_ROW}>
            {card.faces.length > 0 || card.facesOverflow > 0 ? <Faces faces={card.faces} overflow={card.facesOverflow} /> : null}
            <div className="flex min-w-0 flex-col">
              <p className="truncate t-label whitespace-nowrap text-accent-ink">{card.entrantsLabel}</p>
              {card.pendingLabel ? <p className="truncate t-label whitespace-nowrap text-status-pending-fg">{card.pendingLabel}</p> : null}
            </div>
          </div>
        </div>

        <div className={BADGES}>
          <Badge color="green">{card.formatLabel}</Badge>
          {card.rankingLabel ? (
            // Wraps to its own line when the pair does not fit; longer than the card, it is cut.
            <Badge color="yellow" className="max-w-full overflow-hidden">
              <span title={card.rankingLabel} className="min-w-0 truncate">
                {card.rankingLabel}
              </span>
            </Badge>
          ) : null}
        </div>

        {/* Over the poster, after the card's link in the DOM: the link is the card's first tab stop. */}
        <div className="absolute top-2 left-2 flex max-w-[calc(100%-(--spacing(4)))] flex-nowrap items-center gap-1">
          {live ? <Pill tone="live">LIVE</Pill> : null}
          <FollowersPill viewers={c.viewers} competitionId={c.documentId} onPhoto />
        </div>
      </CardShell>
    </li>
  );
}

/**
 * The grid of the status lists: the T1 ListGrid with fish's two columns on a phone (numColumns 2),
 * 220px minimum columns from 768 to 1279 (three at 768, four at 1024 — more columns as the screen
 * grows, never wider cards; ROADMAP §4) and the kit's 240 from 1280, the sibling lists' 10px row
 * gap — which is also the gap between a card's four subgrid rows.
 * TODO(kit): a ListGrid / ListSkeleton `phoneColumns={2}` prop and an `xs` minimum.
 */
export const STATUS_GRID_CLASS = 'gap-y-2.5 max-md:grid-cols-2 md:max-xl:grid-cols-[repeat(auto-fill,minmax(--spacing(55),1fr))]';

export function StatusGrid({ labelledBy, children }: { labelledBy?: string; children: ReactNode }) {
  return (
    <ListGrid min="sm" labelledBy={labelledBy} className={STATUS_GRID_CLASS}>
      {children}
    </ListGrid>
  );
}

const bar = 'rounded-full bg-soft-fill';

/**
 * fish CompetitionsListSkeleton, drawn from the card's own classes (the four subgrid rows) in the
 * same grid — a one-line name and the lake line, a face and the count, two badges: the common card,
 * so the first row does not move when the cards land. TODO(kit): ListSkeleton `card` slot.
 */
export function StatusListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" data-testid="status-list-skeleton">
      <span className="sr-only">Se încarcă concursurile…</span>
      <div aria-hidden>
        <StatusGrid>
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className={ITEM}>
              <CardShell elevated className={CARD}>
                <span className={cn(POSTER, 'block animate-shimmer')} />
                <span className={TOP}>
                  <span className="flex h-3.5 items-center">
                    <span className={cn(bar, 'h-2.5 w-20')} />
                  </span>
                  <span className="flex h-5 items-center xl:h-5.5">
                    <span className={cn(bar, 'h-3.5 w-[80%]')} />
                  </span>
                  <span className="flex h-4 items-center">
                    <span className={cn(bar, 'h-3 w-[45%]')} />
                  </span>
                </span>
                <span className={PEOPLE}>
                  <span className="h-px bg-hairline" />
                  <span className={PEOPLE_ROW}>
                    <span className="flex h-6 items-center">
                      <span className="size-6 animate-shimmer rounded-full" />
                    </span>
                    <span className="flex h-4 items-center">
                      <span className={cn(bar, 'h-3 w-16')} />
                    </span>
                  </span>
                </span>
                <span className={BADGES}>
                  <span className="h-5 w-16 rounded-badge bg-soft-fill" />
                  <span className="h-5 w-14 rounded-badge bg-soft-fill" />
                </span>
              </CardShell>
            </li>
          ))}
        </StatusGrid>
      </div>
    </div>
  );
}
