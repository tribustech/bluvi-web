import Image from 'next/image';
import Link from 'next/link';
import { DashboardHeader } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { getHomeSession } from './data';
import { HomeBell } from './HomeBell';
import { HomeRefresh } from './HomeRefresh';
import { homeLinks } from './links';
import { Slogan } from './Slogan';
import logo from './assets/logo_bluvi.png';

/** fish: «Salut, {username}!», or «Bine ai venit!» without a username; «Conectează-te» signed out. */
/** A guest's page title, the same at every width (the phone card's «Conectează-te» is the sign-in). */
const GUEST_TITLE = 'Bine ai venit pe Bluvi';

function greeting(viewer: { username: string | null } | null): string {
  if (!viewer) return 'Conectează-te';
  return viewer.username ? `Salut, ${viewer.username}!` : 'Bine ai venit!';
}

/**
 * fish's card: 12 padding, 10 gap, radius 16, the indigo glow (shadow-glow is fish's indigo5 0.15
 * r10), 5px wider than the column on each side (fish marginHorizontal -5). Three columns: photo ·
 * text · bell; the bell has its own column, so neither line ever runs under it.
 */
const CARD = 'relative -mx-1.25 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-card bg-surface p-3 shadow-glow';
/** The whole card is the link (fish: the card is one Pressable): a stretched ::after. */
const STRETCHED =
  'outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent';

/**
 * Phone (<768) — fish (tabs)/index.tsx profile card, the page's header there (its greeting is the
 * h1; from 768 HomeHeader's is). Signed in: the avatar thumbnail (the Bluvi logo when the profile
 * has none), «Salut, <username>!» and the rotating slogan; the card opens the profile. Signed out:
 * the logo, «Conectează-te», the signed-out slogan; the card opens sign-in.
 *
 * Signed in, fish's bell sits in the top-right corner (HomeBell, ROADMAP §4b rule 25: the phone is
 * fish screen for screen); a guest's card has none, as fish. No refresh button here: fish refreshes
 * by pull-to-refresh, which a phone browser does natively (it reloads the page); from 768 the
 * header carries the labelled refresh.
 */
export async function ProfileCard({ className }: { className?: string }) {
  const session = await getHomeSession();
  // Unknown (the session read failed): the card's neutral skeleton — neither the greeting nor
  // «Conectează-te», and no «could not check» copy (owner rule 4, ROADMAP §4b). Its refresh is the
  // silent retry (as HomeFocusRefresh): a re-render re-reads the session.
  if (session === 'unknown') return <NeutralProfileCard className={className} />;
  const viewer = session;
  // Signed in the greeting is the phone's h1; a guest's h1 is GUEST_TITLE (HomeHeader, every width)
  // and «Conectează-te» stays the card's title line — same look, not a heading.
  const Title = viewer ? 'h1' : 'p';

  return (
    <div className={cn(CARD, className)}>
      {viewer?.avatarUrl ? (
        // A remote CMS photo at thumbnail size: the image optimizer buys nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={viewer.avatarUrl} alt="" className="size-17.5 shrink-0 rounded-avatar bg-soft-fill object-cover" />
      ) : (
        // Decorative, 64 px: eager (above the fold) but never a preload or a high-priority fetch —
        // those belong to the page's LCP image (M8-B4).
        <Image src={logo} alt="" width={70} height={70} className="size-17.5 shrink-0 rounded-avatar object-cover" loading="eager" />
      )}
      <div className="mt-1 flex min-w-0 flex-col gap-1">
        <Title className="t-title1 text-ink">
          <Link href={viewer ? homeLinks.profile : homeLinks.signIn} className={STRETCHED}>
            {greeting(viewer)}
          </Link>
        </Title>
        {/* Two lines (2 × 20) reserved, as fish's card shows them beside the 70px photo; the
            longest slogan may take a third (a brand line never ends in «…»). */}
        <Slogan signedIn={!!viewer} className="line-clamp-3 min-h-10 t-body" />
      </div>
      {/* Above the card's stretched link. */}
      {viewer ? <HomeBell className="relative z-above" /> : null}
    </div>
  );
}

/**
 * The card when the session could not be read: a slim row — the Bluvi mark, the page's h1 (for
 * assistive tech only) and the real refresh, the retry. Owner rule 4 (ROADMAP §4b): nothing about
 * the viewer and no «could not check» copy; and no skeleton either — nothing will resolve it until
 * a refresh (or HomeFocusRefresh), so a bone that shimmers for good would read as stuck loading.
 */
function NeutralProfileCard({ className }: { className?: string }) {
  return (
    <div className={cn('-mx-1.25 flex items-center justify-between gap-3 rounded-card bg-surface p-3 shadow-glow', className)}>
      <Image src={logo} alt="" width={40} height={40} className="size-10 shrink-0 rounded-avatar object-cover" />
      <h1 className="sr-only">Acasă</h1>
      <HomeRefresh />
    </div>
  );
}

/** Same footprint as the card while the session is read. */
export function ProfileCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD, className)} role="status" aria-label="Se încarcă profilul">
      <ProfileCardBones />
      <span aria-hidden className="size-7" />
    </div>
  );
}

/** The avatar and text bones (the card's first two grid columns), each on its text's line box. */
function ProfileCardBones() {
  return (
    <>
      <span aria-hidden className="size-17.5 shrink-0 rounded-avatar bg-soft-fill animate-shimmer" />
      <span aria-hidden className="mt-1 flex min-w-0 flex-col gap-1">
        <span className="t-title1">
          <span className="inline-block h-5 w-3/5 rounded-full bg-soft-fill align-middle animate-shimmer" />
        </span>
        <span className="flex min-h-10 flex-col t-body">
          <span>
            <span className="inline-block h-3.5 w-11/12 rounded-full bg-soft-fill align-middle animate-shimmer" />
          </span>
          <span>
            <span className="inline-block h-3.5 w-1/2 rounded-full bg-soft-fill align-middle animate-shimmer" />
          </span>
        </span>
      </span>
    </>
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
    // The session read failed: a neutral title (never the signed-out welcome), no caption and no
    // alert (owner rule 4, ROADMAP §4b) — the refresh beside it is the retry.
    return <DashboardHeader className="max-md:hidden" title="Acasă" actions={<HomeRefresh />} />;
  }
  const viewer = session;
  return (
    <>
      {/* A guest's h1 is the same at every width: on the phone a plain title above the sign-in
          card (which carries the slogan and the refresh), from 768 the T5 header. */}
      {/* Visually hidden on the phone: fish opens on the sign-in card, no title above it. */}
      {viewer ? null : <h1 className="sr-only md:hidden">{GUEST_TITLE}</h1>}
      <DashboardHeader
        className="max-md:hidden"
        title={viewer ? greeting(viewer) : GUEST_TITLE}
        caption={<Slogan signedIn={!!viewer} as="span" className="" />}
        actions={<HomeRefresh />}
      />
    </>
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
