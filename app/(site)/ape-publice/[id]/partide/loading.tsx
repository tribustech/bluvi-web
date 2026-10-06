'use client';

import { PartideFallback } from '../../_components/venue/PartideScreen';
import { useWaterBackHref } from '../../_components/venue/backHref';

/* While the water and its partide are read (parity public-waters.partide.c3): the loaded page's
 * header slots (back, caption, refresh) with a bone for the water's name, so nothing moves.
 * The back control already targets the water (the route param), as on the loaded page. */
export default function Loading() {
  return <PartideFallback backHref={useWaterBackHref()} />;
}
