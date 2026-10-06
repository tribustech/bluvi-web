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

describe('news detail content', () => {
  it('drops block types fish does not render instead of failing the article', async () => {
    const detail = {
      ...item,
      content: [
        { __component: 'news-block.simple-text', id: 1, text: [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }] },
        { __component: 'news-block.video-embed', id: 2, url: 'https://x' },
        null,
        { __component: 'news-block.simple-image', id: 3, image: null },
      ],
    };
    const { transport } = createFakeTransport([{ data: detail }]);
    const parsed = await getNewsById(transport, 'e75u');
    expect(parsed.content?.map(b => b.__component)).toEqual(['news-block.simple-text', 'news-block.simple-image']);
  });

  it('still rejects a known block with a wrong shape', async () => {
    const detail = { ...item, content: [{ __component: 'news-block.simple-text', id: 1, text: 'not blocks' }] };
    const { transport } = createFakeTransport([{ data: detail }]);
    await expect(getNewsById(transport, 'e75u')).rejects.toThrow();
  });

  it('home.stire.c6 — a text block saved empty (text null) parses; the other blocks stay', async () => {
    const detail = {
      ...item,
      content: [
        { __component: 'news-block.simple-text', id: 1, text: null },
        { __component: 'news-block.image-left-text-right', id: 2, text: null, image: null },
        { __component: 'news-block.image-right-text-left', id: 3, image: null },
        { __component: 'news-block.simple-text', id: 4, text: [{ type: 'paragraph', children: [{ type: 'text', text: 'x' }] }] },
      ],
    };
    const { transport } = createFakeTransport([{ data: detail }]);
    const parsed = await getNewsById(transport, 'e75u');
    expect(parsed.content).toHaveLength(4);
    expect(parsed.content?.[0]).toMatchObject({ text: null });
  });

  it('keeps a null content', async () => {
    const { transport } = createFakeTransport([{ data: { ...item, content: null } }]);
    await expect(getNewsById(transport, 'e75u')).resolves.toMatchObject({ content: null });
  });
});

describe('news queries', () => {
  it('news is fresh for one hour (fish useNews staleTime / gcTime)', () => {
    const { transport } = createFakeTransport();
    const q = newsInfiniteQuery(transport, { pageSize: 5 });
    expect(q.queryKey).toEqual(['news', { pageSize: 5 }]);
    expect(q.staleTime).toBe(60 * 60 * 1000);
    expect(q.gcTime).toBe(60 * 60 * 1000);
  });

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
