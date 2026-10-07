'use client';

import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { pickSurface, type SurfaceIntent } from './rule';
import { Sheet, type SheetSnap } from './Sheet';
import { SidePanel } from './SidePanel';
import { useBreakpoint } from './useBreakpoint';

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * `context` = list must stay visible (stand, pescar, cântărire); `decision` = anulare, penalizare
   * (an alert dialog); `info` = a dismissible informational panel (a plain dialog with «Închide»).
   */
  intent: SurfaceIntent;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** CTA(s): sheet footer, dialog actions, panel footer. */
  actions?: ReactNode;
  /** Classes for the docked panel (the parent renders this where the panel column goes). */
  panelClassName?: string;
  /** The sheet's opening snap (<768); `fit` for short content. */
  sheetSnap?: SheetSnap;
  /** The sheet keeps its one snap (no handle button, no drag): a sheet that cannot be dismissed. */
  sheetFixed?: boolean;
  /** Title for assistive tech only (the body shows its own). */
  titleHidden?: boolean;
  /**
   * Long content on the dialog (≥768): it fits the viewport, the body scrolls, the actions stay
   * pinned (Dialog `scrollBody`). The sheet and the panel always pin their footer.
   */
  pinnedActions?: boolean;
};

/** Opens the right surface for the breakpoint per `pickSurface` (see rule.ts for the rule). */
export function ResponsiveSurface({ open, onClose, intent, title, subtitle, children, actions, panelClassName, sheetSnap, sheetFixed, titleHidden, pinnedActions }: Props) {
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
        closeButton={intent !== 'decision'}
        titleHidden={titleHidden}
        scrollBody={pinnedActions}
      >
        {children}
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} footer={actions} initialSnap={sheetSnap} fixed={sheetFixed} titleHidden={titleHidden}>
      {children}
    </Sheet>
  );
}
