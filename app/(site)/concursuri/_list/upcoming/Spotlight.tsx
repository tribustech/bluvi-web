'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
  EyeIcon,
  FireIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
} from '@heroicons/react/20/solid';
import { signInPath } from '@/components/nav/items';
import { FishIcon } from '@/components/icons/brand';
import { Avatar } from '@/components/ui/Avatar';
import { BENTO_INK, BentoTile, type BentoTone } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { pulsePeopleQuery, type PulsePerson } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { anglerHref, routes } from '@/lib/routes';
import { SPOTLIGHT_LIMIT, SPOTLIGHT_TITLE_ID, SpotlightFrame, SpotlightSkeleton } from './SpotlightSkeleton';
import s from './upcoming.module.css';

/*
 * «În lumina reflectoarelor» (prototype app/dev/hub Spotlight.tsx): several highlighted anglers,
 * one per criterion of /feed/pulse-person?limit=6 (winner, biggestCatch*, mostPodiums, podiumStreak,
 * mostActive, debutant…) — fish's person tile (MomentCard) as Apple-style bento tiles (§4b.19): the
 * first one big on the navy signature surface, the rest on their own tints. The server ships the
 * finished Romanian copy (kicker, line, meta): nothing here rewrites it. A CMS older than `limit`
 * answers one person, who then has the section alone.
 *
 * Each tile is ONE link to its destination (fish c16–c18): a competition → its ranking; an angler →
 * the profile (signed out → sign-in first, the profile is 403 anonymously) once the web has it (M2,
 * lib/routes ON_WEB.angler) — until then the tile is not a link, never a 404.
 * Unknown is not shown (§4b.4): bones while it reads, nothing when it fails or is empty.
 */

/** Small tiles shown from 768 (two by two). */
const WIDE_SMALL = 4;

const SMALL_TONES: BentoTone[] = ['lavender', 'mint', 'sky', 'amber', 'violet'];

/** The rank badge on the photo, in each surface's own ink (AA). */
const BADGE: Partial<Record<BentoTone, string>> = {
  signature: 'bg-lavender text-navy',
  lavender: 'bg-on-bento-lavender text-on-bento-indigo',
  mint: 'bg-status-success-fg text-on-bento-indigo',
  sky: 'bg-on-bento-sky text-on-bento-indigo',
  amber: 'bg-status-warning-fg text-on-bento-indigo',
  violet: 'bg-on-bento-violet text-on-bento-indigo',
};

function artOf(criterion: string): ReactNode {
  if (criterion.startsWith('biggestCatch')) return <FishIcon size={112} />;
  switch (criterion) {
    case 'winner':
    case 'mostPodiums':
      return <TrophyIcon />;
    case 'podiumStreak':
      return <FireIcon />;
    case 'mostActive':
      return <ArrowTrendingUpIcon />;
    case 'debutant':
      return <SparklesIcon />;
    case 'mostPopular':
      return <EyeIcon />;
    case 'mostCompetitions':
      return <CalendarDaysIcon />;
    default:
      return <StarIcon />;
  }
}

/** Where a tile goes (fish momentHref, server persons only). */
export function spotlightHref(p: PulsePerson, isAuthenticated: boolean): string | null {
  const d = p.destination;
  if (d.type === 'competition') return routes.competitionRanking(d.documentId);
  const profile = anglerHref(d.documentId);
  if (!profile) return null;
  return isAuthenticated ? profile : signInPath(profile);
}

export function Spotlight({
  t,
  isAuthenticated,
  onPress,
}: {
  t: Transport;
  isAuthenticated: boolean;
  onPress?: (p: PulsePerson) => void;
}) {
  const people = useQuery(pulsePeopleQuery(t, SPOTLIGHT_LIMIT));
  if (people.isPending) return <SpotlightSkeleton />;
  if (people.isError) return null;
  return <SpotlightView people={people.data} isAuthenticated={isAuthenticated} onPress={onPress} />;
}

/**
 * The section with its people (nothing when there are none). No reads: the page's static shell
 * (../CompetitionsRoute) draws it from the cached people, the tab from its query.
 */
export function SpotlightView({
  people,
  isAuthenticated,
  onPress,
}: {
  people: PulsePerson[];
  isAuthenticated: boolean;
  onPress?: (p: PulsePerson) => void;
}) {
  if (people.length === 0) return null;
  const [big, ...small] = people;
  // From 768 the small tiles are a 2 × 2 beside the big one (the prototype's bento): a fifth one
  // lives in the phone's shelf only. An odd number left: the last takes the whole row (no orphan).
  const wideCount = Math.min(small.length, WIDE_SMALL);
  const odd = wideCount % 2 === 1;
  return (
    <SpotlightFrame>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-4">
        <SpotTile
          p={big}
          tone="signature"
          big
          href={spotlightHref(big, isAuthenticated)}
          onPress={onPress}
          className={cn('md:col-span-2', small.length > 0 && 'xl:col-span-1')}
        />
        {small.length ? (
          <Shelf>
            {small.map((p, i) => (
              <li
                key={`${p.criterion}:${p.destination.documentId}`}
                className={cn('w-64 shrink-0 md:w-auto', i >= WIDE_SMALL && 'md:hidden', odd && i === wideCount - 1 && 'md:col-span-2')}
              >
                <SpotTile p={p} tone={SMALL_TONES[i % SMALL_TONES.length]} href={spotlightHref(p, isAuthenticated)} onPress={onPress} />
              </li>
            ))}
          </Shelf>
        ) : null}
      </div>
    </SpotlightFrame>
  );
}

