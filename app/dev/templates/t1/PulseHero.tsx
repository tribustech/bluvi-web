import Image from 'next/image';
import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { LIST_GUTTER } from '@/components/templates/T1/ListBody';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { BentoTile, CountTile } from '@/components/ui/BentoTile';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import type { CompetitionCard, PulsePerson } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { competitionImage, lakeLine } from './CompetitionItems';

/*
 * The T1 `hero` region as Concursuri · Descoperă fills it — a reduced fish PulseBento: the hero
 * competition (live first, then the server's featured draw, then the next start), the count tile
 * (live now, or starting within 7 days) and the server-drawn person of the moment
 * (/feed/pulse-person, finished Romanian copy). Only on Viitoare with nothing searched or filtered.
 * The full bento (hero stack, pickHero rungs, freeze-per-mount) belongs to the competitions screen.
 *
 * Layout shift: the caller shows PulseHeroSkeleton until the hero is decided once (no swap), and
 * the second tile's slot is always there — a same-size placeholder while the person loads
 * (`person: undefined`), dropped only on a settled null.
 */

export type PulseData = {
  hero: CompetitionCard | null;
  /** «Recomandat» when the hero is the server's featured draw. */
  featured: boolean;
  liveCount: number;
  startingSoonCount: number;
  faces: string[];
  /** undefined while loading (the slot is held), null when the server has nobody. */
  person: PulsePerson | null | undefined;
};

/**
 * The content column's one gutter (LIST_GUTTER) at every width — the same as the card grid right
 * under the bento, so the vertical channels run on from the tiles into the cards.
 */
const GRID = cn('grid md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]', LIST_GUTTER);
const TILES = cn('grid grid-cols-2 md:grid-cols-1', LIST_GUTTER);

export function PulseHero({ data, onOpenLive }: { data: PulseData; onOpenLive: () => void }) {
  const { hero, featured, liveCount, startingSoonCount, faces, person } = data;
  const live = liveCount > 0;
  return (
    <section aria-label="Pulsul concursurilor" className={GRID}>
      {hero ? <HeroCard competition={hero} featured={featured} /> : null}
      <div className={TILES}>
        <button
          type="button"
          onClick={onOpenLive}
          className="cursor-pointer rounded-bento text-left outline-hidden transition-[filter] duration-(--duration-fast) ease-fast hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
          aria-label={live ? `${liveCount} concursuri live acum, deschide Live` : `${startingSoonCount} concursuri încep în 7 zile, deschide Viitoare`}
        >
          {/* «În desfășurare», not «Live acum»: the hero's LIVE pill is right beside it and the docked
              aside lists «Alte concursuri live» — one LIVE heading per viewport, this tile is the way in. */}
          <CountTile
            className="h-full"
            label={live ? 'În desfășurare' : 'Încep curând'}
            value={live ? liveCount : startingSoonCount}
            caption={
              <span className="flex flex-wrap items-center gap-2">
                {/* Phone: a half-width tile — the short caption, no faces (they wrapped onto a line of their own). */}
                <span className="md:hidden">{live ? 'concursuri' : 'în 7 zile'}</span>
                <span className="hidden md:inline">{live ? 'concursuri acum' : 'în următoarele 7 zile'}</span>
                {faces.length ? (
                  <span className="hidden md:inline-flex">
                    <FaceStack size={24} people={faces.map((src, i) => ({ name: `Pescar ${i + 1}`, src }))} />
                  </span>
                ) : null}
              </span>
            }
          />
        </button>
        {person === undefined ? (
          <span aria-hidden className="block min-h-39 animate-shimmer rounded-bento" />
        ) : person ? (
          <MomentTile person={person} />
        ) : null}
      </div>
    </section>
  );
}

