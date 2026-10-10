import { brandImage, ogResponse } from '@/lib/server/og/images';
import { OG_ALT } from '@/lib/server/og/model';
import { OG_SIZE } from '@/lib/server/og/tokens';

// Open Graph / Twitter image of /partide/exploreaza (parity global.b.seo-og-images): the Partide brand
// card. Its own file because the page sets `openGraph`, which replaces a parent segment's images.
export const alt = OG_ALT.partide;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogResponse(() => brandImage('partide'), 'partide');
}
