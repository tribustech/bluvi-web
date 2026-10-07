'use client';

import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { useModalDialog } from './useModalDialog';

/** `fit`: as tall as the content (capped at 95%) — a short informational sheet, no dead space. */
export type SheetSnap = 0.5 | 0.9 | 'fit';
/** Released below this fraction of the viewport (from the 50% snap), the sheet closes. */
const CLOSE_BELOW = 0.3;

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
  className?: string;
};

/**
 * Mobile bottom sheet (<768): drag the handle/header to resize, snaps at its initial snap (50% of
 * the viewport, or `fit` — the content's own height) and 90%, dragged low enough it closes. The
 * handle is also a button (Enter/Space toggles initial ↔ 90) so the snap is reachable without a
 * pointer. Modal: scrim, Escape and scrim tap close.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, initialSnap = 0.5, titleHidden, className }: Props) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  /** While dragging: the pointer's travel and the panel's height when the drag began (px). */
  const [drag, setDrag] = useState<{ dy: number; base: number } | null>(null);
  // Every opening starts at the initial snap.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(initialSnap);
  }
  const start = useRef<{ y: number; moved: boolean; base: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** The fitted height last seen (px): where a `fit` sheet returns to from 90%. */
  const fitPx = useRef(0);
  /** The other end of the handle's toggle: 90%, or back to the initial snap (0.5 when that is 90). */
  const low: SheetSnap = initialSnap === 0.9 ? 0.5 : initialSnap;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const base = panel.current?.offsetHeight ?? 0;
    if (snap === 'fit') fitPx.current = base;
    start.current = { y: e.clientY, moved: false, base };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (!s.moved && Math.abs(dy) > 4) {
      s.moved = true;
      // Capture only once it is a drag, so a plain tap still clicks the handle button.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (s.moved) setDrag({ dy, base: s.base });
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s || !s.moved || !drag) return;
    const vh = window.innerHeight;
    const fraction = (s.base - drag.dy) / vh;
    const lowFraction = low === 'fit' ? (fitPx.current || vh / 2) / vh : low;
    // Below 60% of the low snap it closes (0.3 of the viewport for the 50% snap).
    if (fraction < lowFraction * (CLOSE_BELOW / 0.5)) return onClose();
    setSnap(Math.abs(0.9 - fraction) < Math.abs(lowFraction - fraction) ? 0.9 : low);
  };

  const height = drag ? `${drag.base - drag.dy}px` : snap === 'fit' ? undefined : `${snap * 100}dvh`;

  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-ink',
        'backdrop:bg-scrim open:flex open:flex-col open:justify-end',
        className,
      )}
    >
      <div
        ref={panel}
        style={{ height }}
        className={cn(
          'flex max-h-[95dvh] w-full flex-col rounded-t-card bg-surface shadow-e2',
          'translate-y-0 starting:translate-y-full',
          !drag && 'transition-[height,translate] duration-(--duration-slow) ease-slow',
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 cursor-grab touch-none px-5 pt-2.5 pb-3 select-none active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={() => setSnap(snap === 0.9 ? low : 0.9)}
            aria-label={snap === 0.9 ? 'Restrânge' : 'Extinde'}
            className="mx-auto mb-2 flex h-4 w-12 items-center justify-center rounded-full"
          >
            <span aria-hidden className="h-1 w-9 rounded-full bg-handle" />
          </button>
          <h2 id={titleId} className={titleHidden ? 'sr-only' : 't-heading'}>
            {title}
          </h2>
          {subtitle ? <div className="t-caption text-muted">{subtitle}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-hairline px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
