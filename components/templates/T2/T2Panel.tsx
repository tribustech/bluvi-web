'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { cn } from '@/components/ui/cn';

export type T2PanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Context line under the title («Se aplică pe hartă și în listă»). */
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky actions («Resetează» · «Aplică · 12 bălți»). */
  footer?: ReactNode;
  /**
   * Where focus goes on close when the control that opened the panel is gone or never existed (a
   * page that loads with the panel open): the «Filtre» button.
   */
  returnFocusTo?: () => HTMLElement | null;
};

/**
 * The T2 panel (filters, sort): the kit Sheet on a phone (fish LakeFilterPickerSheet), a centred
 * kit Dialog from 768 (owner rule 2, ROADMAP §4b 2026-10-06: filters open in a dialog from the
 * horizontal chip bar, never a vertical panel that takes the list's column). Modal at every width:
 * Escape closes it, focus goes in on open and back to what opened it on close.
 */
/** Marks the phone Sheet's <dialog>, so the panel can find its title (the Sheet takes no ref). */
const SHEET_MARK = 't2-panel-sheet';

export function T2Panel({ docked = false, ...props }: T2PanelProps & { docked?: boolean }) {
  // Phone: showModal() focuses the first focusable — the drag handle — and its focus ring is the
  // first thing on screen. Move focus to the title instead, as DockedPanel does (this runs after
  // the Sheet's own effect has called showModal()). TODO(kit): Sheet `initialFocus`.
  const sheetOpen = !docked && props.open;
  // Closed with focus nowhere (no opener to go back to): the fallback, after the surface unmounts.
  const fallback = useRef(props.returnFocusTo);
  useEffect(() => {
    fallback.current = props.returnFocusTo;
  });
  useEffect(() => {
    if (!props.open) return;
    return () => {
      // After the surface is gone: the modal <dialog> hands focus back to <body> as it closes.
      const restore = () => {
        const now = document.activeElement;
        if (!now || now === document.body) fallback.current?.()?.focus({ preventScroll: true });
      };
      requestAnimationFrame(restore);
      window.setTimeout(restore, 250);
    };
  }, [props.open]);
  useEffect(() => {
    if (!sheetOpen) return;
    const heading = document.querySelector<HTMLHeadingElement>(`dialog.${SHEET_MARK}[open] h2`);
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [sheetOpen]);

  if (!docked) {
    return (
      <Sheet
        open={props.open}
        onClose={props.onClose}
        title={props.title}
        subtitle={props.subtitle}
        footer={props.footer}
        initialSnap={0.9}
        // showModal() focuses the handle while the panel still slides up from translate-y-full, and
        // the <dialog> (UA overflow: auto) scrolls to it: the sheet opened ~210px scrolled, title off
        // screen. `clip` (not hidden: focus() can still scroll a hidden box) makes it unscrollable.
        // TODO(kit): Sheet should clip itself and focus with preventScroll.
        className={cn(SHEET_MARK, 'overflow-clip [&_h2]:outline-none')}
      >
        {props.children}
      </Sheet>
    );
  }
  return props.open ? <DockedPanel {...props} /> : null;
}

function DockedPanel({ onClose, title, subtitle, children, footer }: T2PanelProps) {
  // `docked` (from 768): the kit Dialog — its body scrolls between the fixed header and footer, the
  // metrics of T1 FiltersSurface's dialog. The Sheet's «Închide» X in `children` hides itself there.
  return (
    <Dialog open onClose={onClose} title={title} subtitle={subtitle} closeButton actions={footer} className="max-h-[85dvh] [&_h2]:outline-none">
      <div className="-mx-5 mt-2 flex max-h-[60dvh] flex-col overflow-y-auto px-5 pb-1">{children}</div>
    </Dialog>
  );
}
