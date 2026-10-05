'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui/cn';
import { announce, prepareAnnouncer, restoreFocusTo } from './announce';

/**
 * The inline «Reîncearcă» of a per-user card whose stats read failed (Balta mea, Panou
 * organizator): the message is an alert, the retry re-renders the server blocks (router.refresh).
 * While it runs the control stays focusable (aria-disabled) and says so.
 *
 * Both outcomes are said (the RailError / ListError pattern): when the retry works the server render
 * swaps this block for the stats — focus would fall to <body> — so on unmount after a retry the
 * recovery is announced and focus goes to the card's heading link. When it fails again the block
 * stays: the alert is re-keyed with «Tot nu merge. Încercarea N.» so a screen reader hears it.
 */
export function RetryRefresh({ message, tone = 'surface', className }: { message: string; tone?: 'surface' | 'accent'; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [attempt, setAttempt] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const heading = useRef<HTMLElement | null>(null);
  // A refresh that settles (pending true → false) with this block still mounted failed again.
  const [wasPending, setWasPending] = useState(pending);
  if (wasPending !== pending) {
    setWasPending(pending);
    if (!pending) setAttempt((n) => n + 1);
  }

  useEffect(() => {
    prepareAnnouncer();
    return () => {
      if (!asked.current) return;
      announce('Datele au fost reîncărcate.');
      restoreFocusTo(heading.current);
    };
  }, []);

  return (
    <div ref={ref} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <p key={attempt} role="alert" className={cn('t-body', tone === 'accent' ? 'text-on-accent' : 'text-ink-2')}>
        {message}
        {attempt > 1 ? ` Tot nu merge. Încercarea ${attempt}.` : null}
      </p>
      <button
        type="button"
        aria-disabled={pending || undefined}
        onClick={() => {
          if (pending) return;
          asked.current = true;
          const section = ref.current?.closest('section');
          heading.current = section?.querySelector<HTMLElement>('h2 a, h3 a') ?? section?.querySelector<HTMLElement>('h2, h3') ?? null;
          start(() => router.refresh());
        }}
        className={cn(
          'relative z-above inline-flex min-h-11 items-center rounded-control t-body-strong hover:underline',
          tone === 'accent' ? 'text-on-accent underline underline-offset-2 focus-visible:outline-on-accent' : 'text-accent-ink'
        )}
      >
        {pending ? 'Se încarcă…' : 'Reîncearcă'}
      </button>
    </div>
  );
}
