import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { getNews } from '@/core/news';
import { createServerTransport } from '@/lib/server/transport';
import { NEWS_PAGE_SIZE } from './pageSize';

export type FirstPageItem = { documentId: string; title: string };

/**
 * Noutăți's first page for the static HTML (the ItemList JSON-LD), and the page's lifetime. A
 * good read lives until the CMS purges `announcements-list`; a failed one (CMS down at prerender
 * or revalidation) lives a minute — and the static page with it (a page lives as long as its
 * shortest cache), so a client-only list with no ItemList is never baked in until the next write.
 */
export async function firstNewsPage(): Promise<FirstPageItem[] | null> {
  'use cache';
  try {
    const page = await getNews(createServerTransport(), { page: 1, pageSize: NEWS_PAGE_SIZE });
    cacheTag('announcements-list');
    cacheLife('max');
    return page.data.map((n) => ({ documentId: n.documentId, title: n.title }));
  } catch (e) {
    console.error('[stiri] first page failed', e);
    cacheLife('minutes');
    return null;
  }
}
