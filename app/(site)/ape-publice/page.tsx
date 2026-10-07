import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { T2Viewport } from '@/components/templates/T2';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { PublicWatersMapScreen } from './_components/map/PublicWatersMapScreen';

/*
 * Ape publice — hartă și listă (parity public-waters.harta-ape, fish Bălți tab in «Ape publice»
 * mode). The map and its list are browser state (viewport, filters, selection) over the bundled
 * ANAR dataset served by ./api; the page shell is static.
 */

const DESCRIPTION =
  'Harta apelor publice din România — râuri, lacuri naturale și de acumulare din datele ANAR. Caută o apă, filtrează pe județe și vezi partidele și capturile pescarilor.';

export const metadata: Metadata = {
  title: 'Ape publice · hartă râuri și lacuri',
  description: DESCRIPTION,
  alternates: { canonical: routes.publicWaters() },
  openGraph: { type: 'website', title: 'Ape publice', description: DESCRIPTION, url: absoluteUrl(routes.publicWaters()), siteName: 'Bluvi', locale: 'ro_RO' },
  twitter: { card: 'summary_large_image', title: 'Ape publice', description: DESCRIPTION },
};

/** The page as a collection of the waters on its map, and its place under Bălți (the shell's trail). */
const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Ape publice',
    description: DESCRIPTION,
    url: absoluteUrl(routes.publicWaters()),
    inLanguage: 'ro-RO',
  },
  breadcrumbListJsonLd([{ label: 'Bălți', href: routes.lakes() }, { label: 'Ape publice' }], routes.publicWaters()),
];

export default function PublicWatersPage() {
  return (
    <T2Viewport>
      <JsonLd data={JSON_LD} />
      <PublicWatersMapScreen />
    </T2Viewport>
  );
}
