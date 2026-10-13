import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { DashboardLayout, DashboardPage } from '@/components/templates/T5';
import { SHELL_CONTENT } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { AppBand } from './_home/AppPromo';
import { COMPETITION_CARD_HEIGHT } from './_home/CompetitionRailCard';
import { CompetitionsSection } from './_home/CompetitionsSection';
import { CompleteProfileSheet } from './_home/CompleteProfileSheet';
import { ContactCard, FeedbackSection } from './_home/Feedback';
import { LakeRequestBanner } from './_home/LakeRequestBanner';
import { NewsSection } from './_home/NewsSection';
import { NEWS_CARD_HEIGHT } from './_home/newsCard';
import { PartidaCtaSkeleton } from './_home/PartidaCta';
import { Pillars } from './_home/Pillars';
import { PrivacySettingsCard } from './_home/PrivacySettingsCard';
import { HomeErrorGate } from './_home/HomeErrorGate';
import { HomeFocusRefresh } from './_home/HomeRefresh';
import { LAKE_CARD_HEIGHT, LAKE_GRID_CARD_BOX } from './_home/HomeLakeCard';
import { HomeHeader, HomeHeaderSkeleton, ProfileCard, ProfileCardSkeleton } from './_home/ProfileCard';
import {
  CompetitionsPrerendered,
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
  RightColumnLateLiveSlot,
  RightColumnLiveSlot,
  SignedOutOnly,
  SuggestedAnglersSlot,
} from './_home/slots';
import { HomeShortcutCards, HomeShortcutCardsSkeleton } from './_home/Shortcuts';
import { SponsorsSection } from './_home/SponsorsSection';
import { SPONSOR_CHIP, SPONSOR_STRIP } from './_home/sponsorStrip';
import { HomeGridSkeleton } from './_home/HomeGrid';
import { Widgets } from './_home/Widgets';
import { HomeFooter } from './_home/HomeFooter';
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
 * the hero (greeting, slogan, the big search). Body: ONE tree at every width (no second copy of the
 * page for the other breakpoint — the rails, their headings and images exist once):
 * - the column, in fish's order at every width (inventory home.acasa.c58): the partidă hero,
 *   competitions, poll, suggested anglers, lakes, the lake request, sponsors, news, feedback;
 * - from 768 one centred column (owner 2026-10-13, «Acasă într-o coloană», after Airbnb / Booking /
 *   Tripadvisor — no side panel): SHELL_CONTENT (1280 + gutters), the top bar's own frame. The
 *   hero (HomeHeader: greeting, slogan, the big search) and under it «Scurtături» as a category
 *   row (_home/Shortcuts.tsx);
 * - from 1280 «Pentru tine» (ForYou) right under the shortcuts: my partidă or live competition,
 *   organiser panel, my lake — the old right column's cards, three to a row, only when there is
 *   one. Below 1280 fish's blocks above the hero keep opening the column (BELOW_XL). Those few
 *   small blocks are the only ones written twice (one copy display:none at any width). The tools
 *   card is phone / tablet only: from 1280 its Rezervări is a shortcut and the rest is «în curând»;
 * - from 768 the guest's Contact / privacy cards and «Sugestii» move into the page footer
 *   (HomeFooter), and the app is one band (AppBand) above it; from 1024 the lake request is one
 *   slim row under the lakes (LakeRequestBanner `inline`) and the partidă hero leaves (the app band
 *   says the same).
 *
 * Owner rule 5 (ROADMAP §4b, at most two rails per page): from 1280 only Concursuri and Pescari de
 * urmărit are rails; Bălți and Noutăți are dense grids capped to whole rows (_home/HomeGrid.tsx) and
 * Sponsori is a compact logo strip at every width. Below 1280 Bălți and Noutăți stay rails (a phone
 * swipes). The poll keeps fish's place at every width.
 *
 * Public sections (competitions, lakes, news, sponsors) are TanStack client sections: TanStack reads
 * the current time while building query state, so each sits in its own <Suspense> whose fallback
 * is the same markup rendered on the server from the cached first page (_home/prerendered.tsx).
 * Each rail's server prefetch (HydrateRail) is inside that boundary, never at the page root: a
 * failed or short-lived read stays a hole behind the rail's fallback instead of blocking the route.
 *
 * Per-user blocks and layout shift: the static shell cannot know the role, the live partidă or the
 * poll, and inserting them later pushes down what is already painted. So each
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
      {/* home.acasa.c57: signed in with an incomplete profile, the non-dismissable form (1.1s after load). */}
      <CompleteProfileSheet />
      <DashboardPage
        // Phone: fish's screen padding (20) and its 10px between blocks (ROADMAP §4b rule 25).
        className={cn('max-md:gap-2.5 max-md:px-5 max-md:pt-5 max-md:[&>div]:gap-2.5 md:mx-auto md:w-full', SHELL_CONTENT)}
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
          <DashboardLayout
            main={
              // Phone: fish's 10px between blocks (the column keeps its own rhythm from 768).
              <div className="flex flex-col gap-2.5 md:contents">
                <Suspense fallback={<MainColumnSkeleton />}>
                  <AfterSession unknown={<UnknownSessionColumn />}>
                    <MainColumn />
                  </AfterSession>
                </Suspense>
              </div>
            }
          />
        </HomeErrorGate>
      </DashboardPage>
      <HomeFooter />
    </>
  );
}

