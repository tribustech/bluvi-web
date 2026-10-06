'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon } from '@heroicons/react/24/outline';
import { signInPath } from '@/components/nav/items';
import { FishIcon } from '@/components/icons/brand';
import { LIST_GUTTER, LiveDot } from '@/components/templates/T1';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { BentoTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import {
  cardRankingLabel,
  enrolledLabel,
  entrantsLine,
  formatCount,
  formatKg,
  formatTotalKg,
  heroStack,
  type HeroCardPick,
  type HeroPick,
  type Moment,
} from '@/core/competitions';
import { anglerHref, routes } from '@/lib/routes';
import type { PulseTracker } from '../analytics';
import type { Pulse } from './usePulse';

/*
 * The three cards above the list: one competition, one person, one number — fish
 * features/competitions/components/pulse/PulseBento.tsx (+ HeroStack, HeroCard, MomentCard,
 * CountTile, FollowInviteCard, BentoSkeleton). Shown only on Viitoare with scope all and nothing
 * searched or filtered (the caller decides, parity pulse.c1).
 *
 * Layout: the phone keeps fish's column (hero, then person + count side by side, then the invite).
 * From 768 the hero takes the wide left track and the two tiles stack in the right one, so the
 * bento uses the width instead of stretching three phone cards across it. Every channel is the
 * content column's one gutter (LIST_GUTTER), so the bento's lines continue into the cards below.
 * The tiles are the kit's bento tiles (BentoTile, Fundații §07).
 *
 * Interaction (Fundații §06): pressing a card or tile dims it to .7; the hero darkens its scrim on
 * hover, the person tile deepens its tint, the count tile and the invite lift their fill.
 */

const GRID = cn('grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]', LIST_GUTTER);
/** The two tiles: side by side on the phone, stacked in the right track from 768. */
const TILES = cn('grid grid-cols-2 md:row-span-2 md:grid-cols-1', LIST_GUTTER);
/** fish HERO_CARD_HEIGHT 260; from 768 the hero fills its track (the two tiles beside it). */
const HERO_H = 'h-65 md:h-full md:min-h-65';
/** fish TILE_HEIGHT 188. TODO(kit): named size tokens for the bento's spec heights (260 / 188). */
const TILE_MIN_H = 'min-h-47';
/** The follow invite's footprint (44px badge + padding, a two-line caption): its skeleton's height. */
const INVITE_H = 'h-22';

export function PulseBento({
  pulse,
  seed,
  isAuthenticated,
  tracker,
  onOpenLive,
  onOpenStartingSoon,
}: {
  pulse: Pulse;
  /** The stack's shuffle, drawn once per visit by the server (the same order on both renders). */
  seed: number;
  isAuthenticated: boolean;
  tracker: PulseTracker;
  onOpenLive: () => void;
  onOpenStartingSoon: () => void;
}) {
  const { hero, moment, loading, liveCount, startingSoonCount, faces, followedLiveCount, followedLiveKnown } = pulse;
  // Loaded and genuinely empty is the only case that hides the bento (c1).
  if (!hero && !loading.hero) return null;
  const tilesLoading = loading.person || loading.count;
  // Only on a settled answer: a pending or failed followed-live read never claims «you follow none».
  // It waits for the count (live + followed-live), never for the person. Signed out there is no
  // card at all (rule 4b-4: we don't know what a visitor follows).
  const invite = isAuthenticated && !loading.count && liveCount > 0 && followedLiveKnown && followedLiveCount === 0;
  // Something is live and the followed-live read is still out: the invite's row is held, so its
  // landing never pushes the list down.
  const invitePending = isAuthenticated && loading.count && liveCount > 0;

  return (
    <section aria-label="Pulsul concursurilor" aria-busy={loading.hero || tilesLoading || undefined} className={GRID}>
      {/* One footprint loading and loaded: the hero spans both rows beside the stacked tiles (and
          their skeleton), as PulseSkeleton draws it; only a lone count tile leaves it one row. */}
      <div className={cn('min-w-0', (tilesLoading || moment) && 'md:row-span-2')}>
        {hero ? (
          <HeroStack pick={hero} seed={seed} tracker={tracker} />
        ) : (
          // Sized to what lands: two or more live competitions become a stack with a dots row.
          // (From 768 the dots ride inside the card, so no row is reserved for them there.)
          <div aria-hidden className="flex h-full flex-col gap-2.5">
            <span className={cn('block animate-shimmer rounded-bento md:row-span-2', HERO_H)} />
            {liveCount > 1 ? <span className="block h-1.5 md:hidden" /> : null}
          </div>
        )}
      </div>
      {tilesLoading ? (
        // Person and count reveal together: two equal skeletons until both are known (c2).
        <div aria-hidden className={TILES}>
          <span className={cn('block animate-shimmer rounded-bento', TILE_MIN_H)} />
          <span className={cn('block animate-shimmer rounded-bento', TILE_MIN_H)} />
        </div>
      ) : (
        <div className={moment ? TILES : cn('grid grid-cols-1', LIST_GUTTER)}>
          {moment ? <MomentTile moment={moment} isAuthenticated={isAuthenticated} tracker={tracker} /> : null}
          <CountTile
            liveCount={liveCount}
            startingSoonCount={startingSoonCount}
            faces={faces}
            onPress={() => {
              tracker.countTilePress({ live: liveCount });
              (liveCount > 0 ? onOpenLive : onOpenStartingSoon)();
            }}
          />
        </div>
      )}
      {invite ? (
        <div className="md:col-span-2">
          <FollowInvite liveCount={liveCount} onPress={onOpenLive} />
        </div>
      ) : invitePending ? (
        <span aria-hidden className={cn('block animate-shimmer rounded-bento md:col-span-2', INVITE_H)} />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Hero stack                                                          */
/* ------------------------------------------------------------------ */

/** fish INTERVAL_MS: ambient, and four cards still come round in twenty seconds. */
const INTERVAL_MS = 5000;

/**
 * fish HeroStack: every live competition (and my imminent start) as a horizontal stack, the next
 * card peeking at the edge, a dots row tracking the position (c7). It advances every 5 s while the
 * page is visible; the first touch — pointer, wheel, key, focus — stops it for the visit; hiding
 * the page pauses it and showing it again resumes it unless stopped (c8). One card: a plain card,
 * no pager, no dots (c9). The leading card is the impression (c24).
 */
function HeroStack({ pick, seed, tracker }: { pick: HeroPick; seed: number; tracker: PulseTracker }) {
  const cards = useMemo(() => heroStack(pick, seed), [pick, seed]);
  const count = cards.length;
  const lead = cards[0];
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [visible, setVisible] = useState(true);
  // A resting pointer pauses (never stops) the advance: the card never changes under the cursor.
  const [hovered, setHovered] = useState(false);

  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!lead || reported.current === lead.competition.documentId) return;
    reported.current = lead.competition.documentId;
    tracker.heroImpression({ competitionId: lead.competition.documentId, kind: lead.kind });
  }, [lead, tracker]);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (count < 2 || stopped || !visible || hovered || !el) return;
    // Reduced motion: no auto-advance at all (WCAG 2.2.2 / 2.3.3) — the arrows and a swipe still move.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      const stride = strideOf(el);
      if (!stride) return;
      const next = (Math.round(el.scrollLeft / stride) + 1) % count;
      el.scrollTo({ left: next * stride, behavior: 'smooth' });
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [count, stopped, visible, hovered]);

  if (count < 2) {
    return <HeroCard pick={lead} tracker={tracker} />;
  }

  const stop = () => setStopped(true);
  const go = (delta: number) => {
    const el = scroller.current;
    const stride = el ? strideOf(el) : 0;
    if (!el || !stride) return;
    stop();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = (Math.round(el.scrollLeft / stride) + delta + count) % count;
    el.scrollTo({ left: next * stride, behavior: reduce ? 'auto' : 'smooth' });
  };
  const dots = (
    <span aria-hidden className="flex items-center justify-center gap-1.5">
      {cards.map((c, i) => (
        <span
          key={c.competition.documentId}
          className={cn(
            'h-1.5 rounded-full bg-navy transition-[width,opacity] duration-(--duration-medium) ease-medium md:bg-lavender',
            i === active ? 'w-4 opacity-100' : 'w-1.5 opacity-30 md:opacity-50',
          )}
        />
      ))}
    </span>
  );
  return (
    <div
      className="relative flex h-full flex-col gap-2.5"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        ref={scroller}
        onPointerDown={stop}
        onWheel={stop}
        onKeyDown={stop}
        onFocus={stop}
        onScroll={(e) => {
          const stride = strideOf(e.currentTarget);
          if (stride) setActive(Math.min(count - 1, Math.round(e.currentTarget.scrollLeft / stride)));
        }}
        // Phone: each page is 40px narrower than the slot (fish PEEK), so the next card always shows;
        // the trailing spacer lets the last page reach the left edge. From 768 the arrows and dots
        // say there is more, so each page is the whole slot (no clipped photo strip beside the tiles).
        className="flex min-h-0 flex-1 snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] after:w-7.5 after:shrink-0 after:content-[''] md:after:hidden [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c, i) => (
          <div key={c.competition.documentId} className="w-[calc(100%-(--spacing(10)))] shrink-0 snap-start md:w-full">
            <HeroCard pick={c} tracker={tracker} peeking={i !== active} />
          </div>
        ))}
      </div>
      {/* Phone: the dots row under the stack (fish). Decoration: the cards are what assistive tech
          moves between (c8). */}
      <div className="md:hidden">{dots}</div>
      {/* From 768: out of the flow (the hero ends level with the tiles), on the active card's CTA
          row, left of its arrow (16 padding + 20 arrow + 12), with the arrows a pointer needs. */}
      <div className="absolute right-12 bottom-2.5 z-above hidden items-center gap-1.5 md:flex">
        <button type="button" aria-label="Concursul anterior" onClick={() => go(-1)} className={STACK_ARROW}>
          <ChevronLeftIcon aria-hidden className="size-4" />
        </button>
        {dots}
        <button type="button" aria-label="Concursul următor" onClick={() => go(1)} className={STACK_ARROW}>
          <ChevronRightIcon aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** The stack's page stride: one page plus the scroller's own gap (measured, never restated). */
