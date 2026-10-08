'use client';

import { useId, useState } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * c22 — «Motiv anulare: …» / «Motiv refuz: …» / «Neprezentare: …», clamped to two lines; past 90
 * characters a «vezi mai mult / vezi mai puțin» toggle (fish OperatorBookingRow.tsx:233-247). The
 * toggle sits above the card's open control (relative z-above), so it never opens the detail.
 */
export function ReasonLine({ label, text, long, className }: { label: string; text: string; long: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div data-testid="inbox-reason" className={cn('flex flex-col items-start gap-0.5', className)}>
      <p id={id} className={cn('t-caption break-words text-ink-2', !open && 'line-clamp-2')}>
        <span className="font-bold">{`${label}: `}</span>
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="relative z-above rounded-sm t-caption font-bold text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          {open ? 'vezi mai puțin' : 'vezi mai mult'}
        </button>
      ) : null}
    </div>
  );
}
