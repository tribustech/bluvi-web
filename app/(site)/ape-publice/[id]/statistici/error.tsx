'use client';

import { WaterError } from '../../_components/states';
import { useWaterBackHref } from '../../_components/venue/backHref';

/** The dataset could not be read (public-waters.statistici.c1: the detail page's error state). */
export default function StatsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <WaterError error={error} retry={retry} heading="Nu am putut încărca apa publică." backHref={useWaterBackHref()} />;
}
