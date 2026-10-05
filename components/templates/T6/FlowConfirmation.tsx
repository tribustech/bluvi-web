'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';

/**
 * The confirmation that closes a single task, in three distinct steps: the recorded value (a
 * SignatureNumber, no caption of its own), what and where (`caption`, body ink-2: «Crap · Sector C,
 * Stand 14» — the subject, not fine print), then the meta (`details`, caption muted). The success
 * mark sits above them. The step's h1 says what happened («Captură adăugată»); the next moves
 * («Adaugă încă una», «Înapoi la standuri») go in FlowLayout's `actions`, so they stay in the
 * thumb zone like every step.
 *
 * Announcing: one mechanism only. After a submit (`focusOnMount`) focus moves onto this block,
 * whose accessible name is the whole result («Captură adăugată: 4,250 kg Crap, Stand 14»); the
 * submit button that had focus is gone. Opened directly (a link, a demo state) nothing moves, so
 * the skip link and the top bar stay first in the tab order.
 *
 * Below 768 it fills the step (pair it with FlowLayout `fill`) and sits in its upper third (1 : 2
 * spacers), not the exact centre: the eye finds the number right under the header instead of
 * crossing a blank half screen, and the action bar still sits at the bottom.
 */
export function FlowConfirmation({
  label,
  value,
  caption,
  details,
  focusOnMount = false,
}: {
  /** The full result, read when focus lands here. */
  label: string;
  /** The recorded value, big (SignatureNumber size "count", without its caption). */
  value: ReactNode;
  /** What and where, under the value: «Crap · Sector C, Stand 14». */
  caption?: ReactNode;
  /** A quiet line under it («Demo: nimic nu a fost trimis»). */
  details?: ReactNode;
  focusOnMount?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-label={label}
      className="flex flex-1 flex-col items-center px-2 py-8 text-center outline-none md:flex-none md:py-12"
    >
      <span aria-hidden className="flex-1 md:hidden" />
      <div className="flex flex-col items-center gap-6">
        {/* T4Gate's success disc (56, the kit's 24px outline glyph), so «done» looks the same in every flow.
            TODO(kit): extract it from T4Gate as a shared StatusDisc (components/ui) — T4Gate and
            components/ui are outside the T6 folders. */}
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-full bg-status-success-bg text-status-success-fg transition-[scale,opacity] duration-(--duration-medium) ease-select starting:scale-75 starting:opacity-0"
        >
          <CheckIcon className="size-6" />
        </span>
        {/* The value and its caption are one group; the quieter details sit apart (16px). */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center">
            {value}
            {caption ? <p className="t-body mt-1 text-ink-2">{caption}</p> : null}
          </div>
          {details ? <div className="t-caption flex flex-col gap-1 text-muted">{details}</div> : null}
        </div>
      </div>
      <span aria-hidden className="flex-2 md:hidden" />
    </div>
  );
}
