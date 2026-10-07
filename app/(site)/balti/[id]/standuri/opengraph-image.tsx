import { lakeImage, ogImageMetadata, ogResponse } from '@/lib/server/og/images';

// Open Graph / Twitter image of a lake · Standuri: the lake card, labelled (parity global.b.seo-og-images; lib/server/og/images.ts).
// One image (`…/opengraph-image/card`) whose alt names the entity and the facts its card draws.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return ogImageMetadata('lake', params, 'Standuri');
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => lakeImage(id, 'Standuri'), 'lakes');
}
