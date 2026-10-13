import { CalendarDaysIcon, MapIcon, NewspaperIcon, SignalIcon, TrophyIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { FishOutlineIcon } from '@/components/nav/brand';
import { PATHS } from '@/components/nav/items';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { getHomeSession } from './data';
import { homeLinks } from './links';

/**
 * Acasă: «Scurtături», one compact row of six icons at the top of the main column (owner
 * 2026-10-13, after the coloured cards: «nu înțeleg de ce trebuie să fie carduri așa mari și nu
 * doar iconiță și text dedesubt sau ceva sexy»). Not a fish block — the phone has the tab bar and
 * the rails' «Vezi toate» — but the row is small enough to keep there too: a row that scrolls
 * sideways, bleeding to the screen edge like the rails. From 768 the six are spread evenly across
 * the column. Whole rows for every known session: signed in, their own areas next to the public
 * sections; signed out, the public sections and «Intră în cont». Rendered after the session
 * (inside the column's AfterSession reveal), so it never flips from one set to the other.
 *
 * The look (owner pick 2026-10-13, over app icons and a pill bar): stories — round icons in a thin
 * gradient ring, the live one with a pulsing red dot. The label first in the link's name, a 44px+
 * target, hover, press, focus ring.
 */
type Tone = 'live' | 'violet' | 'blue' | 'cyan' | 'teal' | 'plum';
type Shortcut = { href: string; label: string; icon: ReactNode; tone: Tone };

/** The tone's one hue (`--tile`): the icon's ground, its ring and its shadow. */
const HUE: Record<Tone, string> = {
  live: 'var(--color-bento-indigo-2)',
  violet: 'var(--color-shortcut-violet-solid)',
  blue: 'var(--color-shortcut-blue-solid)',
  cyan: 'var(--color-shortcut-cyan-solid)',
  teal: 'var(--color-shortcut-teal-solid)',
  plum: 'var(--color-shortcut-plum-solid)',
};

const PUBLIC = {
  live: { href: homeLinks.competitions('started'), label: 'Concursuri live', icon: <SignalIcon />, tone: 'live' },
  upcoming: { href: homeLinks.competitions('notStarted'), label: 'Concursuri viitoare', icon: <TrophyIcon />, tone: 'violet' },
  lakes: { href: routes.lakes(), label: 'Bălți', icon: <MapIcon />, tone: 'cyan' },
  partide: { href: PATHS.partide, label: 'Partide', icon: <FishOutlineIcon />, tone: 'teal' },
  news: { href: routes.news(), label: 'Noutăți', icon: <NewspaperIcon />, tone: 'plum' },
} satisfies Record<string, Shortcut>;

/**
 * The shortcuts for this session. Unknown (the session read failed): the public ones only — no
 * account items that may not apply, and no «Intră în cont» to someone who may be signed in.
 */
async function shortcuts(): Promise<Shortcut[]> {
  const session = await getHomeSession();
  if (session === 'unknown') return [PUBLIC.live, PUBLIC.upcoming, PUBLIC.lakes, PUBLIC.partide, PUBLIC.news];
  if (session === null) {
    return [PUBLIC.live, PUBLIC.upcoming, PUBLIC.lakes, PUBLIC.partide, PUBLIC.news, { href: homeLinks.signIn, label: 'Intră în cont', icon: <UserCircleIcon />, tone: 'blue' }];
  }
  return [
    PUBLIC.live,
    PUBLIC.upcoming,
    PUBLIC.lakes,
    { href: PATHS.partide, label: 'Partidele mele', icon: <FishOutlineIcon />, tone: 'teal' },
    { href: homeLinks.myBookings, label: 'Rezervările mele', icon: <CalendarDaysIcon />, tone: 'plum' },
    { href: homeLinks.profile, label: 'Profilul meu', icon: <UserCircleIcon />, tone: 'blue' },
  ];
}

/**
 * The row: below 768 one line that scrolls sideways, bleeding to the screen edge (the page's 20px
 * gutter, as the rails); from 768 six equal columns across the main column.
 */
const ROW = cn(
  'flex items-start gap-1 max-md:-mx-5 max-md:overflow-x-auto max-md:px-4 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden',
  'md:grid md:grid-cols-6 md:gap-2'
);
/** One item: the icon over its label, a 44px+ target, the page's focus ring. */
const ITEM = cn(
  'group flex shrink-0 flex-col items-center gap-2 rounded-control py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'max-md:w-21 md:w-full'
);
const LABEL = 'line-clamp-2 w-full text-center t-caption text-ink-2 transition-colors duration-(--duration-fast) group-hover:text-ink';
/** The icon's motion: a lift on hover, a press, nothing under reduced motion. */
const ICON_MOTION =
  'transition-[transform,box-shadow] duration-(--duration-fast) ease-fast group-hover:-translate-y-1 group-active:translate-y-0 group-active:scale-[0.96] motion-reduce:group-hover:translate-y-0 motion-reduce:group-active:scale-100';
/** The hue from a lit top-left to a deeper bottom-right: the icon's ground. */
const HUE_FILL = 'bg-[linear-gradient(160deg,color-mix(in_oklab,var(--tile)_84%,white)_0%,var(--tile)_42%,color-mix(in_oklab,var(--tile)_74%,black)_100%)]';

const hue = (tone: Tone) => ({ '--tile': HUE[tone] }) as CSSProperties;

/**
 * A round icon in the hue inside a thin ring of the same hue (a 2px gap of page
 * between them, as a story ring), the live one with a red dot that breathes (motion-safe).
 */
function Stories({ items }: { items: Shortcut[] }) {
  return (
    <nav aria-label="Scurtături" className={ROW}>
      {items.map((s) => (
        <Link key={s.href} href={s.href} style={hue(s.tone)} className={ITEM}>
          <span
            aria-hidden
            className={cn(
              'relative rounded-full p-[2.5px] bg-[conic-gradient(from_210deg,var(--tile),color-mix(in_oklab,var(--tile)_45%,white),var(--tile)_70%,color-mix(in_oklab,var(--tile)_80%,black),var(--tile))]',
              ICON_MOTION,
              'shadow-[0_8px_18px_-10px_color-mix(in_oklab,var(--tile)_70%,transparent)] group-hover:shadow-[0_16px_30px_-12px_color-mix(in_oklab,var(--tile)_85%,transparent)]'
            )}
          >
            <span className="flex rounded-full bg-page p-[2.5px]">
              <span className={cn('flex size-13 items-center justify-center rounded-full text-on-bento-indigo [&_svg]:size-6', HUE_FILL)}>{s.icon}</span>
            </span>
            {s.tone === 'live' ? (
              <span className="absolute top-0 right-0 size-4 rounded-full bg-live ring-2 ring-page motion-safe:animate-live" />
            ) : null}
          </span>
          <span className={LABEL}>{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export async function HomeShortcutCards() {
  const items = await shortcuts();
  return <Stories items={items} />;
}

/** The row's footprint while the session is read (the stories' height, nothing readable). */
export function HomeShortcutCardsSkeleton() {
  return <span aria-hidden className="block h-24 rounded-card bg-soft-fill animate-shimmer" />;
}
