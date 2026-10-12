import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BALTI_STATIC_SEGMENTS, lakeRouteAction, lakeSlugMap } from './lake-slug-route';

const map = lakeSlugMap([
  { documentId: 'mgtv3zuvzj3qief0uysucjl2', slug: 'aladdin-lakes' },
  { documentId: 'q7dizeq89hv7wmbajdlcwpit', slug: 'iaz-trofee-pausesti' },
]);

describe('lakeRouteAction', () => {
  it('serves a slug URL from the lake page (rewrite), subpages included', () => {
    expect(lakeRouteAction('/balti/aladdin-lakes', map)).toEqual({ kind: 'rewrite', path: '/balti/mgtv3zuvzj3qief0uysucjl2' });
    expect(lakeRouteAction('/balti/aladdin-lakes/recenzii', map)).toEqual({ kind: 'rewrite', path: '/balti/mgtv3zuvzj3qief0uysucjl2/recenzii' });
  });

  it('sends an old documentId URL to the slug URL (308), subpages included', () => {
    expect(lakeRouteAction('/balti/mgtv3zuvzj3qief0uysucjl2', map)).toEqual({ kind: 'redirect', path: '/balti/aladdin-lakes' });
    expect(lakeRouteAction('/balti/q7dizeq89hv7wmbajdlcwpit/galerie', map)).toEqual({ kind: 'redirect', path: '/balti/iaz-trofee-pausesti/galerie' });
  });

  it('the share images under a documentId URL are served as they are (no redirect hop)', () => {
    expect(lakeRouteAction('/balti/mgtv3zuvzj3qief0uysucjl2/opengraph-image-cavseh/card', map)).toEqual({ kind: 'pass' });
    expect(lakeRouteAction('/balti/aladdin-lakes/twitter-image-cavseh/card', map)).toEqual({ kind: 'rewrite', path: '/balti/mgtv3zuvzj3qief0uysucjl2/twitter-image-cavseh/card' });
  });

  it('leaves the site pages, unknown segments and other paths alone', () => {
    for (const p of ['/balti', '/balti/harta', '/balti/judet/ilfov', '/balti/specii', '/balti/necunoscut', '/concursuri/x', '/balti/opengraph-image']) {
      expect(lakeRouteAction(p, map), p).toEqual({ kind: 'pass' });
    }
  });

  it('a lake whose slug equals a site page never shadows it', () => {
    const clash = lakeSlugMap([{ documentId: 'abc', slug: 'harta' }]);
    expect(lakeRouteAction('/balti/harta', clash)).toEqual({ kind: 'pass' });
  });

  it('with no map (the CMS has no slugs yet) everything passes', () => {
    expect(lakeRouteAction('/balti/mgtv3zuvzj3qief0uysucjl2', lakeSlugMap([]))).toEqual({ kind: 'pass' });
  });
});

describe('BALTI_STATIC_SEGMENTS', () => {
  it('lists every page folder under app/(site)/balti (besides the lake page [id] and private _ folders)', () => {
    const dir = path.join(__dirname, '..', 'app', '(site)', 'balti');
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('[') && !d.name.startsWith('_') && !d.name.startsWith('('))
      .map((d) => d.name);
    for (const f of folders) expect(BALTI_STATIC_SEGMENTS.has(f), f).toBe(true);
  });
});
