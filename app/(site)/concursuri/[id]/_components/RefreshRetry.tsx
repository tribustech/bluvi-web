'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

/** «Reîncearcă» for an unread session: re-reads the page (the transition keeps it busy meanwhile). */
export function RefreshRetry() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="compact"
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) start(() => router.refresh());
      }}
    >
      {pending ? 'Se verifică…' : 'Reîncearcă'}
    </Button>
  );
}
