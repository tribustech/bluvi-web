'use client';

import { useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button, ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { FRAME_H } from './_chat/ChatStates';

/**
 * The session could not be read (SessionUnknownError: a cookie, but the CMS is down or slow) — or
 * anything else on the chat page failed. Never a sign-in form for a viewer who may be signed in
 * (owner rule 4): «Serverul nu răspunde» with a retry and the way back to the competition.
 */
export default function ChatError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ id?: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[concursuri/chat]', error);
  }, [error]);
  return (
    <div className={`${FRAME_H} flex items-center justify-center bg-page px-4`}>
      <div role="alert" className="flex w-full max-w-120 flex-col items-center gap-3 rounded-card bg-surface px-5 py-8 text-center shadow-e0">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
          <ExclamationTriangleIcon className="size-6" />
        </span>
        <h1 className="t-title2 text-ink">Serverul nu răspunde</h1>
        <p className="t-body text-ink-2">Lucrăm la asta. Încearcă din nou în câteva minute.</p>
        <div className="mt-2 flex w-full flex-col gap-2.5 md:w-auto md:flex-row md:justify-center">
          <Button onClick={() => startRetry(() => retry())} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
          <ButtonLink variant="secondary" href={params?.id ? routes.competition(params.id) : routes.competitions()}>
            Înapoi la concurs
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
