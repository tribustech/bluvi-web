'use client';

import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { pickSurface, type SurfaceIntent } from './rule';
import { Sheet } from './Sheet';
import { SidePanel } from './SidePanel';
import { useBreakpoint } from './useBreakpoint';

type Props = {
  open: boolean;
  onClose: () => void;
  /** `context` = list must stay visible (stand, pescar, cântărire); `decision` = anulare, penalizare. */
  intent: SurfaceIntent;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** CTA(s): sheet footer, dialog actions, panel footer. */
  actions?: ReactNode;
  /** Classes for the docked panel (the parent renders this where the panel column goes). */
  panelClassName?: string;
};

/** Opens the right surface for the breakpoint per `pickSurface` (see rule.ts for the rule). */
export function ResponsiveSurface({ open, onClose, intent, title, subtitle, children, actions, panelClassName }: Props) {
  const kind = pickSurface(intent, useBreakpoint());
  if (kind === 'panel') {
    return open ? (
      <SidePanel title={title} subtitle={subtitle} onClose={onClose} footer={actions} className={panelClassName}>
        {children}
      </SidePanel>
    ) : null;
  }
  if (kind === 'dialog') {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={title}
        subtitle={subtitle}
        actions={actions}
        alert={intent === 'decision'}
        closeButton={intent === 'context'}
      >
        {children}
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} footer={actions}>
      {children}
    </Sheet>
  );
}
