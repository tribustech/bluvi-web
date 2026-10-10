'use client';

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { releaseVelocity, rubberBand, settle, type Sample } from './sheetPhysics';

/** How long the dismiss slide runs before the parent is told to close (ms). */
export const DISMISS_MS = 240;

type Options = {
  /** The surface is open: every opening starts clean (a dismissed sheet reopened is not still sliding away). */
  open: boolean;
  /** false: no drag at all (a fixed sheet, or the surface is not a sheet at this width). */
  enabled: boolean;
  /** The panel that moves (its offsetHeight is the visible height at rest). */
  panelRef: RefObject<HTMLElement | null>;
  /** The sheet's own scroller: pulling down at its top (or up below the top rest) moves the sheet. */
  scrollerRef: RefObject<HTMLElement | null>;
  /** The rests as panel heights in px, read when a drag starts (the viewport may have changed). */
  rests: () => number[];
  /** Which rest the sheet is at now (index into `rests()`). */
  restIndex: () => number;
  /** A flick / drag far enough down closes it (false: it springs back to its lowest rest). */
  dismissible: boolean;
  onSettle: (index: number) => void;
  onClose: () => void;
};

/** The content under the finger is scrolled to its top: the sheet's scroller and every scroller between. */
function atScrollTop(target: Element | null, scroller: HTMLElement): boolean {
  for (let el = target; el && el !== scroller; el = el.parentElement) {
    const h = el as HTMLElement;
    if (h.scrollTop > 0 && h.scrollHeight > h.clientHeight) return false;
  }
  return scroller.scrollTop <= 0;
}

/**
 * The phone sheet's gesture (fish gorhom, the lakes map sheet's physics — sheetPhysics):
 *  - the handle / header: pointer events (touch and mouse), a move past 4 px is a drag, else a tap;
 *  - the content: touch events (the hand-off needs preventDefault on a live touchmove) — a pull
 *    down while it is scrolled to its top, or a push up while the sheet is below its top rest,
 *    moves the sheet instead of the list;
 *  - the release settles with momentum on a rest, or slides the sheet away and closes it.
 * Between the rests the panel's height follows the finger; below the lowest it slides down whole.
 */
