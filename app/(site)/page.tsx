import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { DashboardLayout, DashboardPage } from '@/components/templates/T5';
import { AppPromo } from './_home/AppPromo';
import { COMPETITION_CARD_HEIGHT } from './_home/CompetitionRailCard';
import { CompetitionsSection } from './_home/CompetitionsSection';
import { ContactCard, FeedbackSection } from './_home/Feedback';
import { LakeRequestBanner } from './_home/LakeRequestBanner';
import { NewsSection } from './_home/NewsSection';
import { NEWS_CARD_HEIGHT } from './_home/newsCard';
import { PartidaCtaSkeleton } from './_home/PartidaCta';
import { PrivacySettingsCard } from './_home/PrivacySettingsCard';
import { HomeErrorGate } from './_home/HomeErrorGate';
import { HomeFocusRefresh } from './_home/HomeRefresh';
import { HomeSessionError } from './_home/HomeSessionError';
import { LAKE_CARD_HEIGHT } from './_home/HomeLakeCard';
import { HomeHeader, HomeHeaderSkeleton, ProfileCard, ProfileCardSkeleton } from './_home/ProfileCard';
import {
  CompetitionsPrerendered,
  IfRaffle,
  IfSponsors,
  LakesLive,
  LakesPrerendered,
  NewsPrerendered,
  SponsorsPrerendered,
} from './_home/prerendered';
import { HydrateRail } from './_home/hydrate';
import { RailSkeleton } from './_home/RailSection';
import {
  AfterSession,
  BookingsBadgeSlot,
  MobileDockSlot,
  OperatorSlot,
  OrganizerSlot,
  PartidaCtaSlot,
  PollSlot,
  RaffleSlot,
  RightColumnLiveSlot,
  SignedOutOnly,
  SuggestedAnglersSlot,
} from './_home/slots';
import { HomeShortcuts, HomeShortcutsSkeleton } from './_home/Shortcuts';
import { SponsorsSection } from './_home/SponsorsSection';
import { Widgets } from './_home/Widgets';
import { absoluteUrl, routes } from '@/lib/routes';
import ogImage from './_home/assets/og-home.jpg';
import logo from './_home/assets/logo_bluvi.png';
import { jsonLdHtml } from '@/lib/json-ld';

const TITLE = 'Bluvi — concursuri de pescuit, bălți și partide';
const DESCRIPTION =
  'Concursuri de pescuit live și viitoare, bălți din toată țara, pescari pe care îi poți urmări și noutăți din comunitate. Intră în Bluvi și ține-ți partidele într-un singur loc.';

// 1200×630 landscape card (summary_large_image wants ~1.91:1), made for Acasă only.
const OG_ALT = 'Bluvi — concursuri de pescuit, bălți și partide';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Bluvi',
    locale: 'ro_RO',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: ogImage.src, width: ogImage.width, height: ogImage.height, alt: OG_ALT }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [{ url: ogImage.src, alt: OG_ALT }] },
};

