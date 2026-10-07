import { afterEach, describe, expect, it } from 'vitest';
import robots from '@/app/robots';

/* global.b.seo-sitemap — robots.txt: indexable only with SITE_INDEXABLE=1, then it names the sitemap index. */

const before = process.env.SITE_INDEXABLE;
afterEach(() => {
  if (before === undefined) delete process.env.SITE_INDEXABLE;
  else process.env.SITE_INDEXABLE = before;
});

describe('robots', () => {
  it('SITE_INDEXABLE unset (staging, previews, dev): disallows everything, no sitemap', () => {
    delete process.env.SITE_INDEXABLE;
    expect(robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('SITE_INDEXABLE=1: allows the site but /api/, and points at /sitemap.xml (the index)', () => {
    process.env.SITE_INDEXABLE = '1';
    expect(robots()).toEqual({ rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }, sitemap: 'http://localhost:3000/sitemap.xml' });
  });
});
