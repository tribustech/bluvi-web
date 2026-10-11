'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { useModalDialog } from './useModalDialog';
import { DISMISS_MS, useSheetDrag } from './useSheetDrag';

/**
 * The opening rest for content TALLER than the sheet's 92% cap: 50% / 90% of the visible height, or
 * `fit` (the cap). Content that fits under the cap ignores it (owner 2026-10-11, fish gorhom's
 * dynamic sizing): the sheet is exactly as tall as its content, the footer right under it, no
 * empty band — and has that one rest.
 */
export type SheetSnap = 0.5 | 0.9 | 'fit';

/**
 * The visible area's height (the visual viewport, so the sheet sits above the iOS keyboard), set on
 * the <dialog> by useModalDialog; the full dynamic viewport until it is known.
 */
const VH = 'var(--vv-h,100dvh)';
const SNAP_HEIGHT = { 0.5: `calc(${VH}*0.5)`, 0.9: `calc(${VH}*0.9)`, fit: `calc(${VH}*0.92)` } as const;
/** The tallest a sheet gets (its max-height). */
const MAX = 0.92;

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky footer (CTA). */
  footer?: ReactNode;
  initialSnap?: SheetSnap;
  /** Keep the title for assistive tech only (the body shows its own, e.g. centred under an icon). */
  titleHidden?: boolean;
  /**
   * One snap, no resize: the handle is decorative (no «Restrânge» button, no drag) — for a sheet
   * that cannot be dismissed (Acasă's «Completează profilul», fish: one 90% snap, no pan-down).
   */
  fixed?: boolean;
  /** false: a tap on the scrim does not close it (Escape and the X still do). Default true. */
  backdropDismiss?: boolean;
  /** An «Închide» X at the header's right end — the visible way out of a `fixed`, scrim-proof sheet. */
  closeButton?: boolean;
  className?: string;
};

