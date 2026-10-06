'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@/components/surfaces/Dialog';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { cn } from '@/components/ui/cn';
import { COLUMN_STICKY_TOP_BELOW_TABS } from '@/components/templates/T3/metrics';

/*
 * A detail read beside the list it belongs to (a weighing, an angler) — Fundații §07 `context`:
 * the kit ResponsiveSurface (a sheet on the phone, a dialog 768–1279, from 1280 the side panel
 * docked beside the content, so the stands / the ranking stay in view). Rendered where the panel
 * docks; `DOCKED_PANEL` is its sticky column.
 *
 * The docked panel is not modal (the kit SidePanel: no focus trap): opening moves focus into it, so
 * Escape works at once; closing gives focus back to what opened it. Focus lands on the surface's
 * heading (tabindex -1, no ring), never on the sheet's grabber or a close button that would light
 * up an accent ring on every pointer open; keyboard users are inside and Tab goes on from there.
 */
export const DOCKED_PANEL = cn('sticky max-h-[calc(100dvh-var(--spacing)*36)] shrink-0 self-start rounded-card', COLUMN_STICKY_TOP_BELOW_TABS);

export function ContextSurface({
  open,
  onClose,
  title,
  subtitle,
  overlay = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  /**
   * Opened by a link on arrival (`?cantar=`, `?pescar=`), after the first paint: from 1280 a dialog
   * over the page instead of the docked panel, so the column beside it never narrows by itself
   * (layout shift). Presses keep the docked panel.
   */
  overlay?: boolean;
  children: ReactNode;
}) {
  const desktop = useBreakpoint() === 'desktop';
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const box = wrap.current;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // After the kit surface has opened (its showModal ran in a child effect, before this one).
    const heading = box?.querySelector<HTMLElement>('dialog[open] h2, aside header h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.classList.add('outline-none');
      heading.focus({ focusVisible: false } as FocusOptions);
    }
    return () => {
      if (back?.isConnected && (document.activeElement === document.body || box?.contains(document.activeElement))) back.focus();
    };
  }, [open]);
  return (
    <div ref={wrap} className="contents">
      {overlay && desktop ? (
        <Dialog open={open} onClose={onClose} title={title} subtitle={subtitle} closeButton>
          {children}
        </Dialog>
      ) : (
        <ResponsiveSurface open={open} onClose={onClose} intent="context" title={title} subtitle={subtitle} panelClassName={DOCKED_PANEL}>
          {children}
        </ResponsiveSurface>
      )}
    </div>
  );
}

/** fish ActivityIndicator: the accent arrows turning, announced politely. */
export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('flex justify-center py-6', className)}>
      <ArrowPathIcon aria-hidden className="size-6 animate-spin text-accent-ink" />
    </span>
  );
}
