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
  className,
}: Props) {
  const dialog = useModalDialog(open, onClose);
  const titleId = useId();
  const descId = useId();
  return (
    <dialog
      {...dialog}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={cn(
        'm-auto w-[calc(100%-32px)] max-w-[480px] rounded-card bg-surface p-0 text-ink shadow-e2',
        'backdrop:bg-scrim open:flex open:flex-col',
        'scale-100 opacity-100 transition-[opacity,scale] duration-(--duration-slow) ease-slow starting:scale-95 starting:opacity-0',
        className,
      )}
    >
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="t-title2">
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
        <div className="flex flex-col-reverse gap-2 px-5 pb-5 md:flex-row md:justify-end">{actions}</div>
      ) : null}
    </dialog>
  );
}