/** Below 1280 only: a block the right column carries from 1280 (`display: contents`, so it keeps the column's gap). */
const BELOW_XL = 'contents xl:hidden';

/** Below 1024 only: the two banners in their fish places (from 1024 the lake request's slim row, no partidă hero). */
const BELOW_LG = 'contents lg:hidden';

/**
 * The main column, in fish's order (inventory home.acasa.c58), rendered after the session: every
 * per-user block is decided in this one reveal; those without a boundary of their own hold it.
 */
function MainColumn() {
  return (
    <>
      <HomeShortcutCards />
      <ForYou />
      {/* fish's blocks above the hero; from 1280 «Pentru tine» (ForYou) carries the cards. */}
      <div className={BELOW_XL}>
        <OrganizerSlot layout="mobile" />
        <OperatorSlot layout="mobile" />
        <Widgets layout="mobile" bookingsBadge={bookingsBadge} />
      </div>
      {/* Below 1024 the partidă hero keeps fish's place; from 1024 it is in the pair after Bălți. */}
      <div className={BELOW_LG}>
        <Suspense fallback={<PartidaCtaSkeleton layout="mobile" />}>
          <PartidaCtaSlot layout="mobile" />
        </Suspense>
      </div>
      <Suspense fallback={<CompetitionsPrerendered />}>
        <HydrateRail rail="competitions">
          <CompetitionsSection />
        </HydrateRail>
      </Suspense>
      {/* No raffle on the web (owner 2026-10-08): the poll takes its row alone, in fish's place. */}
      <PollSlot layout="mobile" />
      <SuggestedAnglersSlot />
      <Suspense fallback={<LakesPrerendered />}>
        <HydrateRail rail="lakes">
          <LakesLive />
        </HydrateRail>
      </Suspense>
      <div className={BELOW_LG}>
        <LakeRequestBanner />
      </div>
      {/* From 1024 the request is one slim row under the lakes it completes. */}
      <LakeRequestBanner layout="inline" className="max-lg:hidden" />
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
      {/* Phone: the feedback card, then fish's guest Contact and privacy cards last (index.tsx:648-650,
          home.acasa.c58). From 768 they are links in the page footer (HomeFooter) and the web-only
          app band takes the column's last row. */}
      <div className="contents md:hidden">
        <FeedbackSection />
        <SignedOutOnly>
          <ContactCard />
          <PrivacySettingsCard />
        </SignedOutOnly>
      </div>
      {/* account.onboarding web replacement: what Bluvi is, for a guest, right above the app band
          (not on the phone: fish's Acasă has no such block, ROADMAP §4b rule 25). */}
      <SignedOutOnly>
        <div className="hidden md:contents">
          <Pillars layout="mobile" />
        </div>
      </SignedOutOnly>
      <AppBand className="max-md:hidden" />
      {/* Its own boundary: four per-user reads must not hold the column's reveal. It is sticky at
          the column's end (below 1280), so arriving late pushes nothing. */}
      <Suspense fallback={null}>
        <MobileDockSlot />
      </Suspense>
    </>
  );
}

