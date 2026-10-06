/*
 * Pure helpers of the news article and the sponsor page (no React): which rendition of each image
 * fish shows, how a CMS link is read, and the analytics payload fish logs on a link press.
 * Shared by Știre (app/(site)/stiri/[id]) and Sponsor (app/(site)/sponsori/[id]).
 */
import type { AnnouncementDetail, AnnouncementListItem, NewsBlock } from '@/core/news';
import type { RichTextNode, StrapiImage } from '@/core/shared';

/** One picture of a gallery / hero: the rendition fish loads and its DTO blurhash. */
export type GalleryImage = { src: string; blurhash?: string; width?: number; height?: number };

/** fish news/[newsId].tsx: every banner, `mediumUrl || url`, over its blurhash. */
export function bannerImages(banner: AnnouncementListItem['banner']): GalleryImage[] {
  return (banner ?? [])
    .map((b) => ({ src: b.mediumUrl || b.url, blurhash: b.blurhash || undefined }))
    .filter((b) => Boolean(b.src));
}

/** fish NewsCard: the FIRST banner, `mediumUrl || url`. */
export function cardImage(banner: AnnouncementListItem['banner']): GalleryImage | null {
  return bannerImages(banner)[0] ?? null;
}

type Pick = { src: string; width?: number; height?: number } | null;

function pick(image: StrapiImage | null | undefined, order: ('medium' | 'small' | 'thumbnail')[]): Pick {
  if (!image) return null;
  for (const key of order) {
    const f = image.formats?.[key];
    if (f?.url) return { src: f.url, width: f.width ?? undefined, height: f.height ?? undefined };
  }
  return image.url ? { src: image.url, width: image.width ?? undefined, height: image.height ?? undefined } : null;
}

/** fish renderNewsContentBlock `simple-image`: the first image, medium → small → original. */
export function simpleImage(images: StrapiImage[] | null | undefined): Pick {
  return pick(images?.[0], ['medium', 'small']);
}

/** fish renderNewsContentBlock `image-*-text-*`: small → thumbnail → original. */
export function sideImage(image: StrapiImage | null | undefined): Pick {
  return pick(image, ['small', 'thumbnail']);
}

/** fish sponsors/[sponsorId].tsx: `largeUrl || url`. */
export function sponsorImage(image: { url: string; largeUrl: string | null; blurhash: string | null } | null): GalleryImage | null {
  if (!image) return null;
  const src = image.largeUrl || image.url;
  return src ? { src, blurhash: image.blurhash || undefined } : null;
}

/**
 * fish CustomBlocksRenderer: a URL starting with «tel» is a phone link — «tel:…» kept, a bare
 * «tel0722…» becomes «tel:0722…»; any other URL opens as is.
 */
export function readLink(url: string): { kind: 'tel' | 'url'; href: string } {
  if (url.startsWith('tel')) return { kind: 'tel', href: url.startsWith('tel:') ? url : `tel:${url.slice(3)}` };
  return { kind: 'url', href: url };
}

/**
 * What fish logs when a link in the text is pressed (`trackingData` + the formatted `url`):
 * news_link_clicked { newsId, url } · sponsor_link_clicked { sponsor_id, sponsor_name, url }.
 * The web writes it on the link (data-analytics-*); the GA4 listener lands in M8 (home.b.analytics).
 */
export type LinkTracking = { event: string; params: Record<string, string> };

export function linkEvent(tracking: LinkTracking | undefined, href: string): LinkTracking | undefined {
  if (!tracking) return undefined;
  return { event: tracking.event, params: { ...tracking.params, url: href } };
}

/** fish CustomBlocksRenderer `if (!content || content.length === 0) return null`. */
export function hasRichText(blocks: RichTextNode[] | null | undefined): blocks is RichTextNode[] {
  return Array.isArray(blocks) && blocks.length > 0;
}

/** The blocks of an article fish renders (core already drops unknown block types). */
export function articleBlocks(news: AnnouncementDetail): NewsBlock[] {
  return news.content ?? [];
}

/** Plain text of a rich text, for meta descriptions (≤ `max` chars, cut at a word). */
export function plainText(blocks: RichTextNode[] | null | undefined, max = 160): string {
  const walk = (n: RichTextNode): string => (n.text ?? '') + (n.children ?? []).map(walk).join('');
  const text = (blocks ?? [])
    .map(walk)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
