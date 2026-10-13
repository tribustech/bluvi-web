'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { ArrowRightIcon, ChevronRightIcon, EyeIcon } from '@heroicons/react/24/outline';
import { signInPath } from '@/components/nav/items';
import { FishIcon } from '@/components/icons/brand';
import { LiveDot } from '@/components/templates/T1';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
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
import { competitionUrlId, anglerHref, routes } from '@/lib/routes';
import type { PulseTracker } from '../analytics';
import type { Pulse } from './usePulse';

/*
 * The phone's bento (below 768) — fish features/competitions/components/pulse/PulseBento.tsx with
 * HeroStack, HeroCard, MomentCard, CountTile, FollowInviteCard and BentoSkeleton, at fish's sizes:
 * the hero 260 high (radius 18), the person and count tiles side by side at 188 (padding 14), 10
 * apart, the follow invite under them. Shown on Viitoare with scope «all» and nothing searched or
 * filtered (the caller decides, parity competitions-list.pulse c1). From 768 the approved Viitoare
 * keeps its own blocks (../tabs/UpcomingTab).
 *
 * Web differences, as small as the web allows: each card is ONE link (the competition, the
 * person's destination) or button (the count tile, the invite); the stack scrolls with CSS scroll
 * snap instead of a native pager, its dots follow the scroll position.
 */

/** fish HERO_CARD_HEIGHT 260 / TILE_HEIGHT 188, radius 18. */
const HERO_H = 'h-65';
const TILE_MIN_H = 'min-h-47';
const RADIUS = 'rounded-[18px]';

export function PhoneBento({
  pulse,
  isAuthenticated,
  tracker,
  onOpenLive,
  onOpenStartingSoon,
}: {
  pulse: Pulse;
  isAuthenticated: boolean;
  tracker: PulseTracker;
  onOpenLive: () => void;
  onOpenStartingSoon: () => void;
}) {
  const { hero, moment, loading, liveCount, startingSoonCount, faces, followedLiveCount, followedLiveKnown } = pulse;
  // fish: loaded and genuinely empty is the only case that hides the bento (c1).
  if (!hero && !loading.hero) return null;
  const tilesLoading = loading.person || loading.count;
  // fish FollowInviteCard: something live and the viewer follows none of it. Only on a settled
  // answer (never «you follow none» from a pending read); signed out we do not know (rule 4b-4).
  const invite = isAuthenticated && !loading.count && liveCount > 0 && followedLiveKnown && followedLiveCount === 0;

  return (
    <section aria-label="Pulsul concursurilor" aria-busy={loading.hero || tilesLoading || undefined} className="flex flex-col gap-2.5">
      {hero ? (
        <HeroStack pick={hero} tracker={tracker} />
      ) : (
        // Sized to what lands: two or more live competitions become a stack with a dots row.
        <div aria-hidden className="flex flex-col gap-2.5">
          <span className={cn('block animate-shimmer', RADIUS, HERO_H)} />
          {liveCount > 1 ? <span className="block h-1.5" /> : null}
        </div>
      )}
      {tilesLoading ? (
        // The person and the count reveal together (c2).
        <div aria-hidden className="grid grid-cols-2 gap-2.5">
          <span className={cn('block animate-shimmer', RADIUS, TILE_MIN_H)} />
          <span className={cn('block animate-shimmer', RADIUS, TILE_MIN_H)} />
        </div>
      ) : (
        <div className={cn('grid gap-2.5', moment ? 'grid-cols-2' : 'grid-cols-1')}>
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
      {invite ? <FollowInvite liveCount={liveCount} onPress={onOpenLive} /> : null}
    </section>
  );
}

/** While the page streams: fish BentoSkeleton in the bento's loaded footprint. */
export function PhoneBentoSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2.5">
      <span className={cn('block animate-shimmer', RADIUS, HERO_H)} />
      <div className="grid grid-cols-2 gap-2.5">
        <span className={cn('block animate-shimmer', RADIUS, TILE_MIN_H)} />
        <span className={cn('block animate-shimmer', RADIUS, TILE_MIN_H)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero stack                                                          */
/* ------------------------------------------------------------------ */

/** fish INTERVAL_MS. */
const INTERVAL_MS = 5000;

/**
 * fish HeroStack: every live competition (and my imminent start) as a horizontal stack, each page
 * 40 narrower than the slot (PEEK) so the next card's edge shows, the dots tracking the position.
 * It advances every 5 s while the page is visible; the first touch stops it for the visit. One
 * card: a plain card, no dots. The leading card is the impression.
 */
function HeroStack({ pick, tracker }: { pick: HeroPick; tracker: PulseTracker }) {
  // fish draws the seed once per mount, into a ref (a re-render must never reshuffle the stack).
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const cards = useMemo(() => heroStack(pick, seed), [pick, seed]);
  const count = cards.length;
  const lead = cards[0];
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [visible, setVisible] = useState(true);

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
    if (count < 2 || stopped || !visible || !el) return;
    // Reduced motion: no auto-advance (WCAG 2.2.2); a swipe still moves it.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      const stride = strideOf(el);
      if (!stride) return;
      const next = (Math.round(el.scrollLeft / stride) + 1) % count;
      el.scrollTo({ left: next * stride, behavior: 'smooth' });
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [count, stopped, visible]);

  if (count < 2) return <HeroCard pick={lead} tracker={tracker} />;

  const stop = () => setStopped(true);
  return (
    <div className="flex flex-col gap-2.5">
      <div
        ref={scroller}
        onPointerDown={stop}
        onTouchStart={stop}
        onWheel={stop}
        onKeyDown={stop}
        onFocus={stop}
        onScroll={(e) => {
          const stride = strideOf(e.currentTarget);
          if (stride) setActive(Math.min(count - 1, Math.round(e.currentTarget.scrollLeft / stride)));
        }}
        // Each page is 40 narrower than the slot (fish PEEK); the trailing spacer (PEEK − GAP) lets
        // the last page reach the left edge.
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] after:w-7.5 after:shrink-0 after:content-[''] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c) => (
          <div key={c.competition.documentId} className="w-[calc(100%-(--spacing(10)))] shrink-0 snap-start">
            <HeroCard pick={c} tracker={tracker} />
          </div>
        ))}
      </div>
      {/* Decoration: the cards are what assistive tech moves between. fish Dot: 6 high, 18 wide when
          active, 6 and faded otherwise. */}
      <span aria-hidden className="flex items-center justify-center gap-1.5">
        {cards.map((c, i) => (
          <span
            key={c.competition.documentId}
            className={cn(
              'h-1.5 rounded-full bg-navy transition-[width,opacity] duration-(--duration-medium) ease-medium',
              i === active ? 'w-4.5 opacity-100' : 'w-1.5 opacity-30',
            )}
          />
        ))}
      </span>
    </div>
  );
}

