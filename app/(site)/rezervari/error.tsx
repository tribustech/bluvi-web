'use client';

import { useEffect, useTransition } from 'react';
import { ListError, TabsSkeleton } from '@/components/templates/T1';
import { CHROME, MyBookingsFrame } from './_components/frame';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS is
 * down or slow) — never a sign-in form for a user who may well be signed in (owner rule 4): the
 * page's frame with «Serverul nu răspunde» and «Încearcă din nou», which re-renders the gate.
 * Model: app/(site)/notificari/error.tsx.
 */
export default function MyBookingsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[rezervari]', error);
  }, [error]);
  return (
    <MyBookingsFrame
      chrome={
        <div className={CHROME}>
          <TabsSkeleton count={4} />
        </div>
      }
    >
      <ListError
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </MyBookingsFrame>
  );
}
