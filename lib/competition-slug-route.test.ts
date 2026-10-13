import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONCURSURI_STATIC_SEGMENTS, competitionRouteAction, competitionSlugMap } from './competition-slug-route';

const map = competitionSlugMap(
  [
    { documentId: 'y1a8131h7otw6ivnohz72ob2', slug: 'cupa-chita-lake-2026' },
    { documentId: 'k646t4o4x3wadzqxn1yqf49l', slug: 'cn-2026-balta-alesteu' },
  ],
  [
    { documentId: 'y1a8131h7otw6ivnohz72ob2', slug: 'cupa-veche-chita-lake-2026' },
    { documentId: 'k646t4o4x3wadzqxn1yqf49l', slug: 'cn-test-balta-alesteu-2026' },
  ]
);

describe('competitionRouteAction', () => {
  it('serves a slug URL from the competition page (rewrite), subpages included', () => {
    expect(competitionRouteAction('/concursuri/cupa-chita-lake-2026', map)).toEqual({ kind: 'rewrite', path: '/concursuri/y1a8131h7otw6ivnohz72ob2' });
    expect(competitionRouteAction('/concursuri/cupa-chita-lake-2026/clasament', map)).toEqual({
      kind: 'rewrite',
      path: '/concursuri/y1a8131h7otw6ivnohz72ob2/clasament',
    });
    expect(competitionRouteAction('/concursuri/cn-2026-balta-alesteu/cantar/s1/w1', map)).toEqual({
      kind: 'rewrite',
      path: '/concursuri/k646t4o4x3wadzqxn1yqf49l/cantar/s1/w1',
    });
  });

  it('sends an old documentId URL to the slug URL (308), subpages included', () => {
    expect(competitionRouteAction('/concursuri/y1a8131h7otw6ivnohz72ob2', map)).toEqual({ kind: 'redirect', path: '/concursuri/cupa-chita-lake-2026' });
    expect(competitionRouteAction('/concursuri/k646t4o4x3wadzqxn1yqf49l/inscriere/echipa', map)).toEqual({
      kind: 'redirect',
      path: '/concursuri/cn-2026-balta-alesteu/inscriere/echipa',
    });
  });

  it('sends an earlier slug (renamed before the start) to the current slug URL (308), the rest of the path kept', () => {
    expect(competitionRouteAction('/concursuri/cupa-veche-chita-lake-2026', map)).toEqual({ kind: 'redirect', path: '/concursuri/cupa-chita-lake-2026' });
    expect(competitionRouteAction('/concursuri/cn-test-balta-alesteu-2026/participanti', map)).toEqual({
      kind: 'redirect',
      path: '/concursuri/cn-2026-balta-alesteu/participanti',
    });
  });

  it('the share images under a documentId URL are served as they are (no redirect hop)', () => {
    expect(competitionRouteAction('/concursuri/y1a8131h7otw6ivnohz72ob2/opengraph-image-1a2b3c', map)).toEqual({ kind: 'pass' });
    expect(competitionRouteAction('/concursuri/cupa-chita-lake-2026/clasament/twitter-image-1a2b3c', map)).toEqual({
      kind: 'rewrite',
      path: '/concursuri/y1a8131h7otw6ivnohz72ob2/clasament/twitter-image-1a2b3c',
    });
  });

  it('leaves the site pages, unknown segments and other paths alone', () => {
    for (const p of ['/concursuri', '/concursuri/live', '/concursuri/viitoare', '/concursuri/rezultate', '/concursuri/opengraph-image', '/concursuri/necunoscut', '/balti/cupa-chita-lake-2026']) {
      expect(competitionRouteAction(p, map), p).toEqual({ kind: 'pass' });
    }
  });

  it('a competition whose slug equals a site page never shadows it', () => {
    expect(competitionRouteAction('/concursuri/live', competitionSlugMap([{ documentId: 'abc', slug: 'live' }]))).toEqual({ kind: 'pass' });
  });

  it('with no map (the CMS has no slugs yet) everything passes', () => {
    expect(competitionRouteAction('/concursuri/y1a8131h7otw6ivnohz72ob2', competitionSlugMap([]))).toEqual({ kind: 'pass' });
  });
});

describe('CONCURSURI_STATIC_SEGMENTS', () => {
  it('lists every page folder under app/(site)/concursuri (besides the competition page [id] and private _ folders)', () => {
    const dir = path.join(__dirname, '..', 'app', '(site)', 'concursuri');
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('[') && !d.name.startsWith('_') && !d.name.startsWith('('))
      .map((d) => d.name);
    expect(folders.length).toBeGreaterThan(0);
    for (const f of folders) expect(CONCURSURI_STATIC_SEGMENTS.has(f), f).toBe(true);
  });
});