/** The stack's page stride: one page plus the scroller's gap (measured). */
function strideOf(el: HTMLElement): number {
  const first = el.children[0] as HTMLElement | undefined;
  const second = el.children[1] as HTMLElement | undefined;
  if (!first) return 0;
  return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0');
}

/** fish HeroCard copy, pure. */
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

/** fish HeroCard: the lake photo, the scrim, the two chips on top and the copy at the bottom. */
function HeroCard({ pick, tracker }: { pick: HeroCardPick; tracker: PulseTracker }) {
  const { competition: c, kind } = pick;
  const copy = heroCopy(pick);
  // fish: the lake photo first, then the banner.
  const photo = c.lake?.image ?? c.banner;
  return (
    <article className={cn('group relative isolate flex flex-col justify-between overflow-hidden bg-navy p-4 active:opacity-90', RADIUS, HERO_H)}>
      {photo ? (
        <Image
          src={photo.mediumUrl ?? photo.url}
          alt=""
          fill
          // The phone's LCP on Viitoare: fetched at once.
          loading="eager"
          fetchPriority="high"
          sizes="calc(100vw - 72px)"
          className="z-backdrop object-cover"
        />
      ) : null}
      {/* fish's scrim: light at the top (the chips bring their own fills), dark where the copy sits. */}
      <span aria-hidden className="absolute inset-0 z-behind bg-linear-to-b from-hero-scrim-top via-hero-scrim-mid via-60% to-hero-scrim-end" />
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 t-hero-chip text-on-photo-scrim',
            kind === 'live' ? 'bg-status-live-bg' : 'bg-photo-scrim',
          )}
        >
          {kind === 'live' ? <span aria-hidden className="size-1.75 rounded-full bg-on-photo-scrim" /> : null}
          {copy.chip}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.25 rounded-full bg-photo-chip px-2.5 py-1.5 t-micro-strong text-ink">
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
      <div className="flex flex-col gap-0.75 text-on-photo-scrim">
        {c.lake ? (
          <p className="flex min-w-0 items-center gap-1 t-hero-lake text-hero-lake">
            <MapPinIcon aria-hidden className="size-3 shrink-0" />
            <span className="truncate">{c.lake.name}</span>
          </p>
        ) : null}
        <h3 className="line-clamp-2 t-hero-title">
          <Link
            href={routes.competition(competitionUrlId(c))}
            aria-label={`${c.name}. ${copy.cta}`}
            onClick={() => tracker.heroPress({ competitionId: c.documentId, kind })}
            className="outline-none after:absolute after:inset-0 after:rounded-[18px] after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-solid focus-visible:after:outline-on-photo-scrim"
          >
            {c.name}
          </Link>
        </h3>
        <div className="mt-1.5 flex flex-col gap-px">
          <p className="t-micro-strong tracking-[0.8px] text-hero-soft">{copy.statLabel}</p>
          <p className="flex min-w-0 items-baseline gap-0.75">
            <span className="truncate t-stat">{copy.statValue}</span>
            {copy.statUnit ? <span className="t-label text-hero-soft">{copy.statUnit}</span> : null}
          </p>
          <p className="truncate t-caption text-hero-soft">{copy.note}</p>
        </div>
        <p aria-hidden className="mt-2.5 flex items-center justify-between border-t border-hero-rule pt-2.5 t-body-strong">
          {copy.cta}
          <ArrowRightIcon className="size-4.5" />
        </p>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Person, count, invite                                               */
