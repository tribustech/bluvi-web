import type { MetadataRoute } from 'next';
import { sitemapEntries } from '@/lib/server/sitemap-entries';
import { createServerTransport } from '@/lib/server/transport';

/** Built from the same cached public CMS reads as the pages, so a CMS purge refreshes it too. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(createServerTransport());
}
