import 'server-only';
import { cache } from 'react';
import { getSponsorById, getSponsors, type SponsorDashboard, type SponsorDetail } from '@/core/competitions';
import { getNews, getNewsById, type AnnouncementDetail, type AnnouncementListItem } from '@/core/news';
import { ApiError, isApiError } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';
import { NEWS_PAGE_SIZE } from './pageSize';
import { withRetry } from './retry';

/*
 * The server reads of Știre and Sponsor. All are public CMS GETs (`auth: 'none'`), so they go
 * through the cached public GET (lib/server/public-get.ts) under the CMS's own CDN-Cache-Control
 * (announcement 10 min, list 5 min, sponsors 1 day) and its X-Cache-Tag tags
 * (`announcement-<id>`, `announcements-list`, `sponsor-<id>`, `sponsors`), which a CMS write purges
 * through /api/revalidate. The pages are therefore static and refresh on publish (ISR by tag).
 *
 * The main read is bounded (T3 data-loading contract): the cached public GET takes no AbortSignal,
 * so a hung CMS would never reach error.tsx; past READ_TIMEOUT_MS it rejects with a retryable
 * network error. A 404 (or 400, a malformed id) is «missing» → notFound().
 *
 * A short CMS blip (a 5xx, a dropped connection) is retried quietly before error.tsx shows — fish's
 * default QueryClient retries useNewsById / useSponsorById behind its LoadingScreen the same way:
 * up to RETRIES more tries with a short backoff, all inside the one READ_TIMEOUT_MS budget.
 */

const READ_TIMEOUT_MS = 8000;

async function bounded<T>(p: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ApiError({ message: `${what}: timeout`, status: 0, code: 'NETWORK', path: what })),
      READ_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type Load<T> = { kind: 'ok'; data: T } | { kind: 'missing' };

async function load<T>(read: () => Promise<T>, what: string): Promise<Load<T>> {
  try {
    return { kind: 'ok', data: await bounded(withRetry(read), what) };
  } catch (e) {
    if (isApiError(e) && (e.status === 404 || e.status === 400)) return { kind: 'missing' };
    throw e;
  }
}

/** fish useNewsById — one read per request for generateMetadata + the page. */
export const loadNews = cache(
  (id: string): Promise<Load<AnnouncementDetail>> =>
    load(() => getNewsById(createServerTransport(), id), `/feed/announcements/${id}`),
);

/** fish useSponsorById. */
export const loadSponsor = cache(
  (id: string): Promise<Load<SponsorDetail>> =>
    load(async () => (await getSponsorById(createServerTransport(), id)).data, `/feed/sponsors/${id}`),
);

/** The list's first page (Noutăți's own page, NEWS_PAGE_SIZE): the article's «Alte noutăți». Never throws. */
export const latestNews = cache(async (): Promise<AnnouncementListItem[] | null> => {
  try {
    const page = await bounded(getNews(createServerTransport(), { page: 1, pageSize: NEWS_PAGE_SIZE }), '/feed/announcements');
    return page.data;
  } catch (e) {
    console.error('[stire] latest news failed', e);
    return null;
  }
});

/** The sponsor dashboard list (Acasă's «Sponsori»): the sponsor page's «Alți sponsori». Never throws. */
export const allSponsors = cache(async (): Promise<SponsorDashboard[] | null> => {
  try {
    return (await bounded(getSponsors(createServerTransport()), '/feed/sponsors/dashboard')).data;
  } catch (e) {
    console.error('[sponsor] sponsors list failed', e);
    return null;
  }
});

/** Ids to prerender (Cache Components needs at least one; an unknown placeholder renders the 404). */
export async function newsIds(): Promise<string[]> {
  try {
    return (await getNews(createServerTransport(), { page: 1, pageSize: 200 })).data.map((n) => n.documentId);
  } catch (e) {
    console.error('[stire] generateStaticParams failed', e);
    return [];
  }
}

export async function sponsorIds(): Promise<string[]> {
  try {
    return (await getSponsors(createServerTransport())).data.map((s) => s.documentId);
  } catch (e) {
    console.error('[sponsor] generateStaticParams failed', e);
    return [];
  }
}
