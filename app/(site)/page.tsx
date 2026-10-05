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
import { SponsorsSection } from './_home/SponsorsSection';
import { Widgets } from './_home/Widgets';
import { absoluteUrl, routes } from '@/lib/routes';
import ogImage from './_home/assets/og-home.jpg';
import logo from './_home/assets/logo_bluvi.png';

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
 * the T5 header (greeting, slogan, refresh). Body, two compositions of the same blocks:
 * - below 1280 (`stacked`): one column in the fish order (inventory home.acasa.c58);
 * - from 1280: the main column for fishing (competitions, lakes, the two calls to action,
 *   sponsors, news, the app + feedback pair, poll, raffle, anglers) and the sticky right column «Ce mă așteaptă»
 *   (my partidă or live competition, organiser panel, my lake, tools). The app, feedback, poll
 *   and raffle cards sit in the main column rather than the aside: the aside has to fit the viewport
 *   under the top bar for `sticky` to hold, and with them it ran ~2200px, far past it.
 * Only one is displayed; the other is `display: none`, out of the accessibility tree.
 *
 * Public rails (competitions, lakes, news, sponsors) are TanStack client sections: TanStack reads
 * the current time while building query state, so each sits in its own <Suspense> whose fallback
 * is the same markup rendered on the server from the cached first page (_home/prerendered.tsx) —
 * the static shell carries headings and first cards, the live section takes over at request time.
 * Each rail's server prefetch (HydrateRail) is inside that boundary, never at the page root: a
 * failed or short-lived read stays a hole behind the rail's fallback instead of blocking the route.
 *
 * Per-user blocks and layout shift: the static shell cannot know the role, the live partidă, the
 * poll or the raffle, and inserting them later pushes down what is already painted. So each
 * column that holds them is revealed ONCE: behind one <Suspense> whose fallback paints nothing
 * readable — a neutral skeleton of the column (aria-busy), never public blocks the per-user ones
 * would then land above — the session-gated version (AfterSession) swaps in whole with every
 * per-user block decided, the role-gated cards as their same-height skeletons when their stats
 * are slower. A replaced skeleton is not a shift; a painted block pushed down is. The phone's profile card is its own boundary above (same
 * footprint skeleton), and the main column's suggested-anglers rail comes last, where nothing
 * follows it. A failed lakes or news read replaces the body with the error card (HomeErrorGate,
 * fish ErrorScreen); the phone's greeting (its h1) stays above it.
 */
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // `<` escaped so no string can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()).replace(/</g, '\\u003c') }}
      />
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
          {/* From 1280 the personal column comes after the whole main column in the DOM (the phone
              order is fish's, where these blocks come first): one jump straight to it. Inside the
              gate, so it never points at a column the error card replaced. */}
          <a
            href={`#${ASIDE_ID}`}
            className="t-body-strong sr-only z-skip rounded-control bg-surface text-accent-ink shadow-e2 max-xl:hidden focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:px-4 focus-visible:py-3"
          >
            Sari la panoul meu
          </a>
          <DashboardLayout
            stacked={
              <Suspense fallback={<StackedColumnSkeleton />}>
                <AfterSession>
                  <StackedColumn />
                </AfterSession>
              </Suspense>
            }
            main={
              <>
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
                <div className="grid grid-cols-2 gap-6">
                  <Suspense fallback={<PartidaCtaSkeleton layout="desktop" />}>
                    <PartidaCtaSlot layout="desktop" />
                  </Suspense>
                  <LakeRequestBanner layout="desktop" />
                </div>
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
                {/* Two short cards side by side (they made the aside too tall to stay sticky), one
                    row: both stretch to its height, so they share a top and a bottom edge. */}
                <div className="grid grid-cols-2 gap-6">
                  <AppPromo />
                  <FeedbackSection layout="desktop" />
                </div>
                {/* Last on desktop, revealed together (fish has them in the stacked order): the
                    poll, the raffle and the suggested anglers stream in after the session and may
                    not appear at all, so nothing painted sits below them. Poll and raffle are
                    main-column blocks from 1280 (the raffle in its two-column layout): in the
                    aside they made the column too tall to stay sticky. */}
                <Suspense fallback={null}>
                  <PollSlot layout="mobile" />
                  <RaffleSlot />
                  <SuggestedAnglersSlot />
                </Suspense>
              </>
            }
            aside={
              <>
                {/* The column's name as its heading, and the target of «Sari la panoul meu». */}
                <h2 id={ASIDE_ID} tabIndex={-1} className="sr-only">
                  Ce mă așteaptă
                </h2>
                <Suspense fallback={<AsideColumnSkeleton />}>
                  <AfterSession>
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

/**
 * Below 1280, in fish's order (inventory home.acasa.c58), rendered after the session: every
 * per-user block is decided in this one reveal; those without a boundary of their own hold it.
 */
function StackedColumn() {
  return (
    <>
      <OrganizerSlot layout="mobile" />
      <OperatorSlot layout="mobile" />
      <Widgets layout="mobile" bookingsBadge={bookingsBadge} />
      <Suspense fallback={<PartidaCtaSkeleton layout="mobile" />}>
        <PartidaCtaSlot layout="mobile" />
      </Suspense>
      <Suspense fallback={<CompetitionsPrerendered />}>
        <HydrateRail rail="competitions">
          <CompetitionsSection />
        </HydrateRail>
      </Suspense>
      <PollSlot layout="mobile" />
      <RaffleSlot />
      <SuggestedAnglersSlot />
      <Suspense fallback={<LakesPrerendered />}>
        <HydrateRail rail="lakes">
          <LakesLive />
        </HydrateRail>
      </Suspense>
      <LakeRequestBanner layout="mobile" />
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
      <FeedbackSection layout="mobile" />
      <SignedOutOnly>
        <ContactCard />
        <PrivacySettingsCard />
      </SignedOutOnly>
      {/* Its own boundary: four per-user reads must not hold the column's reveal. It is sticky at
          the column's end, so arriving late pushes nothing. */}
      <Suspense fallback={null}>
        <MobileDockSlot />
      </Suspense>
    </>
  );
}

/**
 * The stacked column while the session is read: one neutral bone per section the column will
 * hold, in its order and at its height (the rails at their cards' own height classes) — the
 * raffle and Sponsori too, gated by their public reads, so a visitor who scrolls while it loads
 * lands where the column puts them. Nothing readable, so nothing the per-user blocks could land
 * above and push down. (The role-gated cards above Instrumente cannot be known before the session.)
 */
function StackedColumnSkeleton() {
  return (
    <div aria-busy="true" className="contents">
      <span role="status" className="sr-only">
        Se încarcă pagina
      </span>
      <SkeletonSection>
        {/* Instrumente: the tiles card (Widgets), its thirds and the pill band. */}
        <span aria-hidden className="grid grid-cols-3 justify-items-center gap-2 rounded-card bg-surface p-4.5 shadow-e0">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex flex-col items-center gap-9">
              <span className="size-16 rounded-card bg-soft-fill" />
              <span className="h-3 w-14 rounded-full bg-soft-fill animate-shimmer" />
            </span>
          ))}
        </span>
      </SkeletonSection>
      <span aria-hidden className="h-50 rounded-bento bg-soft-fill md:h-28" />
      <SkeletonSection>
        <RailSkeleton label="Se încarcă concursurile" width={224} heightClass={COMPETITION_CARD_HEIGHT} />
      </SkeletonSection>
      <Suspense fallback={null}>
        <IfRaffle>
          <span aria-hidden className="h-160 rounded-bento bg-soft-fill md:h-120" />
        </IfRaffle>
      </Suspense>
      <SkeletonSection>
        <RailSkeleton label="Se încarcă bălțile" width={200} heightClass={LAKE_CARD_HEIGHT} />
      </SkeletonSection>
      <span aria-hidden className="h-64 rounded-bento bg-soft-fill md:h-40" />
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
 * panel, my lake, tools — rendered after the session (one reveal, as StackedColumn). Short
 * enough to fit the viewport under the top bar, so `sticky` holds.
 */
function AsideColumn() {
  return (
    <>
      <RightColumnLiveSlot />
      <OrganizerSlot layout="desktop" />
      <OperatorSlot layout="desktop" />
      <Widgets layout="desktop" bookingsBadge={bookingsBadge} />
      <SignedOutOnly>
        <ContactCard />
        <PrivacySettingsCard />
      </SignedOutOnly>
    </>
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
