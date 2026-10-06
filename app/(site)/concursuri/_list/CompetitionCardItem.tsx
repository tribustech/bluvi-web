'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { MapPinIcon, TrophyIcon, UserIcon, UsersIcon } from '@heroicons/react/20/solid';
import { CardShell, CardTitle } from '@/components/cards/CardShell';
import { LiveDot } from '@/components/templates/T1';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { FaceStack } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import {
  cardRankingLabel,
  entrantsCount,
  entrantsLine,
  formatCount,
  formatKg,
  formatTotalKg,
  type CardMedia,
  type CompetitionCard,
} from '@/core/competitions';
import { routes } from '@/lib/routes';
import { blurDataUrl } from '@/lib/blurhash';
import { FollowersPill } from './Followers';
import { isMedalPlace, PodiumCup } from '@/components/ranking';

/*
 * The list card of the Concursuri tab — fish features/competitions/components/cards/preview/
 * CompetitionCardPreview.tsx and its three footers. Everything it shows is derived by the server
 * (dateLabel, hoursLabel, rankingLabel, counts, unit, podium); the card formats nothing that
 * depends on a timezone or a ranking rule (parity competitions-list.cards.c19).
 *
 * The whole card is ONE link named by the competition (the kit's stretched CardTitle, c1). The
 * poster and the followers pill are their own controls above it (z-above), as in fish.
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

/** What a tapped poster hands the page's photo viewer (fish onOpenPhoto: the thumb and blurhash too). */
export type PhotoRequest = {
  competition: CompetitionCard;
  url: string;
  /** The card's own (already loaded) thumbnail: drawn first, under the original. */
  thumbnailUrl?: string;
  blurhash?: string | null;
  width?: number;
  height?: number;
};


