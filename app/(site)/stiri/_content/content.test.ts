import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RichTextNode, StrapiImage } from '@/core/shared';
import { bannerImages, cardImage, linkEvent, plainText, readLink, sideImage, simpleImage, sponsorImage } from './content';
import { RichText } from './RichText';

const img = (over: Partial<StrapiImage> = {}): StrapiImage => ({ url: 'https://x/o.jpg', width: 1000, height: 500, ...over });

describe('home.stire.c2 / home.stiri.c5 — picture renditions (fish)', () => {
  it('banners: medium, else the original, with the blurhash', () => {
    expect(bannerImages([{ url: 'o', mediumUrl: 'm', blurhash: 'h' }, { url: 'o2', mediumUrl: null, blurhash: null }])).toEqual([
      { src: 'm', blurhash: 'h' },
      { src: 'o2', blurhash: undefined },
    ]);
    expect(bannerImages(null)).toEqual([]);
    expect(cardImage([{ url: 'o', mediumUrl: null, blurhash: null }])).toEqual({ src: 'o', blurhash: undefined });
    expect(cardImage([])).toBeNull();
  });

  it('home.stire.c6 — simple-image: medium → small → original; side images: small → thumbnail → original', () => {
    const formats = {
      medium: { url: 'm', width: 750, height: 375 },
      small: { url: 's', width: 500, height: 250 },
      thumbnail: { url: 't', width: 245, height: 123 },
    };
    expect(simpleImage([img({ formats })])).toEqual({ src: 'm', width: 750, height: 375 });
    expect(simpleImage([img({ formats: { small: formats.small } })])?.src).toBe('s');
    expect(simpleImage([img()])).toEqual({ src: 'https://x/o.jpg', width: 1000, height: 500 });
    expect(simpleImage(null)).toBeNull();
    expect(sideImage(img({ formats }))?.src).toBe('s');
    expect(sideImage(img({ formats: { thumbnail: formats.thumbnail } }))?.src).toBe('t');
    expect(sideImage(null)).toBeNull();
  });

  it('home.sponsor.c2 — sponsor image: large, else the original; none → null', () => {
    expect(sponsorImage({ url: 'o', largeUrl: 'l', blurhash: null })).toEqual({ src: 'l', blurhash: undefined });
    expect(sponsorImage({ url: 'o', largeUrl: null, blurhash: 'h' })).toEqual({ src: 'o', blurhash: 'h' });
    expect(sponsorImage(null)).toBeNull();
  });
});

describe('home.stire.c7 — links (fish CustomBlocksRenderer)', () => {
  it('a «tel» URL dials, normalised to tel:', () => {
    expect(readLink('tel:+40722')).toEqual({ kind: 'tel', href: 'tel:+40722' });
    expect(readLink('tel0722')).toEqual({ kind: 'tel', href: 'tel:0722' });
    expect(readLink('https://bluvi.ro')).toEqual({ kind: 'url', href: 'https://bluvi.ro' });
  });

  it('the logged payload is the tracking data plus the formatted url', () => {
    expect(linkEvent({ event: 'news_link_clicked', params: { newsId: 'n1' } }, 'tel:1')).toEqual({
      event: 'news_link_clicked',
      params: { newsId: 'n1', url: 'tel:1' },
    });
    expect(linkEvent(undefined, 'x')).toBeUndefined();
  });
});

const p = (...children: RichTextNode[]): RichTextNode => ({ type: 'paragraph', children });
const t = (text: string, mods: Record<string, boolean> = {}): RichTextNode => ({ type: 'text', text, ...mods });

function html(blocks: RichTextNode[] | null) {
  return renderToStaticMarkup(
    createElement(RichText, { blocks, tracking: { event: 'sponsor_link_clicked', params: { sponsor_id: 's1', sponsor_name: 'TT' } } }),
  );
}

describe('home.stire.c7 / home.sponsor.c4 — rich text', () => {
  it('home.sponsor.s5 — empty or missing content renders nothing', () => {
    expect(html(null)).toBe('');
    expect(html([])).toBe('');
  });

  it('headings 1 / 2 / 3 are title1 / heading / bodyStrong, one level under the page h1; 4+ fall back to title1', () => {
    const out = html([1, 2, 3, 5].map((level) => ({ type: 'heading', level, children: [t(`H${level}`)] })));
    expect(out).toContain('<h2 class="t-title1');
    expect(out).toMatch(/<h3 class="t-heading[^>]*>H2<\/h3>/);
    expect(out).toMatch(/<h4 class="t-body-strong[^>]*>H3<\/h4>/);
    expect(out).toMatch(/<h2 class="t-title1[^>]*>H5<\/h2>/);
  });

  it('lists, ordered or not, prefix every item with « - »', () => {
    const list = (format: string): RichTextNode => ({
      type: 'list',
      format,
      children: [{ type: 'list-item', children: [t('unu')] }, { type: 'list-item', children: [t('doi')] }],
    });
    const out = html([list('unordered'), list('ordered')]);
    expect(out).toContain('<ul');
    expect(out).toContain('<ol');
    expect(out.match(/<span aria-hidden="true"> - <\/span>/g)).toHaveLength(4);
  });

  it('bold, italic, underline, strikethrough', () => {
    const out = html([p(t('b', { bold: true }), t('i', { italic: true }), t('u', { underline: true }), t('s', { strikethrough: true }))]);
    expect(out).toContain('<strong class="font-bold">b</strong>');
    expect(out).toContain('<em>i</em>');
    expect(out).toContain('<span class="underline">u</span>');
    expect(out).toContain('<s>s</s>');
  });

  it('home.sponsor.c5 — links carry the event: a URL opens in a new tab, a phone link dials', () => {
    const out = html([
      p({ type: 'link', url: 'https://ttboilies.ro', children: [t('site')] }, { type: 'link', url: 'tel0722', children: [t('0722')] }),
    ]);
    expect(out).toContain('href="https://ttboilies.ro" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain('data-analytics-event="sponsor_link_clicked"');
    expect(out).toContain(
      'data-analytics-params="{&quot;sponsor_id&quot;:&quot;s1&quot;,&quot;sponsor_name&quot;:&quot;TT&quot;,&quot;url&quot;:&quot;https://ttboilies.ro&quot;}"',
    );
    expect(out).toContain('href="tel:0722"');
    expect(out).not.toMatch(/href="tel:0722"[^>]*target=/);
  });

  it('a soft line break («\\n») inside a text is a new line, never a collapsed space (fish keeps the raw text)', () => {
    const out = html([p(t('Rând unu\nRând doi\r\nRând trei', { bold: true }))]);
    expect(out).toContain('<strong class="font-bold">Rând unu<br/>Rând doi<br/>Rând trei</strong>');
    expect(html([p(t('fără rupere'))])).not.toContain('<br');
  });

  it('an empty paragraph keeps the author’s blank line; unknown block types render nothing', () => {
    const out = html([p(t('a')), p(t('')), { type: 'image', image: { url: 'x' } } as RichTextNode, p(t('b'))]);
    expect(out).toContain('<p aria-hidden="true" class="h-2"></p>');
    expect(out).not.toContain('<img');
  });
});

describe('meta descriptions', () => {
  it('plain text, cut at a word', () => {
    expect(plainText([p(t('Salut ')), p(t('pescari'))])).toBe('Salut pescari');
    const long = plainText([p(t('cuvânt '.repeat(60)))], 40);
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith('…')).toBe(true);
    expect(plainText(null)).toBe('');
  });
});
