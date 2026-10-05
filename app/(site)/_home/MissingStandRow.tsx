'use client';

import type { ReactNode } from 'react';
import { useSiteToast } from '../_shell/Toast';

/**
 * fish ScaleItem: an extra-scale request whose stand data is incomplete has no history to open —
 * the tap says so instead of going nowhere.
 */
export function MissingStandRow({ className, children }: { className: string; children: ReactNode }) {
  const toast = useSiteToast();
  return (
    <button type="button" className={className} onClick={() => toast('Nu există suficiente date pentru a deschide acest stand', 'danger')}>
      {children}
    </button>
  );
}
