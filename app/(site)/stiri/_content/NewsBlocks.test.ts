import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NewsBlock } from '@/core/news';
import type { RichTextNode, StrapiImage } from '@/core/shared';
import { NewsBlocks } from './NewsBlocks';

const text = (t: string): RichTextNode[] => [{ type: 'paragraph', children: [{ type: 'text', text: t }] }];
const image = (name: string, formats: StrapiImage['formats'] = {}): StrapiImage => ({ url: `https://x/${name}.jpg`, width: 1000, height: 500, formats });
const render = (blocks: NewsBlock[]) => renderToStaticMarkup(createElement(NewsBlocks, { blocks, tracking: { event: 'news_link_clicked', params: { newsId: 'n' } } }));
/** The order of the picture and the text inside a rendered block. */
const order = (html: string) => [...html.matchAll(/<img|<p>/g)].map((m) => (m[0] === '<img' ? 'img' : 'text'));

describe('home.stire.c6 s7 — NewsBlocks renders every block type in fish order', () => {
  it('simple-text: the rich text', () => {
    expect(render([{ __component: 'news-block.simple-text', id: 1, text: text('Salut') }])).toContain('<p>Salut</p>');
  });

  it('simple-image: medium → small → original', () => {
    const medium = { url: 'https://x/m.jpg', width: 750, height: 375 };
    const small = { url: 'https://x/s.jpg', width: 500, height: 250 };
    expect(render([{ __component: 'news-block.simple-image', id: 1, image: [image('o', { medium, small })] }])).toContain(encodeURIComponent('https://x/m.jpg'));
    expect(render([{ __component: 'news-block.simple-image', id: 1, image: [image('o', { small })] }])).toContain(encodeURIComponent('https://x/s.jpg'));
    expect(render([{ __component: 'news-block.simple-image', id: 1, image: [image('o')] }])).toContain(encodeURIComponent('https://x/o.jpg'));
  });

  it('image-left-text-right: the image, then the text — two columns from 768', () => {
    const html = render([{ __component: 'news-block.image-left-text-right', id: 1, text: text('T'), image: image('i') }]);
    expect(order(html)).toEqual(['img', 'text']);
    expect(html).toContain('md:grid-cols-2');
  });

  it('image-right-text-left: the text, then the image — two columns from 768', () => {
    const html = render([{ __component: 'news-block.image-right-text-left', id: 1, text: text('T'), image: image('i') }]);
    expect(order(html)).toEqual(['text', 'img']);
    expect(html).toContain('md:grid-cols-2');
  });

  it('a side block with one side missing takes the full measure (no half-empty grid)', () => {
    const noImage = render([{ __component: 'news-block.image-right-text-left', id: 1, text: text('T'), image: null }]);
    expect(order(noImage)).toEqual(['text']);
    expect(noImage).not.toContain('md:grid-cols-2');
    const noText = render([{ __component: 'news-block.image-left-text-right', id: 1, text: null, image: image('i') }]);
    expect(order(noText)).toEqual(['img']);
    expect(noText).not.toContain('md:grid-cols-2');
  });

  it('an empty block renders nothing', () => {
    expect(
      render([
        { __component: 'news-block.simple-text', id: 1, text: null },
        { __component: 'news-block.simple-text', id: 2, text: [] },
        { __component: 'news-block.simple-image', id: 3, image: null },
        { __component: 'news-block.simple-image', id: 4, image: [] },
        { __component: 'news-block.image-left-text-right', id: 5, text: null, image: null },
        { __component: 'news-block.image-right-text-left', id: 6, text: [], image: null },
      ]),
    ).toBe('');
  });

  it('a content image is never upscaled past its pixels nor taller than 480 from 768, and is framed', () => {
    const tall = render([{ __component: 'news-block.simple-image', id: 1, image: [{ url: 'https://x/t.png', width: 750, height: 1500 }] }]);
    // 480 × 750 / 1500 = 240px wide at most.
    expect(tall).toContain('--img-max:240px');
    expect(tall).toContain('ring-1');
    const small = render([{ __component: 'news-block.simple-image', id: 1, image: [{ url: 'https://x/s.png', width: 400, height: 200 }] }]);
    expect(small).toContain('--img-max:400px');
  });
});
