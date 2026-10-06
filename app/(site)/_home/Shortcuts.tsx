import {
  CalendarDaysIcon,
  MapIcon,
  NewspaperIcon,
  SignalIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { FishOutlineIcon } from '@/components/nav/brand';
import { PATHS } from '@/components/nav/items';
import { DashboardAction, DashboardActions } from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { getHomeSession } from './data';
import { homeLinks } from './links';

/**
 * Acasă from 1280: the left column of the T5 three-column body (ROADMAP §4 width rule, owner
 * decision 2026-10-04: left = quick links / context, centre = the feed, right = «ce mă așteaptă»).
 * Not a fish block — the phone has the tab bar and the rails' «Vezi toate» for this; on a wide
 * screen the column puts the places a visitor goes next one click away, beside the feed.
 *
 * Signed in: their own areas first (profile, partide, bookings, anglers to follow), then the
 * public sections. Signed out: the public sections and what an account unlocks. Rendered after the
 * session (inside the column's AfterSession reveal), so it never flips from one list to the other.
 * The administration links stay in the top bar's «Administrare» (and the right column's cards).
 */
type Shortcut = { href: string; label: string; icon: ReactNode };

/**
 * The shortcuts for this session. Unknown (the session read failed): the public links only — no
 * account links that may not apply, and no «Intră în cont» to someone who may be signed in.
 */
async function shortcuts(): Promise<{ items: Shortcut[]; signedOut: boolean }> {
  const session = await getHomeSession();
  const viewer = session === 'unknown' ? null : session;
  const items: Shortcut[] = [
    ...(viewer
      ? [
          { href: homeLinks.profile, label: 'Profilul meu', icon: <UserCircleIcon /> },
          { href: PATHS.partide, label: 'Partidele mele', icon: <FishOutlineIcon /> },
          { href: homeLinks.myBookings, label: 'Rezervările mele', icon: <CalendarDaysIcon /> },
          { href: homeLinks.suggestedAnglers, label: 'Pescari de urmărit', icon: <UserGroupIcon /> },
        ]
      : []),
    { href: homeLinks.competitions('started'), label: 'Concursuri live', icon: <SignalIcon /> },
    { href: homeLinks.competitions('notStarted'), label: 'Concursuri viitoare', icon: <TrophyIcon /> },
    ...(viewer ? [] : [{ href: routes.lakes(), label: 'Bălți', icon: <MapIcon /> }]),
    { href: routes.news(), label: 'Noutăți', icon: <NewspaperIcon /> },
  ];
  return { items, signedOut: session === null };
}

export async function HomeShortcuts() {
  const { items, signedOut } = await shortcuts();
  return (
    <>
      <DashboardActions label="Scurtături" layout="list" title="Scurtături">
        {items.map((s) => (
          <DashboardAction key={s.href} href={s.href} label={s.label} icon={s.icon} />
        ))}
      </DashboardActions>
      {!signedOut ? null : (
        <div className="flex flex-col gap-3 rounded-card bg-surface p-4.5 shadow-e0">
          <p className="t-body text-ink-2">Cu un cont îți ții partidele, rezervările și pescarii urmăriți într-un singur loc.</p>
          <ButtonLink href={homeLinks.signIn} variant="secondary" block>
            Intră în cont
          </ButtonLink>
        </div>
      )}
    </>
  );
}

/** cn() does not merge: the base and each tone own disjoint utilities. */
const CHIP =
  'flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 t-label transition-[background-color,opacity] duration-(--duration-fast) ease-fast outline-none active:opacity-70 focus-visible:outline-2 focus-visible:outline-accent [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-accent-ink';
const CHIP_PLAIN = 'bg-surface text-ink shadow-e0 hover:bg-soft-fill';
/** The guest's «Intră în cont»: the secondary button's pair (the old card's button). */
const CHIP_ACCENT = 'bg-accent-tint-2 text-accent-ink hover:brightness-95';

/**
 * 1280–1439 (page.tsx ShortcutsAt1280): the same shortcuts as one row of chips at the top of the
 * main column — at that width there is no left column, and the right column must stay short
 * enough to stick under the top bar. A known guest gets «Intră în cont» as the last chip (the
 * card's pitch has no room in a row; the top bar's «Intră» says the same).
 */
export async function HomeShortcutStrip({ className }: { className?: string }) {
  const { items, signedOut } = await shortcuts();
  return (
    <nav aria-label="Scurtături" className={cn('flex-col', className)}>
      <ul className="flex flex-wrap gap-2">
        {items.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className={cn(CHIP, CHIP_PLAIN)}>
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </Link>
          </li>
        ))}
        {signedOut ? (
          <li>
            <Link href={homeLinks.signIn} className={cn(CHIP, CHIP_ACCENT)}>
              Intră în cont
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

/** The chip row's footprint while the session is read (one row of 40px pills). */
export function HomeShortcutStripSkeleton({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('flex-wrap gap-2', className)}>
      {['w-32', 'w-36', 'w-40', 'w-36', 'w-32', 'w-28'].map((w, i) => (
        <span key={i} className={cn('h-10 rounded-full bg-soft-fill animate-shimmer', w)} />
      ))}
    </span>
  );
}

/** The column while the session is read: the shortcuts card's footprint, nothing readable. */
export function HomeShortcutsSkeleton() {
  return (
    <div aria-busy="true" className="h-80 rounded-card bg-surface shadow-e0">
      <span role="status" className="sr-only">
        Se încarcă scurtăturile
      </span>
    </div>
  );
}