/**
 * Acasă — template T5 (Dashboard), behaviour from fish app/(app)/(tabs)/index.tsx.
 *
 * Header: below 768 the fish profile card is the page's header (its greeting is the h1); from 768
 * the T5 header (greeting, slogan, refresh). Body: ONE tree at every width (no second copy of the
 * page for the other breakpoint — the rails, their headings and images exist once):
 * - the main column, in fish's order at every width (inventory home.acasa.c58): the partidă hero,
 *   competitions, poll · raffle · suggested anglers, lakes, the lake request, sponsors, news,
 *   feedback (beside the web-only app promo from 1280, the page's last block);
 * - from 1280 the sticky right column «Ce mă așteaptă» (my partidă or live competition, organiser
 *   panel, my lake, tools — fish's blocks above the hero, which below 1280 open the main column
 *   instead); from 1440 (ROADMAP §4 width rule, three columns) also the sticky left column
 *   «Scurtături» (quick links — web only, _home/Shortcuts.tsx). At 1280 the shortcuts open the
 *   right column instead (`contextFrom="2xl"`), so the centre is 872 wide — three rail cards, as
 *   at 1440 — not 608. Those few small cards are the only blocks written twice (one copy
 *   display:none at any width); DashboardLayout `sidesBelowXl="hidden"`.
 *
 * Public rails (competitions, lakes, news, sponsors) are TanStack client sections: TanStack reads
 * the current time while building query state, so each sits in its own <Suspense> whose fallback
 * is the same markup rendered on the server from the cached first page (_home/prerendered.tsx).
 * Each rail's server prefetch (HydrateRail) is inside that boundary, never at the page root: a
 * failed or short-lived read stays a hole behind the rail's fallback instead of blocking the route.
 *
 * Per-user blocks and layout shift: the static shell cannot know the role, the live partidă, the
 * poll or the raffle, and inserting them later pushes down what is already painted. So each
 * column that holds them is revealed ONCE: behind one <Suspense> whose fallback paints nothing
 * readable — a neutral skeleton of the column at its height (aria-busy), never public blocks the
 * per-user ones would then land above — the session-gated version (AfterSession) swaps in whole
 * with every per-user block decided, the role-gated cards as their same-height skeletons when their
 * stats are slower. A replaced skeleton is not a shift; a painted block pushed down is. The phone's
 * profile card is its own boundary above (same footprint skeleton). A failed lakes or news read
 * replaces the body with the error card (HomeErrorGate, fish ErrorScreen); the phone's greeting
 * (its h1) stays above it.
 */
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // `<` escaped so no string can close the script tag.
        dangerouslySetInnerHTML={jsonLdHtml(homeJsonLd())}
      />
      {/* Coming back to the tab re-reads the live parts (fish useFocusEffect). */}
      <HomeFocusRefresh />
      <DashboardPage
        className="max-md:pt-4"
        header={
          <Suspense fallback={<HomeHeaderSkeleton />}>
            <HomeHeader />
          </Suspense>
        }
      >
        <Suspense fallback={<ProfileCardSkeleton className="md:hidden" />}>
          <ProfileCard className="md:hidden" />
        </Suspense>
        <HomeErrorGate>
          {/* From 1280 the personal column comes after the whole main column in the DOM: one jump
              straight to it. Inside the gate, so it never points at a column the error card hid. */}
          <a
            href={`#${ASIDE_ID}`}
            className="t-body-strong sr-only z-skip rounded-control bg-surface text-accent-ink shadow-e2 max-xl:hidden focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-4 focus-visible:py-3"
          >
            Sari la panoul meu
          </a>
          <DashboardLayout
            sidesBelowXl="hidden"
            contextFrom="2xl"
            main={
              <Suspense fallback={<MainColumnSkeleton />}>
                <AfterSession unknown={<UnknownSessionColumn />}>
                  <MainColumn />
                </AfterSession>
              </Suspense>
            }
            context={
              <Suspense fallback={<HomeShortcutsSkeleton />}>
                <AfterSession>
                  <HomeShortcuts />
                </AfterSession>
              </Suspense>
            }
            aside={
              <>
                {/* The column's name as its heading, and the target of «Sari la panoul meu». */}
                <h2 id={ASIDE_ID} tabIndex={-1} className="sr-only">
                  Ce mă așteaptă
                </h2>
                <Suspense fallback={<AsideColumnSkeleton />}>
                  {/* Unknown: the session-independent blocks (shortcuts at 1280, the tools) — never
                      an empty column; the ONE session error heads the main column. */}
                  <AfterSession unknown={<UnknownSessionAside />}>
                    <AsideColumn />
                  </AfterSession>
                </Suspense>
              </>
            }
          />
        </HomeErrorGate>
      </DashboardPage>
    </>
  );
}

/** Below 1280 only: a block the right column carries from 1280 (`display: contents`, so it keeps the column's gap). */
const BELOW_XL = 'contents xl:hidden';

/**
 * The main column, in fish's order (inventory home.acasa.c58), rendered after the session: every
 * per-user block is decided in this one reveal; those without a boundary of their own hold it.
 */
