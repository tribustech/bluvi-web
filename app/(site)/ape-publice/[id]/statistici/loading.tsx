'use client';

import { StatsFallback } from '../../_components/venue/StatsScreen';
import { useWaterBackHref } from '../../_components/venue/backHref';

/* While the water is read: the statistics skeleton under the loaded header's slots (parity
 * public-waters.statistici.c4).
 * The back control already targets the water (the route param), as on the loaded page. */
export default function Loading() {
  return <StatsFallback backHref={useWaterBackHref()} />;
}
