import { sponsorImageCard, ogImageMetadata, ogResponse } from '@/lib/server/og/images';

// Open Graph / Twitter image of a sponsor: logo and name (parity global.b.seo-og-images; lib/server/og/images.ts).
// One image (`…/opengraph-image/card`) whose alt names the entity and the facts its card draws.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return ogImageMetadata('sponsor', params);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => sponsorImageCard(id), 'home');
}
