import { newsImage, ogImageMetadata, ogResponse } from '@/lib/server/og/images';

// Open Graph / Twitter image of a news article: cover and title (parity global.b.seo-og-images; lib/server/og/images.ts).
// One image (`…/opengraph-image/card`) whose alt names the entity and the facts its card draws.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return ogImageMetadata('news', params);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => newsImage(id), 'news');
}
