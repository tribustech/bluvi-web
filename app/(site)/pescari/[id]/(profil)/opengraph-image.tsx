import { anglerImage, ogImageMetadata, ogResponse } from '@/lib/server/og/images';

// Open Graph / Twitter image of an angler profile: the angler card (name, public partide and
// competitions, the profile photo) from the PUBLIC header (CMS PR #113, lib/server/og/images.ts
// anglerModel). A CMS without that route, or an unknown angler: the brand card.
export function generateImageMetadata({ params }: { params: { id: string } }) {
  return ogImageMetadata('angler', params);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ogResponse(() => anglerImage(id), 'home');
}
