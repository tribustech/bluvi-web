'use client';

import { useId, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { useModalDialog } from './useModalDialog';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Context line under the title (t-caption muted, same as SidePanel / Sheet subtitle). */
  subtitle?: ReactNode;
  description?: ReactNode;
  /** Buttons, right-aligned (stacked full width on mobile). Put the safe choice first. */
  actions?: ReactNode;
  children?: ReactNode;
  /** A destructive or blocking decision (anulare, penalizare): announced as an alert dialog. */
  alert?: boolean;
  /** Show an «Închide» X in the header (ignored for `alert`, which must be answered). */
  closeButton?: boolean;
  /** Keep the title for assistive tech only (the body shows its own, e.g. centred under an icon). */
  titleHidden?: boolean;
  /**
   * Long content (a form): the dialog fits the viewport, the body scrolls on its own and the actions
   * stay pinned under it behind a hairline — the submit never ends up below the fold.
   */
  scrollBody?: boolean;
  /** A long read: max 760 px (a ~720 px text column) instead of 480. */
  wide?: boolean;
  /** false: a click on the backdrop does not close it (Escape and the X still do). Default true. */
  backdropDismiss?: boolean;
  className?: string;
};

/** Centered modal, max 480px — confirmations and decisions (Fundații §07, elevation e2). */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  description,
  actions,
  children,
  alert,
  closeButton,
  titleHidden,
  scrollBody,
  wide,
  backdropDismiss = true,
  className,
}: Props) {
  const dialog = useModalDialog(open, onClose, { backdrop: backdropDismiss });
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      {...dialog}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        // text-left: a <dialog> inherits from where it is mounted (a centred header would centre it).
        'm-auto w-[calc(100%-32px)] rounded-card bg-surface p-0 text-left text-ink shadow-e2',
        wide ? 'max-w-[760px]' : 'max-w-[480px]',
        'backdrop:bg-scrim open:flex open:flex-col',
        scrollBody && 'max-h-[calc(100dvh-32px)] overflow-clip',
        'scale-100 opacity-100 transition-[opacity,scale] duration-(--duration-slow) ease-slow starting:scale-95 starting:opacity-0',
        className,
      )}
    >
      <div className={cn('flex flex-col gap-2 p-5', scrollBody && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
        <div className={cn('flex items-start gap-3', scrollBody && 'shrink-0')}>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={titleHidden ? 'sr-only' : 't-title2'}>
              {title}
            </h2>
            {subtitle ? <div className="t-caption text-muted">{subtitle}</div> : null}
          </div>
          {closeButton && !alert ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="-mt-2 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill"
            >
              <XMarkIcon className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
        {description ? (
          <div id={descId} className="t-body text-ink-2">
            {description}
          </div>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div
          className={cn(
            'flex flex-col-reverse gap-2 px-5 pb-5 md:flex-row md:justify-end',
            scrollBody && 'shrink-0 border-t border-hairline pt-3',
          )}
        >
          {actions}
        </div>
      ) : null}
    </dialog>
  );
}
