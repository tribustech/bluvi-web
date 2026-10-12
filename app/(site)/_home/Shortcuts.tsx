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
type Tone = 'indigo' | 'lavender' | 'sky' | 'peach' | 'lime' | 'violet' | 'accent';
type Shortcut = { href: string; label: string; caption: string; icon: ReactNode; tone: Tone };

/** cn() does not merge: each tone owns its background, ink and icon disc. */
const TONE: Record<Tone, { card: string; disc: string }> = {
  indigo: { card: 'bg-bento-indigo text-on-bento-indigo', disc: 'bg-on-bento-indigo/15' },
  lavender: { card: 'bg-bento-lavender text-on-bento-lavender', disc: 'bg-surface/70' },
  sky: { card: 'bg-bento-sky text-on-bento-sky', disc: 'bg-surface/70' },
  peach: { card: 'bg-bento-peach text-on-bento-peach', disc: 'bg-surface/70' },
  lime: { card: 'bg-bento-lime text-on-bento-lime', disc: 'bg-surface/70' },
  violet: { card: 'bg-bento-violet text-on-bento-violet', disc: 'bg-surface/70' },
  accent: { card: 'bg-accent text-on-accent', disc: 'bg-on-accent/15' },
};

const PUBLIC = {
  live: { href: homeLinks.competitions('started'), label: 'Concursuri live', caption: 'Clasamente în timp real', icon: <SignalIcon />, tone: 'indigo' },
  upcoming: { href: homeLinks.competitions('notStarted'), label: 'Concursuri viitoare', caption: 'Înscrie-te din timp', icon: <TrophyIcon />, tone: 'lavender' },
  lakes: { href: routes.lakes(), label: 'Bălți', caption: 'Găsește și rezervă', icon: <MapIcon />, tone: 'sky' },
  partide: { href: PATHS.partide, label: 'Partide', caption: 'Comunitatea la pescuit', icon: <FishOutlineIcon />, tone: 'lime' },
  news: { href: routes.news(), label: 'Noutăți', caption: 'Ce e nou pe Bluvi', icon: <NewspaperIcon />, tone: 'peach' },
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
      { href: homeLinks.signIn, label: 'Intră în cont', caption: 'Partide, rezervări, pescari', icon: <UserCircleIcon />, tone: 'accent' },
    ];
  }
  return [
    PUBLIC.live,
    PUBLIC.upcoming,
    PUBLIC.lakes,
    { href: PATHS.partide, label: 'Partidele mele', caption: 'Capturi și statistici', icon: <FishOutlineIcon />, tone: 'lime' },
    { href: homeLinks.myBookings, label: 'Rezervările mele', caption: 'Standurile tale', icon: <CalendarDaysIcon />, tone: 'peach' },
    { href: homeLinks.profile, label: 'Profilul meu', caption: 'Cum te văd ceilalți', icon: <UserCircleIcon />, tone: 'violet' },
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
            <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-5 z-behind opacity-15 [&_svg]:size-24">
              {s.icon}
            </span>
            <span aria-hidden className={cn('flex size-11 items-center justify-center rounded-full [&_svg]:size-6', tone.disc)}>
              {s.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="line-clamp-2 t-body-strong">{s.label}</span>
              <span className="truncate t-caption">{s.caption}</span>
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