function MainColumn() {
  return (
    <>
      {/* fish's blocks above the hero; from 1280 they are the right column (AsideColumn). */}
      <div className={BELOW_XL}>
        <OrganizerSlot layout="mobile" />
        <OperatorSlot layout="mobile" />
        <Widgets layout="mobile" bookingsBadge={bookingsBadge} />
      </div>
      <Suspense fallback={<PartidaCtaSkeleton layout="mobile" />}>
        <PartidaCtaSlot layout="mobile" />
      </Suspense>
      <Suspense fallback={<CompetitionsPrerendered />}>
        <HydrateRail rail="competitions">
          <CompetitionsSection />
        </HydrateRail>
      </Suspense>
      {/* From a 896px column (@4xl, ~1620 and up) the poll and the raffle share one row, stretched
          to one height — never a 1000px-wide poll or raffle slab. A lone one takes the row;
          neither: the wrapper is empty and display:none (no extra gap). */}
      <div className="flex flex-col gap-4 empty:hidden md:gap-5 xl:gap-6 @4xl:flex-row @4xl:*:min-w-0 @4xl:*:flex-1">
        <PollSlot layout="mobile" />
        <RaffleSlot />
      </div>
      <SuggestedAnglersSlot />
      <Suspense fallback={<LakesPrerendered />}>
        <HydrateRail rail="lakes">
          <LakesLive />
        </HydrateRail>
      </Suspense>
      <LakeRequestBanner />
      <Suspense fallback={<SponsorsPrerendered />}>
        <HydrateRail rail="sponsors">
          <SponsorsSection />
        </HydrateRail>
      </Suspense>
      <Suspense fallback={<NewsPrerendered />}>
        <HydrateRail rail="news">
          <NewsSection />
        </HydrateRail>
      </Suspense>
      {/* From 1280 the web-only app promo joins the feedback card: side by side once the column has
          the room for two (672px — the column is a size container). Stretched to one height, both
          CTAs on the shared bottom edge. Below 1280 the feedback card alone. */}
      <div className="grid grid-cols-1 items-stretch gap-4 md:gap-5 xl:gap-6 xl:@2xl:grid-cols-2">
        <AppPromo className="max-xl:hidden" />
        <FeedbackSection />
      </div>
      {/* fish puts the guest's Contact and privacy cards last (index.tsx:648-650): at the end of
          the main column at every width (home.acasa.c58), side by side once the column has room. */}
      <SignedOutOnly>
        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:gap-6 @2xl:grid-cols-2">
          <ContactCard />
          <PrivacySettingsCard />
        </div>
      </SignedOutOnly>
      {/* Its own boundary: four per-user reads must not hold the column's reveal. It is sticky at
          the column's end (below 1280), so arriving late pushes nothing. */}
      <Suspense fallback={null}>
        <MobileDockSlot />
      </Suspense>
    </>
  );
}

/**
 * The main column when the session could not be read («unknown»): ONE page-level alert with its
 * retry (HomeSessionError) at the top, then the public rails, which do not depend on the session
 * (their reads succeeded) — never three copies of the error, never a blank page around one card.
 * No per-user block and no guest prompt: who the viewer is, is exactly what is not known.
 */
function UnknownSessionColumn() {
  return (
    <>
      <HomeSessionError />
      <Suspense fallback={<CompetitionsPrerendered />}>
        <HydrateRail rail="competitions">
          <CompetitionsSection />
        </HydrateRail>
      </Suspense>
      <Suspense fallback={<LakesPrerendered />}>
        <HydrateRail rail="lakes">
          <LakesLive />
        </HydrateRail>
      </Suspense>
      <Suspense fallback={<SponsorsPrerendered />}>
        <HydrateRail rail="sponsors">
          <SponsorsSection />
        </HydrateRail>
      </Suspense>
      <Suspense fallback={<NewsPrerendered />}>
        <HydrateRail rail="news">
          <NewsSection />
        </HydrateRail>
      </Suspense>
    </>
  );
}

/**
 * The main column while the session is read: one neutral bone per section the column will hold,
 * in its order and at its height (the rails at their cards' own height classes) — the raffle and
 * Sponsori too, gated by their public reads, so a visitor who scrolls while it loads lands where
 * the column puts them. Nothing readable, so nothing the per-user blocks could land above and push
 * down. (The role-gated cards above Instrumente cannot be known before the session.)
 */
