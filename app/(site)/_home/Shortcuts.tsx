import {
  CalendarDaysIcon,
  MapIcon,
  NewspaperIcon,
  SignalIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { FishOutlineIcon } from '@/components/nav/brand';
import { PATHS } from '@/components/nav/items';
import { DashboardAction, DashboardActions } from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
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
export async function HomeShortcuts() {
  const session = await getHomeSession();
  // Unknown (the session read failed): the public links only — no account links that may not
  // apply, and no «Intră în cont» to someone who may be signed in.
  const viewer = session === 'unknown' ? null : session;
  const signedOut = session === null;
  return (
    <>
      <DashboardActions label="Scurtături" layout="list" title="Scurtături">
        {viewer ? (
          <>
            <DashboardAction href={homeLinks.profile} label="Profilul meu" icon={<UserCircleIcon />} />
            <DashboardAction href={PATHS.partide} label="Partidele mele" icon={<FishOutlineIcon />} />
            <DashboardAction href={homeLinks.myBookings} label="Rezervările mele" icon={<CalendarDaysIcon />} />
            <DashboardAction href={homeLinks.suggestedAnglers} label="Pescari de urmărit" icon={<UserGroupIcon />} />
          </>
        ) : null}
        <DashboardAction href={homeLinks.competitions('started')} label="Concursuri live" icon={<SignalIcon />} />
        <DashboardAction href={homeLinks.competitions('notStarted')} label="Concursuri viitoare" icon={<TrophyIcon />} />
        {viewer ? null : <DashboardAction href={routes.lakes()} label="Bălți" icon={<MapIcon />} />}
        <DashboardAction href={routes.news()} label="Noutăți" icon={<NewspaperIcon />} />
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