function HeroCard({ competition: c, featured }: { competition: CompetitionCard; featured: boolean }) {
  const href = routes.competition(c.documentId);
  return (
    <article className="relative isolate flex min-h-64 flex-col justify-end overflow-hidden rounded-bento bg-navy p-5 md:row-span-1 xl:min-h-72">
      <Image
        src={competitionImage(c)}
        alt=""
        fill
        // The page's LCP: fetched at once, first (Next 16: `priority` is deprecated).
        loading="eager"
        fetchPriority="high"
        sizes="(min-width: 1280px) 50vw, (min-width: 768px) 50vw, 100vw"
        className="z-backdrop object-cover"
      />
      {/* Ink scrim from the bottom so the copy stays AA over any photo. */}
      <span aria-hidden className="absolute inset-0 z-behind bg-linear-to-t from-photo-scrim via-photo-scrim to-transparent" />
      <div className="absolute top-4 left-4 flex gap-1.5">
        {/* The kit StatusPill, as on every other screen (its opaque tints read on any photo). */}
        {c.status === 'started' ? <StatusPill tone="live">LIVE</StatusPill> : null}
        {featured ? <StatusPill tone="info">Recomandat</StatusPill> : null}
        {c.status === 'notStarted' && !featured ? <StatusPill tone="neutral">Următorul start</StatusPill> : null}
      </div>
      <p className="t-eyebrow text-on-photo-scrim uppercase">{c.hoursLabel ? `${c.dateLabel} · ${c.hoursLabel}` : c.dateLabel}</p>
      <h2 className="t-title1 mt-1 text-on-photo-scrim">
        <Link
          href={href}
          className="outline-none after:absolute after:inset-0 after:rounded-bento after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-solid focus-visible:after:outline-accent"
        >
          {c.name}
        </Link>
      </h2>
      <p className="t-label mt-1.5 flex items-center gap-1 text-on-photo-scrim">
        <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{lakeLine(c)}</span>
      </p>
      {/* The whole card is the link (the h2's stretched anchor); this is its button LOOK only. */}
      <span aria-hidden className={buttonClass({ variant: 'secondary', className: 'mt-4 self-start' })}>
        Vezi concursul
        <span className="flex size-5 items-center justify-center [&>svg]:size-5">
          <ArrowRightIcon />
        </span>
      </span>
    </article>
  );
}

/**
 * The person of the moment, composed from the TOP: the kicker, then the person — the tile's
 * signature — then the meta; any height the tile gets from the count tile beside it falls below
 * the content, never as a void between the kicker and the person.
 *
 * A name is never truncated to a few letters: on the phone's half-width tile the 40 avatar stands
 * above the name, which may take two lines; from 768 (a full-width tile) the avatar sits beside it.
 * The meta is long («Ultimele 30 de zile · 1 concurs»): it waits for the full-width tile.
 * `justify-start!` / `gap-3!`: BentoTile spreads its children (justify-between, gap-2) and cn()
 * does not merge.
 */
function MomentTile({ person }: { person: PulsePerson }) {
  return (
    <BentoTile tone="surface" className="justify-start! gap-3! shadow-e0">
      <p className="t-eyebrow line-clamp-1 text-muted uppercase">{person.kicker}</p>
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <Avatar name={person.displayName} src={person.avatarUrls[0]} size={40} />
        <div className="min-w-0 flex-1">
          <p className="t-heading line-clamp-2 break-words text-ink">{person.displayName}</p>
          <p className="t-caption line-clamp-2 text-muted md:line-clamp-1">{person.line}</p>
        </div>
      </div>
      <p className="t-caption hidden truncate text-muted md:block">{person.meta}</p>
    </BentoTile>
  );
}

/** Same footprint as PulseHero while its lists load (fish BentoSkeleton). */
export function PulseHeroSkeleton() {
  return (
    <div aria-hidden className={GRID}>
      <span className="block min-h-64 animate-shimmer rounded-bento xl:min-h-72" />
      <div className={TILES}>
        <span className="block min-h-39 animate-shimmer rounded-bento" />
        <span className="block min-h-39 animate-shimmer rounded-bento" />
      </div>
    </div>
  );
}