function strideOf(el: HTMLElement): number {
  const first = el.children[0] as HTMLElement | undefined;
  const second = el.children[1] as HTMLElement | undefined;
  if (!first) return 0;
  return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0');
}

const STACK_ARROW = cn(
  'flex size-8 cursor-pointer items-center justify-center rounded-full bg-lavender/15 text-on-photo-scrim',
  'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-lavender/30 active:opacity-70',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-on-photo-scrim',
);

/** fish HeroCard copy (c10–c14), pure. */
function heroCopy({ competition: c, kind, mine, featured }: HeroCardPick) {
  const results = c.results;
  const chip =
    kind === 'live' ? (mine ? 'CONCURSUL TĂU · LIVE' : 'LIVE') : kind === 'next' ? (featured ? 'RECOMANDAT' : mine ? 'CONCURSUL TĂU' : 'ÎN CURÂND') : 'REZULTATE';
  let statLabel: string;
  let statValue: string;
  let statUnit = '';
  let note: string;
  if (kind === 'live') {
    const big = results?.hasCatches && results.biggestFishKg !== null;
    statLabel = big ? 'CEA MAI MARE CAPTURĂ' : 'DE PE BALTĂ';
    statValue = big ? formatKg(results.biggestFishKg as number) : 'Așteptăm prima captură';
    statUnit = big ? 'kg' : '';
    note = `${entrantsLine(c.joinedCount, c.format.unit)} · ${cardRankingLabel(c)}`;
  } else if (kind === 'next') {
    statLabel = enrolledLabel(c.format.unit);
    statValue = String(c.joinedCount);
    statUnit = c.capacity === null ? '' : `/ ${c.capacity}`;
    const pending = c.pendingCount > 0 ? `${c.pendingCount} în așteptare` : null;
    const places = c.placesLeft === null ? null : c.placesLeft > 0 ? formatCount(c.placesLeft, 'loc liber', 'locuri libere') : 'complet';
    note = [c.dateLabel, places, pending].filter(Boolean).join(' · ');
  } else {
    const winner = results?.podium.find((r) => r.position === 1);
    statLabel = winner?.tied ? 'LOCUL 1 LA EGALITATE' : c.format.kind === 'team' ? 'ECHIPA CÂȘTIGĂTOARE' : 'CÂȘTIGĂTOR';
    statValue = winner?.displayName ?? 'Fără capturi';
    note = results?.totalKg != null ? `${formatTotalKg(results.totalKg)} kg cântărite` : c.dateLabel;
  }
  const cta = kind === 'live' ? 'Vezi clasamentul' : kind === 'next' ? 'Vezi concursul' : 'Vezi rezultatele';
  const pill = kind === 'live' ? (results?.hasCatches ? formatCount(results.catchCount, 'captură', 'capturi') : 'Fără capturi') : c.dateLabel;
  return { chip, statLabel, statValue, statUnit, note, cta, pill };
}

