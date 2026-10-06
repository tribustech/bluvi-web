import type { MetadataRoute } from 'next';
import { sitemapEntries } from '@/lib/server/sitemap-entries';
import { createServerTransport } from '@/lib/server/transport';
import { allPublicWaterKeys } from './(site)/ape-publice/_server/source';

/**
 * Built from the same cached public CMS reads as the pages, so a CMS purge refreshes it too; the
 * public waters come from the bundled dataset the pages read.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return sitemapEntries(createServerTransport(), allPublicWaterKeys);
}
