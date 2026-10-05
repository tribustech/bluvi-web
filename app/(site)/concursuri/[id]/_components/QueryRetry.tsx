'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonSize } from '@/components/ui/Button';

/**
 * «Încearcă din nou» for a client read (the T3 DetailRetry pattern, on a TanStack refetch instead
 * of a router refresh): busy while the read runs again («Se încarcă…», aria-busy, aria-disabled —
 * never the native `disabled`, which would drop keyboard focus), and when it fails again a polite
 * status says so («Tot nu s-a putut încărca.»), since the screen itself does not change.
 */
export function QueryRetry({
  fetching,
  failed,
  onRetry,
  size = 'default',
  label = 'Încearcă din nou',
}: {
  /** The read is running (TanStack `isFetching`). */
  fetching: boolean;
  /** The read has failed (still `isError`, or offline with nothing). */
  failed: boolean;
  onRetry: () => void;
  size?: ButtonSize;
  label?: string;
}) {
  const [status, setStatus] = useState('');
  const tried = useRef(false);
  const wasFetching = useRef(fetching);
  useEffect(() => {
    // A retry this button started has ended, and the read is still failing.
    if (wasFetching.current && !fetching && tried.current && failed) setStatus('Tot nu s-a putut încărca.');
    wasFetching.current = fetching;
  }, [fetching, failed]);
  return (
    <>
      <Button
        variant="secondary"
        size={size}
        aria-disabled={fetching || undefined}
        aria-busy={fetching || undefined}
        onClick={() => {
          if (fetching) return;
          tried.current = true;
          setStatus('');
          onRetry();
        }}
      >
        {fetching ? 'Se încarcă…' : label}
      </Button>
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
}
