import type { MetadataRoute } from 'next';
import { sitemapChunk, sitemapIds } from '@/lib/server/sitemap-entries';
import { createServerTransport } from '@/lib/server/transport';
import { allPublicWaterKeys } from '../(site)/ape-publice/_server/source';

/*
 * The sitemaps, split by group (lib/server/sitemap-entries.ts sitemapIds): served at
 * /sitemaps/sitemap/<id>.xml and listed by the index at /sitemap.xml (app/sitemap.xml/route.ts),
 * which robots.txt names. Built from the same cached public CMS reads as the pages, so a CMS purge
 * refreshes them too; the public waters come from the bundled dataset the pages read.
 */

export async function generateSitemaps() {
  return (await sitemapIds(createServerTransport(), allPublicWaterKeys)).map(id => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  return sitemapChunk(createServerTransport(), await id, allPublicWaterKeys);
}
