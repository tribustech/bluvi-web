import 'server-only';
import type { MetadataRoute } from 'next';
import { getCompetitionsByStatus } from '@/core/competitions';
import { getLakesIndex } from '@/core/lakes';
import { getNews } from '@/core/news';
import type { Transport } from '@/core/transport';
import { absoluteUrl, routes } from '@/lib/routes';

type Entry = MetadataRoute.Sitemap[number];

/** Guard rail: the CMS is paginated; never walk more than this many pages of one list. */
const MAX_PAGES = 50;
const COMPETITION_STATUSES = ['notStarted', 'started', 'completed'] as const;

export function staticEntries(): Entry[] {
  return [
    { url: absoluteUrl(routes.home()), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl(routes.lakes()), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl(routes.competitions()), changeFrequency: 'hourly', priority: 0.9 },
    { url: absoluteUrl(routes.news()), changeFrequency: 'daily', priority: 0.6 },
  ];
}

export async function lakeEntries(t: Transport): Promise<Entry[]> {
  const lakes = await getLakesIndex(t);
  return lakes.map(l => ({ url: absoluteUrl(routes.lake(l.documentId)), changeFrequency: 'weekly', priority: 0.8 }));
}

export async function competitionEntries(t: Transport): Promise<Entry[]> {
  const out: Entry[] = [];
  for (const status of COMPETITION_STATUSES) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await getCompetitionsByStatus(t, status, { page, pageSize: 100 });
      for (const c of res.data) {
        out.push({
          url: absoluteUrl(routes.competition(c.documentId)),
          changeFrequency: status === 'completed' ? 'monthly' : 'hourly',
          priority: status === 'completed' ? 0.5 : 0.8,
        });
      }
      if (page >= res.meta.pagination.pageCount) break;
    }
  }
  return out;
}

export async function newsEntries(t: Transport): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await getNews(t, { page, pageSize: 200 });
    for (const a of res.data) {
      out.push({ url: absoluteUrl(routes.newsItem(a.documentId)), lastModified: a.createdAt, changeFrequency: 'monthly', priority: 0.4 });
    }
    if (page >= res.meta.pagination.pageCount) break;
  }
  return out;
}

/**
 * All sitemap entries. A list that fails is left out (and logged) rather than failing the whole
 * sitemap — search engines keep the previous copy of what is missing.
 */
export async function sitemapEntries(t: Transport): Promise<Entry[]> {
  const parts = await Promise.allSettled([lakeEntries(t), competitionEntries(t), newsEntries(t)]);
  const dynamic = parts.flatMap((p, i) => {
    if (p.status === 'fulfilled') return p.value;
    console.error(`[sitemap] ${['lakes', 'competitions', 'news'][i]} failed`, p.reason);
    return [];
  });
  return [...staticEntries(), ...dynamic];
}
