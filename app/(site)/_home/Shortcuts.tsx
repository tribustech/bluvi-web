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
 * The look below 768 (owner pick 2026-10-13, over app icons and a pill bar): stories — round icons
 * in a thin gradient ring, the live one with a pulsing red dot. From 768 (owner 2026-10-13, «Acasă
 * într-o coloană»): Airbnb's category row under the hero search — a line icon over its label,
 * centred, on a hairline, the live one with the same red dot. Hover (owner 2026-10-13: «să colorăm
 * frumos animat iconul»): a disc of the item's own hue blooms behind the icon, the icon takes the
 * hue and lifts with a small spring, and the ink rule is drawn under it. The label first in the
 * link's name, a 44px+ target, press, focus ring.
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
 * The phone row: one line that scrolls sideways, bleeding to the screen edge (the page's 20px
 * gutter, as the rails).
 */
const ROW =
  'flex items-start gap-1 -mx-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden';
/** One item: the icon over its label, a 44px+ target, the page's focus ring. */
const ITEM =
  'group flex w-21 shrink-0 flex-col items-center gap-2 rounded-control py-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
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

/**
 * From 768: the category row. Each link is a column (icon, label) with a 2px rule on the row's
 * hairline that turns ink on hover; the row is centred and scrolls sideways if a narrow tablet
 * cannot hold it.
 */
function Categories({ items }: { items: Shortcut[] }) {
  return (
    <nav aria-label="Scurtături" className="-mt-1 border-b border-hairline max-md:hidden">
      <ul className="flex justify-center gap-2 overflow-x-auto [scrollbar-width:none] lg:gap-6 xl:gap-10 [&::-webkit-scrollbar]:hidden">
        {items.map((s) => (
          <li key={s.href} className="shrink-0">
            <Link
              href={s.href}
              style={hue(s.tone)}
              className={cn(
                'group relative flex min-w-22 flex-col items-center gap-1 px-2 pt-2 pb-3 text-ink-2 outline-none',
                'transition-colors duration-(--duration-fast) ease-fast hover:text-ink active:opacity-80',
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink after:opacity-0 after:transition-opacity after:duration-(--duration-fast) after:content-[''] hover:after:opacity-100",
                'focus-visible:rounded-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              )}
            >
              <span aria-hidden className="relative flex size-11 items-center justify-center">
                {/* The hue's disc: scaled up from nothing on hover. */}
                <span className="absolute inset-0 scale-50 rounded-full bg-[color-mix(in_oklab,var(--tile)_14%,transparent)] opacity-0 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
                <span className="relative flex transition-[color,transform] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-0.5 group-hover:scale-110 group-hover:text-(--tile) group-focus-visible:text-(--tile) group-active:scale-95 motion-reduce:transition-colors motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:scale-100 [&_svg]:size-7 [&_svg]:stroke-[1.5]">
                  {s.icon}
                </span>
                {s.tone === 'live' ? (
                  <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-live ring-2 ring-page motion-safe:animate-live" />
                ) : null}
              </span>
              <span className="t-label whitespace-nowrap">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export async function HomeShortcutCards() {
  const items = await shortcuts();
  return (
    <>
      <Stories items={items} />
      <Categories items={items} />
    </>
  );
}

/** The row's footprint while the session is read (the stories' / categories' height, nothing readable). */
export function HomeShortcutCardsSkeleton() {
  return (
    <>
      <span aria-hidden className="block h-24 rounded-card bg-soft-fill animate-shimmer md:hidden" />
      <span aria-hidden className="-mt-1 block h-21 border-b border-hairline max-md:hidden" />
    </>
  );
}
