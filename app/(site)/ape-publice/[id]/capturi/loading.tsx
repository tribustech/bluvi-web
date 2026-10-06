'use client';

import { CatchesFallback } from '../../_components/venue/CatchesScreen';
import { useWaterBackHref } from '../../_components/venue/backHref';

/* While the water and its first catches page are read: the header + the masonry skeleton (c3).
 * The back control already targets the water (the route param), as on the loaded page. */
export default function Loading() {
  return <CatchesFallback subtitle={null} backHref={useWaterBackHref()} />;
}
