'use client';

import { useCallback } from 'react';
import { useSiteToast } from '../../_shell/Toast';
import { useOnline } from './useOnline';

/** fish CronometreScene's offline refusal copy (parity partide.b.offline-writes). */
export const OFFLINE_WRITE_MESSAGE = 'Fără conexiune. Reconectare…';

/**
 * fish features/partide/scenes/CronometreScene.tsx:49-60 — every partidă write (capture, outcome,
 * delete, marker, add / configure rod) is refused offline with «Fără conexiune. Reconectare…»; the
 * live projection stays readable. Call `guard()` first in a write handler: false = refused (the
 * toast is shown), true = go on. For the tab batches (Lansete, Jurnal, captura).
 */
export function useWriteGuard(): () => boolean {
  const online = useOnline();
  const toast = useSiteToast();
  return useCallback(() => {
    if (online) return true;
    toast(OFFLINE_WRITE_MESSAGE, 'danger');
    return false;
  }, [online, toast]);
}
