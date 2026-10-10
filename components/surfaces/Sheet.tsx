'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { useModalDialog } from './useModalDialog';
import { DISMISS_MS, useSheetDrag } from './useSheetDrag';

/** `fit`: as tall as the content (capped at 92%) — a short informational sheet, no dead space. */
export type SheetSnap = 0.5 | 0.9 | 'fit';

/**
 * The visible area's height (the visual viewport, so the sheet sits above the iOS keyboard), set on
 * the <dialog> by useModalDialog; the full dynamic viewport until it is known.
 */
const VH = 'var(--vv-h,100dvh)';
const SNAP_HEIGHT = { 0.5: `calc(${VH}*0.5)`, 0.9: `calc(${VH}*0.9)` } as const;

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
 *  - rests at its initial snap (50% of the visible height, or `fit` — the content's own height) and
 *    90%; the handle / header drags it, with momentum (sheetPhysics, the lakes map sheet's model);
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
  /** The fitted height last seen (px): where a `fit` sheet returns to from 90%. */
  const fitPx = useRef(0);

  const drag = useSheetDrag({
    open,
    enabled: !fixed,
    panelRef: panel,
    scrollerRef: body,
    rests: () => {
      const h = dialog.ref.current?.clientHeight || window.innerHeight;
      // A `fit` sheet's low rest is its own height, measured while it rests there.
      const lowPx = low === 'fit' ? (snap === 'fit' ? (panel.current?.offsetHeight ?? h / 2) : fitPx.current || h / 2) : low * h;
      if (snap === 'fit') fitPx.current = lowPx;
      return [lowPx, 0.9 * h];
    },
    restIndex: () => (snap === 0.9 ? 1 : 0),
    dismissible: true,
    onSettle: (i) => setSnap(i === 1 ? 0.9 : low),
    onClose,
  });

  const height = snap === 'fit' ? undefined : SNAP_HEIGHT[snap];

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
          <h2 id={titleId} className={titleHidden ? 'sr-only' : cn('t-heading', closeButton && 'pr-10')}>
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
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-hairline px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
