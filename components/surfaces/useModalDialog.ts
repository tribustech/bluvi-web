'use client';

import { useEffect, useRef, type MouseEvent, type SyntheticEvent } from 'react';
import { lockPageScroll } from './scrollLock';

/**
 * Drives a native <dialog> as a modal from an `open` prop: showModal() gives the top layer, focus
 * containment, Escape and focus return for free. Escape and backdrop clicks call onClose instead
 * of closing on their own, so the parent stays the source of truth. Locks page scroll while open
 * (scrollLock: iOS-proof — the page behind never scrolls or rubber-bands) and keeps the visual
 * viewport on the dialog as CSS variables, so a phone sheet sits above the iOS keyboard:
 * `--vv-top` / `--vv-h` (the visible area's top and height) and `--vv-bottom` (the layout-viewport
 * strip under it — the keyboard). Without a keyboard they are 0 / the full height / 0.
 * `backdrop: false`: a click on the backdrop does nothing (fish's non-dismissable backdrop); Escape
 * still calls onClose.
 */
export function useModalDialog(open: boolean, onClose: () => void, { backdrop = true }: { backdrop?: boolean } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Who had focus before: a dialog unmounted while open (a host that renders it only when open)
    // never runs the native focus return, so the cleanup does it.
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
    }
    if (!open && d.open) d.close();
    if (!open) return;
    const unlock = lockPageScroll();
    const vv = window.visualViewport;
    const sync = () => {
      if (!vv) return;
      // Pinch-zoomed: the visible area is a magnified part of the page, not a keyboard — no change.
      if (vv.scale > 1.01) {
        for (const k of ['--vv-top', '--vv-h', '--vv-bottom']) d.style.removeProperty(k);
        return;
      }
      const bottom = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      d.style.setProperty('--vv-top', `${Math.max(0, vv.offsetTop)}px`);
      d.style.setProperty('--vv-h', `${vv.height}px`);
      d.style.setProperty('--vv-bottom', `${bottom}px`);
    };
    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    return () => {
      unlock();
      queueMicrotask(() => {
        const active = document.activeElement;
        const back = opener.current;
        if (back?.isConnected && (!active || active === document.body)) back.focus({ preventScroll: true });
      });
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      for (const k of ['--vv-top', '--vv-h', '--vv-bottom']) d.style.removeProperty(k);
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
      if (backdrop && e.target === e.currentTarget) onClose();
    },
  };
  return dialogProps;
}