/**
 * The small tiles: a horizontally scrolling shelf on the phone, a 2 × 2 grid from 768. While it
 * overflows it is itself a tab stop (arrow keys scroll it): its tiles may all be inert (an angler
 * without a web profile yet), and a scroll region with nothing focusable cannot be reached by
 * keyboard (axe scrollable-region-focusable). Never a stray stop when it does not scroll.
 */
function Shelf({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <ul
      ref={ref}
      aria-labelledby={SPOTLIGHT_TITLE_ID}
      tabIndex={overflows ? 0 : undefined}
      data-spotlight-shelf=""
      className={cn(
        s.rail,
        '-mx-4 flex scroll-px-4 gap-3 overflow-x-auto px-4 md:col-span-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 xl:col-span-1',
        'rounded-bento outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
      )}
    >
      {children}
    </ul>
  );
}

/** The tile's one control, stretched over the whole tile (the kit card pattern). */
const STRETCHED =
  "outline-none after:absolute after:inset-0 after:z-above after:rounded-bento after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-solid focus-visible:after:outline-accent";

/** fish FACE_CAP: a winning team is up to three. */
const FACE_CAP = 3;

function SpotTile({
  p,
  tone,
  big = false,
  href,
  onPress,
  className,
}: {
  p: PulsePerson;
  tone: BentoTone;
  big?: boolean;
  href: string | null;
  onPress?: (p: PulsePerson) => void;
  className?: string;
}) {
  const fg = BENTO_INK[tone].fg;
  const nameInk = tone === 'signature' ? 'text-on-bento-indigo' : 'text-ink';
  const faces = p.avatarUrls.slice(0, FACE_CAP);
  const label = `${p.kicker}: ${p.displayName}${p.rank ? `, locul ${p.rank} în top` : ''}`;
  const name = (
    <span className={cn('line-clamp-2 break-words', big ? 't-title1' : 't-title2', nameInk)}>{p.displayName}</span>
  );
  return (
    <BentoTile
      tone={tone}
      art={artOf(String(p.criterion))}
      className={cn(
        href && s.lift,
        'relative h-full justify-start',
        href && 'active:opacity-70',
        big ? 'min-h-56 gap-4 p-6 md:min-h-full' : 'min-h-47',
        className,
      )}
    >
      {/* Two lines rather than an ellipsis: the kicker («CEA MAI MARE CAPTURĂ») is the tile's meaning. */}
      <p className={cn('line-clamp-2 t-eyebrow', fg)}>{p.kicker}</p>
      <div className={cn('flex min-w-0 gap-3', big ? 'flex-col items-start md:flex-row md:items-center md:gap-5' : 'flex-col')}>
        <span className="relative flex shrink-0">
          {faces.length ? (
            faces.map((src, i) => (
              <Face key={`${src}-${i}`} name={p.displayName} src={src} big={big} className={i ? (big ? '-ml-8' : '-ml-5') : undefined} />
            ))
          ) : (
            <Face name={p.displayName} big={big} />
          )}
          {p.rank ? (
            <span
              className={cn(
                'absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full t-micro-strong ring-2 ring-surface',
                BADGE[tone] ?? BADGE.lavender,
              )}
            >
              #{p.rank}
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          {href ? (
            <Link href={href} aria-label={label} onClick={() => onPress?.(p)} className={STRETCHED}>
              {name}
            </Link>
          ) : (
            name
          )}
          <span className={cn(big ? 't-heading text-lavender' : 't-label text-ink')}>
            {p.rank ? <span className={fg}>Locul {p.rank} · </span> : null}
            {p.line}
          </span>
        </span>
      </div>
      <span className={cn('mt-auto line-clamp-2 pe-16 t-micro', fg)}>
        {big ? <StarIcon className="me-1 inline size-3.5 align-[-2px]" aria-hidden /> : null}
        {p.meta}
      </span>
    </BentoTile>
  );
}

function Face({ name, src, big, className }: { name: string; src?: string; big: boolean; className?: string }) {
  return (
    <span className={cn('block shrink-0 overflow-hidden rounded-full ring-3 ring-surface', big ? 'size-24 md:size-28' : 'size-14', className)}>
      <Avatar name={name} src={src} size={64} tone={src ? undefined : 'indigo'} className="size-full!" />
    </span>
  );
}