function MainColumnSkeleton() {
  return (
    <div aria-busy="true" className="contents">
      <span role="status" className="sr-only">
        Se încarcă pagina
      </span>
      <div aria-hidden className={BELOW_XL}>
        <SkeletonSection>
          {/* Instrumente: the tiles card (Widgets), its thirds and the pill band. */}
          <span className="grid grid-cols-3 justify-items-center gap-2 rounded-card bg-surface p-4.5 shadow-e0">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col items-center gap-9">
                <span className="size-16 rounded-card bg-soft-fill" />
                <span className="h-3 w-14 rounded-full bg-soft-fill animate-shimmer" />
              </span>
            ))}
          </span>
        </SkeletonSection>
      </div>
      {/* The partidă hero: stacked copy and actions in a narrow column, one row from 672px of it. */}
      <span aria-hidden className="h-50 rounded-bento bg-soft-fill @2xl:h-28" />
      <SkeletonSection>
        <RailSkeleton label="Se încarcă concursurile" width={224} heightClass={COMPETITION_CARD_HEIGHT} />
      </SkeletonSection>
      <Suspense fallback={null}>
        <IfRaffle>
          <span aria-hidden className="h-160 rounded-bento bg-soft-fill @xl:h-120" />
        </IfRaffle>
      </Suspense>
      <SkeletonSection>
        <RailSkeleton label="Se încarcă bălțile" width={200} heightClass={LAKE_CARD_HEIGHT} />
      </SkeletonSection>
      <span aria-hidden className="h-64 rounded-bento bg-soft-fill @2xl:h-40" />
      <Suspense fallback={null}>
        <IfSponsors>
          <SkeletonSection>
            <RailSkeleton label="Se încarcă sponsorii" width={224} heightClass="aspect-8/5" />
          </SkeletonSection>
        </IfSponsors>
      </Suspense>
      <SkeletonSection>
        <RailSkeleton label="Se încarcă noutățile" width={224} heightClass={NEWS_CARD_HEIGHT} />
      </SkeletonSection>
    </div>
  );
}

/** A plain section's heading (t-title2 line box + its 12px) as a bone, over its body. */
function SkeletonSection({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden>
      <span className="flex items-center pb-3 t-title2">
        {'\u200b'}
        <span className="h-4 w-32 rounded-full bg-soft-fill animate-shimmer" />
      </span>
      {children}
    </div>
  );
}

/**
 * From 1280, the sticky right column «Ce mă așteaptă»: my partidă or live competition, organiser
 * panel, my lake, tools — rendered after the session (one reveal, as MainColumn). Short
 * enough to fit the viewport under the top bar, so `sticky` holds.
 */
function AsideColumn() {
  return (
    <>
      <ShortcutsAt1280 />
      <RightColumnLiveSlot />
      <OrganizerSlot layout="desktop" />
      <OperatorSlot layout="desktop" />
      <Widgets layout="desktop" bookingsBadge={bookingsBadge} />
    </>
  );
}

/**
 * The right column when the session could not be read: what does not depend on it — the
 * shortcuts (1280) and the tools. No guest cards (Contact, privacy: fish shows them to a known
 * guest only) and no per-user block.
 */
function UnknownSessionAside() {
  return (
    <>
      <ShortcutsAt1280 />
      <Widgets layout="desktop" />
    </>
  );
}

/**
 * At 1280 Acasă is centre · right (DashboardLayout `contextFrom="2xl"`: three columns from 1440),
 * so the left column's shortcuts open the right one there. display:none from 1440, where the left
 * column carries them.
 */
function ShortcutsAt1280() {
  return (
    <div className="contents 2xl:hidden">
      <HomeShortcuts />
    </div>
  );
}

/** The aside while the session is read: the tools card's footprint, nothing readable. */
function AsideColumnSkeleton() {
  return (
    <div aria-busy="true" className="h-46 rounded-card bg-surface shadow-e0">
      <span role="status" className="sr-only">
        Se încarcă panoul
      </span>
    </div>
  );
}

const ASIDE_ID = 'acasa-panou';

/** The Rezervări tile's count streams in on its own (signed in only). */
const bookingsBadge = (
  <Suspense fallback={null}>
    <BookingsBadgeSlot />
  </Suspense>
);

/**
 * schema.org for the home page: the site and the organisation behind it. No SearchAction yet: the
 * header's search posts to /cauta, which has no page (add it when the search results page lands).
 */
function homeJsonLd() {
  const url = absoluteUrl(routes.home());
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${url}#website`,
        url,
        name: 'Bluvi',
        description: DESCRIPTION,
        inLanguage: 'ro-RO',
        publisher: { '@id': `${url}#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${url}#organization`,
        name: 'Bluvi',
        url,
        logo: { '@type': 'ImageObject', url: absoluteUrl(logo.src), width: logo.width, height: logo.height },
      },
    ],
  };
}
