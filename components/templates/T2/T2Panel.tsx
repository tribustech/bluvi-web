'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Sheet } from '@/components/surfaces/Sheet';
import { SidePanel } from '@/components/surfaces/SidePanel';
import { cn } from '@/components/ui/cn';
import { useT2Frame } from './context';
import { SHELL_EDGE_LEFT } from '@/components/nav/shell';

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
 * The T2 panel (filters, sort): over the list column from 768 — the map stays visible and
 * live, the list it changes is what it covers (fish hides the list while the filter sheet is
 * open) — and the kit Sheet on a phone (fish LakeFilterPickerSheet). From 768 it is the kit
 * SidePanel at its own 420px (the whole 360px column at 768), docked at the list column's left edge
 * — on screens wider than the shell, at the shell column's edge, where the list starts — with its
 * panel shadow over the rest of the column. Not modal: Escape closes it, focus goes to its title on
 * open and back to what opened it on close. T2Layout makes the list under it inert.
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
  const ref = useRef<HTMLDivElement>(null);
  const { split } = useT2Frame();

  // On close focus returns to the control that opened the panel (captured when it mounted).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    };
  }, []);
  // Focus moves to the panel title once the panel is on screen: again when the breakpoint resolves
  // after hydration (the server render does not know the width; at 375 this panel is display:none).
  // TODO(kit): SidePanel has no heading ref — this task may only touch T2; add `initialFocus` there.
  useEffect(() => {
    if (!split) return;
    const heading = ref.current?.querySelector<HTMLHeadingElement>('h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [split]);

  return (
    <div
      ref={ref}
      // Left: the column's edge, or the shell column's edge once the window is wider than the shell
      // (nav/shell.tsx SHELL_EDGE_LEFT: ALIGN_LEFT less its 32px gutter). Below 1280 the box is the column (360px), so
      // SidePanel's max-w-full keeps it inside; from 1280 the column is wider and it is 420.
      className={cn('absolute inset-y-0 right-0 left-0 z-above flex xl:right-auto [&_h2]:outline-none', SHELL_EDGE_LEFT)}
    >
      <SidePanel title={title} subtitle={subtitle} onClose={onClose} footer={footer} className="h-full">
        {children}
      </SidePanel>
    </div>
  );
}
