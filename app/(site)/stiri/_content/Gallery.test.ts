import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GalleryImage } from './content';
import { Gallery } from './Gallery';
import { RichText } from './RichText';

const back = createElement('button', { type: 'button', 'aria-label': 'Înapoi' });
const render = (images: GalleryImage[], variant: 'news' | 'sponsor' = 'news') =>
  renderToStaticMarkup(createElement(Gallery, { images, label: 'Fotografii: X', back, variant }));

describe('home.stire / home.sponsor — the header pictures', () => {
  it('home.stire.s4 home.sponsor.s4 — no picture: the phone grey header at the loaded header height (300 / 224, newspaper glyph) with the back chip; nothing from 768', () => {
    for (const variant of ['news', 'sponsor'] as const) {
      const html = render([], variant);
      expect(html).toContain('data-gallery="empty"');
      expect(html).toContain('md:hidden');
      expect(html).toContain(variant === 'news' ? 'h-75' : 'h-56');
      expect(html).toContain('<svg');
      expect(html).toContain('aria-label="Înapoi"');
    }
  });

  it('home.sponsor.s5 — an empty description renders nothing', () => {
    expect(renderToStaticMarkup(createElement(RichText, { blocks: [] }))).toBe('');
    expect(renderToStaticMarkup(createElement(RichText, { blocks: null }))).toBe('');
  });

  it('home.stire.c3 — the back chip comes before the strip (focus order, WCAG 2.4.3)', () => {
    const html = render([{ src: 'https://x/a.jpg' }, { src: 'https://x/b.jpg' }]);
    expect(html.indexOf('aria-label="Înapoi"')).toBeLessThan(html.indexOf('tabindex="0"'));
  });

  it('home.stire.c2 — several pictures: the strip is a named group described by the key hint', () => {
    const html = render([{ src: 'https://x/a.jpg' }, { src: 'https://x/b.jpg' }]);
    const hint = /<span id="([^"]+)" class="sr-only">Folosește săgețile/.exec(html);
    expect(hint).not.toBeNull();
    expect(html).toContain(`role="group" aria-label="Fotografii" aria-describedby="${hint![1]}" tabindex="0"`);
  });

  it('home.stire.c2 — the strip takes the first picture ratio, clamped to 4:1 (a 750×133 banner); 16:9 unknown', () => {
    expect(render([{ src: 'https://x/a.jpg', width: 750, height: 133 }])).toContain('--strip-ratio:4');
    expect(render([{ src: 'https://x/a.jpg' }])).toContain(`--strip-ratio:${16 / 9}`);
  });

  it('home.stire.c2 — a banner wider than 2:1 is shown whole on the phone too (contain, its own ratio); a photo is cover-cropped there', () => {
    const wide = render([{ src: 'https://x/a.jpg', width: 1000, height: 200 }]);
    expect(wide).toContain('data-fit="contain"');
    expect(wide).toContain('aspect-(--strip-ratio) md:min-h-60');
    expect(wide).not.toContain('h-75');
    const photo = render([{ src: 'https://x/a.jpg', width: 1600, height: 1000 }]);
    expect(photo).toContain('data-fit="cover"');
    expect(photo).toContain('object-cover md:object-contain');
  });

  it('home.stire.c2 — the letterbox is the picture average colour (blurhash DC), never a blurred copy of it', () => {
    const html = render([{ src: 'https://x/a.jpg', width: 1000, height: 200, blurhash: 'L4Bz760002M}?2Ic9jM@0ZIR~qoi' }]);
    expect(html).toMatch(/--letterbox:rgb\(\d+ \d+ \d+\)/);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).not.toContain('blur-3xl');
  });

  it('home.sponsor.c2 — landscape artwork fills the band; a square logo is contained, clear of the back chip', () => {
    expect(render([{ src: 'https://x/a.jpg', width: 1600, height: 1000 }], 'sponsor')).toContain('data-fit="fill"');
    const logo = render([{ src: 'https://x/a.png', width: 500, height: 500 }], 'sponsor');
    expect(logo).toContain('data-fit="contain"');
    expect(logo).toContain('object-contain p-6 max-md:px-16');
    expect(logo).toContain('h-56 md:h-48 xl:h-56');
    expect(logo).toContain('bg-surface md:border-b md:border-hairline');
  });
});
