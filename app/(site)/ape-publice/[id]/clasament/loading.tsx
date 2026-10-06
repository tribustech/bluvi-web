'use client';

import { RankingFallback } from '../../_components/venue/RankingScreen';
import { useWaterBackHref } from '../../_components/venue/backHref';

/* While the water is read (its name is not known yet): the ranking's frame under the loaded
 * header's slots (parity public-waters.clasament.c4).
 * The back control already targets the water (the route param), as on the loaded page. */
export default function Loading() {
  return <RankingFallback backHref={useWaterBackHref()} />;
}
