import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { sitemapEntries } from './sitemap-entries';

const page = (data: unknown[], pageCount = 1, p = 1) => ({ data, meta: { pagination: { page: p, pageSize: 100, pageCount, total: data.length } } });

describe('sitemapEntries', () => {
  it('lists static pages, every lake, competitions of every status and news', async () => {
    const { transport, calls } = createFakeTransport(req => {
      if (req.path === '/feed/lakes/index') return { data: [{ documentId: 'lk1', name: 'Balta', locality: null, lat: 44, lng: 26, thumb: null }] };
      if (req.path === '/feed/announcements') return page([{ documentId: 'n1', title: 't', shortDescription: null, category: 'Noutati', createdAt: '2026-09-01T00:00:00Z', banner: null }]);
      if (req.path === '/feed/sponsors/dashboard') return { data: [{ documentId: 'sp1', name: 'Sponsor', url: null, image: null }] };
      return { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } };
    });
    const urls = (await sitemapEntries(transport, () => ['R:RO11_01.018_R1', 42])).map(e => e.url);
    expect(urls).toContain('http://localhost:3000/balti/lk1');
    expect(urls).toContain('http://localhost:3000/stiri/n1');
    expect(urls).toContain('http://localhost:3000/sponsori/sp1');
    expect(urls).toContain('http://localhost:3000/ape-publice/R%3ARO11_01.018_R1');
    expect(urls).toContain('http://localhost:3000/ape-publice/42');
    expect(urls).toContain('http://localhost:3000/');
    // The list pages, from lib/routes.ts.
    for (const path of ['/balti', '/balti/harta', '/ape-publice', '/concursuri', '/concursuri/live', '/concursuri/viitoare', '/concursuri/rezultate', '/stiri']) {
      expect(urls).toContain(`http://localhost:3000${path}`);
    }
    const statuses = calls.filter(c => c.path === '/feed/competitions').map(c => c.query?.status);
    expect(statuses).toEqual(['notStarted', 'started', 'completed']);
  });

  it('keeps the rest when one list fails', async () => {
    const { transport } = createFakeTransport(req => {
      if (req.path === '/feed/lakes/index') throw new Error('down');
      return { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } };
    });
    const urls = (await sitemapEntries(transport)).map(e => e.url);
    expect(urls).toContain('http://localhost:3000/balti');
  });
});
