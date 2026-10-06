import { describe, expect, it } from 'vitest';
import { getNews, getNewsById } from '@/core/news';
import { contractContext } from './context';

const { guest, user } = contractContext();

describe('news', () => {
  it('lists and opens announcements as guest and as user', async () => {
    for (const t of [guest, user]) {
      const list = await getNews(t, { page: 1, pageSize: 25 });
      expect(list.meta.pagination.page).toBe(1);
      for (const a of list.data.slice(0, 5)) {
        const detail = await getNewsById(t, a.documentId);
        expect(detail.documentId).toBe(a.documentId);
      }
    }
  });

  it('pages the list 5 at a time, as the Noutăți screen does (home.stiri.c2)', async () => {
    const first = await getNews(guest, { page: 1, pageSize: 5 });
    expect(first.data.length).toBeLessThanOrEqual(5);
    if (first.meta.pagination.pageCount < 2) return;
    const second = await getNews(guest, { page: 2, pageSize: 5 });
    expect(second.meta.pagination.page).toBe(2);
    const ids = new Set(first.data.map(a => a.documentId));
    expect(second.data.some(a => ids.has(a.documentId))).toBe(false);
  });

  it('parses every announcement detail (all content block types in the local CMS)', async () => {
    // The CMS caps pageSize at 100; walk every page.
    let page = 1;
    let pageCount = 1;
    do {
      const list = await getNews(guest, { page, pageSize: 100 });
      pageCount = list.meta.pagination.pageCount;
      for (const a of list.data) {
        const detail = await getNewsById(guest, a.documentId);
        expect(detail.documentId).toBe(a.documentId);
      }
      page += 1;
    } while (page <= pageCount);
  });
});