/* ------------------------------------------------------------------ */

/**
 * fish MomentCard's destination: a server person names an angler (signed out → sign-in: the
 * profile is 403 anonymously) or a competition (→ its ranking); the local fallback opens the
 * competition. An angler profile the web does not have yet opens the moment's ranking instead.
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

/** The tile's one control, stretched over the whole tile. */
const STRETCHED =
  "outline-none after:absolute after:inset-0 after:rounded-[18px] after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-solid";

/** fish MomentCard: the lavender tile, the kicker, 64 faces, the name, the place and the meta. */
function MomentTile({ moment, isAuthenticated, tracker }: { moment: Moment; isAuthenticated: boolean; tracker: PulseTracker }) {
  const faces = moment.avatarUrls.slice(0, FACE_CAP);
  const href = momentHref(moment, isAuthenticated);
  const label = `${moment.kicker}: ${moment.displayName}${moment.rank ? `, locul ${moment.rank} în top` : ''}`;
  return (
    <div className={cn('relative flex min-w-0 flex-col gap-2.5 bg-accent-tint-2 p-3.5 active:opacity-80', RADIUS, TILE_MIN_H)}>
      <p className="truncate t-micro-strong tracking-[1px] text-accent-ink">{moment.kicker}</p>
      <span className="flex overflow-hidden">
        {faces.length ? (
          faces.map((src, i) => (
            <Avatar key={`${src}-${i}`} name={moment.displayName} src={src} size={64} ring className={i ? '-ml-5' : undefined} />
          ))
        ) : (
          <Avatar name={moment.displayName} size={64} tone="solid" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {href ? (
          <Link
            href={href}
            aria-label={label}
            onClick={() => tracker.momentPress({ competitionId: moment.destination?.documentId ?? moment.competitionId, kicker: moment.kicker })}
            className={cn('line-clamp-2 t-moment-name break-words text-ink', STRETCHED, 'focus-visible:after:outline-accent')}
          >
            {moment.displayName}
          </Link>
        ) : (
          <span className="line-clamp-2 t-moment-name break-words text-ink">{moment.displayName}</span>
        )}
        <span className="truncate t-micro text-ink-2">
          {moment.rank ? <span className="t-micro-strong text-accent-ink">{`Locul ${moment.rank}`}</span> : null}
          {moment.rank ? ' · ' : ''}
          {moment.line}
        </span>
      </span>
      <span className="truncate t-micro text-ink-2">{moment.meta}</span>
    </div>
  );
}

/** fish CountTile: navy, «● LIVE», the 64px number, «concursuri live», the faces at the bottom. */
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
    <div className={cn('relative flex min-w-0 flex-col gap-1.5 bg-navy p-3.5 active:opacity-85', RADIUS, TILE_MIN_H)}>
      <span className="flex items-center gap-1.5">
        {live ? <LiveDot tone="on-accent" /> : null}
        <span className="truncate t-micro-strong tracking-[1px] text-lavender-2">{live ? 'LIVE' : 'URMĂTOARELE 7 ZILE'}</span>
      </span>
      <span aria-hidden className="mt-1.5 t-count-hero text-lavender">
        {count}
      </span>
      <button
        type="button"
        onClick={onPress}
        aria-label={live ? `${count} concursuri live` : `${count} concursuri încep în 7 zile`}
        className={cn('line-clamp-2 cursor-pointer text-left t-count-caption text-on-photo-scrim', STRETCHED, 'focus-visible:after:outline-lavender')}
      >
        {live ? (count === 1 ? 'concurs live' : 'concursuri live') : count === 1 ? 'concurs începe' : 'concursuri încep'}
      </button>
      <span className="mt-auto flex">
        <FaceStack people={faces.map((src, i) => ({ name: `Pescar ${i + 1}`, src }))} size={32} />
      </span>
    </div>
  );
}

/** fish FollowInviteCard: white, the 44 eye badge, two lines, the chevron. */
function FollowInvite({ liveCount, onPress }: { liveCount: number; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Nu urmărești niciun concurs live. Vezi concursurile live."
      className={cn('flex w-full cursor-pointer items-center gap-3.5 bg-surface p-3.5 text-left active:opacity-85', RADIUS)}
    >
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-accent-tint text-accent">
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
      <ChevronRightIcon aria-hidden className="size-4.5 shrink-0 text-faint" />
    </button>
  );
}
