import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SPONSOR_TILE_GRID } from './ArticleFrame';
import { ArticleSkeleton } from './ArticleSkeleton';
import { NEWS_CRUMB, HOME_CRUMB } from './crumbs';
import { NEWS_HERO_HEIGHT, SPONSOR_HERO_HEIGHT } from './hero';

/*
 * The loading states (loading.tsx) are not forceable from the browser: the reads are cached and
 * `next dev` neither prefetches nor shows a segment's fallback before its RSC answer streams. The
 * skeleton is rendered here; its picture header reads the same constants as the loaded Gallery
 * (hero.ts — asserted for the Gallery in Gallery.test.ts), so the header never jumps.
 */
const back = createElement('button', { type: 'button', 'aria-label': 'Înapoi' });
const render = (variant: 'news' | 'sponsor') =>
  renderToStaticMarkup(
    createElement(ArticleSkeleton, {
      variant,
      label: variant === 'news' ? 'Se încarcă știrea…' : 'Se încarcă sponsorul…',
      trail: [variant === 'news' ? NEWS_CRUMB : HOME_CRUMB],
      back,
    }),
  );

describe('home.stire.c1 s1 / home.sponsor.c1 s1 — loading', () => {
  it('home.stire.s1 — the article in grey: status + h1, the band pending under Noutăți, the strip at its loaded size', () => {
    const html = render('news');
    expect(html).toContain('role="status"');
    expect(html).toContain('<h1 class="sr-only">Se încarcă știrea…</h1>');
    expect(html).toContain('href="/stiri"');
    expect(html).toContain('bg-soft-fill'); // the pending current crumb
    expect(html).toContain(NEWS_HERO_HEIGHT);
    expect(html).toContain(`--strip-ratio:${16 / 9}`);
  });

  it('home.sponsor.s1 — the sponsor in grey: the band pending under Acasă, the logo band exactly the loaded one', () => {
    const html = render('sponsor');
    expect(html).toContain('Se încarcă sponsorul…');
    expect(html).toContain('href="/"');
    expect(html).toContain(`class="block animate-shimmer ${SPONSOR_HERO_HEIGHT}"`);
    // home.sponsor.s1 — «Alți sponsori» in its loaded shape: the 8:5 logo tiles, not news rows.
    expect(html).toContain(SPONSOR_TILE_GRID);
    expect(html).toContain('aspect-8/5 animate-shimmer');
    expect(render('news')).not.toContain('aspect-8/5');
  });

  it('the grey frame is hidden from assistive tech (no empty article / side landmark); the phone back chip is not', () => {
    for (const variant of ['news', 'sponsor'] as const) {
      const html = render(variant);
      const hidden = html.indexOf('<div aria-hidden="true">');
      expect(hidden).toBeGreaterThan(-1);
      expect(html.indexOf('<aside')).toBeGreaterThan(hidden);
      expect(html.indexOf('aria-label="Înapoi"')).toBeLessThan(hidden);
      expect(html).not.toContain('aria-labelledby');
      // The side column stays out below 1280 (no stray hairline under the skeleton on the phone).
      expect(html).toContain('max-xl:hidden');
    }
  });
});
