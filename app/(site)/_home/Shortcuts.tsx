import { CalendarDaysIcon, MapIcon, NewspaperIcon, SignalIcon, TrophyIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { FishOutlineIcon } from '@/components/nav/brand';
import { PATHS } from '@/components/nav/items';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { getHomeSession } from './data';
import { homeLinks } from './links';

/**
 * Acasă from 768: «Scurtături» as one row of large coloured cards at the top of the main column
 * (owner 2026-10-12: the left-column list and the 1280 chip row «n-au niciun dumnezeu» — bigger
 * cards, coloured, with distinctive icons, at the top). Not a fish block — the phone has the tab bar
 * and the rails' «Vezi toate». Three per row, or one row of six on a wide column — whole rows for every known session:
 * signed in, their own areas next to the public sections; signed out, the public sections and
 * «Intră în cont». Rendered after the session (inside the column's AfterSession reveal), so it
 * never flips from one set to the other.
 */
type Tone = 'live' | 'violet' | 'blue' | 'cyan' | 'teal' | 'plum';
type Shortcut = { href: string; label: string; caption: string; icon: ReactNode; tone: Tone };

/**
 * One family (2026-10-12): a single solid emphasis card (live, the brand's deep indigo), then soft
 * tints on one lightness step — each with its own saturated icon disc under a white glyph, the label
 * in the hue's darkest ink, the caption in its step-11 ink, and the corner glyph in the disc's hue.
 * cn() does not merge: each tone owns its card, caption, disc and glyph.
 */
const TONE: Record<Tone, { card: string; caption: string; disc: string; glyph: string }> = {
  live: { card: 'bg-bento-indigo text-on-bento-indigo', caption: 'text-on-bento-indigo-2', disc: 'bg-on-bento-indigo/15', glyph: 'text-on-bento-indigo opacity-10' },
  violet: { card: 'bg-shortcut-violet text-on-shortcut-violet', caption: 'text-on-shortcut-violet-2', disc: 'bg-shortcut-violet-solid text-on-bento-indigo', glyph: 'text-shortcut-violet-solid opacity-12' },
  blue: { card: 'bg-shortcut-blue text-on-shortcut-blue', caption: 'text-on-shortcut-blue-2', disc: 'bg-shortcut-blue-solid text-on-bento-indigo', glyph: 'text-shortcut-blue-solid opacity-12' },
  cyan: { card: 'bg-shortcut-cyan text-on-shortcut-cyan', caption: 'text-on-shortcut-cyan-2', disc: 'bg-shortcut-cyan-solid text-on-bento-indigo', glyph: 'text-shortcut-cyan-solid opacity-12' },
  teal: { card: 'bg-shortcut-teal text-on-shortcut-teal', caption: 'text-on-shortcut-teal-2', disc: 'bg-shortcut-teal-solid text-on-bento-indigo', glyph: 'text-shortcut-teal-solid opacity-12' },
  plum: { card: 'bg-shortcut-plum text-on-shortcut-plum', caption: 'text-on-shortcut-plum-2', disc: 'bg-shortcut-plum-solid text-on-bento-indigo', glyph: 'text-shortcut-plum-solid opacity-12' },
};

const PUBLIC = {
  live: { href: homeLinks.competitions('started'), label: 'Concursuri live', caption: 'Clasamente în timp real', icon: <SignalIcon />, tone: 'live' },
  upcoming: { href: homeLinks.competitions('notStarted'), label: 'Concursuri viitoare', caption: 'Înscrie-te din timp', icon: <TrophyIcon />, tone: 'violet' },
  lakes: { href: routes.lakes(), label: 'Bălți', caption: 'Găsește și rezervă', icon: <MapIcon />, tone: 'cyan' },
  partide: { href: PATHS.partide, label: 'Partide', caption: 'Comunitatea la pescuit', icon: <FishOutlineIcon />, tone: 'teal' },
  news: { href: routes.news(), label: 'Noutăți', caption: 'Ce e nou pe Bluvi', icon: <NewspaperIcon />, tone: 'plum' },
} satisfies Record<string, Shortcut>;

/**
 * The cards for this session. Unknown (the session read failed): the public cards only — no
 * account cards that may not apply, and no «Intră în cont» to someone who may be signed in.
 */
async function shortcuts(): Promise<Shortcut[]> {
  const session = await getHomeSession();
  if (session === 'unknown') return [PUBLIC.live, PUBLIC.upcoming, PUBLIC.lakes, PUBLIC.partide, PUBLIC.news];
  if (session === null) {
    return [
      PUBLIC.live,
      PUBLIC.upcoming,
      PUBLIC.lakes,
      PUBLIC.partide,
      PUBLIC.news,
      { href: homeLinks.signIn, label: 'Intră în cont', caption: 'Partide, rezervări, pescari', icon: <UserCircleIcon />, tone: 'blue' },
    ];
  }
  return [
    PUBLIC.live,
    PUBLIC.upcoming,
    PUBLIC.lakes,
    { href: PATHS.partide, label: 'Partidele mele', caption: 'Capturi și statistici', icon: <FishOutlineIcon />, tone: 'teal' },
    { href: homeLinks.myBookings, label: 'Rezervările mele', caption: 'Standurile tale', icon: <CalendarDaysIcon />, tone: 'plum' },
    { href: homeLinks.profile, label: 'Profilul meu', caption: 'Cum te văd ceilalți', icon: <UserCircleIcon />, tone: 'blue' },
  ];
}

/** Three per row; one row once the main column (a size container) has 1024px for all of them. */
const GRID = 'hidden md:grid md:grid-cols-3 md:gap-3 xl:gap-4 @5xl:flex';

export async function HomeShortcutCards() {
  const items = await shortcuts();
  return (
    <nav aria-label="Scurtături" className={GRID}>
      {items.map((s) => {
        const tone = TONE[s.tone];
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              'group relative isolate flex min-h-30 min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-card p-4 shadow-e0 @5xl:flex-1',
              'transition-[box-shadow,transform] duration-(--duration-fast) ease-fast hover:-translate-y-0.5 hover:shadow-e2 active:translate-y-0 active:opacity-90 motion-reduce:hover:translate-y-0',
              'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              tone.card
            )}
          >
            {/* The same glyph, large and faint in the corner: the card's own mark. */}
            <span aria-hidden className={cn('pointer-events-none absolute -right-4 -bottom-5 z-behind [&_svg]:size-24', tone.glyph)}>
              {s.icon}
            </span>
            <span aria-hidden className={cn('flex size-11 items-center justify-center rounded-full [&_svg]:size-6', tone.disc)}>
              {s.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="line-clamp-2 t-body-strong">{s.label}</span>
              <span className={cn('truncate t-caption', tone.caption)}>{s.caption}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The row's footprint while the session is read (the cards' height, nothing readable). */
export function HomeShortcutCardsSkeleton() {
  return (
    <span aria-hidden className={GRID}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="min-h-30 rounded-card bg-soft-fill animate-shimmer @5xl:flex-1" />
      ))}
    </span>
  );
}
