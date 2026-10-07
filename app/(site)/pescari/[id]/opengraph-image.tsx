import { brandImage, ogResponse } from '@/lib/server/og/images';
import { OG_ALT } from '@/lib/server/og/model';
import { OG_SIZE } from '@/lib/server/og/tokens';

// Open Graph / Twitter image of an angler profile: the brand card. The profile's name is not public
// yet (GET /feed/anglers/:id needs a session) — an angler card waits for the public header DTO
// (docs/private/cms-patches/M2-angler-public-profile.md).
export const alt = OG_ALT.home;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogResponse(() => brandImage('home'), 'home');
}
