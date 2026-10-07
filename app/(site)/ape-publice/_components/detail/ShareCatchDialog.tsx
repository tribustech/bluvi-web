'use client';

import { useMemo } from 'react';
import { ShareCatchSheet } from '@/components/partide/share/ShareCatchSheet';
import type { LakeCatchDTO } from '@/core/partide';

/**
 * «Distribuie captura» for a catch on a public water (public-waters.detaliu.c24): the shared Bluvi
 * share card (components/partide/share/ShareCatchSheet), the water's name burned in. fish
 * lakeCatchToShareEvent: the full photo first (eventPhotoUri).
 */
export function ShareCatchDialog({ catchRow, waterName, onClose }: { catchRow: LakeCatchDTO | null; waterName: string; onClose: () => void }) {
  const target = useMemo(
    () =>
      catchRow
        ? {
            key: catchRow.clientId,
            photoUrl: catchRow.photoUrl ?? catchRow.photoGridUrl ?? catchRow.photoThumbUrl ?? null,
            weightKg: catchRow.weightKg,
            species: catchRow.species,
            occurredAt: catchRow.occurredAt,
          }
        : null,
    [catchRow],
  );
  return <ShareCatchSheet target={target} lakeName={waterName} onClose={onClose} />;
}
