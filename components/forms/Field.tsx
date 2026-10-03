import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export type FieldMessageProps = {
  /** Visible label (Fundații: label 12/700, ink-2). */
  label: string;
  /** Hint under the control; replaced by the error when there is one. */
  helper?: ReactNode;
  /** Error text — switches the control to the error state and is announced. */
  error?: ReactNode;
};

type Props = FieldMessageProps & {
  /** id of the control the label points at. */
  htmlFor: string;
  helperId: string;
  children: ReactNode;
  className?: string;
};

/** Label + control + helper/error stack shared by every form field. */
export function Field({ label, helper, error, htmlFor, helperId, children, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="t-label text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={helperId} role="alert" className="t-caption text-status-danger-fg">
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="t-caption text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Control shell: soft-fill at rest, surface + 2px accent border + 4px tint ring on focus,
 * danger tint + live border on error. Applied to the box that holds the input (and its suffix).
 */
export function controlShell(error: boolean, disabled?: boolean) {
  return cn(
    'flex h-11 items-center gap-2 rounded-control border-2 px-3 transition-[background-color,border-color,box-shadow] duration-(--duration-fast) ease-fast',
    error
      ? 'border-live bg-status-danger-bg/50'
      : 'border-transparent bg-soft-fill focus-within:border-accent focus-within:bg-surface focus-within:shadow-[0_0_0_4px_var(--color-accent-tint-2)]',
    disabled && 'opacity-50',
  );
}
