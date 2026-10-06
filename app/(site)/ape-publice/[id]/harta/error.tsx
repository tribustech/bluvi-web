'use client';

import { WaterError } from '../../_components/states';

/** parity public-waters.harta.c2 */
export default function PublicWaterMapError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <WaterError error={error} retry={retry} heading="Nu am putut încărca harta." />;
}
