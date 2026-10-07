import { waterImage, ogImageMetadata, ogResponse } from '@/lib/server/og/images';

// Open Graph / Twitter image of a public water: the water card (parity global.b.seo-og-images; lib/server/og/images.ts).
// One image (`…/opengraph-image/card`) whose alt names the entity and the facts its card draws.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return ogImageMetadata('water', params);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => waterImage(id, null), 'publicWaters');
}
