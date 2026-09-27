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
});