/**
 * THE phone bottom sheet (<768) — every phone sheet of the site is this one (directly, through
 * ResponsiveSurface, or ModalSurface's sheet), behaving as fish's gorhom sheets:
 *  - content that fits under the 92% cap: exactly as tall as it, the footer right under it, one
 *    rest (fish gorhom's dynamic sizing). Taller content: rests at its initial snap (50%, or `fit`:
 *    the cap) and 90%, the body scrolling, the footer pinned; the handle / header drags it, with momentum (sheetPhysics, the lakes map sheet's model);
 *    pulling down on the content while it is scrolled to its top drags it too; dragged / flicked low
 *    enough it slides away and closes. The handle is also a button (Enter/Space toggles initial ↔ 90).
 *  - the content scrolls inside (only when taller than the sheet) and never hands the scroll on;
 *    the page behind never scrolls or rubber-bands (useModalDialog → scrollLock);
 *  - max 92% of the visible height, bottom safe area kept, above the bottom tab bar (top layer), and
 *    above the iOS keyboard (the dialog follows the visual viewport);
 *  - modal: scrim tap and Escape close, focus is contained and returned (native <dialog>).
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  initialSnap = 0.5,
  titleHidden,
  fixed,
  backdropDismiss = true,
  closeButton = false,
  className,
}: Props) {
  const dialog = useModalDialog(open, onClose, { backdrop: backdropDismiss });
  const titleId = useId();
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  // Every opening starts at the initial snap.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(initialSnap);
  }
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  /** The other end of the handle's toggle: 90%, or back to the initial snap (0.5 when that is 90). */
  const low: SheetSnap = initialSnap === 0.9 ? 0.5 : initialSnap;
  const header = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  /**
   * The sheet's natural height (px): header + the body's content and padding + footer — what it
   * would be with no cap — when it fits under the cap; null while unknown or taller. Measured when
   * it opens (before the first paint: useModalDialog shows the <dialog> in a layout effect) and
   * whenever the content, the footer or the visible area resize (data streaming in, the keyboard).
   * Within one opening it only grows: a search whose answer shortens while typing keeps its height
   * (no sheet jumping under the finger); once taller than the cap it stays on its snaps.
   */
  const [natural, setNatural] = useState<number | null>(null);
  const naturalRef = useRef<number | null>(null);
  const hasFooter = footer != null;
  useLayoutEffect(() => {
    if (!open) return;
    let peak = 0;
    let tall = false;
    const measure = () => {
      const b = body.current;
      const c = content.current;
      if (!b || !c || !c.getClientRects().length) return;
      const pad = getComputedStyle(b);
      const px = Math.ceil(
        (header.current?.offsetHeight ?? 0) +
          parseFloat(pad.paddingTop) +
          parseFloat(pad.paddingBottom) +
          c.offsetHeight +
          (foot.current?.offsetHeight ?? 0),
      );
      const h = dialog.ref.current?.clientHeight || window.innerHeight;
      peak = Math.max(peak, px);
      tall ||= peak > MAX * h;
      const fits = tall ? null : peak;
      naturalRef.current = fits;
      setNatural(fits);
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of [content.current, header.current, foot.current, dialog.ref.current]) if (el) ro.observe(el);
    return () => ro.disconnect();
    // dialog.ref is a stable ref object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasFooter]);

  const drag = useSheetDrag({
    open,
    enabled: !fixed,
    panelRef: panel,
    scrollerRef: body,
    rests: () => {
      const h = dialog.ref.current?.clientHeight || window.innerHeight;
      // Content that fits: one rest, its own height. Taller: the snaps.
      const fit = naturalRef.current;
      if (fit !== null) return [fit, fit];
      return [low === 'fit' ? MAX * h : low * h, 0.9 * h];
    },
    restIndex: () => (snap === 0.9 ? 1 : 0),
    dismissible: true,
    onSettle: (i) => setSnap(i === 1 ? 0.9 : low),
    onClose,
  });

  // Content that fits: its own height. Taller (or not measured yet): the snap.
  const height = natural !== null ? `${natural}px` : SNAP_HEIGHT[snap];

  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cn(
        // overflow-clip, not the UA's overflow:auto: showModal() focuses the first control while the
        // panel is still translated down (starting:translate-y-full), and a scrollable <dialog> would
        // scroll to reveal it and stay scrolled — the panel left undocked, its top clipped. A clipped
        // box is not a scroll container: the panel's own body scrolls instead.
        // text-left: a <dialog> inherits from where it is mounted (a centred header would centre it).
        // The visible area (top / height of the visual viewport): with the iOS keyboard up the sheet
        // sits on the keyboard, not under it.
        'fixed inset-x-0 top-(--vv-top,0px) bottom-auto m-0 h-(--vv-h,100dvh) max-h-none w-full max-w-none overflow-clip bg-transparent p-0 text-left text-ink',
        'backdrop:bg-scrim open:flex open:flex-col open:justify-end',
        className,
      )}
    >
      <div
        ref={panel}
        data-sheet-panel=""
        style={{ height, ...drag.style, ...(drag.dismissing ? { transitionDuration: `${DISMISS_MS}ms` } : null) }}
        className={cn(
          'flex max-h-[calc(var(--vv-h,100dvh)*0.92)] w-full flex-col rounded-t-card bg-surface shadow-e2',
          'translate-y-0 starting:translate-y-full',
          drag.dismissing
            ? 'transition-[translate] ease-out'
            : !drag.dragging && 'transition-[height,translate] duration-(--duration-slow) ease-slow',
        )}
      >
        <div
          ref={header}
          {...drag.handleProps}
          data-sheet-handle=""
          className={cn('relative shrink-0 px-5 pt-2.5 pb-3', !fixed && 'cursor-grab touch-none select-none active:cursor-grabbing')}
        >
          {closeButton ? (
            <button
              type="button"
              onClick={onClose}
              onPointerDown={e => e.stopPropagation()}
              aria-label="Închide"
              className="absolute top-1.5 right-2 flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill"
            >
              <XMarkIcon className="size-5" aria-hidden />
            </button>
          ) : null}
          {fixed ? (
            <span aria-hidden className="mx-auto mb-2 flex h-4 w-12 items-center justify-center">
              <span className="h-1 w-9 rounded-full bg-handle" />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSnap(snap === 0.9 ? low : 0.9)}
              aria-label={snap === 0.9 ? 'Restrânge' : 'Extinde'}
              className="mx-auto mb-2 flex h-4 w-12 items-center justify-center rounded-full"
            >
              <span aria-hidden className="h-1 w-9 rounded-full bg-handle" />
            </button>
          )}
          <h2 id={titleId} tabIndex={-1} className={cn('outline-none', titleHidden ? 'sr-only' : cn('t-heading', closeButton && 'pr-10'))}>
            {title}
          </h2>
          {subtitle ? <div className={cn('t-caption text-muted', closeButton && 'pr-10')}>{subtitle}</div> : null}
        </div>
        <div
          ref={body}
          data-sheet-body=""
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5',
            // No footer: the content clears the home indicator itself.
            footer ? 'pb-4' : 'pb-[max(--spacing(4),env(safe-area-inset-bottom))]',
          )}
        >
          {/* flow-root: the content's own margins count in its measured height. */}
          <div ref={content} data-sheet-content="" className="flow-root">
            {children}
          </div>
        </div>
        {footer ? (
          <div ref={foot} className="shrink-0 border-t border-hairline px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