export function useSheetDrag(o: Options) {
  const live = useRef(o);
  useEffect(() => {
    live.current = o;
  });
  /** The panel's visible height while held; null at rest. */
  const [held, setHeld] = useState<{ visible: number; lowest: number } | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const drag = useRef<{ y0: number; from: number; min: number; max: number; samples: Sample[]; moved: boolean } | null>(null);

  const start = (y: number) => {
    const l = live.current;
    const rests = l.rests();
    const from = l.panelRef.current?.offsetHeight ?? rests[l.restIndex()] ?? 0;
    drag.current = { y0: y, from, min: Math.min(...rests), max: Math.max(...rests), samples: [{ y, t: performance.now() }], moved: false };
  };
  const move = (y: number) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    d.samples.push({ y, t: performance.now() });
    if (d.samples.length > 8) d.samples.shift();
    const raw = d.from - (y - d.y0);
    // Down past the lowest rest the sheet follows the finger 1:1 when it can close (it is on its way
    // out), damped when it cannot.
    setHeld({ visible: rubberBand(raw, live.current.dismissible ? -Infinity : d.min, d.max), lowest: d.min });
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return setHeld(null);
    const l = live.current;
    const last = d.samples[d.samples.length - 1]!;
    const where = settle(d.from - (last.y - d.y0), releaseVelocity(d.samples), l.rests(), l.dismissible);
    if (where === 'close') {
      setDismissing(true);
      window.setTimeout(() => {
        live.current.onClose();
      }, DISMISS_MS);
      return;
    }
    setHeld(null);
    l.onSettle(where);
  };

  const [wasOpen, setWasOpen] = useState(o.open);
  if (o.open !== wasOpen) {
    setWasOpen(o.open);
    if (o.open) {
      setHeld(null);
      setDismissing(false);
    }
  }

  /* -------------------------------------------------------------- the handle (pointer) */
  const pointer = useRef<{ y: number; id: number } | null>(null);
  const handleProps = o.enabled
    ? {
        'data-own-gesture': '',
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
          if (e.button !== 0) return;
          pointer.current = { y: e.clientY, id: e.pointerId };
        },
        onPointerMove: (e: PointerEvent<HTMLElement>) => {
          const p = pointer.current;
          if (!p || p.id !== e.pointerId) return;
          if (!drag.current) {
            if (Math.abs(e.clientY - p.y) <= 4) return;
            start(p.y);
            // Capture only once it is a drag, so a plain tap still clicks the handle button.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* the pointer is already gone (a synthetic or cancelled one): the drag still follows it */
            }
          }
          move(e.clientY);
        },
        onPointerUp: () => {
          pointer.current = null;
          if (drag.current) end();
        },
        onPointerCancel: () => {
          pointer.current = null;
          if (drag.current) end();
        },
        // A drag that started on the handle button must not also click it.
        onClickCapture: (e: MouseEvent<HTMLElement>) => {
          if (held !== null || dismissing) e.stopPropagation();
        },
      }
    : {};

  /* -------------------------------------------------------------- the content (touch) */
  useEffect(() => {
    const scroller = o.scrollerRef.current;
    if (!o.enabled || !scroller) return;
    let t: { x0: number; y0: number; mode: 'sheet' | 'scroll' | null } | null = null;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        t = null;
        return;
      }
      t = { x0: e.touches[0]!.clientX, y0: e.touches[0]!.clientY, mode: null };
    };
    const onMove = (e: TouchEvent) => {
      if (!t) return;
      const p = e.touches[0];
      if (!p) return;
      const dy = p.clientY - t.y0;
      if (t.mode === null) {
        const dx = p.clientX - t.x0;
        if (Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
        // A sideways swipe (a chip rail) is not ours.
        if (Math.abs(dx) > Math.abs(dy)) {
          t = null;
          return;
        }
        // Inside a horizontal scroller / text field / own-gesture element the content decides.
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest('input, textarea, [contenteditable="true"], [data-own-gesture]')) {
          t.mode = 'scroll';
          return;
        }
        const l = live.current;
        const rests = l.rests();
        const top = Math.max(...rests);
        const atTopRest = (rests[l.restIndex()] ?? top) >= top - 1;
        t.mode = (dy > 0 && atScrollTop(target, scroller)) || (dy < 0 && !atTopRest) ? 'sheet' : 'scroll';
        if (t.mode === 'sheet') start(t.y0);
      }
      if (t.mode === 'sheet') {
        if (e.cancelable) e.preventDefault();
        move(p.clientY);
      }
    };
    const onEnd = () => {
      if (t?.mode === 'sheet') end();
      t = null;
    };
    scroller.addEventListener('touchstart', onStart, { passive: true });
    scroller.addEventListener('touchmove', onMove, { passive: false });
    scroller.addEventListener('touchend', onEnd);
    scroller.addEventListener('touchcancel', onEnd);
    return () => {
      scroller.removeEventListener('touchstart', onStart);
      scroller.removeEventListener('touchmove', onMove);
      scroller.removeEventListener('touchend', onEnd);
      scroller.removeEventListener('touchcancel', onEnd);
    };
    // The handlers read `live`; the helpers only touch refs and state setters. The scroller is
    // mounted with the surface (a closed <dialog> keeps its children).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.enabled]);

  /**
   * The panel's style while held / leaving: between the rests its height follows the finger; under
   * the lowest rest it keeps that height and slides down; dismissing, it slides off the screen.
   */
  const style = dismissing
    ? { translate: '0 calc(100% + 24px)' }
    : held === null
      ? undefined
      : held.visible >= held.lowest
        ? { height: `${held.visible}px` }
        : { height: `${held.lowest}px`, translate: `0 ${held.lowest - held.visible}px` };

  return { handleProps, style, dragging: held !== null, dismissing };
}
