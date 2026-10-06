import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getLakesHome, lakesHomeQuery, splitLakesHomeSections } from '@/core/lakes';
import { HydrateQueries } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { HomeHeader } from './_list/HomeHeader';
import { HomeSkeleton } from './_list/HomeRow';
import { CategoryBarSkeleton, HomeGridSkeleton } from './_list/HomeGrid';
import { GeoHintScript } from './_list/GeoHintScript';
import { HOME_PARAMS } from './_list/homeParams';
import { LakesHome } from './_list/LakesHome';
import { jsonLdHtml } from '@/lib/json-ld';

/*
 * Bălți (parity lakes.home) — fish app/(app)/(tabs)/lakes/index.tsx, home mode. The page is the
 * client LakesHome (location, per-browser recents, the search and filter layers); the server
 * prefetches the rows a visitor without location sees (/lakes/home, CMS tag «lakes-list», the
 * same HOME_PARAMS the client starts from) and LakesHome renders them on the server pass — recents
 * read «none yet» there and never gate the rows — so the HTML lists the lakes (SEO, e2e
 * «lakes.home.c24 SSR») and the browser starts from them. The prefetch needs the CMS Public grant
 * on lake.home; without it the read fails, the HTML carries the skeleton and the browser reads.
 * TanStack reads the clock while it builds query state, so the hydrated part sits in its own
 * <Suspense>, whose fallback is the same header over the rows' skeleton.
 */

const TITLE = 'Bălți de pescuit din România';
const DESCRIPTION =
  'Găsește bălți de pescuit din toată țara: bălți aproape de tine, cu rezervare online, cu reținere sau cu căsuțe, cu recenzii de la pescari. Caută după județ sau localitate și vezi-le pe hartă.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: routes.lakes() },
  openGraph: { type: 'website', url: routes.lakes(), siteName: 'Bluvi', locale: 'ro_RO', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

export default function LakesPage() {
  return (
    <div className="px-4 md:px-6 xl:px-8">
      {/* Before the nearby slot paints: which box to reserve for it (./_list/geoHint.ts). */}
      <GeoHintScript />
      <Suspense
        fallback={
          <>
            <HomeHeader categories={<CategoryBarSkeleton />} />
            <p className="sr-only">Se încarcă bălțile</p>
            <div className="pt-4 pb-28 md:pt-5 md:pb-12">
              <div className="md:hidden">
                <HomeSkeleton />
              </div>
              <div aria-hidden className="max-md:hidden">
                <HomeGridSkeleton />
              </div>
            </div>
          </>
        }
      >
        <LakesJsonLd />
        <HydrateQueries queries={(t) => [lakesHomeQuery(t, HOME_PARAMS)]} tags={['lakes-list']}>
          <LakesHome />
        </HydrateQueries>
      </Suspense>
    </div>
  );
}

/**
 * CollectionPage + ItemList of the lakes the rows show (each lake once, in row order). A failed
 * read leaves the page without it (the client shows its own error state).
 */
async function LakesJsonLd() {
  let lakes: { documentId: string; name: string }[] = [];
  try {
    const { allLakesSection, fixedSections } = splitLakesHomeSections(await getLakesHome(createServerTransport(), HOME_PARAMS));
    const seen = new Set<string>();
    for (const l of [allLakesSection, ...fixedSections].flatMap((s) => s?.lakes ?? [])) {
      if (seen.has(l.documentId)) continue;
      seen.add(l.documentId);
      lakes.push({ documentId: l.documentId, name: l.name });
    }
  } catch {
    lakes = [];
  }
  if (!lakes.length) return null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl(routes.lakes()),
    inLanguage: 'ro-RO',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: lakes.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(routes.lake(l.documentId)),
        name: l.name,
      })),
    },
  };
  return (
    <script
      type="application/ld+json"
      // `<` escaped so no string can close the script tag.
      dangerouslySetInnerHTML={jsonLdHtml(jsonLd)}
    />
  );
}
