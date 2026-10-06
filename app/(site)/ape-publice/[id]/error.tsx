'use client';

import { WaterError } from '../_components/states';

/** The dataset could not be read (parity public-waters.detaliu.c3). */
export default function PublicWaterError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <WaterError error={error} retry={retry} heading="Nu am putut încărca apa publică." />;
}
