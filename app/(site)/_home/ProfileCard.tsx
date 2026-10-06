import Image from 'next/image';
import Link from 'next/link';
import { DashboardHeader } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { getHomeSession } from './data';
import { HomeRefresh } from './HomeRefresh';
import { homeLinks } from './links';
import { Slogan } from './Slogan';
import logo from './assets/logo_bluvi.png';

/** fish: «Salut, {username}!», or «Bine ai venit!» without a username; «Conectează-te» signed out. */
function greeting(viewer: { username: string | null } | null): string {
  if (!viewer) return 'Conectează-te';
  return viewer.username ? `Salut, ${viewer.username}!` : 'Bine ai venit!';
}

/**
 * Three columns: avatar · text · refresh. The refresh has its own column spanning both rows, so
 * neither the greeting nor the slogan ever runs under it, and its top edge is the greeting's.
 */
const CARD = 'relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 rounded-card bg-surface p-3 shadow-e0';
/** The whole card is the link (fish: the card is one Pressable): a stretched ::after. */
const STRETCHED =
  'outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent';

/**
 * Phone (<768) — fish (tabs)/index.tsx profile card, the page's header there (its greeting is the
 * h1; from 768 HomeHeader's is). Signed in: the avatar thumbnail (the Bluvi logo when the profile
 * has none), «Salut, <username>!» and the rotating slogan; the card opens the profile. Signed out:
 * the logo, «Conectează-te», the signed-out slogan; the card opens sign-in.
 *
 * Web difference: fish's bell is not here — the phone top bar owns notifications (ROADMAP §4), so
 * the card never repeats a shell control. Its trailing slot is the refresh instead (the web
 * stand-in for fish pull-to-refresh, which the ≥768 header carries as a labelled button).
 */
export async function ProfileCard({ className }: { className?: string }) {
  const session = await getHomeSession();
  // Unknown (the session read failed): a neutral card, neither the greeting nor «Conectează-te» —
  // the column under it shows the session error with its retry (HomeSessionError).
  if (session === 'unknown') return <NeutralProfileCard className={className} />;
  const viewer = session;

  return (
    <div className={cn(CARD, className)}>
      {viewer?.avatarUrl ? (
        // A remote CMS photo at thumbnail size: the image optimizer buys nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={viewer.avatarUrl} alt="" className="size-16 shrink-0 rounded-avatar bg-soft-fill object-cover" />
      ) : (
        <Image src={logo} alt="" width={64} height={64} className="size-16 shrink-0 rounded-avatar object-cover" priority />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="t-title1 text-ink">
          <Link href={viewer ? homeLinks.profile : homeLinks.signIn} className={STRETCHED}>
            {greeting(viewer)}
          </Link>
        </h1>
        {/* Three lines (3 × 20) reserved: the longest slogan fits whole beside the refresh chip at
            375 (~190px of measure — a brand line never ends in «…»), and whichever one the visit
            picks, the card keeps its height (no shift after hydration). */}
        <Slogan signedIn={!!viewer} className="line-clamp-3 min-h-15 t-body" />
      </div>
      {/* Above the card's stretched link. */}
      <div className="relative z-above">
        <HomeRefresh />
      </div>
    </div>
  );
}

/** The card when the session could not be read: the logo and «Acasă», no link, no slogan prompt. */
function NeutralProfileCard({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, className)}>
      <Image src={logo} alt="" width={64} height={64} className="size-16 shrink-0 rounded-avatar object-cover" priority />
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="t-title1 text-ink">Acasă</h1>
        <p className="line-clamp-3 min-h-15 t-body text-muted">Nu am putut verifica contul tău.</p>
      </div>
      <div className="relative z-above">
        <HomeRefresh />
      </div>
    </div>
  );
}

/** Same footprint as the card while the session is read. */
export function ProfileCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, className)} role="status" aria-label="Se încarcă profilul">
      <span aria-hidden className="size-16 shrink-0 rounded-avatar bg-soft-fill animate-shimmer" />
      {/* Each bone on the line box of the text it stands for: the card's own height. */}
      <span aria-hidden className="flex min-w-0 flex-col gap-1">
        <span className="t-title1">
          <span className="inline-block h-5 w-3/5 rounded-full bg-soft-fill align-middle animate-shimmer" />
        </span>
        <span className="flex min-h-15 flex-col t-body">
          <span>
            <span className="inline-block h-3.5 w-11/12 rounded-full bg-soft-fill align-middle animate-shimmer" />
          </span>
          <span>
            <span className="inline-block h-3.5 w-1/2 rounded-full bg-soft-fill align-middle animate-shimmer" />
          </span>
        </span>
      </span>
      <span aria-hidden className="size-12 rounded-control" />
    </div>
  );
}

/**
 * From 768 — the T5 header: the greeting as the page title, the slogan as its caption, and the
 * refresh (fish pull-to-refresh). Signed out the title welcomes rather than asks («Conectează-te»
 * is the phone card's, where the whole card is the sign-in link): the top bar's «Intră» is the one
 * sign-in control here, and the signed-out slogan is the prompt.
 */
export async function HomeHeader() {
  const session = await getHomeSession();
  if (session === 'unknown') {
    // The session read failed: a neutral title (never the signed-out welcome) and no caption — the
    // ONE page-level session error (HomeSessionError) heads the main column below, with its retry.
    return <DashboardHeader className="max-md:hidden" title="Acasă" actions={<HomeRefresh />} />;
  }
  const viewer = session;
  return (
    <DashboardHeader
      className="max-md:hidden"
      title={viewer ? greeting(viewer) : 'Bine ai venit pe Bluvi'}
      caption={<Slogan signedIn={!!viewer} as="span" className="" />}
      actions={<HomeRefresh />}
    />
  );
}

/** The header while the session is read: the real refresh, bones for the words. */
export function HomeHeaderSkeleton() {
  return (
    <DashboardHeader
      className="max-md:hidden"
      title={
        <>
          <span className="sr-only">Acasă</span>
          <span aria-hidden className="inline-block h-8 w-72 max-w-full rounded-full bg-soft-fill align-middle animate-shimmer" />
        </>
      }
      caption={<span aria-hidden className="inline-block h-3.5 w-96 max-w-full rounded-full bg-soft-fill align-middle animate-shimmer" />}
      actions={<HomeRefresh />}
    />
  );
}