/**
 * The main column when the session could not be read («unknown»): the tools (below 1280) and the
 * public sections, which do not depend on the session (their reads succeeded), and no alert — owner rule 4 (ROADMAP §4b, «when
 * we don't know, we don't show»): no per-user block, no guest prompt and no «could not check your
 * account» copy. The retry is silent: the refresh control (header / phone card) and
 * HomeFocusRefresh re-render the page, which re-reads the session; a failed manual refresh says
 * so in a toast (useHomeRefresh), never as a standing block.
 */
function UnknownSessionColumn() {
  return (
    <>
      <HomeShortcutCards />
      {/* The tools do not depend on the session: the phone keeps them, as the aside does from 1280
          (UnknownSessionAside) — no Rezervări count without a known viewer. */}
      <div className={BELOW_XL}>
        <Widgets layout="mobile" />
      </div>
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
      <AppBand className="max-md:hidden" />
    </>
  );
}

/**
 * The main column while the session is read: one neutral bone per section the column will hold,
 * in its order and at its height (the rails at their cards' own height classes) — Sponsori too,
 * gated by its public read, so a visitor who scrolls while it loads lands where
 * the column puts them. Nothing readable, so nothing the per-user blocks could land above and push
 * down. (The role-gated cards above Instrumente cannot be known before the session.)
 */
function MainColumnSkeleton() {
  return (
    <div aria-busy="true" className="contents">
      <span role="status" className="sr-only">
        Se încarcă pagina
      </span>
      <HomeShortcutCardsSkeleton />
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
      <span aria-hidden className="h-50 rounded-bento bg-soft-fill @2xl:h-28 lg:hidden" />
      <SkeletonSection>
        <RailSkeleton label="Se încarcă concursurile" width={224} heightClass={COMPETITION_CARD_HEIGHT} />
      </SkeletonSection>
      <SkeletonSection>
        <div className="xl:hidden">
          <RailSkeleton label="Se încarcă bălțile" width={200} heightClass={LAKE_CARD_HEIGHT} />
        </div>
        <HomeGridSkeleton kind="lakes" heightClass={LAKE_GRID_CARD_BOX} className="max-xl:hidden" />
      </SkeletonSection>
      <span aria-hidden className="h-64 rounded-bento bg-soft-fill @2xl:h-40 lg:hidden" />
      {/* From 1024 the lake request's slim row, at its height. */}
      <span aria-hidden className="hidden h-21 rounded-card bg-soft-fill lg:block" />
      <Suspense fallback={null}>
        <IfSponsors>
          <SkeletonSection>
            <span className={cn(SPONSOR_STRIP, '-mb-3 overflow-hidden')}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn('shrink-0 rounded-card bg-soft-fill animate-shimmer', SPONSOR_CHIP)} />
              ))}
            </span>
          </SkeletonSection>
        </IfSponsors>
      </Suspense>
      <SkeletonSection>
        <div className="xl:hidden">
          <RailSkeleton label="Se încarcă noutățile" width={224} heightClass={NEWS_CARD_HEIGHT} />
        </div>
        <HomeGridSkeleton kind="news" heightClass={NEWS_CARD_HEIGHT} className="max-xl:hidden" />
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
 * From 1280, «Pentru tine» (owner 2026-10-13, replacing the right column «Ce mă așteaptă»): my
 * partidă or live competition, organiser panel, my lake — three to a row, each card at its column
 * size (`desktop`), under the shortcuts. Rendered after the session (the column's one reveal).
 * Nothing to show (a guest, a plain angler with nothing live): the whole block is display:none — it
 * shows once its grid holds a card. My live competition read late in the browser
 * (RightColumnLateLiveSlot) lands as the row's last card, so nothing painted moves.
 */
function ForYou() {
  return (
    <section aria-labelledby="acasa-pentru-tine" className="hidden flex-col gap-3 xl:has-[>div>*]:flex">
      <h2 id="acasa-pentru-tine" className="t-title2 text-ink">
        Pentru tine
      </h2>
      <div className="grid grid-cols-3 items-start gap-6 [&>*]:min-w-0">
        <RightColumnLiveSlot />
        <OrganizerSlot layout="desktop" />
        <OperatorSlot layout="desktop" />
        <RightColumnLateLiveSlot />
      </div>
    </section>
  );
}

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
