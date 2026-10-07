import { brandImage, ogResponse } from '@/lib/server/og/images';
import { OG_ALT } from '@/lib/server/og/model';
import { OG_SIZE } from '@/lib/server/og/tokens';

// Open Graph / Twitter image of Acasă (_home/assets/og-home.jpg) (parity global.b.seo-og-images): the brand card.
export const alt = OG_ALT.home;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogResponse(() => brandImage('home'), 'home');
}
