'use client';

import { useId, useRef, type ReactNode } from 'react';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { useModalDialog } from './useModalDialog';
import { useBreakpoint } from './useBreakpoint';
import { DISMISS_MS, useSheetDrag } from './useSheetDrag';
import { cn } from '@/components/ui/cn';

/*
 * A modal with fish's screen header — an optional back chevron (a sub-view's way back), the title,
 * an «Închide» X — and an optional footer, on the kit's useModalDialog (top layer, focus containment,
 * Escape, focus return, page scroll lock). For a modal with sub-views or a full-screen phone
 * presentation, which Dialog / Sheet do not have (first used by the Concursuri search and filters).
 *
 *  - phone (<768): `fullScreen` fills the screen (fish CompetitionsSearchScreen, a full-screen
 *    Modal); otherwise a bottom sheet as tall as its content, at most 85% (fish CompetitionFiltersSheet, snap 85%) with the kit
 *    Sheet's handle and gesture (useSheetDrag: drag the header, or pull the content down from its
 *    top, to dismiss), sitting above the iOS keyboard (the visual viewport, useModalDialog);
 *  - from 768: a dialog (e2). The search is anchored near the top and grows DOWNWARD with its
 *    answer (min 320, at most 640 / 80dvh): its field never moves, and a three-row answer leaves no
 *    white band under it. The filters are centred, so they keep a fixed height (their sub-views swap
 *    inside the same box).
 */
export function ModalSurface({
  open,
  onClose,
  title,
  back,
  fullScreen = false,
  footer,
  children,
  bodyClassName,
  backdropDismiss = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A sub-view's way back (fish «Înapoi la filtre»). */
  back?: { label: string; onBack: () => void };
  fullScreen?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  /** false: a click on the backdrop does nothing (a signature pad must not close on a stray tap). */
  backdropDismiss?: boolean;
}) {
  const dialog = useModalDialog(open, onClose, { backdrop: backdropDismiss });
  const titleId = useId();
  const breakpoint = useBreakpoint();
  const sheet = !fullScreen && breakpoint === 'mobile';
  const body = useRef<HTMLDivElement>(null);
  const drag = useSheetDrag({
    open,
    enabled: sheet,
    panelRef: dialog.ref,
    scrollerRef: body,
    rests: () => [dialog.ref.current?.offsetHeight ?? 0],
    restIndex: () => 0,
    dismissible: true,
    onSettle: () => {},
    onClose,
  });
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      style={sheet ? { ...drag.style, ...(drag.dismissing ? { transitionDuration: `${DISMISS_MS}ms` } : null) } : undefined}
      className={cn(
        'max-w-none bg-surface p-0 text-ink shadow-e2 backdrop:bg-scrim open:flex open:flex-col',
        drag.dragging ? 'transition-none' : 'transition-[opacity,translate,scale,height] duration-(--duration-slow) ease-slow',
        drag.dismissing && 'ease-out',
        fullScreen
          ? 'max-md:fixed max-md:inset-x-0 max-md:top-(--vv-top,0px) max-md:bottom-auto max-md:m-0 max-md:h-(--vv-h,100dvh) max-md:max-h-none max-md:w-full max-md:translate-y-0 max-md:starting:translate-y-6 max-md:starting:opacity-0'
          : // The bottom follows the visual viewport (the iOS keyboard's top). As tall as its content, at
            // most 85% (owner 2026-10-11: a short sheet hugs it, its footer right under it, fish gorhom's
            // dynamic sizing); taller content scrolls in the body, the footer pinned.
            'max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-(--vv-bottom,0px) max-md:m-0 max-md:h-auto max-md:max-h-[min(85dvh,calc(var(--vv-h,100dvh)*0.92))] max-md:w-full max-md:overflow-clip max-md:rounded-t-card max-md:translate-y-0 max-md:starting:translate-y-full',
        // From 768: the kit Dialog's frame, a little wider for the search's two-line rows. The search
        // is top-anchored (as the ⌘K palette), so growing with its suggestions never moves the field;
        // the centred filters keep a FIXED height, their sub-views (Filtre / Perioadă / Județ)
        // swapping inside the same box, the body scrolling.
        'md:w-[calc(100%-(--spacing(8)))] md:rounded-card md:scale-100 md:opacity-100 md:starting:scale-95 md:starting:opacity-0',
        fullScreen
          ? 'md:mx-auto md:mt-[12dvh] md:mb-auto md:bottom-auto md:h-auto md:min-h-80 md:max-h-[min(640px,80dvh)] md:max-w-[560px]'
          : 'md:m-auto md:h-[min(680px,85dvh)] md:max-h-none md:max-w-[480px]',
      )}
    >
      {sheet ? (
        // The kit Sheet's handle (36×4), the drag area together with the header under it.
        <div {...drag.handleProps} data-sheet-handle="" className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 select-none active:cursor-grabbing md:hidden">
          <span aria-hidden className="h-1 w-9 rounded-full bg-handle" />
        </div>
      ) : null}
      <div
        {...(sheet ? drag.handleProps : null)}
        data-dialog-chrome=""
        className={cn('flex shrink-0 items-center gap-1 px-5 pt-3 pb-2', !fullScreen && 'border-b border-hairline pb-3', sheet && 'touch-none pt-1 select-none')}
      >
        {back ? (
          <IconButton aria-label={back.label} onClick={back.onBack} className="-ml-3">
            <ChevronLeftIcon aria-hidden />
          </IconButton>
        ) : null}
        {/* The title steps as the kit hosts do: from 768 the kit Dialog's t-title2 for both; on the
            phone the full-screen search's screen title (t-title1), the filters' sheet t-heading. */}
        <h2 id={titleId} tabIndex={-1} className={cn('min-w-0 flex-1 truncate outline-none', fullScreen ? 't-title1 md:t-title2' : 't-heading md:t-title2')}>
          {title}
        </h2>
        <IconButton aria-label="Închide" onClick={onClose} className="-mr-3">
          <XMarkIcon aria-hidden />
        </IconButton>
      </div>
      <div ref={body} data-sheet-body={sheet ? '' : undefined} className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5', !footer && 'pb-[env(safe-area-inset-bottom)]', bodyClassName)}>
        {children}
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-hairline px-5 pt-3 pb-[max(var(--spacing)*4,env(safe-area-inset-bottom))]">{footer}</div>
      ) : null}
    </dialog>
  );
}
