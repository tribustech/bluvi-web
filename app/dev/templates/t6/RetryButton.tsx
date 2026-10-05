'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';

/**
 * «Reîncearcă» that really retries: router.refresh() re-runs the server reads for the same URL
 * (same competition, same stand), keeping client state. Busy while the new payload streams in.
 *
 * Sized by where it sits: `compact` secondary (the default) is the inline action of a T4Notice
 * (ReadFailedNotice); as the only action of a gate (ErrorFlow's T4Gate) it takes the gate's
 * full action size (48 / 40) and weight, like the sign-in gate's «Intră în cont» — T4Gate's
 * action row stretches it full width below 768.
 *
 * A retry that works removes the gate or notice — and this button, which had focus. Focus then
 * moves to the step's h1 (#t6-title, tabIndex -1), so a keyboard or screen-reader user lands on
 * the loaded step and hears its title instead of being dropped on <body>. A retry that fails
 * re-renders the same gate in place: the button stays mounted and keeps focus.
 */
export function RetryButton({
  label = 'Reîncearcă',
  size = 'compact',
  variant = 'secondary',
}: {
  label?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const retried = useRef(false);
  useEffect(
    () => () => {
      if (!retried.current) return;
      // Unmounted by the new payload: the new step is committed by the time this timer runs.
      setTimeout(() => {
        // Only when focus was lost with the button — never take it from where the user moved it.
        const active = document.activeElement;
        if (active && active !== document.body) return;
        document.getElementById('t6-title')?.focus({ preventScroll: true });
      }, 0);
    },
    [],
  );
  return (
    <Button
      size={size}
      variant={variant}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() => {
        retried.current = true;
        start(() => router.refresh());
      }}
    >
      {pending ? 'Se reîncarcă…' : label}
    </Button>
  );
}
