'use client';

import { useEffect, useId, useRef } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import type { T4FieldError } from './types';

type Props = {
  errors: T4FieldError[];
  /**
   * Changes on every failed «Continuă»: the summary takes focus again, so a keyboard / screen-reader
   * user lands on it (and a phone scrolls it into view) each time the step refuses to advance.
   */
  attempt: number;
  className?: string;
};

/**
 * Per-step error summary, at the top of the step after a refused «Continuă» (GOV.UK pattern; fish
 * focuses the first invalid field instead, which a long web page cannot rely on to be seen). Each
 * line links to its field and focuses it. Nothing renders while there are no errors.
 * Not a live region: focus lands on it and its aria-labelledby title is read once — an alert on
 * top would read it twice and race the fields' own messages. Same padding scale and 40px disc as
 * <T4Section> / <T4Notice>, so the step keeps one icon column and one text column.
 */
export function T4ErrorSummary({ errors, attempt, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (attempt > 0 && errors.length > 0) ref.current?.focus();
    // Only a new attempt moves focus; fixing a field while typing must not steal it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  if (errors.length === 0) return null;
  const title = errors.length === 1 ? 'Un câmp trebuie corectat' : `${errors.length} câmpuri trebuie corectate`;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      className={cn(
        'flex scroll-mt-40 gap-3 rounded-card bg-surface p-4 md:p-5 xl:p-6 shadow-[inset_0_0_0_1px_var(--color-status-danger-line)] outline-none focus-visible:outline-2 focus-visible:outline-accent xl:scroll-mt-24',
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
        <ExclamationCircleIcon aria-hidden className="size-6" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p id={titleId} className="t-body-strong text-ink">
          {title}
        </p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {errors.map((e) => (
            <li key={e.id} className="t-caption">
              <a
                href={`#${e.id}`}
                onClick={(ev) => {
                  const el = document.getElementById(e.id);
                  if (!el) return;
                  ev.preventDefault();
                  el.focus();
                  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}
                className="text-status-danger-fg underline decoration-1 underline-offset-2 hover:decoration-2"
              >
                {e.named ? e.message : `${e.label}: ${e.message}`}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
