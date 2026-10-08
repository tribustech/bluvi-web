import { brandImage, ogResponse } from '@/lib/server/og/images';
import { OG_ALT } from '@/lib/server/og/model';
import { OG_SIZE } from '@/lib/server/og/tokens';

// Open Graph / Twitter image of /sondaje/anterioare (participant.polls-past): the brand card — the
// polls are read in the browser (personalised: my vote), never drawn here.
export const alt = OG_ALT.pollsPast;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogResponse(() => brandImage('pollsPast'), 'polls');
}
