import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { buildLanding, readLandingLakes, type Landing, type LandingLake } from '@/lib/lake-landing';
import { createServerTransport } from './transport';

/*
 * The lakes behind the SEO landing pages (lib/lake-landing.ts), read once and shared by every one
 * of them (≈80 prerendered pages) and by their generateStaticParams.
 *
 * One 'use cache' entry with its own, explicit life: the CMS sends /feed/lakes/filtered with a 60 s
 * CDN life, and a 60 s entry shared by many prerendered pages is the «Unexpected cache miss after
 * cache warming phase» class (docs/reviews/M8-notes.md). The explicit outer cacheLife wins over the
 * inner reads' (Next: «With explicit outer cacheLife»); the CMS tag `lakes-list` (purged on every lake
 * write, /api/revalidate) keeps it fresh, the hour is only the floor if a purge is lost. No argument:
 * one key. A failed read is kept `minutes` (never under 5 min of expire, M8) and answers null.
 */
async function landingLakes(): Promise<LandingLake[] | null> {
  'use cache';
  cacheTag('lakes-list');
  try {
    const lakes = await readLandingLakes(createServerTransport());
    cacheLife({ stale: 300, revalidate: 3600, expire: 7 * 24 * 60 * 60 });
    return lakes;
  } catch {
    cacheLife('minutes');
    return null;
  }
}

/** The landing groups, or null when the lakes could not be read. */
export async function getLanding(): Promise<Landing | null> {
  const lakes = await landingLakes();
  return lakes ? buildLanding(lakes) : null;
}