/** fish: banner small → banner original → lake image small → lake image original (c2). */
function posterOf(c: CompetitionCard) {
  const media: CardMedia | null = c.banner ?? c.lake?.image ?? null;
  const thumb = c.banner?.smallUrl ?? c.banner?.url ?? c.lake?.image?.smallUrl ?? c.lake?.image?.url ?? null;
  return { media, thumb, full: media?.url ?? thumb };
}

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
  onOpenPhoto,
  priority = false,
  aligned = true,
}: {
  competition: CompetitionCard;
  /** Share the grid row's footer line (a subgrid); off for results, where footers differ by rows. */
  aligned?: boolean;
  onOpenPhoto: (photo: PhotoRequest) => void;
  /** The first cards of a list with no bento above them carry the page's LCP image. */
  priority?: boolean;
}) {
  const { media, thumb, full } = posterOf(c);
  const live = c.status === 'started';
  const openPhoto = full
    ? () =>
        onOpenPhoto({
          competition: c,
          url: full,
          thumbnailUrl: thumb ?? undefined,
          blurhash: media?.blurhash ?? null,
          width: media?.width ?? undefined,
          height: media?.height ?? undefined,
        })
    : null;

  return (
    // fish: the compact card sits flat.
    <CardShell interactive className={cn(aligned && CARD_SUBGRID, CARD_STATES)}>
      <div className="flex items-start gap-3 p-3">
        {thumb && openPhoto ? (
          <button
            type="button"
            onClick={openPhoto}
            aria-label={`Vezi imaginea pentru ${c.name}`}
            className="relative z-above size-19 shrink-0 cursor-zoom-in overflow-hidden rounded-avatar bg-soft-fill"
          >
            <Image
              src={thumb}
              alt=""
              fill
              sizes="76px"
              className="object-cover"
              {...blur(media)}
              {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
            />
          </button>
        ) : (
          <span aria-hidden className="size-19 shrink-0 rounded-avatar bg-soft-fill" />
        )}
        <CompactCopy c={c} />
      </div>
      <div className="flex min-w-0 flex-col">
        {c.status === 'notStarted' ? <UpcomingFooter c={c} /> : null}
        {live ? <LiveFooter c={c} /> : null}
        {c.status === 'completed' ? <ResultsFooter c={c} /> : null}
      </div>
    </CardShell>
  );
}

function blur(media: CardMedia | null) {
  const url = blurDataUrl(media?.blurhash);
  return url ? { placeholder: 'blur' as const, blurDataURL: url } : {};
}

/** The name, carrying the card's one link (c1, c7). */
function CardName({ c, className }: { c: CompetitionCard; className: string }) {
  return (
    <CardTitle href={routes.competition(c.documentId)} className={cn('line-clamp-2 text-ink', className)}>
      {c.name}
    </CardTitle>
  );
}

/** The ranking chip and the format chip (c8). */
function Chips({ c }: { c: CompetitionCard }) {
  const team = c.format.kind === 'team';
  return (
    <>
      <Badge color="violet" icon={<TrophyIcon aria-hidden />} className="min-w-0 shrink">
        <span className="truncate">{cardRankingLabel(c)}</span>
      </Badge>
      <Badge color="blue" icon={team ? <UsersIcon aria-hidden /> : <UserIcon aria-hidden />}>
        {team ? 'Echipe' : 'Individual'}
      </Badge>
    </>
  );
}

function LakeLine({ c }: { c: CompetitionCard }) {
  if (!c.lake) return null;
  return (
    <p className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
      <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{c.lake.name}</span>
    </p>
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
          {live ? `LIVE · ${c.dateLabel}` : c.dateLabel}
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

/* ------------------------------------------------------------------ */
/* Footers                                                             */
/* ------------------------------------------------------------------ */

const faces = (urls: string[]) => urls.map((src, i) => ({ name: `Participant ${i + 1}`, src }));

/**
 * fish UpcomingFooter (c13). The row is at least a face tall (min-h-8) whether or not faces show. The
 * footer fills its subgrid track (flex-1) with the row at its top: footers in one grid row share their
 * divider line, and a taller neighbour's slack lands at the bottom edge, not around this row.
 */
function UpcomingFooter({ c }: { c: CompetitionCard }) {
  return (
    <div className="flex-1 border-t border-hairline px-3 py-2.5">
      <div className="flex min-h-8 items-center gap-2.5">
        <FaceStack people={faces(c.participantFaces)} size={32} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="t-label text-ink">
            {c.capacity !== null ? `${c.joinedCount}/${c.capacity} ${c.format.unit}` : entrantsCount(c.joinedCount, c.format.unit)}
          </p>
          {c.pendingCount > 0 ? <p className="t-micro text-muted">{c.pendingCount} în așteptare</p> : null}
        </div>
        {c.placesLeft !== null && c.placesLeft > 0 ? (
          <p className="shrink t-label text-status-success-fg">{formatCount(c.placesLeft, 'loc liber', 'locuri libere')}</p>
        ) : null}
      </div>
    </div>
  );
}

function FooterNote({ children }: { children: ReactNode }) {
  // The same divider and rhythm as every other footer (the results' empty note).
  return <p className="flex-1 border-t border-hairline px-3 py-2.5 t-caption text-muted">{children}</p>;
}

/** fish LiveFooter (c14). */
function LiveFooter({ c }: { c: CompetitionCard }) {
  const r = c.results;
  if (!r) return <FooterNote>Statisticile nu sunt disponibile.</FooterNote>;
  if (!r.hasCatches) return <FooterNote>Încă nu sunt capturi înregistrate.</FooterNote>;
  return (
    <div className="flex flex-1 flex-col">
      {c.joinedCount ? (
        <div className="flex min-h-8 items-center gap-2 border-t border-hairline px-3 pt-2.5 pb-3">
          <FaceStack people={faces(c.participantFaces)} size={32} />
          <p className="min-w-0 flex-1 truncate t-caption text-muted">{entrantsLine(c.joinedCount, c.format.unit)}</p>
        </div>
      ) : null}
      <StatRow
        stats={[
          { key: 'capturi', value: String(r.catchCount), label: 'capturi', icon: <FishIcon size={16} className="text-accent" /> },
          ...(r.totalKg !== null
            ? [{ key: 'kg', value: formatTotalKg(r.totalKg), unit: 'kg', label: 'cântărite', icon: <ScaleIcon size={16} className="text-accent" /> }]
            : []),
          ...(r.biggestFishKg !== null
            ? [
                {
                  key: 'cmmc',
                  value: formatKg(r.biggestFishKg),
                  unit: 'kg',
                  label: 'CMMC',
                  // fish's brown Award (#A1531F, the award token); heroicons has no award glyph, so the trophy shape.
                  icon: <TrophyIcon aria-hidden className="size-4 text-award" />,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

type Stat = { key: string; value: string; unit?: string; label: string; icon: ReactNode };

/** fish CardStatRow: equal centred columns, the icon on the figure's line, near-black figures (c15). */
function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex px-3 pb-3">
      {stats.map((s) => (
        <div key={s.key} className="flex flex-1 flex-col-reverse items-center gap-1">
          <dt className="t-micro text-muted">{s.label}</dt>
          <dd className="flex items-center gap-1">
            <span aria-hidden className="flex">
              {s.icon}
            </span>
            <span className="t-num-18 text-ink">
              {s.value}
              {s.unit ? <span className="ml-0.5 t-micro-strong">{s.unit}</span> : null}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** fish ResultsFooter (c16, c17). */
function ResultsFooter({ c }: { c: CompetitionCard }) {
  const r = c.results;
  const rows = r?.hasCatches ? [...r.podium].sort((a, b) => a.position - b.position) : [];
  if (!rows.length) {
    return (
      <div className="flex-1 border-t border-hairline px-3 py-2">
        <p className="t-caption text-muted">
          {!r ? 'Rezultatele nu sunt disponibile.' : !r.hasCatches ? 'Fără capturi înregistrate.' : 'Deschide concursul pentru clasament.'}
        </p>
      </div>
    );
  }
  // Two overlapping faces only when some row has a pair, so names within one card line up.
  const pair = rows.some((row) => row.avatarUrls.length > 1);
  return (
    <ol aria-label={`Podium ${c.name}`} className="flex flex-col gap-0.5 border-t border-hairline px-3 py-2">
      {rows.map((row, i) => {
        const shared = row.tied || rows.filter((o) => o.position === row.position).length > 1;
        const people = row.avatarUrls.length
          ? row.avatarUrls.slice(0, 2).map((src) => ({ name: row.displayName, src }))
          : [{ name: row.displayName }];
        return (
          <li
            key={`${row.position}-${row.displayName}-${i}`}
            // The winner's row: the gold attribute tint (badge-yellow), not the warning status colour.
            // TODO(kit): a --bluvi-podium-1 tint with the podium medal tokens.
            className={cn('flex items-center gap-2.5 rounded-control px-2 py-1', row.position === 1 && 'bg-badge-yellow-bg')}
          >
            <span className={cn('flex shrink-0 items-center', pair ? 'w-13' : 'w-8')}>
              <FaceStack people={people} size={32} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              {/* One line per name (a team's two names wrapped in the narrow 1280 columns, growing the
                  winner's band and breaking the row's alignment); the whole name in the tooltip. */}
              <span title={row.displayName} className="truncate t-body-strong text-ink">
                {row.displayName}
              </span>
              {row.clubName || row.standName ? (
                <span className="t-micro text-muted">
                  {[row.clubName, row.standName ? `Stand ${row.standName}` : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {shared ? <span className="t-micro text-muted">La egalitate</span> : null}
            </span>
            <span className="flex w-8 shrink-0 justify-center">
              {isMedalPlace(row.position) ? (
                <PodiumCup place={row.position} />
              ) : (
                <span className="t-body-strong text-muted">
                  <span className="sr-only">Locul </span>
                  {row.position}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
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
