import Image from 'next/image';
import Link from 'next/link';
import { BellAlertIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { getHomeViewer, loadUnreadNotifications } from './data';
import { homeLinks } from './links';
import { Slogan } from './Slogan';
import logo from './assets/logo_bluvi.png';

const CARD = 'relative -mx-[5px] flex gap-2.5 rounded-card bg-surface p-3 shadow-glow';

/**
 * fish (tabs)/index.tsx profile card. Signed in: avatar, «Salut, <username>!», the rotating
 * slogan, the notifications bell (red dot when anything is unread); the card opens the profile.
 * Signed out: the Bluvi logo, «Conectează-te», the signed-out slogan; the card opens sign-in.
 */
export async function ProfileCard() {
  const viewer = await getHomeViewer();
  if (!viewer) return <SignedOutProfileCard />;
  const unread = await loadUnreadNotifications();

  return (
    <div className={CARD}>
      <Avatar name={viewer.username} src={viewer.avatarUrl} size={64} shape="square" tone="indigo" />
      <div className="mt-1 flex min-w-0 flex-1 flex-col gap-1">
        <p className="t-title1">
          <Link
            href="/profil"
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            {viewer.username ? `Salut, ${viewer.username}!` : 'Bine ai venit!'}
          </Link>
        </p>
        <Slogan signedIn />
      </div>
      <Link
        href={homeLinks.notifications}
        aria-label={unread ? `Notificări, ${unread} necitite` : 'Notificări'}
        className="relative z-10 -m-2.5 flex size-11 shrink-0 items-center justify-center self-start rounded-full text-ink hover:bg-soft-fill"
      >
        <BellAlertIcon aria-hidden className="size-6 stroke-2" />
        {unread ? <span aria-hidden className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-live" /> : null}
      </Link>
    </div>
  );
}

export function SignedOutProfileCard() {
  return (
    <div className={CARD}>
      <Image src={logo} alt="" width={64} height={64} className="size-16 shrink-0 rounded-avatar object-cover" priority />
      <div className="mt-1 flex min-w-0 flex-1 flex-col gap-1">
        <p className="t-title1">
          <Link
            href={homeLinks.signIn}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            Conectează-te
          </Link>
        </p>
        <Slogan signedIn={false} />
      </div>
    </div>
  );
}

/** Same footprint as the card, for the moment the session is still being read. */
export function ProfileCardSkeleton() {
  return (
    <div className={CARD} role="status" aria-label="Se încarcă profilul">
      <span aria-hidden className="size-16 shrink-0 rounded-avatar bg-soft-fill animate-shimmer" />
      <span aria-hidden className="mt-2 flex flex-1 flex-col gap-2">
        <span className="h-4 w-[60%] rounded-full bg-soft-fill" />
        <span className="h-3 w-[85%] rounded-full bg-soft-fill" />
        <span className="h-3 w-[50%] rounded-full bg-soft-fill" />
      </span>
    </div>
  );
}

/**
 * Desktop main column (design): the same greeting as a page heading, without the card. Signed out
 * keeps fish's «Conectează-te» + slogan and adds the sign-in button the card's tap stood for.
 */
export async function DesktopGreeting() {
  const viewer = await getHomeViewer();
  return (
    <div className="flex items-end gap-5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="t-page-title">{viewer ? (viewer.username ? `Salut, ${viewer.username}!` : 'Bine ai venit!') : 'Conectează-te'}</p>
        <Slogan signedIn={!!viewer} />
      </div>
      {viewer ? null : <ButtonLink href={homeLinks.signIn}>Intră în cont</ButtonLink>}
    </div>
  );
}

export function DesktopGreetingSkeleton() {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Se încarcă">
      <span aria-hidden className="h-9 w-80 rounded-full bg-soft-fill animate-shimmer" />
      <span aria-hidden className="h-4 w-96 rounded-full bg-soft-fill" />
    </div>
  );
}
