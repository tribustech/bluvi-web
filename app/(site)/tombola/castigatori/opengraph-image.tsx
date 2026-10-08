import { brandImage, ogResponse } from '@/lib/server/og/images';
import { OG_ALT } from '@/lib/server/og/model';
import { OG_SIZE } from '@/lib/server/og/tokens';

// Open Graph / Twitter image of /tombola/castigatori (participant.raffle-winners): the brand card
// (the winners change with the session and are read in the browser, so the card names the page only).
export const alt = OG_ALT.raffleWinners;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogResponse(() => brandImage('raffleWinners'), 'home');
}
