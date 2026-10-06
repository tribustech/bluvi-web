import type { Metadata } from 'next';
import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/JsonLd';
import { T2Viewport } from '@/components/templates/T2';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { LakesMap } from '../_list/LakesMap';
import { MapFallback } from '../_list/MapFallback';

/*
 * Hartă bălți (parity lakes.results-map, template T2) — fish's results mode of the Bălți tab as its
 * own page. Everything on it is the browser's (the map, the viewport-scoped list, location), and
 * its state is the URL's query (../_list/url.ts), read with useSearchParams — so the page is the
 * static frame (MapFallback) and LakesMap streams in behind it. Filtered variants share the
 * canonical: they are views of one page.
 */

const TITLE = 'Harta bălților de pescuit';
const DESCRIPTION =
  'Toate bălțile de pescuit din România pe hartă: filtrează după regim, facilități, pești, rating și rezervare online, caută după județ sau localitate ori vezi bălțile din jurul tău.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: routes.lakesMap() },
  openGraph: { type: 'website', url: routes.lakesMap(), siteName: 'Bluvi', locale: 'ro_RO', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
};

/** The page as a map of the lakes, and its place under Bălți. */
const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl(routes.lakesMap()),
    inLanguage: 'ro-RO',
  },
  breadcrumbListJsonLd([{ label: 'Bălți', href: routes.lakes() }, { label: 'Hartă' }], routes.lakesMap()),
];

export default function LakesMapPage() {
  return (
    <T2Viewport>
      <JsonLd data={JSON_LD} />
      <Suspense fallback={<MapFallback />}>
        <LakesMap />
      </Suspense>
    </T2Viewport>
  );
}
