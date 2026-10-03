import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrateQueries } from '@/lib/client/hydration';
import { AppPromo } from './_home/AppPromo';
import { CompetitionsSection } from './_home/CompetitionsSection';
import { ContactCard, FeedbackSection } from './_home/Feedback';
import { LakeRequestBanner } from './_home/LakeRequestBanner';
import { LakesSection } from './_home/LakesSection';
import { NewsSection } from './_home/NewsSection';
import { OrganizerBanner } from './_home/OrganizerBanner';
import { OwnedLakesCard } from './_home/OwnedLakesCard';
import { PartidaCta } from './_home/PartidaCta';
import { PrivacySettingsCard } from './_home/PrivacySettingsCard';
import { DesktopGreeting, DesktopGreetingSkeleton, ProfileCard, ProfileCardSkeleton } from './_home/ProfileCard';
import { CompetitionsPrerendered, LakesPrerendered, NewsPrerendered, SponsorsPrerendered } from './_home/prerendered';
import { PUBLIC_HOME_TAGS, publicHomeQueries } from './_home/queries';
import {
  BookingsBadgeSlot,
  MobileDockSlot,
  PartidaCtaSlot,
  PollSlot,
  RaffleSlot,
  RightColumnLiveSlot,
  SignedOutOnly,
  SuggestedAnglersSlot,
} from './_home/slots';
import { SponsorsSection } from './_home/SponsorsSection';
import { StickyAside } from './_home/StickyAside';
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
 * Acasă — design/Acasa.dc.html, behaviour from fish app/(app)/(tabs)/index.tsx.
 *
 * Two compositions of the same blocks: below 1280px the fish order, one column (a mobile/tablet
 * screen); from 1280px a main column for fishing (competitions, lakes, anglers, news) and a sticky
 * right column «ce mă așteaptă» (my partidă / live competition, organiser panel, my lake, tools,
 * poll). Only one is displayed; the other is `display: none` and out of the accessibility tree.
 *
 * Public rails (competitions, lakes, news, sponsors) are TanStack client sections: TanStack reads
 * the current time while building query state, so each sits in its own <Suspense> whose fallback
 * is the same markup rendered on the server from the cached first page (_home/prerendered.tsx) —
 * the static shell carries headings and first cards, the live section takes over at request time.
 * Every per-user block awaits the session inside its own <Suspense> and streams in.
 */
export default function Home() {
  return (
    <HydrateQueries queries={publicHomeQueries} tags={PUBLIC_HOME_TAGS}>
      <script
        type="application/ld+json"
        // `<` escaped so no string can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()).replace(/</g, '\\u003c') }}
      />
      <h1 className="sr-only">Bluvi · Acasă</h1>

      {/* < 1280: fish (tabs)/index.tsx order */}
      <div className="flex flex-col gap-2.5 px-5 pt-5 pb-5 md:px-6 md:pt-6 xl:hidden">
        <Suspense fallback={<ProfileCardSkeleton />}>
          <ProfileCard />
        </Suspense>
        <Suspense fallback={null}>
          <OrganizerBanner layout="mobile" className="-mx-[5px]" />
        </Suspense>
        <Suspense fallback={null}>
          <OwnedLakesCard layout="mobile" className="-mx-[5px]" />
        </Suspense>
        <Widgets
          layout="mobile"
          bookingsBadge={
            <Suspense fallback={null}>
              <BookingsBadgeSlot />
            </Suspense>
          }
        />
        <Suspense fallback={<PartidaCta signedIn={false} layout="mobile" className="-mx-[5px]" />}>
          <PartidaCtaSlot layout="mobile" className="-mx-[5px]" />
        </Suspense>
        <Suspense fallback={<CompetitionsPrerendered layout="rail" />}>
          <CompetitionsSection layout="rail" />
        </Suspense>
        <Suspense fallback={null}>
          <PollSlot layout="mobile" />
        </Suspense>
        <Suspense fallback={null}>
          <RaffleSlot />
        </Suspense>
        <Suspense fallback={null}>
          <SuggestedAnglersSlot layout="rail" />
        </Suspense>
        <Suspense fallback={<LakesPrerendered layout="rail" />}>
          <LakesSection layout="rail" />
        </Suspense>
        <LakeRequestBanner layout="mobile" />
        <Suspense fallback={<SponsorsPrerendered layout="mobile" />}>
          <SponsorsSection layout="mobile" />
        </Suspense>
        <Suspense fallback={<NewsPrerendered layout="rail" />}>
          <NewsSection layout="rail" />
        </Suspense>
        <FeedbackSection layout="mobile" />
        <Suspense fallback={null}>
          <SignedOutOnly>
            <ContactCard />
            <PrivacySettingsCard />
          </SignedOutOnly>
        </Suspense>
        <Suspense fallback={null}>
          <MobileDockSlot />
        </Suspense>
      </div>

      {/* ≥ 1280: main column + «ce mă așteaptă» */}
      <div className="hidden items-start gap-7 px-8 pt-8 pb-14 xl:grid xl:grid-cols-[minmax(0,1fr)_328px]">
        <div className="flex min-w-0 flex-col gap-7">
          <Suspense fallback={<DesktopGreetingSkeleton />}>
            <DesktopGreeting />
          </Suspense>
          <Suspense fallback={<CompetitionsPrerendered layout="grid" />}>
            <CompetitionsSection layout="grid" />
          </Suspense>
          <Suspense fallback={<LakesPrerendered layout="grid" />}>
            <LakesSection layout="grid" />
          </Suspense>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            <Suspense fallback={<PartidaCta signedIn={false} layout="desktop" />}>
              <PartidaCtaSlot layout="desktop" />
            </Suspense>
            <LakeRequestBanner layout="desktop" />
          </div>
          <Suspense fallback={null}>
            <SuggestedAnglersSlot layout="grid" />
          </Suspense>
          <Suspense fallback={<SponsorsPrerendered layout="desktop" />}>
            <SponsorsSection layout="desktop" />
          </Suspense>
          <Suspense fallback={<NewsPrerendered layout="grid" />}>
            <NewsSection layout="grid" />
          </Suspense>
        </div>

        <StickyAside label="Ce mă așteaptă" className="flex flex-col gap-3.5">
          <Suspense fallback={null}>
            <RightColumnLiveSlot />
          </Suspense>
          <Suspense fallback={null}>
            <OrganizerBanner layout="desktop" />
          </Suspense>
          <Suspense fallback={null}>
            <OwnedLakesCard layout="desktop" />
          </Suspense>
          <Widgets
            layout="desktop"
            bookingsBadge={
              <Suspense fallback={null}>
                <BookingsBadgeSlot />
              </Suspense>
            }
          />
          <Suspense fallback={null}>
            <PollSlot layout="desktop" />
          </Suspense>
          <Suspense fallback={null}>
            <RaffleSlot />
          </Suspense>
          <AppPromo />
          <FeedbackSection layout="desktop" />
          <Suspense fallback={null}>
            <SignedOutOnly>
              <ContactCard />
              <PrivacySettingsCard />
            </SignedOutOnly>
          </Suspense>
        </StickyAside>
      </div>
    </HydrateQueries>
  );
}

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
