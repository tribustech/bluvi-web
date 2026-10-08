'use client';

import { useId, type ReactNode } from 'react';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { useModalDialog } from './useModalDialog';
import { cn } from '@/components/ui/cn';

/*
 * A modal with fish's screen header — an optional back chevron (a sub-view's way back), the title,
 * an «Închide» X — and an optional footer, on the kit's useModalDialog (top layer, focus containment,
 * Escape, focus return, page scroll lock). For a modal with sub-views or a full-screen phone
 * presentation, which Dialog / Sheet do not have (first used by the Concursuri search and filters).
 *
 *  - phone (<768): `fullScreen` fills the screen (fish CompetitionsSearchScreen, a full-screen
 *    Modal); otherwise an 85% bottom sheet (fish CompetitionFiltersSheet, snap 85%);
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
  return (
    <dialog
      {...dialog}
      aria-labelledby={titleId}
      className={cn(
        'max-w-none bg-surface p-0 text-ink shadow-e2 backdrop:bg-scrim open:flex open:flex-col',
        'transition-[opacity,translate,scale] duration-(--duration-slow) ease-slow',
        fullScreen
          ? 'max-md:fixed max-md:inset-0 max-md:m-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:translate-y-0 max-md:starting:translate-y-6 max-md:starting:opacity-0'
          : 'max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:m-0 max-md:h-[85dvh] max-md:max-h-none max-md:w-full max-md:rounded-t-card max-md:translate-y-0 max-md:starting:translate-y-full',
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
      <div className={cn('flex shrink-0 items-center gap-1 px-5 pt-3 pb-2', !fullScreen && 'border-b border-hairline pb-3')}>
        {back ? (
          <IconButton aria-label={back.label} onClick={back.onBack} className="-ml-3">
            <ChevronLeftIcon aria-hidden />
          </IconButton>
        ) : null}
        {/* The title steps as the kit hosts do: from 768 the kit Dialog's t-title2 for both; on the
            phone the full-screen search's screen title (t-title1), the filters' sheet t-heading. */}
        <h2 id={titleId} className={cn('min-w-0 flex-1 truncate', fullScreen ? 't-title1 md:t-title2' : 't-heading md:t-title2')}>
          {title}
        </h2>
        <IconButton aria-label="Închide" onClick={onClose} className="-mr-3">
          <XMarkIcon aria-hidden />
        </IconButton>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-5', bodyClassName)}>{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-hairline px-5 pt-3 pb-[max(var(--spacing)*4,env(safe-area-inset-bottom))]">{footer}</div>
      ) : null}
    </dialog>
  );
}
