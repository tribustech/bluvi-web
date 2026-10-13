'use client';

import { useId, useLayoutEffect, useState, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { cn } from '@/components/ui/cn';

/*
 * The Bălți filters from 768 (owner 2026-10-13: «filtrele sunt în modale în mijlocul ecranului…
 * can do better»), Airbnb's two surfaces:
 *  - FilterPopover: «Specie» / «Regim» open a panel hanging right under their segment of the search
 *    pill — the choice is made where it was asked, the page stays in view behind a light veil;
 *  - FilterDrawer: «Filtre» (everything) slides in from the right edge, full height, its footer
 *    («Șterge», «Aplică · N bălți») pinned at the bottom.
 * Both are native modal <dialog>s (useModalDialog: top layer, focus containment, Escape, focus
 * return, scroll lock), named by their title, with the «Închide» X. The phone keeps its sheet.
 */

/** The «Închide» X both surfaces carry (data-dialog-chrome: initial focus goes to the title). */
function CloseX({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Închide"
      data-dialog-chrome=""
      className="-mr-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
    >
      <XMarkIcon className="size-5" aria-hidden />
    </button>
  );
}

/** Where the popover hangs: 12px under the segment, its left edge on the segment's, kept on screen. */
function usePlacement(open: boolean, anchorSelector: string, width: number) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = [...document.querySelectorAll<HTMLElement>(anchorSelector)].find((el) => el.getClientRects().length > 0);
      if (!anchor) return setPos(null);
      const r = anchor.getBoundingClientRect();
      const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16));
      setPos({ top: Math.round(r.bottom + 12), left: Math.round(left) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, anchorSelector, width]);
  return pos;
}

const POPOVER_W = 440;

export function FilterPopover({
  open,
  onClose,
  title,
  anchorSelector,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The segment it hangs from (e.g. `[data-pill-segment="fish"]`); the first visible match. */
  anchorSelector: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  const pos = usePlacement(open, anchorSelector, POPOVER_W);
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      style={pos ? { top: pos.top, left: pos.left, width: POPOVER_W } : { width: POPOVER_W }}
      className={cn(
        'fixed m-0 max-h-[min(560px,calc(100dvh-160px))] max-w-[calc(100vw-32px)] rounded-[28px] bg-surface p-0 text-left text-ink shadow-[0_24px_64px_-16px_rgb(16_24_40/0.32)]',
        'backdrop:bg-ink/10 open:flex open:flex-col',
        pos ? null : 'inset-0 m-auto',
        'translate-y-0 opacity-100 transition-[opacity,translate] duration-(--duration-medium) ease-slow starting:-translate-y-2 starting:opacity-0',
      )}
    >
      <div className="flex shrink-0 items-center gap-3 px-6 pt-5 pb-1">
        <h2 id={titleId} tabIndex={-1} className="min-w-0 flex-1 truncate t-title2 outline-none">
          {title}
        </h2>
        <CloseX onClose={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-2 pb-4">{children}</div>
      <div className="shrink-0 border-t border-hairline px-6 py-4">{footer}</div>
    </dialog>
  );
}

export function FilterDrawer({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(480px,100vw)] max-w-none rounded-l-[28px] bg-surface p-0 text-left text-ink shadow-[0_24px_64px_-16px_rgb(16_24_40/0.32)]',
        'backdrop:bg-scrim open:flex open:flex-col',
        'translate-x-0 transition-[translate] duration-(--duration-slow) ease-slow starting:translate-x-full motion-reduce:transition-none',
      )}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-6 py-4">
        <h2 id={titleId} tabIndex={-1} className="min-w-0 flex-1 truncate t-title2 outline-none">
          {title}
        </h2>
        <CloseX onClose={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
      <div className="shrink-0 border-t border-hairline px-6 py-4">{footer}</div>
    </dialog>
  );
}
