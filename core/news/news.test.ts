import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { getNews, getNewsById } from './api';
import { newsByIdQuery, newsInfiniteQuery, newsKeys } from './queries';

const item = {
  documentId: 'e75u',
  title: 'Rezervări direct din aplicație',
  shortDescription: 'Chita Lake acceptă acum rezervări.',
  category: 'Noutati',
  createdAt: '2026-09-07T11:45:41.143Z',
  banner: [{ url: 'https://x/a.jpg', mediumUrl: null, blurhash: null }],
};
const list = { data: [item], meta: { pagination: { page: 1, pageSize: 2, pageCount: 19, total: 38 } } };

describe('news api', () => {
  it('lists announcements from /feed/announcements', async () => {
    const { transport, calls } = createFakeTransport([list]);
    await expect(getNews(transport, { page: 1, pageSize: 2 })).resolves.toEqual(list);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/announcements', query: { page: 1, pageSize: 2 }, auth: 'none' });
  });

  it('unwraps the detail', async () => {
    const detail = { ...item, content: [{ __component: 'news-block.simple-text', id: 1, text: [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }] }] };
    const { transport, calls } = createFakeTransport([{ data: detail }]);
    await expect(getNewsById(transport, 'e75u')).resolves.toEqual(detail);
    expect(calls[0].path).toBe('/feed/announcements/e75u');
  });
});

describe('news queries', () => {
  it('keeps the fish key shapes', () => {
    const { transport } = createFakeTransport();
    expect(newsInfiniteQuery(transport).queryKey).toEqual(['news', { pageSize: 200 }]);
    expect(newsByIdQuery(transport, 'a').queryKey).toEqual(newsKeys.byId('a'));
  });

  it('pages until pageCount', () => {
    const { transport } = createFakeTransport();
    const q = newsInfiniteQuery(transport);
    expect(q.getNextPageParam(list, [list], 1, [1])).toBe(2);
    const last = { ...list, meta: { pagination: { ...list.meta.pagination, page: 19 } } };
    expect(q.getNextPageParam(last, [last], 19, [19])).toBeUndefined();
  });
});
