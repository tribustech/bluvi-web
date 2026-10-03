'use client';

import { useEffect, useRef, type MouseEvent, type SyntheticEvent } from 'react';

/**
 * Drives a native <dialog> as a modal from an `open` prop: showModal() gives the top layer, focus
 * containment, Escape and focus return for free. Escape and backdrop clicks call onClose instead
 * of closing on their own, so the parent stays the source of truth. Locks page scroll while open.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  const dialogProps = {
    ref,
    onCancel: (e: SyntheticEvent<HTMLDialogElement>) => {
      e.preventDefault();
      onClose();
    },
    // A click whose target is the <dialog> itself landed on the backdrop area.
    onClick: (e: MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
  };
  return dialogProps;
}
