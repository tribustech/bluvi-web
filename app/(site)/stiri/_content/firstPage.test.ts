import { beforeEach, describe, expect, it, vi } from 'vitest';

const cacheLife = vi.fn();
const cacheTag = vi.fn();
const getNews = vi.fn();
vi.mock('next/cache', () => ({ cacheLife: (...a: unknown[]) => cacheLife(...a), cacheTag: (...a: unknown[]) => cacheTag(...a) }));
vi.mock('@/core/news', () => ({ getNews: (...a: unknown[]) => getNews(...a) }));
vi.mock('@/lib/server/transport', () => ({ createServerTransport: () => ({}) }));

const { firstNewsPage } = await import('./firstPage');

describe('home.stiri.c7 — the static first page and its lifetime', () => {
  beforeEach(() => {
    cacheLife.mockReset();
    cacheTag.mockReset();
    getNews.mockReset();
  });

  it('a good read: the items, tagged announcements-list, cached until purged', async () => {
    getNews.mockResolvedValue({ data: [{ documentId: 'a', title: 'A', extra: 1 }] });
    await expect(firstNewsPage()).resolves.toEqual([{ documentId: 'a', title: 'A' }]);
    expect(cacheTag).toHaveBeenCalledWith('announcements-list');
    expect(cacheLife).toHaveBeenCalledWith('max');
  });

  it('a failed read (CMS down at prerender): null, and the page lives only minutes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getNews.mockRejectedValue(new Error('down'));
    await expect(firstNewsPage()).resolves.toBeNull();
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith('minutes');
    expect(cacheTag).not.toHaveBeenCalled();
  });
});
