'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * The action of <DetailError> when the page failed because the session is dead (SESSION_DEAD /
 * 401 on an authed read — parity competition-page.shell): a retry can never succeed, so this
 * drops the dead session cookie (/api/auth/logout, as the top bar's «Deconectează-te») and goes
 * to sign-in (`signIn`, which returns here). Busy is `aria-disabled` (DetailRetry's pattern), so
 * focus stays on the button; if the sign-out call fails, sign-in still opens — it replaces the
 * cookie anyway.
 */
export function DetailSignInAgain({ signIn, label = 'Intră din nou' }: { signIn: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const working = pending || busy;
  return (
    <Button
      variant="secondary"
      aria-disabled={working || undefined}
      aria-busy={working || undefined}
      onClick={() => {
        if (working) return;
        setBusy(true);
        start(async () => {
          try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
          } catch {
            // Sign-in replaces the cookie anyway.
          }
          router.push(signIn);
        });
      }}
    >
      {working ? 'Se deconectează…' : label}
    </Button>
  );
}
