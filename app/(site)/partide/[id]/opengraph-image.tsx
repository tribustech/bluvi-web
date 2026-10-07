import { ogResponse } from '@/lib/server/og/images';
import { partidaImage, partidaImageMetadata } from './_spectator/og';

// Open Graph / Twitter image of a partidă: the venue, the total weighed kg and the top catch photo
// (parity global.b.seo-og-images; ./_spectator/og.ts). A private or unknown partidă: the brand card.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return partidaImageMetadata(params);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => partidaImage(id), 'home');
}