/** `peeking`: the next page's sliver beside the active card — from 768 only its photo shows. */
function HeroCard({ pick, tracker, peeking = false }: { pick: HeroCardPick; tracker: PulseTracker; peeking?: boolean }) {
  const { competition: c, kind } = pick;
  const copy = heroCopy(pick);
  const photo = c.lake?.image ?? c.banner;
  // fish onOpenCompetition for every kind: the competition opens on its ranking (its default view).
  const href = routes.competition(c.documentId);
  return (
    <article
      className={cn(
        'group relative isolate flex flex-col justify-between overflow-hidden rounded-bento bg-navy p-4',
        'transition-opacity duration-(--duration-fast) ease-fast active:opacity-70',
        HERO_H,
      )}
    >
      {photo ? (
        <Image
          src={photo.mediumUrl ?? photo.url}
          alt=""
          fill
          // The page's LCP on Viitoare: fetched at once (Next 16: `priority` is deprecated).
          loading="eager"
          fetchPriority="high"
          // The hero's real track: ~440 at 1440+, ~520 at 1280, about half the window from 768.
          sizes="(min-width: 1536px) 440px, (min-width: 1280px) 520px, (min-width: 768px) 50vw, calc(100vw - 32px)"
          className="z-backdrop object-cover"
        />
      ) : null}
      {/* Light at the top (the chips bring their own fills), dark where the copy sits. */}
      <span
        aria-hidden
        className="absolute inset-0 z-behind bg-linear-to-t from-navy via-photo-scrim to-photo-scrim/50 opacity-90 transition-opacity duration-(--duration-fast) ease-fast group-hover:opacity-100"
      />
      <div className={cn('flex items-center justify-between gap-2', PEEK_FADE, peeking && 'md:opacity-0')}>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 t-eyebrow text-on-photo-scrim',
            kind === 'live' ? 'bg-status-live-bg' : 'bg-photo-scrim',
          )}
        >
          {kind === 'live' ? <LiveDot tone="inverse" /> : null}
          {copy.chip}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-photo-chip px-2.5 py-1.5 t-micro-strong text-ink">
          {kind === 'recent' ? (
            <TrophyIcon aria-hidden className="size-3 shrink-0" />
          ) : kind === 'live' ? (
            <FishIcon size={12} className="shrink-0" />
          ) : (
            <CalendarIcon aria-hidden className="size-3 shrink-0" />
          )}
          <span className="truncate">{copy.pill}</span>
        </span>
      </div>
      <div className={cn('flex flex-col gap-1 text-on-photo-scrim', PEEK_FADE, peeking && 'md:opacity-0')}>
        {c.lake ? (
          <p className="flex min-w-0 items-center gap-1 t-caption text-lavender">
            <MapPinIcon aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{c.lake.name}</span>
          </p>
        ) : null}
        <h3 className="line-clamp-2 t-title1 xl:t-title2">
          <Link
            href={href}
            aria-label={`${c.name}. ${copy.cta}`}
            onClick={() => tracker.heroPress({ competitionId: c.documentId, kind })}
            className="outline-none after:absolute after:inset-0 after:rounded-bento after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-solid focus-visible:after:outline-on-photo-scrim"
          >
            {c.name}
          </Link>
        </h3>
        <div className="mt-1.5 flex flex-col gap-px">
          <p className="t-eyebrow text-lavender-3">{copy.statLabel}</p>
          <p className="flex min-w-0 items-baseline gap-1">
            <span className="truncate t-stat">{copy.statValue}</span>
            {copy.statUnit ? <span className="t-label text-lavender-3">{copy.statUnit}</span> : null}
          </p>
          <p className="truncate t-caption text-lavender-3">{copy.note}</p>
        </div>
        <p aria-hidden className="mt-2.5 flex items-center justify-between border-t border-lavender-2/40 pt-2.5 t-body-strong">
          {copy.cta}
          <ArrowRightIcon className="size-5" />
        </p>
      </div>
    </article>
  );
}

