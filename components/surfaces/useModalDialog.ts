'use client';

import { useEffect, useLayoutEffect, useRef, type MouseEvent, type SyntheticEvent } from 'react';
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
 *
 * Initial focus (owner rule 8: no focus ring on programmatic focus): showModal() focuses the first
 * control — a sheet's drag handle, a close X — and iOS Safari draws its keyboard ring on it. When
 * that is where it lands, the title (the dialog's aria-labelledby, tabIndex -1, no outline) takes it
 * instead: a screen reader starts at the name, nobody sees a ring, Tab goes on to the controls.
 * A host that wants a field focused still moves focus in its own effect, after this one.
 *
 * The <dialog> is shown in a LAYOUT effect, so a sheet can measure its content before the first
 * paint, and closed in that effect's cleanup: a route hidden by React's <Activity> (Next's
 * cacheComponents keeps the previous page mounted) must not leave a modal open in the top layer.
 */
export function useModalDialog(open: boolean, onClose: () => void, { backdrop = true }: { backdrop?: boolean } = {}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Who had focus before: a dialog unmounted while open (a host that renders it only when open)
    // never runs the native focus return, so the cleanup does it.
    if (open && !d.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      d.showModal();
      const active = document.activeElement;
      const title = document.getElementById(d.getAttribute('aria-labelledby') ?? '');
      if (title && d.contains(title) && active instanceof Element && d.contains(active) && active.closest('[data-sheet-handle], [data-dialog-chrome]')) {
        if (!title.hasAttribute('tabindex')) title.tabIndex = -1;
        title.focus({ preventScroll: true });
      }
    }
    if (!open && d.open) d.close();
    if (!open) return;
    return () => {
      if (d.open) d.close();
    };
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
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
