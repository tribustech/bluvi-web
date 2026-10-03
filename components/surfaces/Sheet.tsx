'use client';

import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { useModalDialog } from './useModalDialog';

export type SheetSnap = 0.5 | 0.9;
const SNAPS: SheetSnap[] = [0.5, 0.9];
/** Released below this fraction of the viewport, the sheet closes. */
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
  className?: string;
};

/**
 * Mobile bottom sheet (<768): drag the handle/header to resize, snaps at 50% and 90% of the
 * viewport, dragged low enough it closes. The handle is also a button (Enter/Space toggles
 * 50 ↔ 90) so the snap is reachable without a pointer. Modal: scrim, Escape and scrim tap close.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, initialSnap = 0.5, className }: Props) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [dragPx, setDragPx] = useState<number | null>(null);
  // Every opening starts at the initial snap.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnap(initialSnap);
  }
  const start = useRef<{ y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    if (!start.current.moved && Math.abs(dy) > 4) {
      start.current.moved = true;
      // Capture only once it is a drag, so a plain tap still clicks the handle button.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (start.current.moved) setDragPx(dy);
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s || dragPx === null) return setDragPx(null);
    const vh = window.innerHeight;
    const fraction = snap - dragPx / vh;
    setDragPx(null);
    if (!s.moved) return;
    if (fraction < CLOSE_BELOW) return onClose();
    setSnap(SNAPS.reduce((a, b) => (Math.abs(b - fraction) < Math.abs(a - fraction) ? b : a)));
  };

  const height = dragPx === null ? `${snap * 100}dvh` : `calc(${snap * 100}dvh - ${dragPx}px)`;

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
        style={{ height }}
        className={cn(
          'flex max-h-[95dvh] w-full flex-col rounded-t-card bg-surface shadow-e2',
          'translate-y-0 starting:translate-y-full',
          dragPx === null && 'transition-[height,translate] duration-(--duration-slow) ease-slow',
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
            onClick={() => setSnap(snap === 0.5 ? 0.9 : 0.5)}
            aria-label={snap === 0.5 ? 'Extinde' : 'Restrânge'}
            className="mx-auto mb-2 flex h-4 w-12 items-center justify-center rounded-full"
          >
            <span aria-hidden className="h-1 w-9 rounded-full bg-handle" />
          </button>
          <h2 id={titleId} className="t-heading">
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
