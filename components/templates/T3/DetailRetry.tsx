'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, type ButtonSize } from '@/components/ui/Button';

/**
 * «Încearcă din nou» (parity lakes.detail.c2 / c24, competition-page.shell) for a T3 page or section
 * that failed to read: the `action` of <DetailError> (pass `size="default"`: there it is the page's
 * one call to action) and of a section's ErrorState (the compact default, an inline row action). It re-renders the route on the server (`router.refresh()`), in a
 * transition, so the page keeps what it shows while the read runs again; meanwhile the button is
 * busy («Se încarcă…», aria-busy, not pressable twice) — the T1 ListError pattern.
 *
 * Busy is `aria-disabled`, never the native `disabled`: a disabled button drops keyboard focus to
 * <body>, which would throw a keyboard or screen-reader user back to the top of the page. When the
 * read succeeds this error (and the button) is replaced by the content; when it fails again the
 * button is still here, and a polite status says so («Tot nu s-a putut încărca.»).
 *
 * The refresh only re-reads when the failed read was not cached: a T3 page's reads must throw (or
 * return an error) outside any `'use cache'` scope — lib/server/public-get.ts already keeps error
 * answers for seconds only and never caches a network failure.
 */
export function DetailRetry({
  label = 'Încearcă din nou',
  failedAgain = 'Tot nu s-a putut încărca.',
  size = 'compact',
}: {
  label?: string;
  failedAgain?: string;
  size?: ButtonSize;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState('');
  const tried = useRef(false);

  useEffect(() => {
    // The transition ended and this error is still mounted: the read failed again.
    if (!pending && tried.current) setStatus(failedAgain);
  }, [pending, failedAgain]);

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        onClick={() => {
          if (pending) return;
          tried.current = true;
          setStatus('');
          start(() => router.refresh());
        }}
      >
        {pending ? 'Se încarcă…' : label}
      </Button>
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
}
