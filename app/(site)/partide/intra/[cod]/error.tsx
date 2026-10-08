'use client';

import { useEffect, useTransition } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { T4Gate } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { JoinFrame } from './_confirm/JoinFrame';

/**
 * The session gate could not read the viewer (requireViewer → SessionUnknownError): never a
 * sign-in form for a viewer who may well be signed in (owner rule 4). The page's frame, T4Gate
 * danger «Serverul nu răspunde» and «Încearcă din nou», which re-renders the gate.
 */
export default function PartidaJoinCodeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.warn('[partide/intra/cod]', error);
  }, [error]);
  return (
    <JoinFrame variant="bare">
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationCircleIcon aria-hidden />}
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        actions={
          <Button aria-busy={pending || undefined} aria-disabled={pending || undefined} onClick={() => !pending && start(() => retry())}>
            {pending ? 'Se încarcă…' : 'Încearcă din nou'}
          </Button>
        }
      />
    </JoinFrame>
  );
}
