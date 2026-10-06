import type { Metadata } from 'next';
import { newsInfiniteQuery } from '@/core/news';
import { HydrateQueries } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { firstNewsPage } from './_content/firstPage';
import { NEWS_PAGE_SIZE } from './_content/pageSize';
import { NewsList } from './_list/NewsList';
import { jsonLdHtml } from '@/lib/json-ld';

/*
 * Noutăți — fish app/(app)/news/index.tsx (parity home.stiri), template T1.
 *
 * Static: the first page is the cached public read of /feed/announcements (CDN 5 min, tag
 * `announcements-list`, purged by the CMS on every announcement write through /api/revalidate),
 * hydrated into the browser's query (same factory, same key: ['news', { pageSize: 12 }]), so the
 * twelve newest cards and their links are in the HTML. A failed server read is skipped: the browser
 * then reads it itself, with the list's skeleton, error and retry — and the static page lives only
 * minutes (firstNewsPage's cacheLife), so the next visitor gets the cards in the HTML again.
 */

const DESCRIPTION = 'Descoperă cele mai recente noutăți din lumea pescarilor: anunțuri, concursuri, evenimente și tehnici de pescuit pe Bluvi.';

export const metadata: Metadata = {
  title: 'Noutăți',
  description: DESCRIPTION,
  alternates: { canonical: routes.news() },
  openGraph: {
    type: 'website',
    title: 'Noutăți · Bluvi',
    description: DESCRIPTION,
    url: absoluteUrl(routes.news()),
    siteName: 'Bluvi',
    locale: 'ro_RO',
  },
  twitter: { card: 'summary', title: 'Noutăți · Bluvi', description: DESCRIPTION },
};

export default function NewsPage() {
  return (
    <>
      <NewsJsonLd />
      <HydrateQueries queries={(t) => [newsInfiniteQuery(t, { pageSize: NEWS_PAGE_SIZE })]} tags={['announcements-list']}>
        <NewsList />
      </HydrateQueries>
    </>
  );
}

/** schema.org CollectionPage + the first page as an ItemList (the same cached read as the list). */
async function NewsJsonLd() {
  // A failed read: no ItemList (the list's own read reports the failure) and a short-lived page.
  const items = (await firstNewsPage()) ?? [];
  const data = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Noutăți',
    description: DESCRIPTION,
    url: absoluteUrl(routes.news()),
    inLanguage: 'ro-RO',
    ...(items.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: items.map((n, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: absoluteUrl(routes.newsItem(n.documentId)),
              name: n.title,
            })),
          },
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      // `<` escaped so a title can never close the script element.
      dangerouslySetInnerHTML={jsonLdHtml(data)}
    />
  );
}