const PEEK_FADE = 'transition-opacity duration-(--duration-medium) ease-medium';

/* ------------------------------------------------------------------ */
/* Person, count, invite                                               */
/* ------------------------------------------------------------------ */

/**
 * fish MomentCard + the destination rule (c16–c18): a server person names an angler (signed out →
 * sign-in: the profile is 403 anonymously) or a competition (→ its ranking); the local fallback
 * opens the competition. Until the web has the angler profile (M2, ../angler.ts) an angler opens the
 * moment's competition ranking when it names one, else the tile is not a link (never a 404).
 */
function momentHref(moment: Moment, isAuthenticated: boolean): string | null {
  const d = moment.destination;
  if (d?.type === 'angler') {
    const profile = anglerHref(d.documentId);
    if (!profile) return moment.competitionId ? routes.competitionRanking(moment.competitionId) : null;
    return isAuthenticated ? profile : signInPath(profile);
  }
  if (d?.type === 'competition') return routes.competitionRanking(d.documentId);
  return routes.competition(moment.competitionId);
}

/** fish FACE_CAP: a winning team is up to three. */
const FACE_CAP = 3;

function MomentTile({ moment, isAuthenticated, tracker }: { moment: Moment; isAuthenticated: boolean; tracker: PulseTracker }) {
  const faces = moment.avatarUrls.slice(0, FACE_CAP);
  const href = momentHref(moment, isAuthenticated);
  const label = `${moment.kicker}: ${moment.displayName}${moment.rank ? `, locul ${moment.rank} în top` : ''}`;
  return (
    <BentoTile
      // The person's tint is not a BentoTile tone: it overrides the page fill (and its hover step).
      // TODO(kit): a BentoTile 'tint' tone with a pressable state, instead of these overrides.
      className={cn(
        'relative min-w-0 justify-start bg-accent-tint-2!',
        href && 'hover:bg-accent-tint-3! active:opacity-70',
        'transition-[background-color,opacity] duration-(--duration-fast) ease-fast',
        TILE_MIN_H,
      )}
    >
      {/* Two lines rather than an ellipsis: the kicker («CEA MAI MARE CAPTURĂ») is the tile's meaning. */}
      <p className="line-clamp-2 t-eyebrow text-accent-ink">{moment.kicker}</p>
      <span className="flex overflow-hidden">
        {faces.length ? (
          faces.map((src, i) => (
            <Avatar key={`${src}-${i}`} name={moment.displayName} src={src} size={64} ring className={i ? '-ml-5' : undefined} />
          ))
        ) : (
          <Avatar name={moment.displayName} size={64} tone="indigo" ring />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {href ? (
          <Link
            href={href}
            aria-label={label}
            onClick={() => tracker.momentPress({ competitionId: moment.destination?.documentId ?? moment.competitionId, kicker: moment.kicker })}
            className={cn('line-clamp-2 t-title2 break-words text-ink', STRETCHED_TILE, 'focus-visible:after:outline-accent')}
          >
            {moment.displayName}
          </Link>
        ) : (
          <span className="line-clamp-2 t-title2 break-words text-ink">{moment.displayName}</span>
        )}
        <span className="truncate t-micro text-ink-2">
          {moment.rank ? <span className="t-micro-strong text-accent-ink">{`Locul ${moment.rank}`}</span> : null}
          {moment.rank ? ' · ' : ''}
          {moment.line}
        </span>
      </span>
      <span className="truncate t-micro text-ink-2">{moment.meta}</span>
    </BentoTile>
  );
}

/** The tile's one control, stretched over the whole tile (the kit card pattern). */
const STRETCHED_TILE =
  "outline-none after:absolute after:inset-0 after:rounded-bento after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-solid";

/** fish CountTile (c19, c20): live now, or what starts within a week; faces from the same set. */
function CountTile({
  liveCount,
  startingSoonCount,
  faces,
  onPress,
}: {
  liveCount: number;
  startingSoonCount: number;
  faces: string[];
  onPress: () => void;
}) {
  const live = liveCount > 0;
  const count = live ? liveCount : startingSoonCount;
  return (
    <BentoTile
      tone="navy"
      className={cn('relative min-w-0 justify-start gap-1.5 transition-opacity duration-(--duration-fast) ease-fast hover:opacity-90 active:opacity-70', TILE_MIN_H)}
    >
      <span className="flex items-center gap-1.5">
        {live ? <LiveDot tone="on-accent" /> : null}
        <span className="truncate t-eyebrow text-lavender-2">{live ? 'LIVE' : 'URMĂTOARELE 7 ZILE'}</span>
      </span>
      <SignatureNumber size="tile" tone="lavender" value={count} className="mt-1.5" />
      <button
        type="button"
        onClick={onPress}
        aria-label={live ? `${count} concursuri live` : `${count} concursuri încep în 7 zile`}
        className={cn('line-clamp-2 cursor-pointer text-left t-heading text-on-photo-scrim', STRETCHED_TILE, 'focus-visible:after:outline-lavender')}
      >
        {live ? (count === 1 ? 'concurs live' : 'concursuri live') : count === 1 ? 'concurs începe' : 'concursuri încep'}
      </button>
      <span className="mt-auto flex pt-1">
        <FaceStack people={faces.map((src, i) => ({ name: `Pescar ${i + 1}`, src }))} size={32} />
      </span>
    </BentoTile>
  );
}

/** fish FollowInviteCard (c22): something live, and the viewer follows none of it. */
function FollowInvite({ liveCount, onPress }: { liveCount: number; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Nu urmărești niciun concurs live. Vezi concursurile live."
      // Hover lifts it (the kit card's e2), never fills it with the page's own colour.
      className="flex w-full cursor-pointer items-center gap-3.5 rounded-bento bg-surface p-3.5 text-left shadow-e0 transition-[box-shadow,opacity] duration-(--duration-fast) ease-fast hover:shadow-[var(--shadow-e2),var(--shadow-e0)] active:opacity-70"
    >
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-avatar bg-accent-tint text-accent">
        <EyeIcon className="size-5.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-body-strong text-ink">Nu urmărești niciun concurs live</span>
        <span className="t-caption text-muted">
          {liveCount === 1
            ? 'Unul e LIVE acum. Urmărește-l și ești la curent cu fiecare cântărire.'
            : `${liveCount} sunt LIVE acum. Urmărește unul și ești la curent cu fiecare cântărire.`}
        </span>
      </span>
      <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-faint" />
    </button>
  );
}

/** The bento while the page streams (fish BentoSkeleton), in its loaded footprint. */
export function PulseSkeleton() {
  return (
    <div aria-hidden className={GRID}>
      <span className={cn('block animate-shimmer rounded-bento md:row-span-2', HERO_H)} />
      <div className={TILES}>
        <span className={cn('block animate-shimmer rounded-bento', TILE_MIN_H)} />
        <span className={cn('block animate-shimmer rounded-bento', TILE_MIN_H)} />
      </div>
    </div>
  );
}

