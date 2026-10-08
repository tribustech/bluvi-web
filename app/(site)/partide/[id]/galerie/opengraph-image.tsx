import { ogResponse } from '@/lib/server/og/images';
import { galleryImage, galleryImageMetadata } from './_gallery/og';

// Open Graph / Twitter image of a partidă's gallery: the partidă's card labelled «Galerie», the
// photo count and the gallery's first photo (parity global.b.seo-og-images; ./_gallery/og.ts).
// A private or unknown partidă: the brand card.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return galleryImageMetadata(params);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => galleryImage(id), 'home');
}
