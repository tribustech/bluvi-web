import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/transport';
import { newsKeys } from '@/core/news';
import { NEWS_PAGE_SIZE } from '../_content/pageSize';
import { NewsList, previousIsInApp } from './NewsList';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: () => {}, push: () => {} }) }));

/*
 * The first-page states of Noutăți (home.stiri.s1 loading, s2 error, s3 empty) — the server prefetch
 * fills the list in production, so these only show when it failed and the browser reads it; the
 * cache is set here to each state and the list rendered.
 */
function render(setup: (qc: QueryClient) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
  setup(qc);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client: qc }, createElement(NewsList)));
}

const key = newsKeys.list(NEWS_PAGE_SIZE);
const page = (data: unknown[], p = 1, pageCount = 1) => ({ data, meta: { pagination: { page: p, pageSize: 5, pageCount, total: data.length } } });

describe('Noutăți first-page states', () => {
  it('home.stiri.c1 — header «Noutăți» with a back button and the intro', () => {
    const out = render(() => {});
    expect(out).toMatch(/<h1[^>]*>Noutăți<\/h1>/);
    expect(out).toContain('aria-label="Înapoi"');
    expect(out).toContain('Descoperă cele mai recente noutăți din lumea pescarilor.');
  });

  it('home.stiri.c3 / s1 — loading: the cards skeleton', () => {
    const out = render(() => {});
    expect(out).toContain('Se încarcă noutățile…');
    expect(out.match(/<li class="overflow-hidden rounded-card/g)).toHaveLength(NEWS_PAGE_SIZE);
  });

  it('home.stiri.c3 / s2 — error: the error card with «Încearcă din nou»', () => {
    const out = render((qc) => {
      const q = qc.getQueryCache().build(qc, { queryKey: key });
      q.setState({ status: 'error', error: new ApiError({ message: 'x', status: 503, code: 'HTTP', path: '/feed/announcements' }) });
    });
    expect(out).toContain('role="alert"');
    expect(out).toContain('Serverul nu răspunde');
    expect(out).toContain('Încearcă din nou');
  });

  it('home.stiri.c4 / s3 — empty: «Momentan nu există noutăți.»', () => {
    const out = render((qc) => qc.setQueryData(key, { pages: [page([])], pageParams: [1] }));
    expect(out).toContain('Momentan nu există noutăți.');
  });

  it('home.stiri.s6 — end of list: no footer once the last page is in', () => {
    const item = { documentId: 'a', title: 'T', shortDescription: 'D', category: 'Noutati', createdAt: '2026-09-07T11:45:41.143Z', banner: null };
    const out = render((qc) => qc.setQueryData(key, { pages: [page([item])], pageParams: [1] }));
    expect(out).toContain('href="/stiri/a"');
    expect(out).not.toContain('Încarcă mai multe');
  });
});

describe('home.stiri.c1 — «Înapoi» goes back only to a Bluvi page', () => {
  const win = (over: { index?: number; length?: number }) => ({
    ...(over.index === undefined ? {} : { navigation: { currentEntry: { index: over.index } } }),
    history: { length: over.length ?? 2 },
    location: { origin: 'https://bluvi.ro' },
  });
  it('Navigation API: back only when a same-origin entry precedes this one', () => {
    expect(previousIsInApp(win({ index: 1 }), '')).toBe(true);
    expect(previousIsInApp(win({ index: 0, length: 5 }), 'https://www.google.com/')).toBe(false);
  });
  it('without it: history behind AND a same-origin referrer', () => {
    expect(previousIsInApp(win({ length: 3 }), 'https://bluvi.ro/')).toBe(true);
    expect(previousIsInApp(win({ length: 3 }), 'https://www.google.com/')).toBe(false);
    expect(previousIsInApp(win({ length: 3 }), '')).toBe(false);
    expect(previousIsInApp(win({ length: 1 }), 'https://bluvi.ro/')).toBe(false);
  });
});
